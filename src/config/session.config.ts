// src/config/session.config.ts
// Redis-based session configuration with memory store fallback

import session from "express-session";
import { redisClient, isRedisConnected } from "../lib/redisClient";
import logger from "../utils/logger";

/**
 * Session Configuration with Redis Store (fallback to memory)
 * 
 * Tries to use Redis for:
 * - Scalability (multiple server instances can share sessions)
 * - Performance (fast session lookups)
 * - Persistence (sessions survive server restarts)
 * 
 * Falls back to memory store if Redis is unavailable
 * 
 * To use cloud Redis, update REDIS_URL in .env
 */

// Session secret (should be in .env)
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || "change-me-in-production";

// Try to create Redis store, fallback to memory store if Redis fails
let sessionStore: session.Store;

try {
  if (isRedisConnected()) {
    const RedisStore = require("connect-redis").default;
    sessionStore = new RedisStore({
      client: redisClient,
      prefix: "session:", // All session keys will be prefixed with "session:"
    });
    logger.info("✅ Using Redis session store");
  } else {
    throw new Error("Redis not connected");
  }
} catch (error) {
  // Fallback to memory store if Redis fails (built-in, no extra package needed)
  logger.warn("⚠️  Redis session store unavailable, using memory store", { error: (error as Error)?.message });
  sessionStore = new session.MemoryStore();
  logger.info("✅ Using memory session store (sessions will be lost on restart)");
}

// Session configuration
export const sessionConfig: session.SessionOptions = {
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something stored
  name: "jevah.sid", // Session cookie name
  cookie: {
    secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // CSRF protection
    path: "/",
  },
  // Rolling sessions - extend session on activity
  rolling: true,
};

// Initialize session middleware
export const sessionMiddleware = session(sessionConfig);

// Helper to check if session store is ready
export function isSessionStoreReady(): boolean {
  // Only check if using Redis store
  if ((sessionStore as any).client) {
    return (sessionStore as any).client?.status === "ready";
  }
  // Memory store is always "ready"
  return true;
}

// Log session store status (only for Redis)
if ((sessionStore as any).client) {
  (sessionStore as any).client?.on("ready", () => {
    logger.info("✅ Redis session store ready");
  });

  (sessionStore as any).client?.on("error", (err: any) => {
    logger.error("❌ Redis session store error", { error: err?.message });
  });
}

export default sessionMiddleware;

