# Live demonstration script

This script describes the application flow without inventing credentials or
claiming database evidence. Configure the local environment first; do not
display `.env.local` contents during the demo.

## Local setup

1. Start the existing MySQL server and confirm the `defence_asset_system`
   database is available.
2. In `web-app/.env.local`, configure `DB_HOST`, `DB_PORT`, `DB_NAME`,
   `DB_USER`, `DB_PASSWORD`, and a long random `AUTH_SESSION_SECRET`.
3. Use approved existing users whose `` `USER`.PasswordHash `` values are
   supported PBKDF2 hashes. The supplied `hash_demo_*` seed values are
   placeholders and are not valid login credentials.
4. Optionally start Redis with
   `docker run --name defence-asset-redis -p 6379:6379 -d redis:7-alpine` and
   configure `REDIS_URL=redis://127.0.0.1:6379`. The application remains
   functional when Redis is unavailable.
5. Run `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`,
   and `npm run dev` from `web-app`.

## Application flow

1. Open `/login` and sign in with an approved user.
2. Show the dashboard metrics and readiness grouping.
3. Open Assets:
   - search by asset name or model;
   - open an asset detail page;
   - as Admin, create an asset using existing `UnitID` and `AssetTypeID`;
   - update status and demonstrate dependent-record protection on deletion.
4. Open Work orders:
   - create a work order against an existing asset;
   - open its detail page;
   - update status, priority, or description;
   - cancel only a work order without maintenance events.
5. Open Dependencies:
   - view component relationships;
   - as Admin, add a valid relationship;
   - demonstrate self-dependency and circular-dependency rejection;
   - remove a relationship with confirmation.
6. Open Inventory:
   - review low-stock indicators;
   - as Admin, apply a positive or negative stock adjustment;
   - demonstrate that stock cannot become negative.
7. Open Reports and filter maintenance costs by type.
8. Sign out and verify protected pages/API routes require authentication.
9. Sign in as the second approved role and show that mutation controls differ.

## Redis evidence

1. Open the dashboard once, then request `/api/health/redis`.
2. Show `"reachable":true`, `"keyPresent":true`, and a positive
   `"ttlSeconds"` without displaying the cache value.
3. If using Docker, run `docker exec defence-asset-redis redis-cli EXISTS
   dashboard:summary` and `docker exec defence-asset-redis redis-cli TTL
   dashboard:summary`; expect `1` and a value from `0` through `30`.
4. Update a work order or inventory quantity, reload the dashboard, and show
   that the key is refreshed. Stop Redis and reload again to demonstrate the
   MySQL fallback.

## Evidence boundary

The application build and unauthenticated authorization behavior can be
verified locally. Successful login and database-backed mutations require the
user-controlled MySQL server, approved credentials, and real password hashes.
Do not claim those flows were tested until they are run locally.
