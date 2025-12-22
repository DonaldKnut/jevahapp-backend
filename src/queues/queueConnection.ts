import IORedis from "ioredis";

/**
 * Shared Redis connection for BullMQ.
 * BullMQ requires a real ioredis connection (not node-redis v4 client).
 */
export function createBullConnection() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // BullMQ recommendation
    enableReadyCheck: false, // BullMQ recommendation
  });
}

