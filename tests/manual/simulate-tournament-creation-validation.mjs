// Manual API regression for tournament creation input validation.
//
// Usage: node dist/server.cjs (in one shell) then
//        node tests/manual/simulate-tournament-creation-validation.mjs [baseUrl]

const BASE = process.argv[2] || "http://localhost:3999/api";
let failures = 0;

function assert(condition, message) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`ok: ${message}`);
  }
}

async function req(method, url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await response.json(); } catch { /* response has no JSON body */ }
  return { status: response.status, body: json };
}

async function main() {
  const login = await req("POST", "/auth/login", {
    email: "admin@sim.test",
    password: "Sim123456789!"
  });
  assert(login.status === 200 && login.body?.access_token, "simulation admin login succeeds");
  if (!login.body?.access_token) {
    process.exit(1);
  }
  const token = login.body.access_token;
  const baseTournament = {
    title: `Creation validation ${Date.now()}`,
    format: "groups_elim",
    max_participants: 32,
    venue_name: "Test Arena",
    country: "PA"
  };

  for (const groupCount of [1, 17, 32, 2.5, "not-a-number"]) {
    const response = await req("POST", "/tournaments", {
      ...baseTournament,
      group_count: groupCount
    }, token);
    assert(response.status === 400, `rejects invalid group_count=${groupCount}`);
  }

  for (const advancers of [0, 5, 2.5, "not-a-number"]) {
    const response = await req("POST", "/tournaments", {
      ...baseTournament,
      advancers_per_group: advancers
    }, token);
    assert(response.status === 400, `rejects invalid advancers_per_group=${advancers}`);
  }

  const shortTitle = await req("POST", "/tournaments", {
    ...baseTournament,
    title: "AB"
  }, token);
  assert(shortTitle.status === 400, "rejects titles shorter than three characters");

  const valid = await req("POST", "/tournaments", {
    ...baseTournament,
    group_count: 16,
    advancers_per_group: 1
  }, token);
  assert(valid.status === 200 && valid.body?.group_count === 16, "accepts supported maximum of 16 groups");
  if (valid.body?.id) {
    const deleted = await req("DELETE", `/tournaments/${valid.body.id}`, undefined, token);
    assert(deleted.status === 200, "removes validation fixture tournament");
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Simulation crashed:", error);
  process.exit(1);
});
