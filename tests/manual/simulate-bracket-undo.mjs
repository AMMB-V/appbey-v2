// Manual simulation focused on the bracket-consistency fixes for
// reopen / undo-finish / target-points on knockout matches:
//   1. Reopening/undoing a finished match whose winner already started or
//      finished the next round match must be BLOCKED (400), not silently
//      leave a stale winner in the next match.
//   2. Reopening/undoing a finished match whose winner's next match hasn't
//      started yet must clear that player from the next match's slot.
//   3. undo-finish on a best-of-3 elimination match must only unwind the
//      currently open set, not re-sum points across all closed sets.
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-bracket-undo.mjs [baseUrl] [--allow-remote]

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

async function main() {
  console.log(`Simulating bracket-undo edge cases against ${BASE}`);

  const adminLogin = await req("POST", "/auth/login", { email: "admin@sim.test", password: "Sim123456789!" });
  assert(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
  const adminToken = adminLogin.body.access_token;

  // 4-player single_elim: semis (round 1) -> final (round 2)
  const players = [];
  for (let i = 1; i <= 4; i++) players.push(await registerAndLogin(`bu${SUFFIX}_${i}`));
  assert(players.every((p) => p.token && p.id), "all 4 participants registered and logged in");

  const createRes = await req("POST", "/tournaments", {
    title: `Simulacro Undo Bracket ${SUFFIX}`,
    format: "single_elim",
    max_participants: 4,
    match_target_points: 3,
    venue_name: "Arena de Pruebas",
    country: "PA"
  }, adminToken);
  const tournamentId = createRes.body?.id;
  assert(createRes.status === 200 && !!tournamentId, `tournament created (status ${createRes.status})`);

  for (const p of players) {
    await req("POST", `/tournaments/${tournamentId}/register`, {}, p.token);
    await req("POST", `/tournaments/${tournamentId}/checkin`, {}, p.token);
  }
  const startRes = await req("POST", `/tournaments/${tournamentId}/start`, {}, adminToken);
  assert(startRes.status === 200, `tournament started (status ${startRes.status}, ${JSON.stringify(startRes.body)})`);

  const round1 = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body
    .filter((m) => m.round_number === 1);
  assert(round1.length === 2, `round 1 has 2 semifinal matches (got ${round1.length})`);

  // Finish semifinal 1 -> winner should appear in round 2
  const semi1 = round1[0];
  await req("PUT", `/matches/${semi1.id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken);

  let matches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body;
  const semi1After = matches.find((m) => m.id === semi1.id);
  const round2 = matches.filter((m) => m.round_number === 2);
  assert(round2.length === 1, "round 2 (final) match was created after first semifinal finished");
  const finalMatch = round2[0];
  const semi1Winner = semi1After.winner_id;
  const slotHasWinner = finalMatch.player_a_id === semi1Winner || finalMatch.player_b_id === semi1Winner;
  assert(slotHasWinner, "semifinal 1 winner was placed into the final match");

  // Case A: final hasn't started yet -> reopening semi1 should be ALLOWED
  // and should clear the winner from the final's slot. (undo-finish isn't
  // applicable here because manual-score sets a result without recording
  // matchGames "asaltos" to undo — that's expected, separate behavior.)
  const undoRes = await req("POST", `/matches/${semi1.id}/reopen`, {}, adminToken);
  assert(undoRes.status === 200, `reopen allowed while final has not started (status ${undoRes.status}, ${JSON.stringify(undoRes.body)})`);
  assert(!JSON.stringify(undoRes.body).includes("password_hash"), "match response does not expose user password hashes");
  matches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body;
  const finalAfterUndo = matches.find((m) => m.id === finalMatch.id);
  const slotCleared = finalAfterUndo.player_a_id !== semi1Winner && finalAfterUndo.player_b_id !== semi1Winner;
  assert(slotCleared, "final match slot was cleared after reopening the semifinal that fed it");

  // Re-finish semi1 the same way to get back to a consistent state
  await req("PUT", `/matches/${semi1.id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken);
  await req("PUT", `/matches/${round1[1].id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken);

  matches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body;
  const finalReady = matches.find((m) => m.round_number === 2);
  assert(finalReady.player_a_id && finalReady.player_b_id, "final match has both players once both semifinals finished");

  // Case B: start the final (record a point), then try to reopen semi1 ->
  // must be BLOCKED because the final already has progress.
  await req("POST", `/matches/${finalReady.id}/record-finish`, { finish_type: "spin_finish_1p", awarded_to: "player_a" }, adminToken);
  const reopenRes = await req("POST", `/matches/${semi1.id}/reopen`, {}, adminToken);
  assert(reopenRes.status === 400, `reopening semi1 is blocked once the final has started (status ${reopenRes.status}, ${JSON.stringify(reopenRes.body)})`);

  // Finish the final and confirm the tournament completes
  await req("PUT", `/matches/${finalReady.id}/manual-score`, { score_a: 3, score_b: 0, status: "finished" }, adminToken);
  const tourState = (await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken)).body;
  assert(tourState.status === "completed", `tournament completed after the final (got ${tourState.status})`);

  // Case C: reopening the completed Gran Final itself should revert the
  // tournament back to in_progress instead of leaving stale winner/status.
  const reopenFinalRes = await req("POST", `/matches/${finalReady.id}/reopen`, {}, adminToken);
  assert(reopenFinalRes.status === 200, `Gran Final can be reopened (status ${reopenFinalRes.status})`);
  const tourStateAfterReopen = (await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken)).body;
  assert(tourStateAfterReopen.status === "in_progress", `tournament reverted to in_progress after reopening the Gran Final (got ${tourStateAfterReopen.status})`);
  assert(tourStateAfterReopen.winner_user_id === null, "winner_user_id cleared after reopening the Gran Final");

  // --- Best-of-3 elimination undo-finish scoping (Case D) ---
  // Set up a fresh 2-player single_elim tournament with target 21 (so a single
  // set closes at 21, matching a realistic elimination scenario), and record
  // enough games to close set 1 for player A, then start set 2 and undo one
  // point in set 2 — the recomputed score must reflect ONLY set 2's games.
  const duoA = await registerAndLogin(`du${SUFFIX}_a`);
  const duoB = await registerAndLogin(`du${SUFFIX}_b`);
  const duoCreate = await req("POST", "/tournaments", {
    title: `Simulacro Sets Undo ${SUFFIX}`,
    format: "single_elim",
    max_participants: 2,
    match_target_points: 3,
    venue_name: "Arena de Pruebas",
    country: "PA"
  }, adminToken);
  const duoId = duoCreate.body?.id;
  await req("POST", `/tournaments/${duoId}/register`, {}, duoA.token);
  await req("POST", `/tournaments/${duoId}/register`, {}, duoB.token);
  await req("POST", `/tournaments/${duoId}/checkin`, {}, duoA.token);
  await req("POST", `/tournaments/${duoId}/checkin`, {}, duoB.token);
  await req("POST", `/tournaments/${duoId}/start`, {}, adminToken);
  const duoMatch = (await req("GET", `/tournaments/${duoId}/matches`, undefined, adminToken)).body[0];

  // Close set 1 for player A with an xtreme finish (3p) reaching target 3.
  await req("POST", `/matches/${duoMatch.id}/record-finish`, { finish_type: "xtreme_finish_3p", awarded_to: "player_a" }, adminToken);
  // Start set 2: player B scores 1 point (spin finish).
  await req("POST", `/matches/${duoMatch.id}/record-finish`, { finish_type: "spin_finish_1p", awarded_to: "player_b" }, adminToken);

  let duoState = (await req("GET", `/matches/${duoMatch.id}`, undefined, adminToken)).body;
  assert(duoState.sets_won_a === 1 && duoState.sets_won_b === 0, `set 1 closed for player A (sets_won_a=${duoState.sets_won_a}, sets_won_b=${duoState.sets_won_b})`);
  assert(duoState.score_a === 0 && duoState.score_b === 1, `set 2 in progress with correct scoped score (score_a=${duoState.score_a}, score_b=${duoState.score_b})`);

  // Undo the last point (set 2's only point) -> set 2 should go back to 0-0,
  // and set 1 (already closed) must remain untouched at sets_won_a=1.
  const undoDuo = await req("POST", `/matches/${duoMatch.id}/undo-finish`, {}, adminToken);
  assert(undoDuo.status === 200, `undo-finish succeeds on the open set (status ${undoDuo.status})`);
  duoState = (await req("GET", `/matches/${duoMatch.id}`, undefined, adminToken)).body;
  assert(duoState.sets_won_a === 1 && duoState.sets_won_b === 0, `set 1 result preserved after undoing a point in set 2 (sets_won_a=${duoState.sets_won_a}, sets_won_b=${duoState.sets_won_b})`);
  assert(duoState.score_a === 0 && duoState.score_b === 0, `set 2 score correctly reverted to 0-0, not summed across sets (score_a=${duoState.score_a}, score_b=${duoState.score_b})`);
  assert(duoState.status === "in_progress", `match remains in_progress mid-series (got ${duoState.status})`);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(1);
});
