// src/service/cache.service.ts
// Redis caching service for improved performance

import Redis from "ioredis";
import logger from "../utils/logger";

class CacheService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private counters = {
    hits: 0,
    misses: 0,
    sets: 0,
    dels: 0,
    invalidations: 0,
    errors: 0,
  };

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.client.on("connect", () => {
        this.isConnected = true;
        logger.info("✅ Redis connected successfully");
      });

      this.client.on("ready", () => {
        this.isConnected = true;
        logger.info("✅ Redis ready to accept commands");
      });

      this.client.on("error", (err) => {
        this.isConnected = false;
        logger.error("❌ Redis error:", err);
      });

      this.client.on("close", () => {
        this.isConnected = false;
        logger.warn("⚠️  Redis connection closed");
      });

      // Connect lazily
      this.client.connect().catch((err) => {
        logger.warn("⚠️  Redis connection failed (will retry):", err.message);
        this.isConnected = false;
      });
    } catch (error) {
      logger.error("❌ Failed to initialize Redis:", error);
      this.isConnected = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const data = await this.client.get(key);
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
   */
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
      this.counters.sets++;
    } catch (error) {
      this.counters.errors++;
      logger.error("Cache set error:", { key, error: (error as Error).message });
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
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
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      // IMPORTANT: Avoid Redis KEYS in production.
      // KEYS is O(N) and can block Redis (causing timeouts / stalls).
      // SCAN is incremental and safe for prod usage.
      const stream = this.client.scanStream({
        match: pattern,
        count: 250,
      });

      let deleted = 0;

      for await (const keys of stream as any) {
        if (!Array.isArray(keys) || keys.length === 0) continue;
        deleted += keys.length;
        // Pipeline deletes to reduce RTT
        const pipeline = this.client.pipeline();
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
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get cache statistics
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
    if (!this.isConnected || !this.client) {
      return { connected: false, counters: this.counters };
    }

    try {
      const keys = await this.client.dbsize();
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
   */
  async flushAll(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.flushall();
      logger.warn("⚠️  All cache cleared");
    } catch (error) {
      logger.error("Cache flush error:", error);
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;

