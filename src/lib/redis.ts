import { Redis } from "@upstash/redis";
import logger from "../utils/logger";

/**
 * Centralized Upstash Redis (REST) client.
 *
 * IMPORTANT:
 * - Redis is an optimization layer only.
 * - If env vars are missing or Redis is down, the app must keep working.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis: Redis | null =
  url && token
    ? new Redis({
        url,
        token,
      })
    : null;

export function isRedisEnabled(): boolean {
  return redis !== null;
}

/**
 * Execute Redis code safely (never throws).
 * Use this for all Redis reads/writes in request handlers.
 */
export async function redisSafe<T>(
  opName: string,
  fn: (client: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  if (!redis) return fallback;
  try {
    return await fn(redis);
  } catch (err: any) {
    logger.warn("Redis operation failed (fallback to DB)", {
      op: opName,
      error: err?.message,
    });
    return fallback;
  }
}

