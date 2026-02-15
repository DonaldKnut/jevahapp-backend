// src/lib/redisClient.ts
// Unified Redis client using ioredis
// Can be imported anywhere in the backend
// Supports both local Redis and cloud Redis (via REDIS_URL env var)

import Redis, { RedisOptions } from "ioredis";
import logger from "../utils/logger";

/**
 * Redis Configuration
 * 
 * Environment Variable: REDIS_URL
 * - Local: redis://127.0.0.1:6379 (default)
 * - Cloud: redis://username:password@host:port
 * - Redis Cloud: redis://default:password@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
 * - AWS ElastiCache: redis://your-cluster.cache.amazonaws.com:6379
 * 
 * To switch to cloud Redis, simply update REDIS_URL in your .env file
 */

// Get Redis URL from environment (defaults to local)
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Parse Redis URL to extract connection options
function parseRedisUrl(url: string): RedisOptions {
  try {
    const parsed = new URL(url);
    
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      // Connection options
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Enable offline queue for better resilience
      enableOfflineQueue: true,
      // Connection timeout
      connectTimeout: 10000,
      // Keep alive
      keepAlive: 30000,
    };
  } catch (error) {
    logger.error("Invalid REDIS_URL format, using defaults", { url, error });
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    };
  }
}

// Create Redis client instance
const redisOptions = parseRedisUrl(REDIS_URL);
export const redisClient = new Redis(redisOptions);

// Connection status
let isConnected = false;
let connectionAttempts = 0;

// Event handlers
redisClient.on("connect", () => {
  connectionAttempts++;
  logger.info("🔄 Redis connecting...", {
    host: redisOptions.host,
    port: redisOptions.port,
    attempt: connectionAttempts,
  });
});

redisClient.on("ready", () => {
  isConnected = true;
  logger.info("✅ Redis connected and ready", {
    host: redisOptions.host,
    port: redisOptions.port,
    url: REDIS_URL.replace(/:[^:@]+@/, ":****@"), // Hide password in logs
  });
});

redisClient.on("error", (err) => {
  isConnected = false;
  logger.error("❌ Redis connection error", {
    error: err.message,
    host: redisOptions.host,
    port: redisOptions.port,
  });
});

redisClient.on("close", () => {
  isConnected = false;
  logger.warn("⚠️  Redis connection closed");
});

redisClient.on("reconnecting", (delay: number) => {
  logger.info("🔄 Redis reconnecting...", { delay });
});

// Connect to Redis (lazy connection - happens automatically on first command)
// But we can also explicitly connect
export async function connectRedis(): Promise<void> {
  try {
    if (!isConnected) {
      await redisClient.connect();
    }
  } catch (error: any) {
    logger.warn("Redis connection attempt failed (will retry on use)", {
      error: error?.message,
    });
  }
}

// Check if Redis is connected
export function isRedisConnected(): boolean {
  return isConnected && redisClient.status === "ready";
}

// Get Redis client instance (for direct access if needed)
export function getRedisClient(): Redis {
  return redisClient;
}

// Graceful shutdown
export async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    logger.info("✅ Redis disconnected gracefully");
  } catch (error: any) {
    logger.error("Error disconnecting Redis", { error: error?.message });
  }
}

// Safe Redis operation wrapper (never throws, returns fallback on error)
export async function redisSafe<T>(
  opName: string,
  fn: (client: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  if (!isConnected) {
    // Try to connect if not connected
    try {
      await connectRedis();
    } catch {
      // If connection fails, return fallback
      return fallback;
    }
  }

  try {
    return await fn(redisClient);
  } catch (err: any) {
    logger.warn("Redis operation failed (fallback used)", {
      op: opName,
      error: err?.message,
    });
    return fallback;
  }
}

// Export default
export default redisClient;

