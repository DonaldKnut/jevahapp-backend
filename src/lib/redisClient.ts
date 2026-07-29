// src/lib/redisClient.ts
// Unified Redis client using ioredis (REDIS_URL).
// Supports local Redis and TLS cloud Redis (Upstash rediss://, Redis Cloud, etc.).

import Redis, { RedisOptions } from "ioredis";
import logger from "../utils/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

function parseRedisUrl(url: string): RedisOptions {
  try {
    const parsed = new URL(url);
    const useTls =
      parsed.protocol === "rediss:" ||
      /\.upstash\.io$/i.test(parsed.hostname);

    const options: RedisOptions = {
      host: parsed.hostname,
      port: parseInt(parsed.port || (useTls ? "6379" : "6379"), 10),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      // Prefer IPv4 — Upstash / cloud DNS often breaks on IPv6-first stacks
      family: 4,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      enableOfflineQueue: true,
      connectTimeout: 15000,
      keepAlive: 30000,
      retryStrategy: (times: number) => {
        // Cap reconnect spam in logs; still retry indefinitely for resilience
        if (times > 20) return 5000;
        return Math.min(times * 100, 3000);
      },
    };

    // CRITICAL: constructing via host/port does NOT inherit rediss:// TLS.
    // Upstash requires TLS — without this you get endless ECONNRESET.
    if (useTls) {
      options.tls = {};
    }

    return options;
  } catch (error) {
    logger.error("Invalid REDIS_URL format, using localhost defaults", {
      error: (error as Error).message,
    });
    return {
      host: "127.0.0.1",
      port: 6379,
      family: 4,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    };
  }
}

const redisOptions = parseRedisUrl(REDIS_URL);
export const redisClient = new Redis(redisOptions);

let isConnected = false;
let connectionAttempts = 0;

redisClient.on("connect", () => {
  connectionAttempts++;
  logger.info("🔄 Redis connecting...", {
    host: redisOptions.host,
    port: redisOptions.port,
    tls: Boolean(redisOptions.tls),
    attempt: connectionAttempts,
  });
});

redisClient.on("ready", () => {
  isConnected = true;
  logger.info("✅ Redis connected and ready", {
    host: redisOptions.host,
    port: redisOptions.port,
    tls: Boolean(redisOptions.tls),
    url: REDIS_URL.replace(/:[^:@]+@/, ":****@"),
  });
});

redisClient.on("error", (err) => {
  isConnected = false;
  // Throttle identical connection errors — Upstash misconfig used to spam every 2s
  if (connectionAttempts <= 3 || connectionAttempts % 25 === 0) {
    logger.error("❌ Redis connection error", {
      error: err.message,
      host: redisOptions.host,
      port: redisOptions.port,
      tls: Boolean(redisOptions.tls),
      hint: redisOptions.tls
        ? undefined
        : "If using Upstash, REDIS_URL must be rediss:// and tls must be enabled",
    });
  }
});

redisClient.on("close", () => {
  isConnected = false;
  if (connectionAttempts <= 3 || connectionAttempts % 25 === 0) {
    logger.warn("⚠️  Redis connection closed");
  }
});

redisClient.on("reconnecting", (delay: number) => {
  if (connectionAttempts <= 5 || connectionAttempts % 25 === 0) {
    logger.info("🔄 Redis reconnecting...", { delay, attempt: connectionAttempts });
  }
});

export async function connectRedis(): Promise<void> {
  try {
    if (!isConnected && redisClient.status !== "connecting") {
      await redisClient.connect();
    }
  } catch (error: any) {
    logger.warn("Redis connection attempt failed (will retry on use)", {
      error: error?.message,
      host: redisOptions.host,
      tls: Boolean(redisOptions.tls),
    });
  }
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient.status === "ready";
}

export function getRedisClient(): Redis {
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    logger.info("✅ Redis disconnected gracefully");
  } catch (error: any) {
    logger.error("Error disconnecting Redis", { error: error?.message });
  }
}

export async function redisSafe<T>(
  opName: string,
  fn: (client: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  if (!isConnected) {
    try {
      await connectRedis();
    } catch {
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

export default redisClient;
