# Repository audit: Defence Asset Readiness & Maintenance Dependency System

Audit basis: repository source and `Dump20261101.sql`; no database connection,
SQL execution, migration, or data change was made. The dump is treated as the
documented schema contract, but the live database may differ and must be
verified with `submission/00_schema_verification.sql` before applying a
migration.

## Prioritized findings

| Severity | Finding | Evidence | Proposed correction |
| --- | --- | --- | --- |
| Critical | Pinned Next.js release is obsolete and has published critical advisories. | `web-app/package.json` and lockfile pin 14.2.15. The official advisories affect this release, including Windows hosted RCE and image optimization RCE. | Upgrade to a patched stable release; audit the resulting lockfile and rebuild before deployment. |
| High | Asset create/update/read omit real schema fields. | `ASSET` has nullable `IdentificationNo varchar(100)` and `MnfYear int`; the form, Zod schemas, POST/PATCH SQL, list query, and detail query omit them. Blank optional strings also become `''` rather than SQL `NULL`. | Carry both fields through form, validation, SQL, list and detail UI. Preserve blank optional fields as `NULL`; do not invent values. |
| High | Work-order create omits a required primary key in the schema artifact. | `MAINTENANCE_WORK_ORDER.WorkOrderID int NOT NULL PRIMARY KEY` has no default or `AUTO_INCREMENT` in the dump; `POST /api/work-orders` omits it. Existing SQL seed inserts explicit IDs. | Provide database-generated IDs through a guarded migration, after live-schema preflight and backup. |
| High | Login password verification blocks the Node.js event loop and has no rate limiting. | `verifyPassword` calls `pbkdf2Sync`; login route invokes it for each attempt. | Use asynchronous PBKDF2 and enforce shared login throttling at the deployment edge or a distributed limiter. A per-process limit is not sufficient for multiple instances. |
| Medium | Dashboard dependency alerts can remain stale after dependency changes. | Dashboard cache contains `dependencyAlerts`; dependency POST/DELETE do not invalidate `dashboard:summary`. | Invalidate the dashboard key on successful dependency mutations. |
| Medium | Middleware and server-side session validation accept different claims. | `auth-edge.ts` accepts any numeric ID and role string; `auth.ts` requires an integer ID and supported role. | Apply the same strict claim checks in both verifiers. |
| Medium | Login ignores the `next` destination set by middleware. | Middleware sets `?next=...`; login client always routes to `/`. | Read and validate a same-origin relative destination, falling back to `/`. |
| Medium | Work-order UI calls deletion “cancel.” | Manager confirmation says “Cancel”; API permanently deletes the row when it has no maintenance event. | Describe this action as deletion and keep the existing dependency guard. No `Cancelled` status exists in the schema. |
| Medium | Database pool has no explicit connection timeout, TLS configuration, or bounded wait queue. | `lib/db.ts` sets only `connectionLimit` and `waitForConnections`. | Add validated production database TLS settings and finite queue/connection timeouts; keep TLS configuration deployment-specific. |
| Low | Redis health endpoint is public and returns configuration/reachability details. | Middleware exempts `/api/health/redis`; handler reports configured, reachable, key presence, and TTL. | Keep public only if deployment monitoring requires those details; otherwise protect it or reduce its response. |
| Low | App has no container, CI workflow, or automated regression suite in the repository. | Package scripts contain dev/build/start/lint/typecheck only; no deployment manifest or CI workflow is present. | Add CI and deployment artifacts after target host/runtime is chosen. |

## Schema contract checked

- `ASSET`: `AssetID int NOT NULL` primary key (migration 001 is intended to
  enable `AUTO_INCREMENT`); `AssetName varchar(100) NOT NULL`;
  `IdentificationNo varchar(100) NULL`; `Model varchar(100) NULL`;
  `MnfYear int NULL`; `Status varchar(30) NULL`;
  `CriticalityLevel varchar(20) NULL`; `UnitID int NOT NULL` and
  `AssetTypeID int NOT NULL`, both foreign keys.
- `MAINTENANCE_WORK_ORDER`: `WorkOrderID int NOT NULL` primary key with no
  default in the dump; `AssetID int NOT NULL` foreign key;
  `Description varchar(500) NULL`, `OrderDate date NULL`,
  `Priority varchar(20) NULL`, `Status varchar(30) NULL`.
- `SPARE_PART`: `SparePartID int NOT NULL` primary key;
  `PartName varchar(100) NOT NULL`; nullable part number and criticality;
  stock and reorder level are nullable `int` with default `0`.
- `COMPONENT_DEPENDENCY`: composite primary key `(ComponentID,
  DependsOnComponentID)`, both foreign keys, and a no-self-edge check.
- Other read columns used by dashboard, asset dossier, reports, work-order
  dossier, and dependency/spares UI were checked against their corresponding
  table definitions in the dump. Query values are parameterized; the asset and
  work-order PATCH column names are selected from fixed application schemas.

## Workflow trace

