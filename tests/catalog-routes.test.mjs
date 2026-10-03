import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import test from "node:test";
import { registerCatalogRoutes } from "../src/backend/routes/catalog.ts";

test("catalog routes expose tier summary and filter parts", async (context) => {
  const app = express();
  const router = express.Router();
  const parts = [
    { id: 1, name: "Blade A", category: "blade", system: "BX", tier: "S", pick_rate_pct: 10 },
    { id: 2, name: "Bit B", category: "bit", system: "UX", tier: "N", pick_rate_pct: 2 }
  ];
  const state = {
    parts,
    decks: [],
    users: [],
    metaSyncState: {
      source_name: "Catalog",
      official_url: "",
      secondary_url: "",
      meta_version: "",
      last_synced_at: "",
      total_matches_analyzed: 0,
      status: "synced",
      auto_sync_interval_mins: 0,
      patch_notes: []
    },
    nextId: (records) => records.reduce((max, record) => Math.max(max, record.id), 0) + 1,
    publicUser: () => null,
    persistState: async () => {}
  };
  registerCatalogRoutes(router, state);
  app.use(express.json(), router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const filteredResponse = await fetch(`${baseUrl}/beyblades/parts?category=blade`);
  assert.equal(filteredResponse.status, 200);
  assert.deepEqual(await filteredResponse.json(), [parts[0]]);

  const summaryResponse = await fetch(`${baseUrl}/beyblades/meta-tierlist`);
  const summary = await summaryResponse.json();
  assert.equal(summaryResponse.status, 200);
  assert.equal(summary.counts.total, 2);
  assert.equal(summary.counts.blades, 1);
  assert.equal(summary.counts.s_tier, 1);
  assert.deepEqual(summary.parts, parts);
});
