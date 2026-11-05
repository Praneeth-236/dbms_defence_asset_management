export type CacheContext = { key: string };
export type CacheLookup<T> = {
  hit: boolean;
  value?: T;
  available: boolean;
  context?: CacheContext;
};

export type CacheStore = {
  mget(...keys: string[]): Promise<(string | null)[]>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: Array<string | number>): Promise<unknown>;
  del(key: string): Promise<unknown>;
  exists(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  multi(): {
    set(key: string, value: string): unknown;
    exec(): Promise<Array<[Error | null, unknown]> | null>;
  };
};

export function isLoopbackRedisUrl(value: string): boolean;
export function createCacheCore(options: {
  namespace: string;
  getStore: () => CacheStore | null;
  prepareStore: (store: CacheStore) => Promise<CacheStore>;
  logFailure: (operation: string, error: unknown) => void;
  createToken?: () => string;
}): {
  readCache<T>(logicalKey: string, tags?: string[]): Promise<CacheLookup<T>>;
  writeCache<T>(logicalKey: string, value: T, ttlSeconds: number, tags?: string[], expectedContext?: CacheContext): Promise<void>;
  deleteCache(logicalKey: string, tags?: string[]): Promise<void>;
  cached<T>(logicalKey: string, loader: () => Promise<T>, ttlSeconds: number, tags?: string[]): Promise<T>;
  invalidate(tags: string[]): Promise<void>;
  inspectKey(logicalKey: string, tags?: string[]): Promise<{
    namespace: string;
    key: string | null;
    tagGenerations: Record<string, string | null>;
  } | null>;
  redisStatus(logicalKey: string, tags?: string[]): Promise<{
    configured: boolean;
    reachable: boolean;
    keyPresent: boolean;
    ttlSeconds: number | null;
  }>;
};
