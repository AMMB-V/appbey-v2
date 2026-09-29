// End-to-end catalog import regression using a local upstream fixture.
//
// Usage: npm run build, then node tests/manual/simulate-catalog-sync.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const ADMIN_EMAIL = "admin@sim.test";
const ADMIN_PASSWORD = "Sim123456789!";
let failBitsRequest = false;
let appProcess;

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function createUpstream() {
  return createServer((request, response) => {
    if (request.url === "/beybladex/blades") {
      return sendJson(response, 200, [
        { id: 901, name: "Phoenix Wing", line: "Basic", bladeType: "Standard", attack: null, defense: null, stamina: null },
        { id: 902, name: "Catalog Test Blade", line: "Unique", bladeType: "Standard", attack: null, defense: null, stamina: null }
      ]);
    }
    if (request.url === "/beybladex/ratchets") {
      return sendJson(response, 200, [
        { id: 903, name: "Catalog Test Ratchet", line: "Basic", attack: 11, defense: 13, stamina: 6, weight: 6.2 }
      ]);
    }
    if (request.url === "/beybladex/bits") {
      if (failBitsRequest) return sendJson(response, 503, { detail: "fixture unavailable" });
      return sendJson(response, 200, [
        { id: 904, name: "Catalog Test Bit", code: "CTB", category: "Attack", line: "Unique", weight: 2.4, attack: 40, defense: 10, stamina: 10, dash: 40, type: null }
      ]);
    }
    sendJson(response, 404, { detail: "Not found" });
  });
}

async function waitForServer(url, processHandle) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error("AppBey test server exited before becoming ready.");
    try {
      const response = await fetch(`${url}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("AppBey test server did not become ready.");
}

async function waitForSync(baseUrl, token, expectedStatus) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/beyblades/meta-tierlist`, {
      headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" }
    });
    const data = await response.json();
    if (data.meta.status !== "syncing") {
      assert.equal(data.meta.status, expectedStatus, data.meta.last_error || "unexpected sync status");
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Catalog sync did not finish in time.");
}

async function main() {
  const appPort = await reservePort();
  const upstreamPort = await reservePort();
  const baseUrl = `http://127.0.0.1:${appPort}/api/v1`;
  const upstream = createUpstream();
  await new Promise((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(upstreamPort, "127.0.0.1", resolve);
  });

  appProcess = spawn(process.execPath, ["dist/server.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      DATABASE_URL: "",
      NODE_ENV: "development",
      APPBEY_DEMO_DATA: "true",
      APPBEY_ADMIN_EMAIL: ADMIN_EMAIL,
      APPBEY_ADMIN_PASSWORD: ADMIN_PASSWORD,
      BEYBLADE_X_API_BASE_URL: `http://127.0.0.1:${upstreamPort}/beybladex`
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let serverErrors = "";
  appProcess.stderr.setEncoding("utf8");
  appProcess.stderr.on("data", (chunk) => { serverErrors += chunk; });

  try {
    await waitForServer(`http://127.0.0.1:${appPort}`, appProcess);
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    assert.equal(loginResponse.status, 200);
    const { access_token: token } = await loginResponse.json();
    assert.ok(token);

    const initialResponse = await fetch(`${baseUrl}/beyblades/meta-tierlist`);
    const initial = await initialResponse.json();
    const phoenix = initial.parts.find((part) => part.name === "Phoenix Wing");
    const phoenixId = phoenix.id;

    const unauthorized = await fetch(`${baseUrl}/beyblades/meta-tierlist/sync`, { method: "POST" });
    assert.equal(unauthorized.status, 401, "only signed-in organizers/admins may start an import");

    const start = await fetch(`${baseUrl}/beyblades/meta-tierlist/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(start.status, 202);
    const imported = await waitForSync(baseUrl, token, "synced");
    assert.equal(imported.parts.find((part) => part.name === "Phoenix Wing").id, phoenixId);
    assert.equal(imported.parts.find((part) => part.name === "Phoenix Wing").attack_stat, 0,
      "null source metrics are shown as unavailable instead of preserving stale local values");
    assert.equal(imported.parts.find((part) => part.name === "Catalog Test Blade").tier, "N");
    assert.equal(imported.parts.find((part) => part.name === "Catalog Test Blade").system, "UX");
    assert.ok(imported.parts.some((part) => part.name === "Catalog Test Ratchet" && part.category === "ratchet"));
    assert.ok(imported.parts.some((part) =>
      part.name === "Catalog Test Bit" && part.category === "bit" && part.type_attr === "Attack"
    ));
    const importedCount = imported.parts.length;

    failBitsRequest = true;
    const failedStart = await fetch(`${baseUrl}/beyblades/meta-tierlist/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(failedStart.status, 202);
    const failed = await waitForSync(baseUrl, token, "error");
    assert.equal(failed.parts.length, importedCount, "a failed source response leaves the last good catalog intact");
    assert.match(failed.meta.last_error, /HTTP 503/);

    console.log("ALL CATALOG SYNC CHECKS PASSED");
  } catch (error) {
    if (serverErrors) console.error("AppBey server stderr:\n", serverErrors);
    throw error;
  } finally {
    appProcess.kill();
    await new Promise((resolve) => {
      if (appProcess.exitCode !== null) return resolve();
      appProcess.once("exit", resolve);
      setTimeout(resolve, 3000).unref();
    });
    await new Promise((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => {
  console.error("Catalog sync simulation failed:", error);
  process.exitCode = 1;
});
