// src/config/session.config.ts
// Redis-based session configuration with memory store fallback
//
// connect-redis@9 dropped ioredis; pin @8 so sessions use the same
// REDIS_URL / ioredis client as likes, queues, and rate limits.

import session from "express-session";
import { redisClient } from "../lib/redisClient";
import logger from "../utils/logger";

// Named export at runtime; @types/connect-redis can erase RedisStore as a value.
const { RedisStore } = require("connect-redis") as {
  RedisStore: new (opts: { client: unknown; prefix?: string }) => session.Store;
};

/**
 * Prefer RedisStore whenever REDIS_URL is configured — do NOT gate on
 * isRedisConnected() at module load (that race permanently stuck MemoryStore
 * because connectRedis() runs after app import).
 *
 * ioredis queues commands until ready; connect-redis@8 works with a connecting client.
 */

const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.JWT_SECRET || "change-me-in-production";

let sessionStore: session.Store;
let usingRedisStore = false;

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;

try {
  if (!redisUrl) {
    throw new Error("REDIS_URL not configured");
  }

  sessionStore = new RedisStore({
    client: redisClient,
    prefix: "session:",
  });
  usingRedisStore = true;
  logger.info("Using Redis session store (client connects via REDIS_URL)");
} catch (error) {
  logger.warn("Redis session store unavailable, using memory store", {
    error: (error as Error)?.message,
  });
  sessionStore = new session.MemoryStore();
  logger.info("Using memory session store (sessions will be lost on restart)");
}

export const sessionConfig: session.SessionOptions = {
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "jevah.sid",
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  },
  rolling: true,
};

export const sessionMiddleware = session(sessionConfig);

export function isSessionStoreReady(): boolean {
  if (!usingRedisStore) return true;
  const status = redisClient.status;
  return status === "ready" || status === "connecting" || status === "connect";
}

if (usingRedisStore) {
  redisClient.on("ready", () => {
    logger.info("Redis session store ready");
  });

  redisClient.on("error", (err: Error) => {
    logger.error("Redis session store error", { error: err?.message });
  });
}

export default sessionMiddleware;
