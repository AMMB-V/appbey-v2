import assert from "node:assert/strict";
import test from "node:test";
import { PersistenceDatabase } from "../src/backend/persistence/database.ts";
import { PersistenceRepository } from "../src/backend/persistence/repository.ts";
import { persistenceTables } from "../src/backend/persistence/schema.ts";

function createState() {
  return {
    users: [{ id: 1, username: "blader" }],
    parts: [],
    decks: [],
    tournaments: [],
    participants: [],
    matches: [],
    matchGames: [],
    seasons: [],
    seasonRankings: [],
    hallOfFame: [],
    communityPosts: [],
    postLikes: [],
    postComments: [],
    notifications: [],
    metaSyncState: {
      source_name: "catalog",
      official_url: "",
      secondary_url: "",
      meta_version: "",
      last_synced_at: "",
      total_matches_analyzed: 0,
      status: "not_configured",
      auto_sync_interval_mins: 0,
      patch_notes: []
    }
  };
}

test("repository loads relational rows and marks persistence ready", async () => {
  const loadedState = createState();
  loadedState.users = [{ id: 7, username: "loaded" }];
  const database = new PersistenceDatabase(undefined, false);
  const pool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({
      query: async (sql) => {
        if (sql.includes("SELECT version FROM appbey_schema_migrations")) {
          return { rows: [{ version: 1 }], rowCount: 1 };
        }
        if (sql.includes("SELECT payload FROM appbey_meta_sync_state")) {
          return { rows: [{ payload: loadedState.metaSyncState }], rowCount: 1 };
        }
        const table = persistenceTables.find((item) => sql.includes(`FROM ${item.name}`));
        return { rows: table ? loadedState[table.key].map((payload) => ({ payload })) : [], rowCount: 0 };
      },
      release() {}
    }),
    end: async () => {}
  };
  Object.defineProperty(database, "pool", { value: pool });

  let state = createState();
  const repository = new PersistenceRepository(database, {
    getState: () => state,
    replaceState: (nextState) => { state = nextState; }
  });
  await repository.initialize();

  assert.deepEqual(state.users, [{ id: 7, username: "loaded" }]);
  assert.equal(database.isReady, true);
  await database.close();
});

test("persistence schema and state contract exclude retired wallet tables", () => {
  const names = persistenceTables.map((table) => table.name);
  assert.ok(!names.includes("appbey_wallets"));
  assert.ok(!names.includes("appbey_transactions"));
  assert.ok(!persistenceTables.some((table) => ["wallets", "transactions"].includes(table.key)));
});

test("repository ignores legacy wallet collections in stored state", async () => {
  const database = new PersistenceDatabase(undefined, false);
  const repository = new PersistenceRepository(database, () => createState(), () => {});
  const legacy = { ...createState(), wallets: [{ id: 1 }], transactions: [{ id: 1 }] };
  const result = repository.withDefaults ? repository.withDefaults(legacy, createState()) : repository["withDefaults"](legacy, createState());
  assert.equal("wallets" in result, false);
  assert.equal("transactions" in result, false);
});
