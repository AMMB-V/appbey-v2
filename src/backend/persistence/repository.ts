import pg from "pg";
import type { MetaSyncState } from "../models.js";
import { PersistenceDatabase } from "./database.js";
import {
  persistenceTables,
  type PersistedCollectionName,
  type PersistedState,
  type PersistenceTable
} from "./schema.js";

export interface PersistedStateStore {
  getState(): PersistedState;
  replaceState(state: PersistedState): void;
}

export class PersistenceRepository {
  private lastPersistedState: PersistedState | null = null;

  constructor(
    private readonly database: PersistenceDatabase,
    private readonly store: PersistedStateStore
  ) {}

  async initialize(): Promise<void> {
    const pool = this.database.pool;
    if (!pool) return;

    await this.ensureSchema(pool);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const migration = await client.query(
        "SELECT version FROM appbey_schema_migrations WHERE version = 1"
      );
      if (migration.rowCount) {
        const state = this.store.getState();
        for (const table of persistenceTables) {
          const result = await client.query<{ payload: unknown }>(
            `SELECT payload FROM ${table.name} ORDER BY record_order, record_id`
          );
          this.assignCollection(state, table.key, result.rows.map((row) => row.payload));
        }
        const meta = await client.query<{ payload: MetaSyncState }>(
          "SELECT payload FROM appbey_meta_sync_state WHERE id = 1"
        );
        if (meta.rows[0]?.payload) state.metaSyncState = meta.rows[0].payload;
        this.store.replaceState(state);
        await client.query("COMMIT");
        console.log("Loaded AppBey relational data from PostgreSQL");
      } else {
        const legacy = await client.query<{ state: Partial<PersistedState> }>(
          "SELECT state FROM appbey_state WHERE state_key = $1",
          ["production"]
        );
        const state = this.withDefaults(legacy.rows[0]?.state, this.store.getState());
        this.store.replaceState(this.deduplicateUsers(state));
        const initialState = this.clone(this.store.getState());
        await client.query("ROLLBACK");
        await this.persistRelationalState(client, initialState, null, true);
        console.log(legacy.rows[0]?.state
          ? "Migrated existing AppBey state into relational PostgreSQL tables"
          : "Migrated seeded AppBey data into relational PostgreSQL tables");
      }
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Failed to roll back PostgreSQL initialization:", rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
    const normalizedState = this.deduplicateUsers(this.store.getState());
    this.store.replaceState(normalizedState);
    this.lastPersistedState = this.clone(normalizedState);
    this.database.markReady();
  }

  persistState(): Promise<void> {
    if (!this.database.pool) return Promise.resolve();
    const state = this.clone(this.store.getState());
    return this.database.enqueueWrite(async () => {
      const client = await this.database.pool!.connect();
      try {
        await this.persistRelationalState(client, state, this.lastPersistedState);
        this.lastPersistedState = state;
      } finally {
        client.release();
      }
    });
  }

  private withDefaults(state: Partial<PersistedState> | undefined, fallback: PersistedState): PersistedState {
    return {
      users: state?.users || fallback.users,
      wallets: state?.wallets || fallback.wallets,
      transactions: state?.transactions || fallback.transactions,
      parts: state?.parts || fallback.parts,
      decks: state?.decks || fallback.decks,
      tournaments: state?.tournaments || fallback.tournaments,
      participants: state?.participants || fallback.participants,
      matches: state?.matches || fallback.matches,
      matchGames: state?.matchGames || fallback.matchGames,
      seasons: state?.seasons || fallback.seasons,
      seasonRankings: state?.seasonRankings || fallback.seasonRankings,
      hallOfFame: state?.hallOfFame || fallback.hallOfFame,
      communityPosts: state?.communityPosts || fallback.communityPosts,
      postLikes: state?.postLikes || fallback.postLikes,
      postComments: state?.postComments || fallback.postComments,
      notifications: state?.notifications || fallback.notifications,
      metaSyncState: state?.metaSyncState || fallback.metaSyncState
    };
  }

