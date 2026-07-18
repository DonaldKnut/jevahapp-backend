/**
 * Authoritative Redis for engagement hot path (likes, rate limits, idempotency).
 * Uses Contabo / local ioredis via REDIS_URL — not Upstash REST.
 *
 * Fail-open: Redis outages must never block durable Mongo writes.
 */
import type Redis from "ioredis";
import {
  redisClient,
  redisSafe as ioredisSafe,
  isRedisConnected,
  connectRedis,
  getRedisClient,
} from "./redisClient";
import logger from "../utils/logger";

export { isRedisConnected, connectRedis, getRedisClient };

/** Safe wrapper over the engagement (ioredis) client */
export async function engagementRedisSafe<T>(
  opName: string,
  fn: (client: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  return ioredisSafe(opName, fn, fallback);
}

export async function engagementSetEx(
  key: string,
  value: string | number,
  ttlSeconds: number
): Promise<boolean> {
  return engagementRedisSafe(
    "engagementSetEx",
    async r => {
      await r.set(String(key), String(value), "EX", ttlSeconds);
      return true;
    },
    false
  );
}

export async function engagementGet(key: string): Promise<string | null> {
  return engagementRedisSafe(
    "engagementGet",
    async r => r.get(String(key)),
    null
  );
}

export async function engagementDel(...keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  return engagementRedisSafe(
    "engagementDel",
    async r => r.del(...keys),
    0
  );
}

/**
 * SET key value NX EX ttl — returns true if the key was set (first writer).
 */
export async function engagementSetNxEx(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean | null> {
  return engagementRedisSafe<boolean | null>(
    "engagementSetNxEx",
    async r => {
      const result = await r.set(key, value, "EX", ttlSeconds, "NX");
      return result === "OK";
    },
    null // Redis unavailable → caller fail-opens
  );
}

/**
 * Atomic fixed-window rate limit via Lua (INCR + PEXPIRE on first hit).
 * Returns null when Redis is unavailable (fail-open).
 */
export async function engagementRateLimitIncr(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number } | null> {
  const { key, limit, windowSeconds } = params;
  const windowMs = Math.max(1, windowSeconds) * 1000;

  const lua = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end
    local ttl = redis.call('PTTL', KEYS[1])
    if ttl < 0 then
      redis.call('PEXPIRE', KEYS[1], ARGV[1])
      ttl = tonumber(ARGV[1])
    end
    return { current, ttl }
  `;

  return engagementRedisSafe(
    "engagementRateLimitIncr",
    async r => {
      const raw = (await r.eval(lua, 1, key, String(windowMs))) as [
        number | string,
        number | string,
      ];
      const current = Number(raw[0]);
      const ttlMs = Number(raw[1]);
      const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      return { allowed, remaining, retryAfterSeconds };
    },
    null
  );
}

/** Simple in-process counters for ops dashboards / logs */
const metrics = {
  idempotencyHits: 0,
  idempotencyConflicts: 0,
  rateLimitRejections: 0,
  cacheFailures: 0,
};

export function bumpEngagementMetric(
  name: keyof typeof metrics,
  by = 1
): void {
  metrics[name] += by;
}

export function getEngagementMetrics(): Readonly<typeof metrics> {
  return { ...metrics };
}

export function logEngagementMetric(
  event: string,
  fields: Record<string, unknown> = {}
): void {
  logger.info(event, { ...fields, engagementMetrics: getEngagementMetrics() });
}

export { redisClient as engagementRedis };
