// Manual simulation for round_robin tournaments. Verifies the bug fixed in
// recalcTournamentStats/advanceSingleElimination: previously round_robin never
// computed group_rank/tie-breaks (the standings block only ran for
// "groups_elim") and never auto-completed (advanceSingleElimination only
// handles single_elim/knockout), so a round_robin tournament could never
// finish or declare a winner, and its standings table always showed zeros.
//
// This script covers:
//   1. A 4-player round robin engineered so two pairs tie on
//      victories/losses AND point difference, forcing the head-to-head
//      tie-break to decide both pairs' final rank.
//   2. Automatic tournament completion (status "completed",
//      winner/runner_up/third_place assigned from final standings) once every
//      match is finished, with no explicit "generate playoffs" step (which
//      round_robin does not support).
//   3. A 3-player round robin including a real draw, verifying
//      matches_drawn/group_matches_drawn are counted and standings still
//      resolve (falling back to seed when even head-to-head ties).
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-round-robin.mjs [baseUrl]

const BASE = process.argv[2] || "http://localhost:3999/api";
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

async function req(method, url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: json };
}

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

async function playMatch(m, adminToken, scoreA, scoreB) {
  const res = await req("PUT", `/matches/${m.id}/manual-score`, {
    score_a: scoreA,
    score_b: scoreB,
    status: "finished"
  }, adminToken);
  return res;
}

async function createRoundRobin(adminToken, title, players) {
  const createRes = await req("POST", "/tournaments", {
    title,
    format: "round_robin",
    max_participants: players.length,
    match_target_points: 4,
    venue_name: "Arena de Pruebas",
    country: "PA"
  }, adminToken);
  const tournamentId = createRes.body?.id;
  if (!tournamentId) throw new Error(`tournament creation failed: ${JSON.stringify(createRes.body)}`);

  for (const p of players) {
    await req("POST", `/tournaments/${tournamentId}/register`, {}, p.token);
    await req("POST", `/tournaments/${tournamentId}/checkin`, {}, p.token);
  }
  const startRes = await req("POST", `/tournaments/${tournamentId}/start`, {}, adminToken);
  if (startRes.status !== 200) throw new Error(`start failed: ${JSON.stringify(startRes.body)}`);
  return tournamentId;
}

