import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCacheCore, isLoopbackRedisUrl } from "../lib/cache-core.mjs";

class FakeRedis {
  values = new Map();
  expires = new Map();
  failRead = false;
  failWrite = false;
  failMulti = false;
  afterGet;

  async mget(...keys) {
    if (this.failRead) throw new Error("simulated read outage");
    return keys.map((key) => this.values.get(key) ?? null);
  }

  async get(key) {
    if (this.failRead) throw new Error("simulated read outage");
    const value = this.values.get(key) ?? null;
    await this.afterGet?.();
    return value;
  }

  async set(key, value, ...args) {
    if (this.failWrite) throw new Error("simulated write outage");
    if (args.includes("NX") && this.values.has(key)) return null;
    this.values.set(key, value);
    const exIndex = args.indexOf("EX");
    if (exIndex >= 0) this.expires.set(key, Number(args[exIndex + 1]));
    return "OK";
  }

  async del(key) {
    this.expires.delete(key);
    return this.values.delete(key) ? 1 : 0;
  }

  async exists(key) {
    return this.values.has(key) ? 1 : 0;
  }

  async ttl(key) {
    return this.expires.get(key) ?? -2;
  }

  multi() {
    const writes = [];
    return {
      set: (key, value) => { writes.push([key, value]); return this; },
      exec: async () => {
        if (this.failMulti) throw new Error("simulated transaction outage");
        for (const [key, value] of writes) this.values.set(key, value);
        return writes.map(() => [null, "OK"]);
      }
    };
  }
}

function makeCore({ store = new FakeRedis(), getStore, errors = [] } = {}) {
  return createCacheCore({
    namespace: "darms:test:v1",
    getStore: getStore ?? (() => store),
    prepareStore: async (value) => value,
    createToken: (() => { let n = 0; return () => `generation-${++n}`; })(),
    logFailure: (operation) => errors.push(operation)
  });
}

test("cache miss loads MySQL data once, then cache hit avoids another load", async () => {
  const core = makeCore();
  let loads = 0;
  const loader = async () => ({ rows: ++loads });

  assert.deepEqual(await core.cached("assets:list", loader, 30, ["assets"]), { rows: 1 });
  assert.deepEqual(await core.cached("assets:list", loader, 30, ["assets"]), { rows: 1 });
  assert.equal(loads, 1);
});

test("Redis outage falls back to MySQL and successful results are not cached during the outage", async () => {
  const redis = new FakeRedis();
  redis.failRead = true;
  const core = makeCore({ store: redis });
  let loads = 0;

  assert.equal(await core.cached("assets:list", async () => ++loads, 30, ["assets"]), 1);
  assert.equal(await core.cached("assets:list", async () => ++loads, 30, ["assets"]), 2);
  assert.equal(loads, 2);
});

test("failed MySQL loaders propagate and are never cached", async () => {
  const core = makeCore();
  let loads = 0;
  const failingLoader = async () => {
    loads += 1;
    throw new Error("database unavailable");
  };

  await assert.rejects(core.cached("assets:list", failingLoader, 30, ["assets"]), /database unavailable/);
  await assert.rejects(core.cached("assets:list", failingLoader, 30, ["assets"]), /database unavailable/);
  assert.equal(loads, 2);
});

test("tag invalidation expires affected data while preserving unrelated cached data", async () => {
  const core = makeCore();
  let assetLoads = 0;
  let dependencyLoads = 0;
  const assets = () => core.cached("assets:list", async () => ++assetLoads, 30, ["assets"]);
  const dependencies = () => core.cached("dependencies:list", async () => ++dependencyLoads, 30, ["dependencies"]);

  assert.equal(await assets(), 1);
  assert.equal(await dependencies(), 1);
  await core.invalidate(["assets"]);
  assert.equal(await assets(), 2);
  assert.equal(await dependencies(), 1);
});

test("a generation change during cache lookup prevents returning the stale entry", async () => {
  const redis = new FakeRedis();
  const core = makeCore({ store: redis });
  let loads = 0;
  const loader = async () => `fresh-${++loads}`;
  assert.equal(await core.cached("assets:list", loader, 30, ["assets"]), "fresh-1");

  redis.afterGet = async () => {
    redis.afterGet = undefined;
    await core.invalidate(["assets"]);
  };
  assert.equal(await core.cached("assets:list", loader, 30, ["assets"]), "fresh-2");
  assert.equal(loads, 2);
});

