// src/service/cache.service.ts
// Redis caching service for Contabo / REDIS_URL with SWR + single-flight loaders.

import { redisClient, isRedisConnected } from "../lib/redisClient";
import { CACHE_TTL, cacheLockKey } from "../lib/cacheKeys";
import logger from "../utils/logger";

export type CacheStatus = "HIT" | "STALE" | "MISS" | "BYPASS";

export interface SwrEnvelope<T> {
  value: T;
  freshUntil: number;
}

export interface GetOrSetSwrResult<T> {
  value: T;
  status: CacheStatus;
}

interface FeedCacheMetrics {
  freshHits: number;
  staleHits: number;
  misses: number;
  bypasses: number;
  coalesced: number;
  lockWaitTimeouts: number;
  refreshFailures: number;
}

const feedMetrics: FeedCacheMetrics = {
  freshHits: 0,
  staleHits: 0,
  misses: 0,
  bypasses: 0,
  coalesced: 0,
  lockWaitTimeouts: 0,
  refreshFailures: 0,
};

class CacheService {
  private counters = {
    hits: 0,
    misses: 0,
    sets: 0,
    dels: 0,
    invalidations: 0,
    errors: 0,
  };

  /** In-process single-flight map for stampede protection. */
  private inflight = new Map<string, Promise<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    if (!isRedisConnected()) {
      return null;
    }

    try {
      const data = await redisClient.get(key);
      if (!data) {
        this.counters.misses++;
        return null;
      }
      this.counters.hits++;
      return JSON.parse(data) as T;
    } catch (error) {
      this.counters.errors++;
      logger.error("Cache get error:", { key, error: (error as Error).message });
      return null;
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }

  async set(key: string, value: any, ttl: number = CACHE_TTL.default): Promise<void> {
    if (!isRedisConnected()) {
      return;
    }

    try {
      await redisClient.setex(key, ttl, JSON.stringify(value));
      this.counters.sets++;
    } catch (error) {
      this.counters.errors++;
      logger.error("Cache set error:", { key, error: (error as Error).message });
    }
  }

  async setJSON(key: string, value: any, ttl: number = CACHE_TTL.default): Promise<void> {
    return this.set(key, value, ttl);
  }

