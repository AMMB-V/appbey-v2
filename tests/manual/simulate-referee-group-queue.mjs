// End-to-end simulation of the "one referee per group" arbitration flow.
//
// Reproduces the real-world complaint: a single referee ends up working an
// entire group phase by hand. This script drives the new
// GET /tournaments/:id/referee/groups and GET /tournaments/:id/referee/queue
// endpoints exactly like the referee pad UI does: pick a group, take the
// top-recommended match from its queue, resolve it, refetch, repeat -- and
// asserts that no blader is ever recommended twice in a row unless every
// remaining pending match in the group unavoidably repeats someone (flagged
// forced_repeat), and that the group listing itself empties out once done.
//
// Usage: npm run build, then node tests/manual/simulate-referee-group-queue.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const ADMIN_EMAIL = "admin@sim.test";
const ADMIN_PASSWORD = "Sim123456789!";
const PLAYER_PASSWORD = "PlayerPass123!";
const PARTICIPANT_COUNT = 16;
const GROUP_COUNT = 4;

let appProcess;
let failures = 0;

function assertOk(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok: ${msg}`);
  }
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(url, processHandle) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error("AppBey test server exited before becoming ready.");
    try {
      const response = await fetch(`${url}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("AppBey test server did not become ready.");
}

function makeReq(baseUrl) {
  return async function req(method, url, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, body: json };
  };
}