  private deduplicateUsers(state: PersistedState): PersistedState {
    const uniqueUsers = new Map<number, PersistedState["users"][number]>();
    for (const user of state.users) {
      if (!uniqueUsers.has(user.id)) uniqueUsers.set(user.id, user);
    }
    const duplicateCount = state.users.length - uniqueUsers.size;
    if (duplicateCount > 0) {
      console.warn(`Ignored ${duplicateCount} duplicate persisted user record(s)`);
    }
    return { ...state, users: Array.from(uniqueUsers.values()) };
  }

  private clone(state: PersistedState): PersistedState {
    return JSON.parse(JSON.stringify(state)) as PersistedState;
  }

  private collectionRows(state: PersistedState, key: PersistedCollectionName): readonly object[] {
    switch (key) {
      case "users": return state.users;
      case "wallets": return state.wallets;
      case "transactions": return state.transactions;
      case "parts": return state.parts;
      case "decks": return state.decks;
      case "tournaments": return state.tournaments;
      case "participants": return state.participants;
      case "matches": return state.matches;
      case "matchGames": return state.matchGames;
      case "seasons": return state.seasons;
      case "seasonRankings": return state.seasonRankings;
      case "hallOfFame": return state.hallOfFame;
      case "communityPosts": return state.communityPosts;
      case "postLikes": return state.postLikes;
      case "postComments": return state.postComments;
      case "notifications": return state.notifications;
    }
  }

  private assignCollection(state: PersistedState, key: PersistedCollectionName, rows: unknown[]): void {
    switch (key) {
      case "users": state.users = rows as PersistedState["users"]; break;
      case "wallets": state.wallets = rows as PersistedState["wallets"]; break;
      case "transactions": state.transactions = rows as PersistedState["transactions"]; break;
      case "parts": state.parts = rows as PersistedState["parts"]; break;
      case "decks": state.decks = rows as PersistedState["decks"]; break;
      case "tournaments": state.tournaments = rows as PersistedState["tournaments"]; break;
      case "participants": state.participants = rows as PersistedState["participants"]; break;
      case "matches": state.matches = rows as PersistedState["matches"]; break;
      case "matchGames": state.matchGames = rows as PersistedState["matchGames"]; break;
      case "seasons": state.seasons = rows as PersistedState["seasons"]; break;
      case "seasonRankings": state.seasonRankings = rows as PersistedState["seasonRankings"]; break;
      case "hallOfFame": state.hallOfFame = rows as PersistedState["hallOfFame"]; break;
      case "communityPosts": state.communityPosts = rows as PersistedState["communityPosts"]; break;
      case "postLikes": state.postLikes = rows as PersistedState["postLikes"]; break;
      case "postComments": state.postComments = rows as PersistedState["postComments"]; break;
      case "notifications": state.notifications = rows as PersistedState["notifications"]; break;
    }
  }

  private async ensureSchema(pool: pg.Pool): Promise<void> {
    const statements = [`
      CREATE TABLE IF NOT EXISTS appbey_state (
        state_key TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `, `
      CREATE TABLE IF NOT EXISTS appbey_schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `];
    for (const table of persistenceTables) {
      statements.push(this.createTableSql(table));
      statements.push(`CREATE INDEX IF NOT EXISTS ${table.name}_id_idx ON ${table.name} (id)`);
      statements.push(`CREATE INDEX IF NOT EXISTS ${table.name}_record_order_idx ON ${table.name} (record_order)`);
      for (const column of table.indexes || []) {
        statements.push(`CREATE INDEX IF NOT EXISTS ${table.name}_${column}_idx ON ${table.name} (${column})`);
      }
    }
    statements.push(`
      CREATE TABLE IF NOT EXISTS appbey_meta_sync_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        source_name TEXT,
        official_url TEXT,
        secondary_url TEXT,
        meta_version TEXT,
        last_synced_at TEXT,
        total_matches_analyzed INTEGER,
        status TEXT,
        auto_sync_interval_mins INTEGER,
        patch_notes JSONB,
        payload JSONB NOT NULL
      )
    `);
    await pool.query(statements.join(";\n"));
  }