test("concurrent cache misses in one process share one database load", async () => {
  const core = makeCore();
  let loads = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const loader = async () => {
    loads += 1;
    await gate;
    return { rows: 7 };
  };

  const first = core.cached("assets:list", loader, 30, ["assets"]);
  const second = core.cached("assets:list", loader, 30, ["assets"]);
  await new Promise((resolve) => setImmediate(resolve));
  release();
  assert.deepEqual(await Promise.all([first, second]), [{ rows: 7 }, { rows: 7 }]);
  assert.equal(loads, 1);
});

test("cache invalidation failure is logged and never throws to a committed mutation", async () => {
  const redis = new FakeRedis();
  redis.failMulti = true;
  const errors = [];
  const core = makeCore({ store: redis, errors });

  await assert.doesNotReject(core.invalidate(["assets", "dashboard"]));
  assert.deepEqual(errors, ["invalidate"]);
});

test("production rejects loopback Redis URLs without exposing the URL", () => {
  assert.equal(isLoopbackRedisUrl("redis://localhost:6379"), true);
  assert.equal(isLoopbackRedisUrl("rediss://127.0.0.1:6380/0"), true);
  assert.equal(isLoopbackRedisUrl("redis://[::1]:6379"), true);
  assert.equal(isLoopbackRedisUrl("rediss://redis.internal:6380"), false);
  assert.equal(isLoopbackRedisUrl("not a url"), false);
});

test("cache-key inspection reads tag generations without fetching or creating payloads", async () => {
  const redis = new FakeRedis();
  const core = makeCore({ store: redis });
  await core.cached("dashboard:summary", async () => ({ secret: "not read by inspection" }), 30, ["assets", "failures", "maintenance-events", "work-orders"]);
  const before = new Map(redis.values);
  const diagnostic = await core.inspectKey("dashboard:summary", ["assets", "failures", "maintenance-events", "work-orders"]);
  assert.match(diagnostic.key, /^darms:test:v1:/);
  assert.deepEqual(Object.keys(diagnostic.tagGenerations), ["assets", "failures", "maintenance-events", "work-orders"]);
  assert.deepEqual(redis.values, before);
});

test("protected cached API reads authenticate before touching shared cache keys", async () => {
  const files = [
    "../app/api/assets/route.ts",
    "../app/api/assets/[id]/route.ts",
    "../app/api/work-orders/route.ts",
    "../app/api/dependencies/route.ts",
    "../app/api/maintenance-events/route.ts"
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const cacheAt = source.indexOf("cached(");
    assert.ok(cacheAt >= 0, `${file} uses cache-aside reads`);
    const authAt = Math.max(source.lastIndexOf("currentSession()", cacheAt), source.lastIndexOf("authorized()", cacheAt));
    assert.ok(authAt >= 0 && authAt < cacheAt, `${file} authenticates before cache access`);
  }

  const middleware = await readFile(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(middleware, /verifySessionTokenAtEdge/);
  assert.match(middleware, /matcher:\s*\["\/\(\(\?!_next\/static\|_next\/image\|favicon\.ico\)\.\*\)"\]/);
  assert.doesNotMatch(middleware, /startsWith\("\/assets"\).*NextResponse\.next/s);
});

test("every implemented mutation route invalidates its affected cache tags", async () => {
  const cases = [
    ["../app/api/assets/route.ts", '["assets"]'],
    ["../app/api/assets/[id]/route.ts", '["assets"]'],
    ["../app/api/work-orders/route.ts", '["work-orders", "assets"]'],
    ["../app/api/failures/route.ts", '["failures"]'],
    ["../app/api/maintenance-events/route.ts", '["maintenance-events"]'],
    ["../app/api/inventory/[id]/route.ts", '["inventory"]'],
    ["../app/api/subsystems/route.ts", '["hierarchy", "dependencies"]'],
    ["../app/api/subsystems/[id]/route.ts", '["hierarchy", "dependencies"]'],
    ["../app/api/components/route.ts", '["hierarchy", "dependencies"]'],
    ["../app/api/components/[id]/route.ts", '["hierarchy", "dependencies"]'],
    ["../app/api/dependencies/route.ts", '["dependencies"]']
  ];
  for (const [file, tags] of cases) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.ok(source.includes(`invalidate(${tags})`), `${file} invalidates ${tags}`);
  }

  const dashboard = await readFile(new URL("../lib/cache.ts", import.meta.url), "utf8");
  assert.match(dashboard, /DASHBOARD_CACHE_TAGS\s*=\s*\["assets",\s*"work-orders",\s*"failures",\s*"maintenance-events"\]/);
});
