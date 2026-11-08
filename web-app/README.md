# Defence Asset Readiness Web Application

This is an isolated Next.js application for the existing MySQL database
`defence_asset_system`. It does not execute SQL scripts or modify the database
automatically. Database migrations are reviewed and applied manually by an
operator; Codex does not execute them.

## Architecture

- Next.js App Router UI
- Server-rendered pages for dashboard, assets, work orders, inventory,
  dependencies, failures, and reports
- Next.js Route Handlers under `app/api`
- `mysql2/promise` connection pool with parameterized SQL
- Zod request validation
- Optional Redis cache-aside reads for dashboard, assets, asset hierarchy,
  work orders, maintenance events, failures, dependencies, inventory, and reports
- MySQL remains the source of truth; Redis failure falls back to MySQL without
  breaking core operations

## MySQL and Redis responsibilities

MySQL remains the authoritative source for assets, work orders, inventory,
failures, maintenance events, reference data, and dependencies. Redis holds
short-lived serialized results of successful server-side SELECT queries. The
cache uses the `darms:v1` namespace, opaque hashed query keys, and tag
generation tokens; it contains no session or authentication data.

Reads use cache-aside behavior: a hit is returned, while a miss, malformed
entry, or unavailable Redis falls back to MySQL. Only successful MySQL results
are cached. Dashboard and operational records use 30-second TTLs, reports use
60 seconds, and stable reference lists use 300 seconds. Mutations rotate the
generations for affected data tags (assets, work orders, failures, maintenance
events, inventory, hierarchy, or dependencies), making their previous cache
entries unreachable. If Redis is unavailable during invalidation, the write
still succeeds and any old entry can remain visible until its bounded TTL
expires; MySQL remains authoritative.

## Existing schema used

The app only references verified objects from `Dump20261101.sql`:
`ASSET`, `ASSET_TYPE`, `UNIT`, `SERVICE`, `FAILURE_EVENT`, `MAINTENANCE_WORK_ORDER`,
`MAINTENANCE_EVENT`, `SPARE_PART`, `SUBSYSTEM`, `COMPONENT`,
`COMPONENT_DEPENDENCY`, `COMPONENT_SPARE`, and `` `USER` ``.

The asset detail page presents the schema's actual hierarchy as
`ASSET → SUBSYSTEM → COMPONENT`. `COMPONENT` has no status or parent-component
column, and work orders store only `AssetID`, so the app does not fabricate
component status, a deeper component tree, or a work-order/component link.

## Local setup

1. Install Node.js 18.18+.
2. Copy `.env.example` to `.env.local`.
3. Use a least-privilege MySQL account. Do not use root for the app.
4. Set local credentials in `.env.local`; never commit that file.
5. Install dependencies with `npm install`.
6. Apply `../migrations/001_asset_id_auto_increment.sql` once to the existing
  database before using the Create asset form. Run it from MySQL Workbench
  or the MySQL client with the correct database selected. It validates the
  four expected tables, existing AssetID values, foreign keys, child indexes,
  and orphan rows before changing anything. It drops only the three named
  foreign keys, changes the parent column, then recreates those constraints
  with the default `RESTRICT` behavior. It never disables foreign-key checks.
  Do not run the dump file, because it drops tables. If a preflight check
  fails, stop and review the reported schema mismatch instead of editing the
  migration to bypass it.
7. Before enabling work-order creation, verify the live
   `MAINTENANCE_WORK_ORDER.WorkOrderID` definition with
   `../submission/00_schema_verification.sql`. The checked-in schema export
   defines it as a required non-generated primary key, while the application
   lets MySQL generate it. If the live schema matches that export, take a
   verified backup and review/apply
   `../migrations/002_work_order_id_auto_increment.sql` once. It checks the
   database, column definitions, foreign key, row IDs, and orphan events. It
   preserves work orders and maintenance events while recreating the named
   foreign key. MySQL DDL commits implicitly, so take a restorable backup
   first and do not assume rollback is available. Do not run the migration if
   the live schema differs; reconcile the schema first.
8. Before recording maintenance events, verify the live `MAINTENANCE_EVENT`
   schema. The checked-in export has a required, non-generated `MaintenanceID`.
   Review and apply `../migrations/003_maintenance_event_id_auto_increment.sql`
   separately, only if its preflight matches the live schema. Run it with a
   stop-on-error SQL client (never `mysql --force`). The migration
   preserves IDs and stops for unexpected IDs, referenced identifiers, or a
   schema/version mismatch. It does not change historical costs.
