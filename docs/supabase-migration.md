# Neon ? Supabase migration runbook (AppBey)

Reference: <https://supabase.com/docs/guides/platform/migrating-to-supabase/neon>

AppBey stores each collection in `appbey_*` tables as a JSONB `payload` plus projection columns, and loads everything into memory at startup. Auth is custom (password hashes live in the `appbey_users` payload). This plan moves **only the PostgreSQL database**; Supabase Auth is a separate architectural migration and is out of scope.

> Never paste connection strings, passwords or user data into tickets, commits or this file. Use the Render/Supabase secret stores.

## 1. Inventory (read-only, on Neon)
- `SELECT version();` and `SELECT extname, extversion FROM pg_extension;` (confirm each extension is available on Supabase).
- `SELECT pg_size_pretty(pg_database_size(current_database()));`
- Row counts for every `appbey_*` table (`SELECT count(*) FROM appbey_users;` …) and table list from `\dt appbey_*`.
- Retired wallet data: record `count(*)` of `appbey_wallets` and `appbey_transactions`. Code no longer reads, writes or creates them.
- Record Render service settings (instance, region) and the current Neon region.

## 2. Backup
- Take a `pg_dump -Fc` of Neon to encrypted storage; verify with `pg_restore --list`. Keep it until the post-cutover window ends.
- Optionally export the wallet tables separately as the archive for the final DROP.

## 3. Stage Supabase
- Create a new Supabase project in a region close to Render; same or newer Postgres major version.
- Enable any extensions found in step 1. Use the direct or session-mode connection string (the app uses a long-lived `pg` pool, so avoid transaction-mode pooling unless prepared statements are verified).

## 4. Rehearsal
- `pg_dump` from Neon and `pg_restore` into the staging Supabase project (per the official guide).
- Compare row counts per table to step 1. Spot-check JSONB payloads and that `appbey_users` login works.
- Run a staging copy of the app (Render preview or local) with `DATABASE_URL` pointing at the rehearsal DB: `/health`, login, read tournaments/decks, create+delete a test record, restart and confirm data persisted.
- Time the restore to size the cutover window.

## 5. Cutover
1. Announce a window; deploy the wallet-free code release first and confirm it is healthy on Neon.
2. Stop writes (scale Render service to 0 or enable maintenance mode).
3. Final dump from Neon, restore into Supabase, re-verify counts.
4. Update `DATABASE_URL` in the Render dashboard (secret env var; no logs/commits). Redeploy.
5. Validate: health endpoint, startup log shows relational data loaded, login, read and write checks, websocket connectivity.

## 6. Rollback
Keep Neon untouched and read-only-intent during the window. If validation fails, restore the previous `DATABASE_URL` on Render and redeploy. Any writes made on Supabase after cutover must be exported and replayed manually before reverting.

## 7. Delayed wallet cleanup (manual, later)
Only after: (a) wallet counts recorded, (b) verified backup, (c) wallet-free code released and stable on the new database for an agreed period, an operator may manually drop `appbey_wallets` and `appbey_transactions` with `DROP TABLE` in the DB console, in a reviewed session. No script in this repo does this.

## 8. Decommission
After the retention window, delete the Neon project and rotate any shared secrets.
