#!/usr/bin/env node
/**
 * Test Redis Connection Script
 * 
 * Usage:
 *   node scripts/test-redis-connection.js
 *   REDIS_URL=redis://localhost:6379 node scripts/test-redis-connection.js
 */

require("dotenv").config();
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

console.log("🔍 Testing Redis connection...");
console.log(`📍 Redis URL: ${redisUrl.replace(/:[^:@]+@/, ":****@")}`); // Hide password if present

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis
  .on("connect", () => {
    console.log("🟡 Connecting to Redis...");
  })
  .on("ready", () => {
    console.log("✅ Redis ready!");
  })
  .on("error", (err) => {
    console.error("❌ Redis error:", err.message);
  });

async function testConnection() {
  try {
    // Test ping
    const pong = await redis.ping();
    console.log(`✅ PING: ${pong}`);

    // Test set/get
    await redis.set("test:connection", "ok", "EX", 10);
    const value = await redis.get("test:connection");
    console.log(`✅ SET/GET: ${value}`);

    // Get info
    const info = await redis.info("server");
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log(`✅ Redis version: ${version || "unknown"}`);

    // Get database size
    const dbsize = await redis.dbsize();
    console.log(`✅ Keys in database: ${dbsize}`);

    console.log("\n🎉 Redis connection test PASSED!");
    console.log("✅ Your Redis is working correctly!");
  } catch (error) {
    console.error("\n❌ Redis connection test FAILED!");
    console.error("Error:", error.message);
    console.error("\n💡 Troubleshooting:");
    console.error("1. Check if Redis is running: redis-cli ping");
    console.error("2. Check REDIS_URL in .env file");
    console.error("3. For production, verify Redis service is running in Render");
    process.exit(1);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

// Run test
testConnection();
