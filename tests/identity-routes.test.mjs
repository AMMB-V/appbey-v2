import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import test from "node:test";
import { registerIdentityRoutes } from "../src/backend/routes/identity.ts";

test("registration email validation preserves accepted formats and rejects malformed values", async (context) => {
  const app = express();
  const router = express.Router();
  const state = {
    users: [],
    nextId: (records) => records.reduce((max, record) => Math.max(max, record.id), 0) + 1,
    generateToken: () => "test-token",
    publicUser: (user) => user
  };
  registerIdentityRoutes(router, state);
  app.use(express.json(), router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let nextUsername = 0;
  const register = (email) => fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: `testuser${++nextUsername}`, email, password: "secret123" })
  });

  for (const email of ["@example.com", "user@@example.com", "user@example.", "user @example.com", "user\n@example.com"]) {
    assert.equal((await register(email)).status, 400);
  }
  assert.equal((await register("user+tag@sub.example.com")).status, 200);
  assert.equal((await register("user@domain..example")).status, 200);
  assert.equal((await register(" User@Example.com\n")).status, 200);
});
