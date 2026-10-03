// Manual simulation for removing a participant mid-tournament
// (DELETE /tournaments/:id/participants/:userId), covering:
//   A. A pending single_elim match with BOTH players known -> removing one
//      should auto-forfeit the match to the opponent (not leave it stuck).
//   B. A bracket match where the opponent slot is still TBD (waiting on a
//      sibling match) -> removing the already-placed player should vacate
//      that slot and mark it walkover_pending; once the sibling match
//      resolves, the new opponent should auto-win by walkover instead of
//      the tournament getting stuck.
//   C. Removing a groups_elim participant with a still-pending group match
//      should auto-forfeit that match to their group opponent, so
//      generate-playoffs can proceed once the rest of the group finishes.
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-participant-removal.mjs [baseUrl] [--allow-remote]

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

async function finishMatch(matchId, token, scoreA, scoreB) {
  return req("PUT", `/matches/${matchId}/manual-score`, { score_a: scoreA, score_b: scoreB, status: "finished" }, token);
}

async function main() {
  console.log(`Simulating participant removal edge cases against ${BASE}`);

  const adminLogin = await req("POST", "/auth/login", { email: "admin@sim.test", password: "Sim123456789!" });
  assert(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
  const adminToken = adminLogin.body.access_token;

  // ---------------------------------------------------------------
  // Scenario A + B: 4-player single_elim bracket.
  //   Round 1: semi1 (p1 vs p2), semi2 (p3 vs p4)
  //   Round 2: final (winner semi1 vs winner semi2)
  // ---------------------------------------------------------------
  const players = [];
  for (let i = 1; i <= 4; i++) players.push(await registerAndLogin(`rm${SUFFIX}_${i}`));
  assert(players.every((p) => p.token && p.id), "all 4 bracket participants registered and logged in");

  const createRes = await req("POST", "/tournaments", {
    title: `Simulacro Remocion Bracket ${SUFFIX}`,
    format: "single_elim",
    max_participants: 4,
    match_target_points: 3,
    venue_name: "Arena de Pruebas",
    country: "PA"
  }, adminToken);
  const tournamentId = createRes.body?.id;
  assert(createRes.status === 200 && !!tournamentId, `bracket tournament created (status ${createRes.status})`);

  for (const p of players) {
    await req("POST", `/tournaments/${tournamentId}/register`, {}, p.token);
    await req("POST", `/tournaments/${tournamentId}/checkin`, {}, p.token);
  }
  const startRes = await req("POST", `/tournaments/${tournamentId}/start`, {}, adminToken);
  assert(startRes.status === 200, `bracket tournament started (status ${startRes.status}, ${JSON.stringify(startRes.body)})`);

  let allMatches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body;
  const round1 = allMatches.filter((m) => m.round_number === 1);
  assert(round1.length === 2, `round 1 has 2 semifinal matches (got ${round1.length})`);
  const semi1 = round1[0];
  const semi2 = round1[1];

  // Scenario A: remove one of semi2's players BEFORE it's played. Both
  // players are known, so the opponent should auto-win by walkover.
  const semi2LoserByRemoval = semi2.player_a_id;
  const semi2Survivor = semi2.player_b_id;
  const removeA = await req("DELETE", `/tournaments/${tournamentId}/participants/${semi2LoserByRemoval}`, undefined, adminToken);
  assert(removeA.status === 200, `removing semi2 player_a succeeds (status ${removeA.status}, ${JSON.stringify(removeA.body)})`);

  allMatches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body;
  const semi2After = allMatches.find((m) => m.id === semi2.id);
  assert(semi2After.status === "finished" && semi2After.winner_id === semi2Survivor, `semi2 auto-forfeited to the remaining player (status ${semi2After.status}, winner ${semi2After.winner_id})`);

  // Scenario B: finish semi1 normally so its winner is placed into the final.
  const semi1FinishRes = await finishMatch(semi1.id, adminToken, 3, 0);
  assert(semi1FinishRes.status === 200, `semi1 finished normally (status ${semi1FinishRes.status})`);
  allMatches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body;
  const semi1After = allMatches.find((m) => m.id === semi1.id);
  const semi1Winner = semi1After.winner_id;

  const finalMatch = allMatches.find((m) => m.round_number === 2);
  assert(!!finalMatch, "final match was created after both semifinals resolved (one played, one forfeited)");
  assert(finalMatch.player_b_id === semi2Survivor || finalMatch.player_a_id === semi2Survivor, "the semi2 walkover survivor was placed into the final");

  // Now remove the semi1 winner BEFORE the final started -> should mark the
  // final's slot walkover_pending and clear it, since we can't know the
  // eventual opponent (already known here actually, so it should ALSO auto
  // forfeit immediately since both slots are already known at this point).
  const removeFinalist = await req("DELETE", `/tournaments/${tournamentId}/participants/${semi1Winner}`, undefined, adminToken);
  assert(removeFinalist.status === 200, `removing the finalist succeeds (status ${removeFinalist.status}, ${JSON.stringify(removeFinalist.body)})`);

  allMatches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body;
  const finalAfter = allMatches.find((m) => m.round_number === 2);
  assert(finalAfter.status === "finished" && finalAfter.winner_id === semi2Survivor, `final auto-forfeited to the remaining finalist (status ${finalAfter.status}, winner ${finalAfter.winner_id})`);

  const tournamentAfter = (await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken)).body;
  assert(tournamentAfter.status === "completed" && tournamentAfter.winner_user_id === semi2Survivor, `tournament completed with the walkover survivor as champion (status ${tournamentAfter.status}, winner ${tournamentAfter.winner_user_id})`);

  // ---------------------------------------------------------------
  // Scenario B2: reproduce the TBD-opponent-slot case specifically, where
  // the withdrawal happens while the sibling semifinal hasn't finished yet.
  // ---------------------------------------------------------------
  const players2 = [];
  for (let i = 1; i <= 4; i++) players2.push(await registerAndLogin(`rm2${SUFFIX}_${i}`));
  const createRes2 = await req("POST", "/tournaments", {
    title: `Simulacro Remocion TBD ${SUFFIX}`,
    format: "single_elim",
    max_participants: 4,
    match_target_points: 3,
    venue_name: "Arena de Pruebas",
    country: "PA"
  }, adminToken);
  const tournamentId2 = createRes2.body?.id;
  assert(createRes2.status === 200 && !!tournamentId2, `second bracket tournament created (status ${createRes2.status})`);
  for (const p of players2) {
    await req("POST", `/tournaments/${tournamentId2}/register`, {}, p.token);
    await req("POST", `/tournaments/${tournamentId2}/checkin`, {}, p.token);
  }
  await req("POST", `/tournaments/${tournamentId2}/start`, {}, adminToken);

  let matches2 = (await req("GET", `/tournaments/${tournamentId2}/matches`, undefined, adminToken)).body;
  const semiA = matches2.filter((m) => m.round_number === 1)[0];
  const semiB = matches2.filter((m) => m.round_number === 1)[1];

  // Finish semiA so its winner is placed into the final; semiB is still pending (opponent TBD from the final's perspective).
  await finishMatch(semiA.id, adminToken, 3, 0);
  matches2 = (await req("GET", `/tournaments/${tournamentId2}/matches`, undefined, adminToken)).body;
  const semiAWinner = matches2.find((m) => m.id === semiA.id).winner_id;
  const finalMatch2 = matches2.find((m) => m.round_number === 2);
  assert(!!finalMatch2 && (finalMatch2.player_a_id === semiAWinner || finalMatch2.player_b_id === semiAWinner), "final's first slot filled by semiA's winner while semiB is still undecided");

  // Remove the semiA winner NOW, while the final's other slot is still TBD (semiB not finished).
  const removeEarlyFinalist = await req("DELETE", `/tournaments/${tournamentId2}/participants/${semiAWinner}`, undefined, adminToken);
  assert(removeEarlyFinalist.status === 200, `removing the early finalist succeeds (status ${removeEarlyFinalist.status}, ${JSON.stringify(removeEarlyFinalist.body)})`);

  matches2 = (await req("GET", `/tournaments/${tournamentId2}/matches`, undefined, adminToken)).body;
  const finalAfterRemoval = matches2.find((m) => m.round_number === 2);
  assert(finalAfterRemoval.status !== "finished", `final is NOT finished yet since semiB hasn't resolved (status ${finalAfterRemoval.status})`);
  assert(finalAfterRemoval.player_a_id !== semiAWinner && finalAfterRemoval.player_b_id !== semiAWinner, "the withdrawn finalist's slot was cleared from the final");

  // Now finish semiB -> its winner should be placed in the final and
  // immediately win by walkover since the other slot is permanently vacant.
  const semiBWinnerCandidate = semiB.player_a_id;
  await finishMatch(semiB.id, adminToken, 3, 0);
  matches2 = (await req("GET", `/tournaments/${tournamentId2}/matches`, undefined, adminToken)).body;
  const finalAfterSemiB = matches2.find((m) => m.round_number === 2);
  assert(finalAfterSemiB.status === "finished" && finalAfterSemiB.winner_id === semiBWinnerCandidate, `final auto-resolved by walkover once semiB's winner filled the vacant slot (status ${finalAfterSemiB.status}, winner ${finalAfterSemiB.winner_id})`);

  const tournament2After = (await req("GET", `/tournaments/${tournamentId2}`, undefined, adminToken)).body;
  assert(tournament2After.status === "completed" && tournament2After.winner_user_id === semiBWinnerCandidate, `second tournament completed with semiB's winner as champion by walkover (status ${tournament2After.status})`);

  // ---------------------------------------------------------------
  // Scenario C: groups_elim mid-group removal should auto-forfeit the
  // pending group match so generate-playoffs isn't blocked.
  // ---------------------------------------------------------------
  const groupPlayers = [];
  for (let i = 1; i <= 4; i++) groupPlayers.push(await registerAndLogin(`grp${SUFFIX}_${i}`));
  const createRes3 = await req("POST", "/tournaments", {
    title: `Simulacro Remocion Grupos ${SUFFIX}`,
    format: "groups_elim",
    max_participants: 4,
    group_count: 2,
    advancers_per_group: 2,
    match_target_points: 3,
    venue_name: "Arena de Pruebas",
    country: "PA"
  }, adminToken);
  const tournamentId3 = createRes3.body?.id;
  assert(createRes3.status === 200 && !!tournamentId3, `groups tournament created (status ${createRes3.status}, ${JSON.stringify(createRes3.body)})`);
  for (const p of groupPlayers) {
    await req("POST", `/tournaments/${tournamentId3}/register`, {}, p.token);
    await req("POST", `/tournaments/${tournamentId3}/checkin`, {}, p.token);
  }
  const start3 = await req("POST", `/tournaments/${tournamentId3}/start`, {}, adminToken);
  assert(start3.status === 200, `groups tournament started (status ${start3.status}, ${JSON.stringify(start3.body)})`);

  let matches3 = (await req("GET", `/tournaments/${tournamentId3}/matches`, undefined, adminToken)).body;
  const groupMatches = matches3.filter((m) => m.group_id);
  assert(groupMatches.length > 0, `group stage generated matches (got ${groupMatches.length})`);

  // Finish all but one group match, then remove a player from the last pending one.
  for (let i = 0; i < groupMatches.length - 1; i++) {
    await finishMatch(groupMatches[i].id, adminToken, 3, 0);
  }
  const lastPending = groupMatches[groupMatches.length - 1];
  const victimUserId = lastPending.player_a_id;
  const opponentUserId = lastPending.player_b_id;
  const removeGroupPlayer = await req("DELETE", `/tournaments/${tournamentId3}/participants/${victimUserId}`, undefined, adminToken);
  assert(removeGroupPlayer.status === 200, `removing a mid-group participant succeeds (status ${removeGroupPlayer.status}, ${JSON.stringify(removeGroupPlayer.body)})`);

  matches3 = (await req("GET", `/tournaments/${tournamentId3}/matches`, undefined, adminToken)).body;
  const lastPendingAfter = matches3.find((m) => m.id === lastPending.id);
  assert(lastPendingAfter.status === "finished" && lastPendingAfter.winner_id === opponentUserId, `last pending group match auto-forfeited to the remaining opponent (status ${lastPendingAfter.status}, winner ${lastPendingAfter.winner_id})`);

  const allGroupMatchesFinished = matches3.filter((m) => m.group_id).every((m) => m.status === "finished");
  assert(allGroupMatchesFinished, "every group stage match is now finished after the forfeit (generate-playoffs is no longer blocked)");

  const playoffsRes = await req("POST", `/tournaments/${tournamentId3}/generate-playoffs`, {}, adminToken);
  assert(playoffsRes.status === 200, `generate-playoffs succeeds after the forfeit resolved the last pending match (status ${playoffsRes.status}, ${JSON.stringify(playoffsRes.body)})`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(1);
});
