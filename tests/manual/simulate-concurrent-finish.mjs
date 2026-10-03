// Manual simulation for two referees (or a network retry / double click)
// finishing the SAME match at nearly the same time. Since Node is
// single-threaded, concurrent HTTP requests to the same synchronous handler
// never truly interleave -- but the *second* call still needs to see a
// consistent, already-finished match and not corrupt state. This validates:
//   A. Two concurrent manual-score calls declaring the SAME winner only
//      apply ELO once (no double-counting from a duplicate submission).
//   B. Two concurrent declare-winner calls with the SAME winner only apply
//      ELO once and don't push duplicate matchGames.
//   C. record-finish called again after the match is already finished AND
//      its winner has already advanced to a started next match is BLOCKED
//      (doesn't silently leave the next round with a stale opponent).
//   D. manual-score attempting to flip the winner of an already-finished,
//      already-advanced match is BLOCKED for the same reason.
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-concurrent-finish.mjs [baseUrl] [--allow-remote]
// Remote targets must also be listed in APPBEY_TEST_ALLOWED_HOSTS and use in-memory storage.


import { createChecks, createManualApiClient, createRegisterAndLogin, resolveManualApiTarget } from "./safe-target.mjs";

const { baseUrl: BASE } = await resolveManualApiTarget();
const SUFFIX = Date.now().toString(36).slice(-5);

const checks = createChecks();
const { assert } = checks;

const req = createManualApiClient(BASE);

const registerAndLogin = createRegisterAndLogin(req);

async function getUserElo(userId, adminToken) {
  const res = await req("GET", `/users/${userId}`, undefined, adminToken);
  return res.body?.elo_rating;
}

