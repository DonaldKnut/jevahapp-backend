import { engagementRateLimitIncr } from "./engagementRedis";

/**
 * Redis-backed fixed-window rate limiter (engagement Redis / ioredis).
 * Atomic INCR + PEXPIRE via Lua. Fail-open when Redis is down.
 */
export async function redisRateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}> {
  const { key, limit, windowSeconds } = params;
  const result = await engagementRateLimitIncr({ key, limit, windowSeconds });

  if (!result) {
    // Redis unavailable — do not break UX
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }

  return result;
}
