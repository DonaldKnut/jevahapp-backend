import { redisSafe } from "./redis";

/**
 * Simple Redis-backed rate limiter (per key, fixed window).
 * Uses atomic INCR and sets EXPIRE on first hit.
 *
 * Redis is optional: if Redis is down, returns allowed=true (do not break UX).
 */
export async function redisRateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const { key, limit, windowSeconds } = params;

  return await redisSafe(
    "rateLimit",
    async (r) => {
      const current = await r.incr(key);
      if (current === 1) {
        // First hit in this window → set TTL
        await r.expire(key, windowSeconds);
      }
      const remaining = Math.max(0, limit - current);
      return { allowed: current <= limit, remaining };
    },
    { allowed: true, remaining: limit }
  );
}

