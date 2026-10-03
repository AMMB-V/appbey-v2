import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import test from "node:test";
import { registerIdentityRoutes } from "../src/backend/routes/identity.ts";

async function setup(context) {
  const users = [
    { id: 1, username: "admin", email: "admin@example.com", password_hash: "secret-hash-1", display_name: "Admin", role: "admin" },
    { id: 2, username: "blader", email: "blader@example.com", password_hash: "secret-hash-2", display_name: "Blader", role: "blader" },
    { id: 3, username: "other", email: "Other@Example.com", password_hash: "secret-hash-3", display_name: "Other", role: "blader" }
  ];
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = users[0]; next(); });
  registerIdentityRoutes(router, {
    users,
    nextId: () => 99,
    generateToken: () => "token",
    publicUser: (user) => user && { id: user.id, username: user.username, display_name: user.display_name, role: user.role }
  });
  app.use(router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const put = (id, body) => fetch(`${baseUrl}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { users, put };
}

test("admin email update trims, lowercases and returns only the public user", async (context) => {
  const { users, put } = await setup(context);
  const response = await put(2, { email: "  New.Address@Example.COM " });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(users[1].email, "new.address@example.com");
  assert.equal(body.id, 2);
  assert.equal("email" in body, false);
  assert.equal("password_hash" in body, false);
  assert.equal(users[1].password_hash, "secret-hash-2");
});

test("admin email update rejects invalid formats", async (context) => {
  const { users, put } = await setup(context);
  for (const email of ["not-an-email", "a@b", "", "   ", 42, `${"a".repeat(250)}@example.com`]) {
    const response = await put(2, { email });
    assert.equal(response.status, 400, String(email));
  }
  assert.equal(users[1].email, "blader@example.com");
});

test("admin email update rejects case-insensitive duplicates of another account", async (context) => {
  const { users, put } = await setup(context);
  const response = await put(2, { email: "OTHER@example.com" });
  assert.equal(response.status, 409);
  assert.equal(users[1].email, "blader@example.com");
});

test("admin email update allows an unchanged address", async (context) => {
  const { users, put } = await setup(context);
  const response = await put(2, { email: "BLADER@example.com" });
  assert.equal(response.status, 200);
  assert.equal(users[1].email, "blader@example.com");
});
