// Manual simulation for the Swiss pairing engine (pairSwissRound):
//   1. No two players should ever face each other twice (rematch avoidance),
//      unless it becomes mathematically unavoidable.
//   2. No player should receive more than one bye in the same tournament
//      while there are still players who haven't had one.
//   3. Round-1 pairings, next-round pairings and tournament completion
//      (winner/runner-up/third place) should all work end to end.
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-swiss.mjs [baseUrl] [--allow-remote]

import { createManualApiClient, resolveManualApiTarget } from "./safe-target.mjs";

const { baseUrl: BASE } = await resolveManualApiTarget();
const SUFFIX = Date.now().toString(36).slice(-5);

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok: ${msg}`);
  }
}

const req = createManualApiClient(BASE);

async function registerAndLogin(username) {
  await req("POST", "/auth/register", {
    username,
    email: `${username}@sim.test`,
    password: "PlayerPass123!",
    display_name: username
  });
  const login = await req("POST", "/auth/login", { email: `${username}@sim.test`, password: "PlayerPass123!" });
  return { username, token: login.body?.access_token, id: login.body?.user?.id };
}

function pairKey(a, b) {
  return [a, b].sort((x, y) => x - y).join("-");
}

async function finishMatch(m, token, winnerId) {
  const isA = m.player_a_id === winnerId;
  await req("PUT", `/matches/${m.id}/manual-score`, {
    score_a: isA ? 4 : 1,
    score_b: isA ? 1 : 4,
    status: "finished"
  }, token);
}

async function main() {
  console.log(`Simulating Swiss pairing edge cases against ${BASE}`);

  const adminLogin = await req("POST", "/auth/login", { email: "admin@sim.test", password: "Sim123456789!" });
  assert(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
  const adminToken = adminLogin.body.access_token;

  // 7 players (odd count) forces a bye every round -> best stress test for
  // both rematch avoidance and bye rotation.
  const PLAYER_COUNT = 7;
  const players = [];
  for (let i = 1; i <= PLAYER_COUNT; i++) players.push(await registerAndLogin(`sw${SUFFIX}_${i}`));
  assert(players.every((p) => p.token && p.id), `all ${PLAYER_COUNT} participants registered and logged in`);

  const createRes = await req("POST", "/tournaments", {
    title: `Simulacro Swiss ${SUFFIX}`,
    format: "swiss",
    max_participants: PLAYER_COUNT,
    total_rounds: 4,
    match_target_points: 4,
    venue_name: "Arena de Pruebas",
    country: "PA"
  }, adminToken);
  const tournamentId = createRes.body?.id;
  assert(createRes.status === 200 && !!tournamentId, `tournament created (status ${createRes.status}, ${JSON.stringify(createRes.body)})`);

  for (const p of players) {
    await req("POST", `/tournaments/${tournamentId}/register`, {}, p.token);
    await req("POST", `/tournaments/${tournamentId}/checkin`, {}, p.token);
  }
  const startRes = await req("POST", `/tournaments/${tournamentId}/start`, {}, adminToken);
  assert(startRes.status === 200, `tournament started (status ${startRes.status}, ${JSON.stringify(startRes.body)})`);

  const seenPairs = new Set();
  const byeCount = new Map();
  let forcedRematches = 0;
  const totalRounds = 4;

  for (let round = 1; round <= totalRounds; round++) {
    const allMatches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body;
    const roundMatches = allMatches.filter((m) => m.round_number === round);
    assert(roundMatches.length === Math.ceil(PLAYER_COUNT / 2), `round ${round} has ${Math.ceil(PLAYER_COUNT / 2)} matches (got ${roundMatches.length})`);

    for (const m of roundMatches) {
      if (m.is_bye) {
        byeCount.set(m.player_a_id, (byeCount.get(m.player_a_id) || 0) + 1);
        continue;
      }
      const key = pairKey(m.player_a_id, m.player_b_id);
      if (seenPairs.has(key)) forcedRematches++;
      seenPairs.add(key);
    }

    // Finish every non-bye match, deterministically favoring player_a.
    for (const m of roundMatches) {
      if (m.is_bye || m.status === "finished") continue;
      await finishMatch(m, adminToken, m.player_a_id);
    }

    if (round < totalRounds) {
      const nextRes = await req("POST", `/tournaments/${tournamentId}/next-round`, {}, adminToken);
      assert(nextRes.status === 200, `advanced from round ${round} to ${round + 1} (status ${nextRes.status}, ${JSON.stringify(nextRes.body)})`);
    }
  }

  assert(forcedRematches === 0, `no rematches occurred across ${totalRounds} rounds with ${PLAYER_COUNT} players (forced rematches: ${forcedRematches})`);

  const maxByes = Math.max(0, ...[...byeCount.values()]);
  assert(maxByes <= 1, `no player received more than one bye before everyone had a turn (max byes for one player: ${maxByes})`);
  const distinctByePlayers = byeCount.size;
  assert(distinctByePlayers >= Math.min(totalRounds, PLAYER_COUNT), `byes were rotated among distinct players (${distinctByePlayers} distinct players got a bye across ${totalRounds} rounds)`);

  // Finish the tournament (round 4 -> completed)
  const finishRes = await req("POST", `/tournaments/${tournamentId}/next-round`, {}, adminToken);
  assert(finishRes.status === 200 && /finalizado/i.test(finishRes.body?.message || ""), `tournament completed after final round (status ${finishRes.status}, ${JSON.stringify(finishRes.body)})`);

  const finalTournament = (await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken)).body;
  assert(finalTournament.status === "completed", `tournament status is completed (got ${finalTournament.status})`);
  assert(!!finalTournament.winner_user_id, "tournament has a winner_user_id assigned");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(1);
});
