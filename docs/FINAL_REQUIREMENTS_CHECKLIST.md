# Final requirements checklist

Status meanings: **Complete** means supported by source and local checks;
**Partial** means implementation exists but needs environment or manual
verification; **Blocked** means a required decision, credential, or evidence
is missing.

| Requirement | Status | Evidence / verification |
|---|---|---|
| Existing MySQL schema preserved | Complete | Application SQL references exported tables; no migration is included. |
| Assets list/detail/search | Complete | `/assets`, `/assets/[id]`, `/api/assets?q=...`; typecheck/build pass. |
| Asset create/update/delete | Partial | Admin-only routes exist; requires approved session and live DB to verify. |
| Work-order list/detail/create/update/cancel | Partial | `/work-orders`, `/work-orders/[id]`, `/api/work-orders`; mutation verification requires live DB. |
| Dependency view/create/delete | Partial | `/dependencies`, `/api/dependencies`; self/cycle checks are server-side; live DB verification pending. |
| Inventory view/adjustment | Partial | `/inventory`, `/api/inventory/[id]`; non-negative SQL guard is implemented; live DB verification pending. |
| Reports and filtering | Partial | `/reports?type=...` uses database aggregates; live result verification pending. |
| Parameterized SQL | Complete | Dynamic values use `?` parameters; update column names come from fixed maps. |
| Server validation | Complete | Zod schemas in `web-app/lib/validation.ts`. |
| Safe error responses | Complete | Route handlers return generic errors and sanitized server logs. |
| Authentication/session | Partial | Signed HTTP-only cookie and PBKDF2 verification implemented; valid local secret/hashes required. |
| Server authorization | Complete | Middleware and route-level role checks protect application/API access. |
| Admin role | Partial | Supported by code; requires an approved database user with a real hash. |
| Analyst role | Partial | Supported by code; requires an approved database user with a real hash. |
| Inspector role | Blocked | Present in seed/schema context, but no permission policy was specified. |
| Redis cache | Partial | Dashboard summary is a real Redis key-value cache with TTL, fallback, mutation invalidation, and `/api/health/redis`; runtime availability still requires local verification. |
| ERD | Complete | `docs/ERD.md` matches `Dump20261101.sql`. |
| SQL feature coverage | Partial | Scripts cover read-only queries and programmable objects; Workbench execution evidence is still required. |
| Git history | Blocked | Project root is not a Git repository. |
| Team details | Blocked | Names and responsibilities remain placeholders. |

## Manual steps still required

1. Configure local MySQL connection values and `AUTH_SESSION_SECRET` without
   sharing them.
2. Obtain approved PBKDF2 password hashes for existing users. Do not invent
   credentials or execute provisioning SQL without review and approval.
3. Run the application login and mutation workflows locally.
4. Validate Redis with a local Redis instance using the `/api/health/redis`
   endpoint and the documented `redis-cli EXISTS`/`TTL` checks.
5. Run read-only SQL verification in MySQL Workbench and capture result grids.
6. Use an isolated test database for any write, trigger, procedure, transaction,
   or concurrency demonstration.
7. Fill in the team placeholders.
