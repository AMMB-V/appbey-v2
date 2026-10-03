import assert from "node:assert/strict";
import test from "node:test";
import { parseManualApiTarget, resolveManualApiTarget } from "./safe-target.mjs";

test("manual simulation targets default to localhost and accept only API base paths", () => {
  assert.deepEqual(parseManualApiTarget([]), {
    baseUrl: "http://localhost:3999/api",
    healthUrl: "http://localhost:3999/healthz"
  });
  assert.equal(parseManualApiTarget(["http://127.0.0.1:4000/api/"]).baseUrl, "http://127.0.0.1:4000/api");
  assert.equal(parseManualApiTarget(["http://[::1]:4000/api/v1"]).baseUrl, "http://[::1]:4000/api/v1");
  assert.throws(() => parseManualApiTarget(["http://localhost:3999/api", "unexpected"]));
  assert.throws(() => parseManualApiTarget(["http://localhost:3999/api?token=secret"]));
  assert.throws(() => parseManualApiTarget(["http://localhost.evil.test:3999/api"]));
});

test("remote targets require explicit HTTPS opt-in and an exact host allowlist", () => {
  const env = { APPBEY_TEST_ALLOWED_HOSTS: "test.example.com, staging.example.com " };
  assert.throws(() => parseManualApiTarget(["https://test.example.com/api"], env));
  assert.throws(() => parseManualApiTarget(["--allow-remote", "http://test.example.com/api"], env));
  assert.throws(() => parseManualApiTarget(["--allow-remote", "https://test.example.com:8443/api"], env));
  assert.throws(() => parseManualApiTarget(["--allow-remote", "https://other.example.com/api"], env));
  assert.equal(
    parseManualApiTarget(["--allow-remote", "https://test.example.com/api"], env).baseUrl,
    "https://test.example.com/api"
  );
});

test("manual targets must confirm in-memory storage before scripts issue mutations", async () => {
  const target = await resolveManualApiTarget([], process.env, async (url, options) => {
    assert.equal(url, "http://localhost:3999/healthz");
    assert.equal(options.redirect, "error");
    return { ok: true, json: async () => ({ storage: "in-memory" }) };
  });
  assert.equal(target.baseUrl, "http://localhost:3999/api");
  await assert.rejects(resolveManualApiTarget([], process.env, async () => ({
    ok: true,
    json: async () => ({ storage: "postgresql-relational" })
  })), /in-memory/);
});
