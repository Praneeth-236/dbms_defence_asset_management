import { createHash } from "node:crypto";
import Redis from "ioredis";
import { createCacheCore, isLoopbackRedisUrl, type CacheStore } from "./cache-core.mjs";

const cacheScope = createHash("sha256")
  .update(`${process.env.NODE_ENV ?? "development"}:${process.env.DB_HOST ?? "unconfigured"}:${process.env.DB_PORT ?? "3306"}:${process.env.DB_NAME ?? "unconfigured"}`)
  .digest("hex")
  .slice(0, 12);
const CACHE_NAMESPACE = `darms:v1:${cacheScope}`;
export const DASHBOARD_CACHE_KEY = "dashboard:summary";
export const CACHE_TTL_SECONDS = {
  dashboard: 30,
  operational: 30,
  reports: 60,
  reference: 300
} as const;
export const DASHBOARD_CACHE_TAGS = ["assets", "work-orders", "failures", "maintenance-events"];

type RedisGlobal = typeof globalThis & { __darmsRedisClient?: Redis | null };
const globalForRedis = globalThis as RedisGlobal;
let lastCacheErrorLog = 0;

function logCacheFailure(operation: string, error: unknown): void {
  const now = Date.now();
  if (now - lastCacheErrorLog < 10_000) return;
  lastCacheErrorLog = now;
  const code = error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : error instanceof Error ? error.name : "UNKNOWN_ERROR";
  console.warn(`[redis.${operation}] cache unavailable`, { code });
}

function client(): Redis | null {
  if (globalForRedis.__darmsRedisClient !== undefined) return globalForRedis.__darmsRedisClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || !process.env.DB_HOST || !process.env.DB_NAME) {
    globalForRedis.__darmsRedisClient = null;
    return null;
  }
  if (process.env.NODE_ENV === "production" && isLoopbackRedisUrl(redisUrl)) {
    const error = Object.assign(new Error("Loopback Redis URL is not valid in production."), { code: "REDIS_LOOPBACK_IN_PRODUCTION" });
    logCacheFailure("configure", error);
    globalForRedis.__darmsRedisClient = null;
    return null;
  }

  try {
    const store = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1_500,
      commandTimeout: 1_500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => attempt <= 2 ? attempt * 150 : null
    });
    store.on("error", () => undefined);
    globalForRedis.__darmsRedisClient = store;
    return store;
  } catch (error) {
    logCacheFailure("configure", error);
    globalForRedis.__darmsRedisClient = null;
    return null;
  }
}

async function connectedStore(store: Redis): Promise<Redis> {
  if (store.status === "wait" || store.status === "end") await store.connect();
  return store;
}

const cacheCore = createCacheCore({
  namespace: CACHE_NAMESPACE,
  getStore: () => client() as unknown as CacheStore | null,
  prepareStore: async (store) => await connectedStore(store as unknown as Redis) as unknown as CacheStore,
  logFailure: logCacheFailure
});

export const readCache = cacheCore.readCache;
export const writeCache = cacheCore.writeCache;
export const deleteCache = cacheCore.deleteCache;
export const cached = cacheCore.cached;
export const invalidate = cacheCore.invalidate;
export const redisStatus = (key = DASHBOARD_CACHE_KEY, tags: string[] = DASHBOARD_CACHE_TAGS) => cacheCore.redisStatus(key, tags);

export async function dashboardCacheDiagnostic() {
  const store = client();
  if (!store) return { configured: false as const };
  const cache = await cacheCore.inspectKey(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_TAGS);
  if (!cache) return { configured: true as const, reachable: false as const };
  return {
    configured: true as const,
    reachable: true as const,
    host: store.options.host,
    port: store.options.port,
    databaseIndex: store.options.db ?? 0,
    ...cache
  };
}
