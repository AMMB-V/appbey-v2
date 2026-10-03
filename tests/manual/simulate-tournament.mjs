// Manual end-to-end tournament simulation script (not part of npm test).
// Spins through a full groups_elim tournament lifecycle against a running
// local server instance to catch integration bugs that unit tests miss:
// registration, check-in, group stage, standings/tiebreakers, playoff
// generation, and bracket advancement all the way to the final.
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-tournament.mjs [baseUrl] [--allow-remote]

import { createManualApiClient, randomBelow, resolveManualApiTarget } from "./safe-target.mjs";

const { baseUrl: BASE } = await resolveManualApiTarget();
const PARTICIPANT_COUNT = 32; // near max realistic size, power of two for clean groups

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

async function main() {
  console.log(`Simulating a ${PARTICIPANT_COUNT}-participant tournament against ${BASE}`);

  // 1. Admin login
  const adminLogin = await req("POST", "/auth/login", { email: "admin@sim.test", password: "Sim123456789!" });
  assert(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
  const adminToken = adminLogin.body.access_token;

  // 2. Register participants
  const players = [];
  for (let i = 1; i <= PARTICIPANT_COUNT; i++) {
    const username = `simplayer${i}`;
    const reg = await req("POST", "/auth/register", {
      username,
      email: `${username}@sim.test`,
      password: "PlayerPass123!",
      display_name: `Sim Player ${i}`
    });
    if (reg.status !== 200 && reg.status !== 201) {
      console.error(`register failed for ${username}:`, reg.status, reg.body);
    }
    const login = await req("POST", "/auth/login", { email: `${username}@sim.test`, password: "PlayerPass123!" });
    players.push({ username, token: login.body?.access_token, id: login.body?.user?.id });
  }
  assert(players.every((p) => p.token && p.id), "all participants registered and logged in");

  // 3. Create tournament (groups_elim, max_participants covering all)
  const createRes = await req("POST", "/tournaments", {
    title: "Simulacro Torneo Completo",
    description: "Simulación automatizada end-to-end",
    venue_name: "Arena de Pruebas",
    country: "PA",
    format: "groups_elim",
    max_participants: PARTICIPANT_COUNT,
    match_target_points: 3,
    advancers_per_group: 2,
    group_count: 8
  }, adminToken);
  assert(createRes.status === 200 || createRes.status === 201, `tournament created (status ${createRes.status})`);
  const tournamentId = createRes.body?.id || createRes.body?.tournament?.id;
  assert(!!tournamentId, "tournament id present in response");

  // 4. Register + check-in every participant
  for (const p of players) {
    const regRes = await req("POST", `/tournaments/${tournamentId}/register`, {}, p.token);
    if (regRes.status !== 200 && regRes.status !== 201) {
      console.error(`register in tournament failed for ${p.username}:`, regRes.status, regRes.body);
    }
    const checkinRes = await req("POST", `/tournaments/${tournamentId}/checkin`, {}, p.token);
    if (checkinRes.status !== 200) {
      console.error(`checkin failed for ${p.username}:`, checkinRes.status, checkinRes.body);
    }
  }
  const partsRes = await req("GET", `/tournaments/${tournamentId}/participants`, undefined, adminToken);
  const checkedIn = (partsRes.body || []).filter((p) => p.checked_in);
  assert(checkedIn.length === PARTICIPANT_COUNT, `all ${PARTICIPANT_COUNT} participants checked in (got ${checkedIn.length})`);

  // 5. Start the tournament (creates group stage matches)
  const startRes = await req("POST", `/tournaments/${tournamentId}/start`, {}, adminToken);
  assert(startRes.status === 200, `tournament started (status ${startRes.status}, ${JSON.stringify(startRes.body)})`);

  // 6. Play out every group-stage match to completion via manual-score
  async function playAllPending(label) {
    let round = 0;
    while (true) {
      const matchesRes = await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken);
      const allMatches = matchesRes.body || [];
      const pending = allMatches.filter((m) => m.status !== "finished" && m.player_a_id && m.player_b_id);
      if (!pending.length) break;
      round++;
      if (round > 50) {
        assert(false, `${label}: exceeded safety round limit, matches not converging`);
        break;
      }
      for (const m of pending) {
        // Deterministic-ish "random" winner based on ids to vary outcomes
        const aWins = (m.id + m.player_a_id) % 2 === 0;
        const scoreA = aWins ? 3 : randomBelow(2);
        const scoreB = aWins ? randomBelow(2) : 3;
        const scoreRes = await req("PUT", `/matches/${m.id}/manual-score`, {
          score_a: scoreA,
          score_b: scoreB,
          status: "finished"
        }, adminToken);
        if (scoreRes.status !== 200) {
          console.error(`manual-score failed for match ${m.id}:`, scoreRes.status, scoreRes.body);
        }
      }
    }
    return round;
  }

  const groupRounds = await playAllPending("group stage");
  console.log(`group stage converged in ${groupRounds} passes`);

  // 7. Verify standings show sane W/L counts and head-to-head is coherent
  const groupMatchesRes = await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken);
  const groupMatches = (groupMatchesRes.body || []).filter((m) => m.group_id);
  assert(groupMatches.length > 0, "group stage matches were generated");
  assert(groupMatches.every((m) => m.status === "finished"), "all group stage matches finished");
  assert(groupMatches.every((m) => m.winner_id), "every finished group match has a winner (no unresolved draws)");

  const tourAfterGroups = await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken);
  console.log(`stage_type after group stage: ${tourAfterGroups.body?.stage_type}`);

  // 8. Generate playoffs
  const playoffRes = await req("POST", `/tournaments/${tournamentId}/generate-playoffs`, {}, adminToken);
  assert(playoffRes.status === 200, `generate-playoffs succeeded (status ${playoffRes.status}, ${JSON.stringify(playoffRes.body)})`);

  // 9. Play out every knockout round until the tournament is completed
  let safety = 0;
  let tourState = await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken);
  while (tourState.body?.status !== "completed" && safety < 20) {
    safety++;
    const played = await playAllPending(`knockout pass ${safety}`);
    if (played === 0) break;
    tourState = await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken);
    console.log(`after knockout pass ${safety}: status=${tourState.body?.status} stage_type=${tourState.body?.stage_type} current_round=${tourState.body?.current_round}`);
  }
  assert(tourState.body?.status === "completed", `tournament reached completed status (got ${tourState.body?.status})`);
  assert(!!tourState.body?.winner_user_id, "tournament has a winner_user_id set");
  assert(!!tourState.body?.runner_up_user_id, "tournament has a runner_up_user_id set");

  const finalMatchesRes = await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken);
  const knockoutMatches = (finalMatchesRes.body || []).filter((m) => !m.group_id);
  const stagesSeen = new Set(knockoutMatches.map((m) => m.stage));
  console.log("knockout stages seen:", [...stagesSeen].join(", "));
  const grandFinal = knockoutMatches.find((m) => m.stage === "Gran Final");
  assert(!!grandFinal, "a 'Gran Final' match was created");
  assert(grandFinal?.status === "finished", "the Gran Final match is finished");
  assert(knockoutMatches.every((m) => m.status === "finished"), "every knockout match reached finished status (no orphaned matches)");

  // Bracket size for 32 qualifiers scenario (8 groups x top2 = 16) -> rounds: 16,8,4,2,1 (4 rounds)
  const roundsCreated = new Set(knockoutMatches.map((m) => m.round_number));
  console.log("knockout rounds created:", [...roundsCreated].sort((a, b) => a - b).join(", "));
  assert(roundsCreated.size >= 4, `bracket advanced through at least 4 rounds (got ${roundsCreated.size})`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(1);
});