async function main() {
  console.log(`Simulating round_robin tie-breaks & completion against ${BASE}`);

  const adminLogin = await req("POST", "/auth/login", { email: "admin@sim.test", password: "Sim123456789!" });
  assert(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
  const adminToken = adminLogin.body.access_token;

  // --- Scenario A: 4 players, head-to-head decides two tied pairs ---
  const A = [];
  for (let i = 1; i <= 4; i++) A.push(await registerAndLogin(`rrA${SUFFIX}_${i}`));
  assert(A.every((p) => p.token && p.id), "scenario A: all 4 participants registered");
  const [p1, p2, p3, p4] = A;

  const tIdA = await createRoundRobin(adminToken, `Round Robin H2H ${SUFFIX}`, A);
  assert(!!tIdA, `scenario A: tournament ${tIdA} started`);

  const matchesA = (await req("GET", `/tournaments/${tIdA}/matches`, undefined, adminToken)).body;
  assert(matchesA.length === 6, `scenario A: 6 matches generated for 4 players (got ${matchesA.length})`);

  const findMatch = (list, aId, bId) => list.find((m) =>
    (m.player_a_id === aId && m.player_b_id === bId) || (m.player_a_id === bId && m.player_b_id === aId)
  );
  const playAgainst = async (list, aId, bId, scoreForA) => {
    const m = findMatch(list, aId, bId);
    if (!m) throw new Error(`match not found for ${aId} vs ${bId}`);
    const isAFirst = m.player_a_id === aId;
    return playMatch(m, adminToken, isAFirst ? scoreForA[0] : scoreForA[1], isAFirst ? scoreForA[1] : scoreForA[0]);
  };

  // P1 beats P2 4-1, P1 beats P3 4-1, P1 loses to P4 1-4
  // P2 beats P3 4-1, P2 beats P4 4-1
  // P3 beats P4 4-1
  // => P1: won2 lost1 (scored 9 conceded 6, diff +3)
  //    P2: won2 lost1 (scored 9 conceded 6, diff +3) -> tied with P1 on both criteria, decided by H2H (P1 beat P2)
  //    P3: won1 lost2 (scored 6 conceded 9, diff -3)
  //    P4: won1 lost2 (scored 6 conceded 9, diff -3) -> tied with P3 on both criteria, decided by H2H (P3 beat P4)
  const r1 = await playAgainst(matchesA, p1.id, p2.id, [4, 1]);
  const r2 = await playAgainst(matchesA, p1.id, p3.id, [4, 1]);
  const r3 = await playAgainst(matchesA, p1.id, p4.id, [1, 4]);
  const r4 = await playAgainst(matchesA, p2.id, p3.id, [4, 1]);
  const r5 = await playAgainst(matchesA, p2.id, p4.id, [4, 1]);
  const r6 = await playAgainst(matchesA, p3.id, p4.id, [4, 1]);
  assert([r1, r2, r3, r4, r5, r6].every((r) => r.status === 200), "scenario A: all 6 matches recorded successfully");

  const finalA = (await req("GET", `/tournaments/${tIdA}`, undefined, adminToken)).body;
  assert(finalA.status === "completed", `scenario A: tournament auto-completed once all matches finished (got ${finalA.status})`);
  assert(finalA.winner_user_id === p1.id, `scenario A: winner is P1 via head-to-head tie-break (got ${finalA.winner_user_id}, expected ${p1.id})`);
  assert(finalA.runner_up_user_id === p2.id, `scenario A: runner-up is P2 (got ${finalA.runner_up_user_id}, expected ${p2.id})`);
  assert(finalA.third_place_user_id === p3.id, `scenario A: third place is P3 via head-to-head over P4 (got ${finalA.third_place_user_id}, expected ${p3.id})`);

  const partsA = (await req("GET", `/tournaments/${tIdA}/participants`, undefined, adminToken)).body;
  const rankOf = (id) => partsA.find((p) => p.user_id === id)?.group_rank;
  assert(rankOf(p1.id) === 1, `scenario A: P1 group_rank is 1 (got ${rankOf(p1.id)})`);
  assert(rankOf(p2.id) === 2, `scenario A: P2 group_rank is 2 (got ${rankOf(p2.id)})`);
  assert(rankOf(p3.id) === 3, `scenario A: P3 group_rank is 3 (got ${rankOf(p3.id)})`);
  assert(rankOf(p4.id) === 4, `scenario A: P4 group_rank is 4 (got ${rankOf(p4.id)})`);

  // --- Scenario B: 3 players, one real draw ---
  const B = [];
  for (let i = 1; i <= 3; i++) B.push(await registerAndLogin(`rrB${SUFFIX}_${i}`));
  const [q1, q2, q3] = B;
  const tIdB = await createRoundRobin(adminToken, `Round Robin Draw ${SUFFIX}`, B);
  const matchesB = (await req("GET", `/tournaments/${tIdB}/matches`, undefined, adminToken)).body;
  assert(matchesB.length === 3, `scenario B: 3 matches generated for 3 players (got ${matchesB.length})`);

  const findMatchB = (aId, bId) => matchesB.find((m) =>
    (m.player_a_id === aId && m.player_b_id === bId) || (m.player_a_id === bId && m.player_b_id === aId)
  );
  const playAgainstB = async (aId, bId, scoreForA) => {
    const m = findMatchB(aId, bId);
    const isAFirst = m.player_a_id === aId;
    return playMatch(m, adminToken, isAFirst ? scoreForA[0] : scoreForA[1], isAFirst ? scoreForA[1] : scoreForA[0]);
  };

  // Q1 draws Q2 2-2, Q1 beats Q3 4-1, Q2 beats Q3 4-1
  const d1 = await playAgainstB(q1.id, q2.id, [2, 2]);
  const d2 = await playAgainstB(q1.id, q3.id, [4, 1]);
  const d3 = await playAgainstB(q2.id, q3.id, [4, 1]);
  assert([d1, d2, d3].every((r) => r.status === 200), "scenario B: all 3 matches recorded successfully");
  assert(d1.body?.winner_id === null || d1.body?.winner_id === undefined, "scenario B: drawn match has no winner_id");

  const finalB = (await req("GET", `/tournaments/${tIdB}`, undefined, adminToken)).body;
  assert(finalB.status === "completed", `scenario B: tournament auto-completed (got ${finalB.status})`);
  assert([q1.id, q2.id].includes(finalB.winner_user_id), `scenario B: winner is Q1 or Q2 (top two, tied on everything down to seed) (got ${finalB.winner_user_id})`);
  assert(finalB.third_place_user_id === q3.id, `scenario B: third place is Q3, the only player with 2 losses (got ${finalB.third_place_user_id})`);

  const partsB = (await req("GET", `/tournaments/${tIdB}/participants`, undefined, adminToken)).body;
  const q1p = partsB.find((p) => p.user_id === q1.id);
  const q2p = partsB.find((p) => p.user_id === q2.id);
  assert(q1p.matches_drawn === 1 && q1p.group_matches_drawn === 1, `scenario B: Q1 has 1 recorded draw (matches_drawn=${q1p.matches_drawn}, group_matches_drawn=${q1p.group_matches_drawn})`);
  assert(q2p.matches_drawn === 1 && q2p.group_matches_drawn === 1, `scenario B: Q2 has 1 recorded draw (matches_drawn=${q2p.matches_drawn}, group_matches_drawn=${q2p.group_matches_drawn})`);
  assert(rankOfB(q3.id) === 3, `scenario B: Q3 ranked last (rank ${rankOfB(q3.id)})`);

  function rankOfB(id) {
    return partsB.find((p) => p.user_id === id)?.group_rank;
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(1);
});
