// Manual simulation focused on pure single_elim tournaments with an odd
// participant count so that round 1 must include byes. Validates the fix
// where byes created directly in /start now call advanceSingleElimination
// so the advancing player is placed into round 2 instead of getting stuck.
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-single-elim-byes.mjs [baseUrl] [--allow-remote]

import { createChecks, createManualApiClient, randomBelow, resolveManualApiTarget } from "./safe-target.mjs";

const { baseUrl: BASE } = await resolveManualApiTarget();
const PARTICIPANT_COUNT = 24; // not a power of two -> bracketSize 32, 8 byes in round 1
const SUFFIX = Date.now().toString(36).slice(-5); // keep usernames within the 20-char limit

const checks = createChecks();
const { assert } = checks;

const req = createManualApiClient(BASE);

async function main() {
  console.log(`Simulating a ${PARTICIPANT_COUNT}-participant pure single_elim tournament (with byes) against ${BASE}`);

  const adminLogin = await req("POST", "/auth/login", { email: "admin@sim.test", password: "Sim123456789!" });
  assert(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
  const adminToken = adminLogin.body.access_token;

  const players = [];
  for (let i = 1; i <= PARTICIPANT_COUNT; i++) {
    const username = `bp${SUFFIX}_${i}`;
    await req("POST", "/auth/register", {
      username,
      email: `${username}@sim.test`,
      password: "PlayerPass123!",
      display_name: `Bye Player ${i}`
    });
    const login = await req("POST", "/auth/login", { email: `${username}@sim.test`, password: "PlayerPass123!" });
    players.push({ username, token: login.body?.access_token, id: login.body?.user?.id });
  }
  assert(players.every((p) => p.token && p.id), "all participants registered and logged in");

  const createRes = await req("POST", "/tournaments", {
    title: `Simulacro Single Elim Byes ${SUFFIX}`,
    description: "Simulación de bracket de eliminación simple con byes",
    venue_name: "Arena de Pruebas",
    country: "PA",
    format: "single_elim",
    max_participants: PARTICIPANT_COUNT,
    match_target_points: 3
  }, adminToken);
  assert(createRes.status === 200 || createRes.status === 201, `tournament created (status ${createRes.status}, ${JSON.stringify(createRes.body)})`);
  const tournamentId = createRes.body?.id;
  assert(!!tournamentId, "tournament id present in response");

  for (const p of players) {
    await req("POST", `/tournaments/${tournamentId}/register`, {}, p.token);
    await req("POST", `/tournaments/${tournamentId}/checkin`, {}, p.token);
  }
  const partsRes = await req("GET", `/tournaments/${tournamentId}/participants`, undefined, adminToken);
  const checkedIn = (partsRes.body || []).filter((p) => p.checked_in);
  assert(checkedIn.length === PARTICIPANT_COUNT, `all ${PARTICIPANT_COUNT} participants checked in (got ${checkedIn.length})`);

  const startRes = await req("POST", `/tournaments/${tournamentId}/start`, {}, adminToken);
  assert(startRes.status === 200, `tournament started (status ${startRes.status}, ${JSON.stringify(startRes.body)})`);

  // Right after start, round-1 byes should already have propagated their
  // winner into round 2 (this is the behavior we just fixed).
  const matchesAfterStart = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body || [];
  const round1 = matchesAfterStart.filter((m) => m.round_number === 1);
  const round1Byes = round1.filter((m) => m.is_bye);
  const round2 = matchesAfterStart.filter((m) => m.round_number === 2);
  console.log(`round 1 matches: ${round1.length} (byes: ${round1Byes.length}), round 2 matches present right after start: ${round2.length}`);
  assert(round1Byes.length > 0, "round 1 contains byes for a non-power-of-two participant count");
  const byeWinnersInRound2 = round1Byes.filter((bye) =>
    round2.some((m) => m.player_a_id === bye.winner_id || m.player_b_id === bye.winner_id)
  );
  assert(byeWinnersInRound2.length === round1Byes.length,
    `every round-1 bye winner (${round1Byes.length}) was already placed into a round-2 match immediately after /start (found ${byeWinnersInRound2.length})`);

  async function playAllPending() {
    let round = 0;
    while (true) {
      const allMatches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body || [];
      const pending = allMatches.filter((m) => m.status !== "finished" && m.player_a_id && m.player_b_id);
      if (!pending.length) break;
      round++;
      if (round > 50) {
        assert(false, "exceeded safety round limit, matches not converging");
        break;
      }
      for (const m of pending) {
        const aWins = (m.id + m.player_a_id) % 2 === 0;
        const scoreA = aWins ? 3 : randomBelow(2);
        const scoreB = aWins ? randomBelow(2) : 3;
        await req("PUT", `/matches/${m.id}/manual-score`, { score_a: scoreA, score_b: scoreB, status: "finished" }, adminToken);
      }
    }
    return round;
  }

  const passes = await playAllPending();
  console.log(`bracket converged in ${passes} passes`);

  const tourState = (await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken)).body;
  assert(tourState?.status === "completed", `tournament reached completed status (got ${tourState?.status})`);
  assert(!!tourState?.winner_user_id, "tournament has a winner_user_id set");
  assert(!!tourState?.runner_up_user_id, "tournament has a runner_up_user_id set");

  const finalMatches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body || [];
  assert(finalMatches.every((m) => m.status === "finished"), "every match in the bracket reached finished status (no bye left stuck)");
  const roundsCreated = new Set(finalMatches.map((m) => m.round_number));
  console.log("rounds created:", [...roundsCreated].sort((a, b) => a - b).join(", "));
  assert(roundsCreated.size === 5, `bracket of 32 slots created all 5 rounds (got ${roundsCreated.size})`);

  console.log(`\n${checks.failures === 0 ? "ALL CHECKS PASSED" : `${checks.failures} CHECK(S) FAILED`}`);
  process.exit(checks.failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(1);
});
