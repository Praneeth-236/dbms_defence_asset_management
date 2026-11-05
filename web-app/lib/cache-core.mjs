import { createHash, randomUUID } from "node:crypto";

const DEFAULT_TAG = "global";

function normalizedTags(tags) {
  const result = [...new Set(tags.length ? tags : [DEFAULT_TAG])]
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => /^[a-z0-9][a-z0-9:_-]{0,63}$/.test(tag))
    .sort();
  return result.length ? result : [DEFAULT_TAG];
}

export function isLoopbackRedisUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0";
  } catch {
    return false;
  }
}

export function createCacheCore({ namespace, getStore, prepareStore, logFailure, createToken = randomUUID }) {
  const inFlightLoads = new Map();
  const tagKey = (tag) => `${namespace}:tag:${tag}`;

  async function connected() {
    const store = getStore();
    return store ? prepareStore(store) : null;
  }

  async function contextFor(store, logicalKey, tags) {
    const names = normalizedTags(tags);
    let generations = await store.mget(...names.map(tagKey));
    for (let index = 0; index < names.length; index += 1) {
      if (generations[index] === null) await store.set(tagKey(names[index]), createToken(), "NX");
    }
    if (generations.some((generation) => generation === null)) {
      generations = await store.mget(...names.map(tagKey));
    }
    if (generations.some((generation) => generation === null)) throw new Error("REDIS_TAG_GENERATION_UNAVAILABLE");
    const revision = names.map((name, index) => `${name}-${generations[index]}`).join(":");
    const digest = createHash("sha256").update(logicalKey).digest("hex").slice(0, 32);
    return { key: `${namespace}:${revision}:${digest}` };
  }

  async function readCache(logicalKey, tags = []) {
    try {
      const store = await connected();
      if (!store) return { hit: false, available: false };
      const context = await contextFor(store, logicalKey, tags);
      const value = await store.get(context.key);
      // Confirm the generation after reading the payload. A mutation can bump a
      // tag after the initial MGET but before GET; without this check that
      // overlapping request could return an entry invalidated in between.
      const confirmedContext = await contextFor(store, logicalKey, tags);
      if (confirmedContext.key !== context.key) {
        return { hit: false, available: true, context: confirmedContext };
      }
      if (value === null) return { hit: false, available: true, context: confirmedContext };
      try {
        const envelope = JSON.parse(value);
        if (envelope && typeof envelope === "object" && envelope.version === 1 && Object.prototype.hasOwnProperty.call(envelope, "data")) {
          return { hit: true, value: envelope.data, available: true, context: confirmedContext };
        }
        return { hit: false, available: true, context: confirmedContext };
      } catch (error) {
        logFailure("parse", error);
        return { hit: false, available: true, context: confirmedContext };
      }
    } catch (error) {
      logFailure("read", error);
      return { hit: false, available: false };
    }
  }

  async function writeCache(logicalKey, value, ttlSeconds, tags = [], expectedContext) {
    try {
      const store = await connected();
      if (!store) return;
      const context = expectedContext ?? await contextFor(store, logicalKey, tags);
      const serialized = JSON.stringify({ version: 1, data: value });
      if (serialized === undefined) return;
      const safeTtl = Number.isFinite(ttlSeconds) ? Math.floor(ttlSeconds) : 30;
      await store.set(context.key, serialized, "EX", Math.max(1, Math.min(3_600, safeTtl)));
    } catch (error) {
      logFailure("write", error);
    }
  }

  async function deleteCache(logicalKey, tags = []) {
    try {
      const store = await connected();
      if (!store) return;
      const context = await contextFor(store, logicalKey, tags);
      await store.del(context.key);
    } catch (error) {
      logFailure("delete", error);
    }
  }

  async function cached(logicalKey, loader, ttlSeconds, tags = []) {
    const lookup = await readCache(logicalKey, tags);
    if (lookup.hit) return lookup.value;
    if (!lookup.available || !lookup.context) return loader();

    const existingLoad = inFlightLoads.get(lookup.context.key);
    if (existingLoad) return existingLoad;
    const pending = (async () => {
      const result = await loader();
      await writeCache(logicalKey, result, ttlSeconds, tags, lookup.context);
      return result;
    })();
    inFlightLoads.set(lookup.context.key, pending);
    try {
      return await pending;
    } finally {
      if (inFlightLoads.get(lookup.context.key) === pending) inFlightLoads.delete(lookup.context.key);
    }
  }

  async function invalidate(tags) {
    const names = normalizedTags(tags);
    try {
      const store = await connected();
      if (!store) return;
      const transaction = store.multi();
      for (const tag of names) transaction.set(tagKey(tag), createToken());
      const result = await transaction.exec();
      if (!result || result.some(([error]) => error !== null)) throw new Error("REDIS_INVALIDATION_FAILED");
    } catch (error) {
      logFailure("invalidate", error);
    }
  }

  async function redisStatus(logicalKey, tags = []) {
    try {
      const store = await connected();
      if (!store) return { configured: false, reachable: false, keyPresent: false, ttlSeconds: null };
      const context = await contextFor(store, logicalKey, tags);
      const [exists, ttl] = await Promise.all([store.exists(context.key), store.ttl(context.key)]);
      return { configured: true, reachable: true, keyPresent: exists === 1, ttlSeconds: ttl >= 0 ? ttl : null };
    } catch (error) {
      logFailure("status", error);
      return { configured: true, reachable: false, keyPresent: false, ttlSeconds: null };
    }
  }

  async function inspectKey(logicalKey, tags = []) {
    try {
      const store = await connected();
      if (!store) return null;
      const names = normalizedTags(tags);
      const generations = await store.mget(...names.map(tagKey));
      const tagGenerations = Object.fromEntries(names.map((name, index) => [name, generations[index]]));
      if (generations.some((generation) => generation === null)) {
        return { namespace, key: null, tagGenerations };
      }
      const revision = names.map((name, index) => `${name}-${generations[index]}`).join(":");
      const digest = createHash("sha256").update(logicalKey).digest("hex").slice(0, 32);
      return { namespace, key: `${namespace}:${revision}:${digest}`, tagGenerations };
    } catch (error) {
      logFailure("inspect", error);
      return null;
    }
  }

  return { readCache, writeCache, deleteCache, cached, invalidate, redisStatus, inspectKey };
}