9. Review `../migrations/004_work_order_readiness_and_cost_triggers.sql` and
   back up the database before applying it. Run the script with stop-on-error
   enabled, never `mysql --force`; on a failed preflight, stop before any later
   statements. Its read-only preview includes all
   assets and reports active work-order counts; it does not reconcile or mark
   any asset Ready. The triggers update asset status from work-order states
   only, cannot account for unresolved failures, and are not fully consistent
   under concurrent work-order changes. The cost triggers reject new NULL
   costs and updates that set costs to NULL, while leaving historical NULLs
   untouched. Review the reported count and do not invent replacement costs.
   A failed preflight leaves its helper procedure for inspection: `darms_preflight_work_order_readiness_20261104` (migration 004) or `darms_preflight_maintenance_event_id_20261104` (migration 003). Remove only the exact leftover helper after reviewing the error before retrying. Verify all
   five expected triggers through `information_schema.TRIGGERS` after applying.
   Do not perform a readiness reconciliation as part of this migration.
10. To enforce non-negative maintenance costs in MySQL, review
    `../migrations/007_nonnegative_maintenance_cost.sql` and its paired
    `../migrations/007_nonnegative_maintenance_cost_rollback.sql`. The forward
    migration requires MySQL 8.0.46, the reviewed event table/key/foreign-key
    structure, and the existing NULL-protection triggers. It lists negative
    historical costs and stops if any are found; do not change those records
    without an approved, auditable correction. Apply only after a verified
    backup, a passing preflight, and explicit deployment approval. Verify the
    named enforced CHECK through `information_schema.TABLE_CONSTRAINTS` and
    `information_schema.CHECK_CONSTRAINTS`. The rollback removes only that
    CHECK and does not alter stored costs.
11. Before creating subsystems or components, review and apply
    `../migrations/006_component_hierarchy_id_auto_increment.sql` against a
    verified backup and only after its exact preflight matches the live schema.
    The migration enables database-generated IDs for both tables, preserving
    IDs and the existing inbound foreign keys. Run it with application writers
    quiesced and a stop-on-error SQL client. DDL is not transactional; if the
    client or server stops between statements, inspect and restore the named
    foreign keys before retrying. The app leaves creation disabled until both
    ID columns report `AUTO_INCREMENT`.
12. Optionally start local Redis for development (Docker is not required for MySQL):

   ```text
   docker run --name defence-asset-redis -p 127.0.0.1:6379:6379 -d redis:7-alpine
   ```

   Keep `REDIS_URL=redis://127.0.0.1:6379` in local `.env.local`. Production
   must set `REDIS_URL` to the private managed Redis endpoint through its
   deployment environment; production rejects localhost/loopback endpoints. If
   Redis is absent or unavailable, the app continues using MySQL.
13. Run `npm run typecheck`.
14. Run `npm run build`.
15. Start with `npm run dev`.