async function main() {
  const appPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${appPort}/api/v1`;

  appProcess = spawn(process.execPath, ["dist/server.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      DATABASE_URL: "",
      NODE_ENV: "development",
      APPBEY_DEMO_DATA: "true",
      APPBEY_ADMIN_EMAIL: ADMIN_EMAIL,
      APPBEY_ADMIN_PASSWORD: ADMIN_PASSWORD
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let serverErrors = "";
  appProcess.stderr.setEncoding("utf8");
  appProcess.stderr.on("data", (chunk) => { serverErrors += chunk; });

  try {
    await waitForServer(`http://127.0.0.1:${appPort}`, appProcess);
    const req = makeReq(baseUrl);

    const adminLogin = await req("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    assertOk(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
    const adminToken = adminLogin.body.access_token;

    // Register + log in every player.
    const players = [];
    for (let i = 1; i <= PARTICIPANT_COUNT; i++) {
      const username = `refq${i}`;
      await req("POST", "/auth/register", {
        username,
        email: `${username}@sim.test`,
        password: PLAYER_PASSWORD,
        display_name: `Ref Queue Player ${i}`
      });
      const login = await req("POST", "/auth/login", { email: `${username}@sim.test`, password: PLAYER_PASSWORD });
      players.push({ username, token: login.body?.access_token, id: login.body?.user?.id });
    }
    assertOk(players.every((p) => p.token && p.id), "all participants registered and logged in");

    // Create a groups_elim tournament with multiple groups so the group
    // selector in the referee lobby has more than one "mesa" to choose from.
    const createRes = await req("POST", "/tournaments", {
      title: "Simulacro Cola de Arbitraje por Grupos",
      description: "Valida que ningun jugador repita rival dos veces seguidas salvo obligatorio",
      venue_name: "Arena de Pruebas",
      country: "PA",
      format: "groups_elim",
      max_participants: PARTICIPANT_COUNT,
      match_target_points: 3,
      advancers_per_group: 2,
      group_count: GROUP_COUNT
    }, adminToken);
    assertOk(createRes.status === 200 || createRes.status === 201, `tournament created (status ${createRes.status})`);
    const tournamentId = createRes.body?.id || createRes.body?.tournament?.id;
    assertOk(!!tournamentId, "tournament id present in response");

    for (const p of players) {
      await req("POST", `/tournaments/${tournamentId}/register`, {}, p.token);
      await req("POST", `/tournaments/${tournamentId}/checkin`, {}, p.token);
    }
    const partsRes = await req("GET", `/tournaments/${tournamentId}/participants`, undefined, adminToken);
    const checkedIn = (partsRes.body || []).filter((p) => p.checked_in);
    assertOk(checkedIn.length === PARTICIPANT_COUNT, `all ${PARTICIPANT_COUNT} participants checked in (got ${checkedIn.length})`);

    const startRes = await req("POST", `/tournaments/${tournamentId}/start`, {}, adminToken);
    assertOk(startRes.status === 200, `tournament started (status ${startRes.status}, ${JSON.stringify(startRes.body)})`);

    // Referee lobby step 1: groups listing should show every group with pending combats.
    const groupsRes = await req("GET", `/tournaments/${tournamentId}/referee/groups`, undefined, adminToken);
    assertOk(groupsRes.status === 200, "referee/groups endpoint responds 200");
    const groups = groupsRes.body?.groups || [];
    assertOk(groups.length === GROUP_COUNT, `referee/groups lists all ${GROUP_COUNT} groups (got ${groups.length})`);
    assertOk(groups.every((g) => !!g.group_id && g.pending_count > 0), "every listed group has a letter id and pending combats");

    // Referee lobby step 2+3: for each group, walk its queue end-to-end like
    // a single referee dedicated to that mesa would, verifying anti-repeat.
    let totalForcedRepeats = 0;
    let totalMatchesPlayed = 0;
    for (const group of groups) {
      let lastPlayers = null;
      let safety = 0;
      while (true) {
        safety++;
        if (safety > PARTICIPANT_COUNT * 4) {
          assertOk(false, `group ${group.group_id}: queue did not converge (possible infinite loop)`);
          break;
        }
        const queueRes = await req("GET", `/tournaments/${tournamentId}/referee/queue?group=${group.group_id}`, undefined, adminToken);
        assertOk(queueRes.status === 200, `group ${group.group_id}: queue endpoint responds 200`);
        const queue = queueRes.body?.matches || [];
        if (!queue.length) break;

        const next = queue[0];
        const nextPlayers = new Set([next.player_a_id, next.player_b_id]);
        if (lastPlayers) {
          const repeats = [...nextPlayers].some((id) => lastPlayers.has(id));
          if (repeats) {
            assertOk(next.forced_repeat === true, `group ${group.group_id}: repeated player at match ${next.id} is correctly flagged forced_repeat`);
            totalForcedRepeats++;
          } else {
            assertOk(next.forced_repeat === false, `group ${group.group_id}: non-repeating match ${next.id} is not flagged forced_repeat`);
          }
        } else {
          assertOk(next.forced_repeat === false, `group ${group.group_id}: first recommended match has no forced repeat`);
        }

        const aWins = (next.id + next.player_a_id) % 2 === 0;
        const scoreRes = await req("PUT", `/matches/${next.id}/manual-score`, {
          score_a: aWins ? 3 : 1,
          score_b: aWins ? 1 : 3,
          status: "finished"
        }, adminToken);
        assertOk(scoreRes.status === 200, `group ${group.group_id}: match ${next.id} resolved via manual-score`);

        lastPlayers = nextPlayers;
        totalMatchesPlayed++;
      }
    }
    assertOk(totalMatchesPlayed > 0, "at least one match was played through the referee queue");
    console.log(`Total matches played through referee queues: ${totalMatchesPlayed}, forced repeats: ${totalForcedRepeats}`);

    // Once every group is fully resolved, the group selector should have
    // nothing left to show (no dangling pending/in-progress combats).
    const groupsAfterRes = await req("GET", `/tournaments/${tournamentId}/referee/groups`, undefined, adminToken);
    assertOk((groupsAfterRes.body?.groups || []).length === 0, "referee/groups is empty once all group-stage combats are finished");

    const allMatchesRes = await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken);
    const groupMatches = (allMatchesRes.body || []).filter((m) => m.group_id);
    assertOk(groupMatches.length > 0 && groupMatches.every((m) => m.status === "finished"), "all group-stage matches finished via the referee queue flow");
  } finally {
    if (appProcess && appProcess.exitCode === null) {
      appProcess.kill();
    }
  }

  if (failures > 0 && serverErrors) {
    console.error("Server stderr output:\n" + serverErrors);
  }

  console.log(failures === 0 ? "\nAll referee group-queue checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Simulation crashed:", error);
  if (appProcess && appProcess.exitCode === null) appProcess.kill();
  process.exit(1);
});