- **Assets:** `/assets` server query -> `AssetManager` -> `POST /api/assets` ->
  Zod -> transaction/FK checks -> MySQL insert (omits nullable fields and
  lets MySQL generate `AssetID`) -> `{ assetId }` -> refreshed list. Search
  reads only summary fields. Detail page reads model/status but omits
  identification number and manufacture year. PATCH supports only the older
  subset; DELETE checks failure/work-order/subsystem references. Dashboard key
  invalidation exists on create/update/delete.
- **Work orders:** server page loads all rows -> form sends asset, description,
  date, priority, status -> Zod -> transaction checks asset -> insert omits
  `WorkOrderID` -> response expects `insertId`. This only works if the live
  schema has an auto-generated ID, which the dump does not show. PATCH maps
  validated fields to fixed columns. DELETE removes a row and refuses existing
  maintenance events. Mutations invalidate the dashboard key.
- **Inventory:** page reads spare-part fields -> manager sends integer quantity
  adjustment -> Zod -> atomic `GREATEST(0, StockQuantity + ?)` update and
  optional reorder threshold -> invalidates dashboard cache. No inventory
  records are stored in Redis.
- **Dependencies:** page reads component edges, components and component-spare
  mappings -> manager sends edge IDs -> Zod/self-edge validation -> transaction
  validates components and walks the graph to reject cycles -> MySQL insert or
  delete. The dashboard displays dependency alerts from a cached query, but
  these writes did not invalidate the cache.
- **Reports/dashboard:** server-rendered parameterized MySQL queries. Dashboard
  reads/writes only the serialized dashboard summary cache; reports do not use
  Redis.
- **Authentication:** login queries `USER`, verifies PBKDF2, signs an 8-hour
  HTTP-only/SameSite Strict cookie. Middleware protects pages and APIs except
  login/logout and Redis health. API handlers repeat authentication and role
  checks. No DB or asset data is stored in Redis.

## Redis contract

Redis is optional, non-authoritative cache storage. `lib/cache.ts` uses exactly
`dashboard:summary`, TTL 30 seconds. It stores the result of the dashboard's
MySQL aggregates/recent orders/dependency alerts. A miss, malformed value, or
Redis connection/read/write failure falls back to MySQL; cache failures do not
fail the primary operation. Asset, work-order, and inventory mutations
invalidate the key. Dependency mutations were the invalidation gap corrected
by this audit. No persisted relational records are moved to Redis.

## Assumptions and unverified items

- The live MySQL schema has not been queried. In particular, verify the current
  `AUTO_INCREMENT` state of both IDs and the exact foreign-key names/rules
  before running a migration.
- Existing SQL export is schema-only; corrected SQL files are seed scripts
  with explicit IDs, not schema updates.
- TLS CA requirements, production OS, number of app instances, trusted proxy,
  secret-manager setup, backup/restore procedure and target deployment host
  were not supplied. These affect final production settings.
- `npm audit` could not reach the npm security endpoint in this environment;
  after network approval, the production dependency subset reported zero
  known vulnerabilities. The full dependency tree still reports 14 moderate
  findings, all in development/lint tooling; no high or critical findings
  remain. Review them when refreshing the ESLint toolchain.

## Fixes applied after the audit

- Asset forms and reads now round-trip `IdentificationNo` and `MnfYear`;
  optional blank text/year values are normalized to SQL `NULL`. Status and
  criticality are left unspecified by default instead of inventing values.
- Asset create uses database-backed unit/type choices, validates foreign keys,
  and supports generated `AssetID`. Asset updates use an explicit column map
  and return consistent not-found/foreign-key responses.
- Work-order forms use database-backed asset choices and validate real MySQL
  dates. A guarded migration was prepared for generated `WorkOrderID`; it was
  not run. The delete UI now clearly states that it removes the row.
- Dependency mutations invalidate `dashboard:summary`; inventory adjustments
  handle nullable stock correctly; work-order and asset update paths no longer
  report an unchanged row as missing.
- Password PBKDF2 now runs asynchronously; session claims are stricter and
  consistent across Node and Edge; the login return path is validated.
- Next.js, its environment package and ESLint config were updated to 15.5.29;
  Zod to 4.6.7; PostCSS to 8.5.32 across the tree; ESLint to 9.39.5. The
  production audit reports zero known vulnerable packages.
- Production DB connections now require TLS with certificate verification,
  and use a bounded pool queue. Security response headers were added. Next
  output tracing is scoped to this app to avoid resolving an unrelated parent
  lockfile.
- No database was connected, and no migration or data script was executed.

## Remaining deployment gates

- Configure a trusted proxy/shared rate limiter for login before public
  exposure; per-process throttling cannot protect a multi-instance deployment.
- Verify the live schema, back up the database, and review migrations 001 and
  002 before applying them. Migration 002 is needed only when the live
  `WorkOrderID` matches the exported non-generated definition.
- Configure production DB TLS/CA, HTTPS, secret management, least-privilege
  SQL permissions, and a tested backup/restore plan.
- Add CI/deployment artifacts and regression coverage for API workflows. The
  npm registry reported 14 moderate issues in the development toolchain; the
  production dependency audit returned zero.