  async exists(key: string): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }
    try {
      const n = await redisClient.exists(key);
      return n === 1;
    } catch (error) {
      this.counters.errors++;
      logger.error("Cache exists error:", { key, error: (error as Error).message });
      return false;
    }
  }

  async del(key: string): Promise<void> {
    if (!isRedisConnected()) {
      return;
    }

    try {
      await redisClient.del(key);
      this.counters.dels++;
    } catch (error) {
      this.counters.errors++;
      logger.error("Cache delete error:", { key, error: (error as Error).message });
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!isRedisConnected()) {
      return;
    }

    try {
      const stream = redisClient.scanStream({
        match: pattern,
        count: 250,
      });

      let deleted = 0;

      for await (const keys of stream as any) {
        if (!Array.isArray(keys) || keys.length === 0) continue;
        deleted += keys.length;
        const pipeline = redisClient.pipeline();
        for (const key of keys) pipeline.del(key);
        await pipeline.exec();
      }

      if (deleted > 0) {
        this.counters.invalidations++;
        logger.info(`Cache cleared: ${deleted} keys matching pattern "${pattern}"`);
      }
    } catch (error) {
      this.counters.errors++;
      logger.error("Cache delete pattern error:", {
        pattern,
        error: (error as Error).message,
      });
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CACHE_TTL.default
  ): Promise<T> {
    const result = await this.getOrSetSwr(key, fetchFn, {
      freshTtlSeconds: ttl,
      staleTtlSeconds: 0,
    });
    return result.value;
  }

  /**
   * Stale-while-revalidate loader with local single-flight + optional Redis lock.
   * Empty arrays / falsy-but-valid payloads are treated as hits (caller decides).
   * Redis unavailable → BYPASS and run loader via local single-flight only.
   */
  async getOrSetSwr<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: {
      freshTtlSeconds?: number;
      staleTtlSeconds?: number;
      lockMs?: number;
      waitMs?: number;
    } = {}
  ): Promise<GetOrSetSwrResult<T>> {
    const freshTtl = options.freshTtlSeconds ?? CACHE_TTL.feed;
    const staleTtl = options.staleTtlSeconds ?? CACHE_TTL.feedStale;
    const hardTtl = freshTtl + Math.max(0, staleTtl);
    const lockMs = options.lockMs ?? 8_000;
    const waitMs = options.waitMs ?? 2_000;

    if (!isRedisConnected()) {
      feedMetrics.bypasses++;
      const value = await this.singleFlight(key, fetchFn);
      return { value, status: "BYPASS" };
    }

    const envelope = await this.get<SwrEnvelope<T>>(key);
    const now = Date.now();

    if (envelope && envelope.value !== undefined && envelope.value !== null) {
      if (envelope.freshUntil > now) {
        feedMetrics.freshHits++;
        this.counters.hits++;
        return { value: envelope.value, status: "HIT" };
      }

      // Soft-stale: return immediately, refresh in background if we win the lock
      feedMetrics.staleHits++;
      this.counters.hits++;
      void this.refreshInBackground(key, fetchFn, freshTtl, hardTtl, lockMs);
      return { value: envelope.value, status: "STALE" };
    }

    feedMetrics.misses++;
    this.counters.misses++;

    try {
      const value = await this.loadWithLock(key, fetchFn, freshTtl, hardTtl, lockMs, waitMs);
      return { value, status: "MISS" };
    } catch (error) {
      feedMetrics.refreshFailures++;
      throw error;
    }
  }

  async getOrSetWithHeaders<T>(
    key: string,
    fetchFn: () => Promise<T>,
    res: any,
    ttl: number = CACHE_TTL.default
  ): Promise<T> {
    const result = await this.getOrSetSwr(key, fetchFn, {
      freshTtlSeconds: ttl,
      staleTtlSeconds: Math.min(CACHE_TTL.feedStale, Math.floor(ttl / 2)),
    });
    if (res?.setHeader) {
      res.setHeader("X-Cache", result.status);
    }
    return result.value;
  }

  private async refreshInBackground<T>(
    key: string,
    fetchFn: () => Promise<T>,
    freshTtl: number,
    hardTtl: number,
    lockMs: number
  ): Promise<void> {
    try {
      const acquired = await this.tryAcquireLock(key, lockMs);
      if (!acquired) return;
      try {
        const value = await this.singleFlight(key, fetchFn);
        await this.setEnvelope(key, value, freshTtl, hardTtl);
      } finally {
        await this.releaseLock(key, acquired);
      }
    } catch (error) {
      feedMetrics.refreshFailures++;
      logger.warn("SWR background refresh failed", {
        key,
        error: (error as Error).message,
      });
    }
  }

  private async loadWithLock<T>(
    key: string,
    fetchFn: () => Promise<T>,
    freshTtl: number,
    hardTtl: number,
    lockMs: number,
    waitMs: number
  ): Promise<T> {
    const token = await this.tryAcquireLock(key, lockMs);
    if (token) {
      try {
        const value = await this.singleFlight(key, fetchFn);
        await this.setEnvelope(key, value, freshTtl, hardTtl);
        return value;
      } finally {
        await this.releaseLock(key, token);
      }
    }

    // Wait briefly for the lock owner to populate cache
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      await sleep(50 + Math.floor(Math.random() * 50));
      const envelope = await this.get<SwrEnvelope<T>>(key);
      if (envelope && envelope.value !== undefined && envelope.value !== null) {
        feedMetrics.coalesced++;
        return envelope.value;
      }
    }

    feedMetrics.lockWaitTimeouts++;
    // Fall through — load locally without writing if we still can't get the lock
    return this.singleFlight(key, fetchFn);
  }

  private async setEnvelope<T>(
    key: string,
    value: T,
    freshTtlSeconds: number,
    hardTtlSeconds: number
  ): Promise<void> {
    const jitter = Math.floor(freshTtlSeconds * 0.1 * Math.random());
    const freshUntil = Date.now() + (freshTtlSeconds + jitter) * 1000;
    const envelope: SwrEnvelope<T> = { value, freshUntil };
    await this.set(key, envelope, hardTtlSeconds + jitter);
  }

  private async singleFlight<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) {
      feedMetrics.coalesced++;
      return existing;
    }
    const promise = Promise.resolve()
      .then(fetchFn)
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    return promise;
  }

  private async tryAcquireLock(key: string, lockMs: number): Promise<string | null> {
    if (!isRedisConnected()) return `local:${key}`;
    const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    try {
      const result = await redisClient.set(cacheLockKey(key), token, "PX", lockMs, "NX");
      return result === "OK" ? token : null;
    } catch {
      return null;
    }
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    if (token.startsWith("local:")) return;
    if (!isRedisConnected()) return;
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;
    try {
      await redisClient.eval(lua, 1, cacheLockKey(key), token);
    } catch {
      // non-fatal
    }
  }

  isReady(): boolean {
    return isRedisConnected();
  }

  getCounters() {
    return { ...this.counters };
  }

  getFeedMetrics(): Readonly<FeedCacheMetrics> {
    return { ...feedMetrics };
  }

  async getStats(): Promise<{
    connected: boolean;
    keys?: number;
    counters?: {
      hits: number;
      misses: number;
      sets: number;
      dels: number;
      invalidations: number;
      errors: number;
    };
    feed?: FeedCacheMetrics;
  }> {
    if (!isRedisConnected()) {
      return { connected: false, counters: this.counters, feed: feedMetrics };
    }

    try {
      const keys = await redisClient.dbsize();
      return {
        connected: true,
        keys,
        counters: this.counters,
        feed: feedMetrics,
      };
    } catch {
      return {
        connected: true,
        counters: this.counters,
        feed: feedMetrics,
      };
    }
  }

  async flushAll(): Promise<void> {
    const allowed =
      process.env.ALLOW_REDIS_FLUSH === "true" ||
      process.env.NODE_ENV === "test" ||
      process.env.NODE_ENV === "development";

    if (!allowed) {
      logger.error("Cache flushAll blocked — set ALLOW_REDIS_FLUSH=true to override");
      throw new Error("flushAll is disabled outside test/development");
    }

    if (!isRedisConnected()) {
      return;
    }

    try {
      await redisClient.flushall();
      logger.warn("All Redis keys cleared via flushAll");
    } catch (error) {
      logger.error("Cache flush error:", error);
      throw error;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const cacheService = new CacheService();
export { CACHE_TTL };
export default cacheService;