  private createTableSql(table: PersistenceTable): string {
    const fields = [
      "record_id BIGSERIAL PRIMARY KEY",
      "id BIGINT NOT NULL",
      "record_order INTEGER NOT NULL",
      "payload JSONB NOT NULL",
      ...table.columns.map((column) => `${column.name} ${column.type}`)
    ];
    return `CREATE TABLE IF NOT EXISTS ${table.name} (${fields.join(", ")})`;
  }

  private async writeCollection(client: pg.PoolClient, table: PersistenceTable, rows: readonly object[]): Promise<void> {
    await client.query(`DELETE FROM ${table.name}`);
    if (rows.length === 0) return;

    const columns = ["id", "record_order", "payload", ...table.columns.map((column) => column.name)];
    const recordset = [
      "id BIGINT",
      "record_order INTEGER",
      "payload JSONB",
      ...table.columns.map((column) => `${column.name} ${column.type}`)
    ];
    const projectedRows = rows.map((row, index) => ({
      id: Reflect.get(row, "id"),
      record_order: index,
      payload: row,
      ...Object.fromEntries(table.columns.map((column) => [column.name, Reflect.get(row, column.field)]))
    }));
    await client.query(
      `INSERT INTO ${table.name} (${columns.join(", ")})
       SELECT ${columns.map((column) => `incoming.${column}`).join(", ")}
       FROM jsonb_to_recordset($1::JSONB) AS incoming(${recordset.join(", ")})`,
      [JSON.stringify(projectedRows)]
    );
  }

  private async persistRelationalState(
    client: pg.PoolClient,
    state: PersistedState,
    previousState: PersistedState | null,
    applyInitialMigration = false
  ): Promise<void> {
    await client.query("BEGIN");
    try {
      for (const table of persistenceTables) {
        const rows = this.collectionRows(state, table.key);
        const previousRows = previousState ? this.collectionRows(previousState, table.key) : null;
        if (previousRows && JSON.stringify(rows) === JSON.stringify(previousRows)) continue;
        await this.writeCollection(client, table, rows);
      }
      if (!previousState || JSON.stringify(state.metaSyncState) !== JSON.stringify(previousState.metaSyncState)) {
        await client.query(
          `INSERT INTO appbey_meta_sync_state (
             id, source_name, official_url, secondary_url, meta_version, last_synced_at,
             total_matches_analyzed, status, auto_sync_interval_mins, patch_notes, payload
           )
           SELECT
             1, state.source_name, state.official_url, state.secondary_url, state.meta_version,
             state.last_synced_at, state.total_matches_analyzed, state.status,
             state.auto_sync_interval_mins, state.patch_notes, $1::JSONB
           FROM jsonb_to_record($1::JSONB) AS state(
             source_name TEXT, official_url TEXT, secondary_url TEXT, meta_version TEXT,
             last_synced_at TEXT, total_matches_analyzed INTEGER, status TEXT,
             auto_sync_interval_mins INTEGER, patch_notes JSONB
           )
           ON CONFLICT (id) DO UPDATE SET
             source_name = EXCLUDED.source_name,
             official_url = EXCLUDED.official_url,
             secondary_url = EXCLUDED.secondary_url,
             meta_version = EXCLUDED.meta_version,
             last_synced_at = EXCLUDED.last_synced_at,
             total_matches_analyzed = EXCLUDED.total_matches_analyzed,
             status = EXCLUDED.status,
             auto_sync_interval_mins = EXCLUDED.auto_sync_interval_mins,
             patch_notes = EXCLUDED.patch_notes,
             payload = EXCLUDED.payload`,
          [JSON.stringify(state.metaSyncState)]
        );
      }
      if (applyInitialMigration) {
        await client.query(
          "INSERT INTO appbey_schema_migrations (version) VALUES (1) ON CONFLICT (version) DO NOTHING"
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}
