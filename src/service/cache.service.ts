// src/service/cache.service.ts
// Redis caching service for improved performance
// Uses unified Redis client from lib/redisClient.ts

import { redisClient, isRedisConnected } from "../lib/redisClient";
import logger from "../utils/logger";

class CacheService {
  private counters = {
    hits: 0,
    misses: 0,
    sets: 0,
    dels: 0,
    invalidations: 0,
    errors: 0,
  };

  constructor() {
    // Redis client is already initialized in lib/redisClient.ts
    // No need to create a new connection here
  }

  /**
   * Get value from cache
   * Uses unified Redis client from lib/redisClient.ts
   */
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

  /**
   * Set value in cache with TTL
   * Uses unified Redis client from lib/redisClient.ts
   */
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
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

  /**
   * Delete a key from cache
   * Uses unified Redis client from lib/redisClient.ts
   */
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

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    if (!isRedisConnected()) {
      return;
    }

    try {
      // IMPORTANT: Avoid Redis KEYS in production.
      // KEYS is O(N) and can block Redis (causing timeouts / stalls).
      // SCAN is incremental and safe for prod usage.
      const stream = redisClient.scanStream({
        match: pattern,
        count: 250,
      });

      let deleted = 0;

      for await (const keys of stream as any) {
        if (!Array.isArray(keys) || keys.length === 0) continue;
        deleted += keys.length;
        // Pipeline deletes to reduce RTT
        const pipeline = redisClient.pipeline();
        for (const key of keys) pipeline.del(key);
        await pipeline.exec();
      }

      if (deleted > 0) {
        this.counters.invalidations++;
        logger.info(
          `Cache cleared: ${deleted} keys matching pattern "${pattern}"`
        );
      }
    } catch (error) {
      this.counters.errors++;
      logger.error("Cache delete pattern error:", { pattern, error: (error as Error).message });
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      logger.debug(`Cache HIT: ${key}`);
      return cached;
    }

    // Cache miss - fetch data
    logger.debug(`Cache MISS: ${key}`);
    const data = await fetchFn();
    
    // Store in cache
    await this.set(key, data, ttl);
    
    return data;
  }

  /**
   * Get or set with Response headers for cache visibility
   * Sets X-Cache header (HIT/MISS) for debugging
   */
  async getOrSetWithHeaders<T>(
    key: string,
    fetchFn: () => Promise<T>,
    res: any, // Express Response object
    ttl: number = 3600
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      // Cache HIT
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Key", key);
      logger.debug(`Cache HIT: ${key}`);
      return cached;
    }

    // Cache miss - fetch data
    res.setHeader("X-Cache", "MISS");
    res.setHeader("X-Cache-Key", key);
    logger.debug(`Cache MISS: ${key}`);
    
    const data = await fetchFn();
    
    // Store in cache (async, don't block response)
    this.set(key, data, ttl).catch((error) => {
      logger.error("Cache set error in getOrSetWithHeaders:", error);
    });
    
    return data;
  }

  /**
   * Check if Redis is connected
   * Uses unified Redis client from lib/redisClient.ts
   */
  isReady(): boolean {
    return isRedisConnected();
  }

  /**
   * Get cache statistics
   * Uses unified Redis client from lib/redisClient.ts
   */
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
  }> {
    if (!isRedisConnected()) {
      return { connected: false, counters: this.counters };
    }

    try {
      const keys = await redisClient.dbsize();
      return {
        connected: true,
        keys,
        counters: this.counters,
      };
    } catch (error) {
      return {
        connected: true,
        counters: this.counters,
      };
    }
  }

  /**
   * Clear all cache (use with caution)
   * Uses unified Redis client from lib/redisClient.ts
   */
  async flushAll(): Promise<void> {
    if (!isRedisConnected()) {
      return;
    }

    try {
      await redisClient.flushall();
      logger.warn("⚠️  All cache cleared");
    } catch (error) {
      logger.error("Cache flush error:", error);
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;