async function main() {
  console.log("Simulating concurrent referee finish edge cases.");

  const adminLogin = await req("POST", "/auth/login", { email: "admin@sim.test", password: "Sim123456789!" });
  assert(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
  const adminToken = adminLogin.body.access_token;

  // ---------------------------------------------------------------
  // Scenario A: two concurrent manual-score calls with the SAME winner
  // should only apply ELO once.
  // ---------------------------------------------------------------
  const playersA = [];
  for (let i = 1; i <= 2; i++) playersA.push(await registerAndLogin(`ccA${SUFFIX}_${i}`));
  const t1 = await req("POST", "/tournaments", {
    title: `Simulacro Concurrencia A ${SUFFIX}`, format: "single_elim", max_participants: 2,
    match_target_points: 3, venue_name: "Arena de Pruebas", country: "PA"
  }, adminToken);
  const t1Id = t1.body?.id;
  assert(t1.status === 200 && !!t1Id, `tournament A created (status ${t1.status})`);
  for (const p of playersA) {
    await req("POST", `/tournaments/${t1Id}/register`, {}, p.token);
    await req("POST", `/tournaments/${t1Id}/checkin`, {}, p.token);
  }
  await req("POST", `/tournaments/${t1Id}/start`, {}, adminToken);
  let matchesA = (await req("GET", `/tournaments/${t1Id}/matches`, undefined, adminToken)).body;
  const matchA = matchesA[0];

  const eloBeforeA = { a: await getUserElo(matchA.player_a_id, adminToken), b: await getUserElo(matchA.player_b_id, adminToken) };

  // Fire both "finish" requests back-to-back (simulating two referees
  // pressing the button within moments of each other) before awaiting either.
  const [r1, r2] = await Promise.all([
    req("PUT", `/matches/${matchA.id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken),
    req("PUT", `/matches/${matchA.id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken)
  ]);
  assert(r1.status === 200 && r2.status === 200, "both concurrent manual-score calls succeed");

  const eloAfterA = { a: await getUserElo(matchA.player_a_id, adminToken), b: await getUserElo(matchA.player_b_id, adminToken) };
  const expectedDeltaA = Math.round(32 * (1.0 - 1.0 / (1.0 + Math.pow(10, (eloBeforeA.b - eloBeforeA.a) / 400.0))));
  assert(eloAfterA.a === eloBeforeA.a + expectedDeltaA, "winner's ELO only increased once despite 2 concurrent finish calls");

  const gamesA = (await req("GET", `/matches/${matchA.id}`, undefined, adminToken)).body.games;
  assert(gamesA.length === 0, "manual-score doesn't push duplicate matchGames on double submission");

  // A third, later, re-submission of the identical result should also be a no-op.
  const r3 = await req("PUT", `/matches/${matchA.id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken);
  assert(r3.status === 200, "a third identical re-submission still succeeds as a no-op");
  const eloAfterA3 = { a: await getUserElo(matchA.player_a_id, adminToken) };
  assert(eloAfterA3.a === eloAfterA.a, "a third identical re-submission does not change ELO further");

  // ---------------------------------------------------------------
  // Scenario B: two concurrent declare-winner calls with the SAME winner.
  // ---------------------------------------------------------------
  const playersB = [];
  for (let i = 1; i <= 2; i++) playersB.push(await registerAndLogin(`ccB${SUFFIX}_${i}`));
  const t2 = await req("POST", "/tournaments", {
    title: `Simulacro Concurrencia B ${SUFFIX}`, format: "single_elim", max_participants: 2,
    match_target_points: 3, venue_name: "Arena de Pruebas", country: "PA"
  }, adminToken);
  const t2Id = t2.body?.id;
  for (const p of playersB) {
    await req("POST", `/tournaments/${t2Id}/register`, {}, p.token);
    await req("POST", `/tournaments/${t2Id}/checkin`, {}, p.token);
  }
  await req("POST", `/tournaments/${t2Id}/start`, {}, adminToken);
  let matchesB = (await req("GET", `/tournaments/${t2Id}/matches`, undefined, adminToken)).body;
  const matchB = matchesB[0];
  const declaredWinner = matchB.player_a_id;

  const eloBeforeB = await getUserElo(declaredWinner, adminToken);
  const [rb1, rb2] = await Promise.all([
    req("POST", `/matches/${matchB.id}/declare-winner`, { winner_id: declaredWinner }, adminToken),
    req("POST", `/matches/${matchB.id}/declare-winner`, { winner_id: declaredWinner }, adminToken)
  ]);
  assert(rb1.status === 200 && rb2.status === 200, "both concurrent declare-winner calls succeed");
  const eloAfterB = await getUserElo(declaredWinner, adminToken);
  assert(eloAfterB > eloBeforeB, "declared winner's ELO increased");

  const gamesB = (await req("GET", `/matches/${matchB.id}`, undefined, adminToken)).body.games;
  assert(gamesB.length === 1, "declare-winner only recorded ONE matchGame despite 2 concurrent calls");

  // ---------------------------------------------------------------
  // Scenario C + D: 4-player bracket. Finish both semis, then attempt a
  // duplicate/late "finish" submission on a semifinal AFTER the final has
  // already started -- must be blocked, not silently desync the bracket.
  // ---------------------------------------------------------------
  const playersC = [];
  for (let i = 1; i <= 4; i++) playersC.push(await registerAndLogin(`ccC${SUFFIX}_${i}`));
  const t3 = await req("POST", "/tournaments", {
    title: `Simulacro Concurrencia C ${SUFFIX}`, format: "single_elim", max_participants: 4,
    match_target_points: 3, venue_name: "Arena de Pruebas", country: "PA"
  }, adminToken);
  const t3Id = t3.body?.id;
  for (const p of playersC) {
    await req("POST", `/tournaments/${t3Id}/register`, {}, p.token);
    await req("POST", `/tournaments/${t3Id}/checkin`, {}, p.token);
  }
  await req("POST", `/tournaments/${t3Id}/start`, {}, adminToken);
  let matchesC = (await req("GET", `/tournaments/${t3Id}/matches`, undefined, adminToken)).body;
  const round1C = matchesC.filter((m) => m.round_number === 1);
  const semi1C = round1C[0];
  const semi2C = round1C[1];

  await req("PUT", `/matches/${semi1C.id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken);
  await req("PUT", `/matches/${semi2C.id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken);

  matchesC = (await req("GET", `/tournaments/${t3Id}/matches`, undefined, adminToken)).body;
  const finalC = matchesC.find((m) => m.round_number === 2);
  assert(!!finalC && finalC.player_a_id && finalC.player_b_id, "final has both finalists once both semifinals are finished");

  // Start the final (any score change puts it in_progress / gives it "progress").
  await req("PUT", `/matches/${finalC.id}/manual-score`, { score_a: 1, score_b: 0 }, adminToken);

  // A late/duplicate finish attempt on semi1 (e.g. a delayed second request
  // from another referee) trying to flip the winner must now be rejected.
  const semi1After = matchesC.find((m) => m.id === semi1C.id);
  const otherPlayer = semi1After.player_a_id === semi1After.winner_id ? semi1After.player_b_id : semi1After.player_a_id;
  const lateFlip = await req("PUT", `/matches/${semi1C.id}/manual-score`, { score_a: 0, score_b: 3, winner_id: otherPlayer, status: "finished" }, adminToken);
  assert(lateFlip.status === 400, "late duplicate finish is blocked once the final has started");

  // A late duplicate record-finish reactivation attempt must also be blocked.
  const lateRecordFinish = await req("POST", `/matches/${semi1C.id}/record-finish`, { finish_type: "spin_finish_1p", awarded_to: "player_b" }, adminToken);
  assert(lateRecordFinish.status === 400, "late duplicate record-finish reactivation is blocked once the final has started");

  const finalStillIntact = (await req("GET", `/matches/${finalC.id}`, undefined, adminToken)).body;
  assert(finalStillIntact.player_a_id === finalC.player_a_id && finalStillIntact.player_b_id === finalC.player_b_id, "final's slots remained untouched after the blocked late submissions");

  console.log(checks.failures === 0 ? "\nALL CHECKS PASSED" : `\n${checks.failures} CHECK(S) FAILED`);
  process.exit(checks.failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation failed.");
  process.exit(1);
});
