// Bounded local load test for the most-used tournament user journeys.
// Uses the same restricted target rules as other API simulations.
//
// Usage: node dist/server.cjs (in one shell), then:
//        node tests/manual/simulate-tournament-load.mjs [baseUrl] [--allow-remote]
// Remote targets must also be listed in APPBEY_TEST_ALLOWED_HOSTS and use in-memory storage.

import { resolveManualApiTarget } from "./safe-target.mjs";

const { baseUrl: BASE } = await resolveManualApiTarget();

const CONCURRENT_USERS = 32;
const READ_WORKERS = 20;
const READ_ITERATIONS = 10;
const SUFFIX = Date.now().toString(36).slice(-6);
let failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`ok: ${message}`);
  }
}

async function request(method, url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const start = performance.now();
  const response = await fetch(`${BASE}${url}`, {
    method,
    headers,
    redirect: "error",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try { json = await response.json(); } catch { /* an empty response is checked by the caller */ }
  return {
    status: response.status,
    body: json,
    durationMs: performance.now() - start
  };
}

async function main() {
  console.log("Running bounded tournament load test against an in-memory server.");

  const email = process.env.APPBEY_ADMIN_EMAIL || "admin@sim.test";
  const password = process.env.APPBEY_ADMIN_PASSWORD || "Sim123456789!";
  const login = await request("POST", "/auth/login", { email, password });
  assert(login.status === 200 && login.body?.access_token, "organizer/admin login works");
  if (!login.body?.access_token) throw new Error("Configure admin credentials for the simulation target.");
  const token = login.body.access_token;
  let tournamentId;
  let capacityTournamentId;

  try {
    const accountResults = await Promise.all(Array.from({ length: CONCURRENT_USERS }, (_, index) => {
      const username = `load_${SUFFIX}_${index + 1}`;
      return request("POST", "/auth/register", {
        username,
        email: `${username}@sim.test`,
        password: "LoadTestPass123!",
        display_name: `Load ${SUFFIX} Player ${index + 1}`
      });
    }));
    assert(accountResults.every((result) => result.status === 200 && result.body?.access_token),
      `creates ${CONCURRENT_USERS} distinct simulated user accounts concurrently`);
    const users = accountResults.map((result) => ({
      id: result.body?.user?.id,
      token: result.body?.access_token
    }));
    if (users.some((user) => !user.id || !user.token)) {
      throw new Error("One or more simulated accounts were not created.");
    }

    const created = await request("POST", "/tournaments", {
      title: `Load simulation ${SUFFIX}`,
      description: "Bounded local load and user-flow test",
      format: "groups_elim",
      group_count: 8,
      advancers_per_group: 2,
      battle_type: "3on3_deck",
      match_target_points: 3,
      max_participants: CONCURRENT_USERS,
      venue_name: "Local Load Test Arena",
      country: "PA"
    }, token);
    assert(created.status === 200, "create groups + playoffs tournament");
    tournamentId = created.body?.id;
    if (!tournamentId) throw new Error("Tournament creation did not return an id.");

    const registrations = await Promise.all(users.map((user) =>
      request("POST", `/tournaments/${tournamentId}/register`, {}, user.token)
    ));
    assert(registrations.every((result) => result.status === 200),
      `all ${CONCURRENT_USERS} independent users register concurrently`);
    const checkins = await Promise.all(users.map((user) =>
      request("POST", `/tournaments/${tournamentId}/checkin`, {}, user.token)
    ));
    assert(checkins.every((result) => result.status === 200),
      `${CONCURRENT_USERS} users complete check-in concurrently`);

    const started = await request("POST", `/tournaments/${tournamentId}/start`, {}, token);
    assert(started.status === 200, "organizer starts the tournament");
    const initialMatches = await request("GET", `/tournaments/${tournamentId}/matches`, undefined, token);
    assert(initialMatches.status === 200 && initialMatches.body?.length === 48,
      "generates all 48 group-stage matches for 32 players");
    const matches = initialMatches.body || [];

    const capacityTournament = await request("POST", "/tournaments", {
      title: `Capacity race ${SUFFIX}`,
      format: "single_elim",
      max_participants: CONCURRENT_USERS / 2,
      venue_name: "Local Load Test Arena",
      country: "PA"
    }, token);
    assert(capacityTournament.status === 200, "creates a second tournament to test concurrent capacity enforcement");
    capacityTournamentId = capacityTournament.body?.id;
    if (!capacityTournamentId) throw new Error("Capacity tournament creation did not return an id.");
    const raceRegistrations = await Promise.all(users.map((user) =>
      request("POST", `/tournaments/${capacityTournamentId}/register`, {}, user.token)
    ));
    const acceptedRegistrations = raceRegistrations.filter((result) => result.status === 200).length;
    assert(acceptedRegistrations === CONCURRENT_USERS / 2,
      `concurrent registrations never exceed the 16-slot cap (accepted ${acceptedRegistrations})`);
    const capacityParticipants = await request("GET", `/tournaments/${capacityTournamentId}/participants`, undefined, token);
    assert(capacityParticipants.status === 200 && capacityParticipants.body?.length === CONCURRENT_USERS / 2,
      "capacity-limited tournament contains exactly 16 participants after registration race");

    const scoreResults = await Promise.all(matches.map((match, index) =>
      request("PUT", `/matches/${match.id}/manual-score`, {
        score_a: index % 2 === 0 ? 3 : 0,
        score_b: index % 2 === 0 ? 0 : 3,
        status: "finished"
      }, token)
    ));
    assert(scoreResults.every((result) => result.status === 200),
      `records all ${matches.length} group results in parallel (HTTP errors: ${scoreResults.filter((result) => result.status !== 200).length})`);

    const readPaths = [
      `/tournaments`,
      `/tournaments/${tournamentId}`,
      `/tournaments/${tournamentId}/participants`,
      `/tournaments/${tournamentId}/matches`
    ];
    const durations = [];
    let responseErrors = 0;
    const readTasks = Array.from({ length: READ_WORKERS }, async () => {
      for (let iteration = 0; iteration < READ_ITERATIONS; iteration++) {
        const path = readPaths[iteration % readPaths.length];
        const result = await request("GET", path, undefined, token);
        durations.push(result.durationMs);
        if (result.status !== 200 || result.body === null) responseErrors++;
      }
    });
    await Promise.all(readTasks);
    durations.sort((a, b) => a - b);
    const percentile = (p) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)] || 0;
    console.log(`read burst: ${durations.length} requests; p50=${percentile(0.50).toFixed(1)}ms; p95=${percentile(0.95).toFixed(1)}ms; max=${Math.max(...durations).toFixed(1)}ms`);
    assert(responseErrors === 0, `${READ_WORKERS} simulated users complete ${READ_ITERATIONS} reads each with no failed/empty responses`);

    const finalizedMatches = await request("GET", `/tournaments/${tournamentId}/matches`, undefined, token);
    assert(finalizedMatches.status === 200 && finalizedMatches.body?.every((match) => match.status === "finished"),
      "all matches remain consistent after concurrent scoring and read traffic");

    const playoffs = await request("POST", `/tournaments/${tournamentId}/generate-playoffs`, {}, token);
    assert(playoffs.status === 200, "organizer generates playoffs after the loaded group stage");
    const finalTournament = await request("GET", `/tournaments/${tournamentId}`, undefined, token);
    assert(finalTournament.status === 200 && finalTournament.body?.stage_type === "knockout",
      "tournament remains readable and advances to knockout stage");
  } finally {
    if (capacityTournamentId) {
      const removed = await request("DELETE", `/tournaments/${capacityTournamentId}`, undefined, token);
      assert(removed.status === 200, "removes the temporary capacity-race tournament");
    }
    if (tournamentId) {
      const removed = await request("DELETE", `/tournaments/${tournamentId}`, undefined, token);
      assert(removed.status === 200, "removes the temporary load-test tournament");
    }
  }

  console.log(failures === 0 ? "\nALL LOAD CHECKS PASSED" : `\n${failures} LOAD CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Load test failed.");
  process.exit(1);
});
