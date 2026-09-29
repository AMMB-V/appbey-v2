// Manual simulation for groups_elim tournaments where the number of
// qualifiers is not a power of two, forcing byes in the very first
// generate-playoffs bracket. Confirms byes there still propagate correctly
// end-to-end (this path already called advanceSingleElimination before this
// session, but we validate it keeps working alongside the other fixes).
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-groups-elim-byes.mjs [baseUrl]

const BASE = process.argv[2] || "http://localhost:3999/api";
const PARTICIPANT_COUNT = 29; // uneven -> some groups of 4, some of 5; 7 groups x top2 = 14 qualifiers -> bracketSize 16, 2 byes
const GROUP_COUNT = 7;
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

async function main() {
  console.log(`Simulating a ${PARTICIPANT_COUNT}-participant groups_elim tournament (${GROUP_COUNT} groups, playoff byes expected) against ${BASE}`);

  const adminLogin = await req("POST", "/auth/login", { email: "admin@sim.test", password: "Sim123456789!" });
  assert(adminLogin.status === 200 && adminLogin.body?.access_token, "admin login succeeds");
  const adminToken = adminLogin.body.access_token;

  const players = [];
  for (let i = 1; i <= PARTICIPANT_COUNT; i++) {
    const username = `gp${SUFFIX}_${i}`;
    await req("POST", "/auth/register", {
      username,
      email: `${username}@sim.test`,
      password: "PlayerPass123!",
      display_name: `Group Player ${i}`
    });
    const login = await req("POST", "/auth/login", { email: `${username}@sim.test`, password: "PlayerPass123!" });
    players.push({ username, token: login.body?.access_token, id: login.body?.user?.id });
  }
  assert(players.every((p) => p.token && p.id), "all participants registered and logged in");

  const createRes = await req("POST", "/tournaments", {
    title: `Simulacro Grupos Byes ${SUFFIX}`,
    description: "Simulación de grupos desiguales con byes en playoffs",
    venue_name: "Arena de Pruebas",
    country: "PA",
    format: "groups_elim",
    max_participants: PARTICIPANT_COUNT,
    match_target_points: 3,
    advancers_per_group: 2,
    group_count: GROUP_COUNT
  }, adminToken);
  assert(createRes.status === 200, `tournament created (status ${createRes.status}, ${JSON.stringify(createRes.body)})`);
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
        const scoreA = aWins ? 3 : Math.floor(Math.random() * 2);
        const scoreB = aWins ? Math.floor(Math.random() * 2) : 3;
        await req("PUT", `/matches/${m.id}/manual-score`, { score_a: scoreA, score_b: scoreB, status: "finished" }, adminToken);
      }
    }
    return round;
  }

  const groupRounds = await playAllPending();
  console.log(`group stage converged in ${groupRounds} passes`);

  const groupMatches = ((await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body || []).filter((m) => m.group_id);
  assert(groupMatches.every((m) => m.status === "finished"), "all group stage matches finished");

  // Check standings/group_rank got assigned so playoff seeding is deterministic
  const partsAfterGroups = (await req("GET", `/tournaments/${tournamentId}/participants`, undefined, adminToken)).body || [];
  assert(partsAfterGroups.every((p) => typeof p.group_rank === "number"), "every participant received a group_rank after the group stage");

  const playoffRes = await req("POST", `/tournaments/${tournamentId}/generate-playoffs`, {}, adminToken);
  assert(playoffRes.status === 200, `generate-playoffs succeeded (status ${playoffRes.status}, ${JSON.stringify(playoffRes.body)})`);

  const matchesAfterPlayoffs = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body || [];
  const round1Knockout = matchesAfterPlayoffs.filter((m) => !m.group_id && m.round_number === 1);
  const round1Byes = round1Knockout.filter((m) => m.is_bye);
  const round2Knockout = matchesAfterPlayoffs.filter((m) => !m.group_id && m.round_number === 2);
  console.log(`playoff round 1: ${round1Knockout.length} matches (${round1Byes.length} byes); round 2 present right after generation: ${round2Knockout.length}`);
  assert(round1Byes.length > 0, "generate-playoffs created byes for an uneven qualifier count");
  const byeWinnersAdvanced = round1Byes.filter((bye) =>
    round2Knockout.some((m) => m.player_a_id === bye.winner_id || m.player_b_id === bye.winner_id)
  );
  assert(byeWinnersAdvanced.length === round1Byes.length,
    `every playoff bye winner (${round1Byes.length}) was placed into round 2 immediately (found ${byeWinnersAdvanced.length})`);

  let safety = 0;
  let tourState = (await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken)).body;
  while (tourState?.status !== "completed" && safety < 20) {
    safety++;
    const played = await playAllPending();
    if (played === 0) break;
    tourState = (await req("GET", `/tournaments/${tournamentId}`, undefined, adminToken)).body;
  }
  assert(tourState?.status === "completed", `tournament reached completed status (got ${tourState?.status})`);
  assert(!!tourState?.winner_user_id, "tournament has a winner_user_id set");

  const finalMatches = (await req("GET", `/tournaments/${tournamentId}/matches`, undefined, adminToken)).body || [];
  const knockoutMatches = finalMatches.filter((m) => !m.group_id);
  assert(knockoutMatches.every((m) => m.status === "finished"), "every knockout match finished (no stuck byes/matches)");
  const grandFinal = knockoutMatches.find((m) => m.stage === "Gran Final");
  assert(!!grandFinal && grandFinal.status === "finished", "a finished 'Gran Final' match exists");

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(1);
});
