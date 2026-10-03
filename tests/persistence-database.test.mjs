import assert from "node:assert/strict";
import test from "node:test";
import { PersistenceDatabase } from "../src/backend/persistence/database.ts";

test("persistence writes are serialized in submission order", async () => {
  const database = new PersistenceDatabase(undefined, false);
  const order = [];

  await Promise.all([
    database.enqueueWrite(async () => {
      order.push("first-start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push("first-end");
    }),
    database.enqueueWrite(async () => {
      order.push("second");
    })
  ]);

  assert.deepEqual(order, ["first-start", "first-end", "second"]);
  assert.equal(database.hasWriteError, false);
  await database.close();
});