The `.env.example` variables are `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
and `DB_PASSWORD` for MySQL, `AUTH_SESSION_SECRET` for signed sessions, and
optional `REDIS_URL` for the Redis cache. Keep real values only in the
untracked `.env.local`; no Redis password is required for the local
passwordless Docker example. `DB_SSL=false` is for local development;
production requires `DB_SSL=true`, certificate verification, and optionally
`DB_SSL_CA` for a private database CA PEM file.

Before a demo, verify that `.env.local` contains a non-empty
`AUTH_SESSION_SECRET`. The application deliberately does not generate or
modify this secret. If it is missing, database credential checks can still
return a safe invalid-login response, but a valid account cannot receive a
signed session and the login API returns
`Authentication is not configured on the server.` Set the secret, restart
Next.js, and then use the provisioning script below if no approved account
has been verified.

Migration behavior was exercised against a temporary MySQL 8.0.46 container
loaded only from the checked-in schema and seed. A read-only inspection of the
configured live database found a negative historical maintenance cost, so
migration 007 remains unapplied until that record is reviewed and any correction
is explicitly approved and auditable. No live schema or data writes were made.
Production deployment still requires a verified backup, a passing preflight,
and explicit operator approval.

If dependency installation is blocked by network policy, run the same commands
after packages are available locally; source-level validation was completed
without opening a database connection.

## Suggested least-privilege permissions

Grant the app account SELECT access to reporting tables and INSERT access to
`MAINTENANCE_WORK_ORDER` only if work-order creation is desired. Do not grant
DROP, ALTER, TRUNCATE, or unrestricted DELETE privileges.

## Demo flow

See [`../docs/LIVE_DEMO_SCRIPT.md`](../docs/LIVE_DEMO_SCRIPT.md) for the
complete login, role, workflow, and verification sequence.

The application routes are:

- `/login`
- `/`
- `/assets` and `/assets/[id]`
- `/work-orders` and `/work-orders/[id]`
- `/dependencies`
- `/inventory`
- `/reports`

Server routes include `/api/auth/login`, `/api/auth/logout`, `/api/assets`,
`/api/assets/[id]`, `/api/subsystems`, `/api/subsystems/[id]`, `/api/components`,
`/api/components/[id]`, `/api/work-orders`, `/api/dependencies`,
`/api/inventory/[id]`, and `/api/failures`. The `/api/health/redis` endpoint reports
whether Redis is configured/reachable and lists namespaced cache keys with their
remaining TTLs. It never returns the Redis URL or cached values.

## Redis verification

After opening the dashboard once, check `http://localhost:3000/api/health/redis`
while the app is running after loading pages that use caching. A working Redis instance reports
`"reachable":true`, a `count` of cache entries, and an `entries` array showing
each opaque key and its remaining `ttlSeconds`. Tag-generation metadata is
excluded, and cache values are never returned. Stop Redis or temporarily use an invalid
`REDIS_URL` to verify that pages continue reading from MySQL.

## Safety limitations

- Database credentials are server-only environment variables.
- Browser code talks to Route Handlers, never directly to MySQL.
- Redis is optional and non-authoritative.
- The app does not create tables or run migrations.
- Authentication uses an HTTP-only signed session cookie. Set
  `AUTH_SESSION_SECRET` to a long random secret.
- Login accepts only
  `pbkdf2-sha256$iterations$base64url-salt$base64url-digest` values in
  `` `USER`.PasswordHash ``. The supplied demo seed values such as
  `hash_demo_101` are placeholders and cannot authenticate.
- The application assumes the existing `Admin` and `Analyst` role values are
  the two roles for this demonstration. Work-order API access is checked on
  the server; no UI-only role checks are used.
- Provision real password hashes and approved users through your controlled
  database process. This project does not create credentials or execute SQL.

## Provisioning a local demo user

No usable demo account is included. The existing seed values are placeholders,
not hashes accepted by the application. If you control the local MySQL
instance, provision one account with the explicit, one-time script below.
Run it only after confirming the target database and credentials; it performs
one `INSERT` only after you type the exact confirmation phrase. It refuses
existing user IDs/usernames, accepts only the application-supported `Admin` or
`Analyst` roles, generates a PBKDF2-SHA256 hash locally, and never prints the
password or hash.

From `web-app`, with the existing DB environment variables set:

```text
npm run provision:demo-user
```

The script prompts for `UserID`, username, role, full name, and a hidden
12-200 character password. Use a disposable/local database and do not paste
the password, `DB_PASSWORD`, or any hash into source control, chat, logs, or
the browser. This script was not run as part of this verification.

After provisioning, start the app and submit the same username and password
at `/login`. A successful login redirects to `/`; an incorrect or unsupported
role returns the generic `Invalid username or password.` response. Verify
the session by opening a protected page such as `/` or `/assets`, then use
the existing logout control and confirm the protected page redirects to
`/login`. Do not claim success until this is tested against the user-controlled
MySQL instance.

## Redis demo check

The dashboard route is protected by the same session middleware as the other
application pages. Therefore its versioned cache entry remains absent until a
valid session opens `/`. The public `/api/health/redis` endpoint intentionally
separates Redis connectivity from cache population:

- `reachable: true` means Redis can be contacted.
- `keyPresent: true` and a non-null `ttlSeconds` mean the authenticated
  dashboard has populated its current versioned summary entry.

After setting `AUTH_SESSION_SECRET` and logging in, open `/` once and request
`/api/health/redis`. A Redis outage remains non-fatal; reads recompute from
MySQL and attempt to repopulate the cache when Redis returns.
