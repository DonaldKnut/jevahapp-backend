// src/config/session.config.ts
// Redis-based session configuration with memory store fallback

import session from "express-session";
import { redisClient } from "../lib/redisClient";
import logger from "../utils/logger";

/**
 * Session Configuration with Redis Store (fallback to memory)
 *
 * Prefer RedisStore whenever REDIS_URL is configured — do NOT gate on
 * isRedisConnected() at module load (that race permanently stuck MemoryStore
 * because connectRedis() runs after app import).
 *
 * ioredis queues commands until ready; connect-redis works with a connecting client.
 */

const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.JWT_SECRET || "change-me-in-production";

let sessionStore: session.Store;

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;

try {
  if (redisUrl) {
    const RedisStore = require("connect-redis").default;
    sessionStore = new RedisStore({
      client: redisClient,
      prefix: "session:",
    });
    logger.info("Using Redis session store (client connects via REDIS_URL)");
  } else {
    throw new Error("REDIS_URL not configured");
  }
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
  if ((sessionStore as any).client) {
    const status = (sessionStore as any).client?.status;
    return status === "ready" || status === "connecting" || status === "connect";
  }
  return true;
}

if ((sessionStore as any).client) {
  (sessionStore as any).client?.on("ready", () => {
    logger.info("Redis session store ready");
  });

  (sessionStore as any).client?.on("error", (err: any) => {
    logger.error("Redis session store error", { error: err?.message });
  });
}

export default sessionMiddleware;
