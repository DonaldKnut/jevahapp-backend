/**
 * Shared CORS policy for the Express API and Socket.IO.
 *
 * Hard rule: the origin resolver must NEVER throw or call back with an Error.
 * `cors()` forwards a callback Error to the Express error handler, which turns
 * every browser request (including preflight) into a 500 with no
 * Access-Control-Allow-* headers, so the browser reports a bare network
 * failure. Denials must be `callback(null, false)`.
 */
import type { CorsOptions } from "cors";
import logger from "../utils/logger";

/** Origins always allowed, plus anything in ALLOWED_ORIGINS. */
export const allowedOrigins: string[] = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:19006", // Expo
  "http://localhost:5173", // Vite
  "http://localhost:8081", // Metro
  "http://10.0.2.2:4000", // Android emulator → host
  "http://localhost:4000",
  ...(process.env.ALLOWED_ORIGINS?.split(",")
    .map(s => s.trim())
    .filter(Boolean) || []),
];

export function isPrivateNetworkOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Product hosts are allowed without env config so a missing ALLOWED_ORIGINS on
 * the server can never lock the web app out of its own API.
 */
export function isKnownProductOrigin(origin: string): boolean {
  const host = origin.toLowerCase();
  return (
    host.includes("jevahapp.com") ||
    host.includes(".vercel.app") ||
    host.includes(".netlify.app")
  );
}

function allowDevCors(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEV_CORS === "true"
  );
}

/** Pure predicate — safe to unit test and never throws. */
export function isOriginAllowed(origin: string | undefined): boolean {
  // Mobile apps, curl, server-to-server — no Origin header
  if (!origin) return true;

  const inAllowlist = allowedOrigins.some(allowed => {
    const bare = allowed.replace(/^https?:\/\//, "");
    return origin === allowed || origin.includes(bare);
  });
  if (inAllowlist) return true;

  if (isKnownProductOrigin(origin)) return true;

  // Local / LAN browsers (Vite, Expo web, admin on 192.168.x.x:5173, etc.)
  if (allowDevCors() && isPrivateNetworkOrigin(origin)) return true;

  return false;
}

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);

    logger.warn("CORS blocked origin", {
      origin,
      nodeEnv: process.env.NODE_ENV,
      hint: "Add to ALLOWED_ORIGINS or set ALLOW_DEV_CORS=true for local prod NODE_ENV",
    });
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "expo-platform",
    "Idempotency-Key",
    "X-Request-Id",
  ],
  exposedHeaders: ["Retry-After", "X-Request-Id"],
  optionsSuccessStatus: 204,
};

/** Socket.IO shares the same policy so browser sockets match REST. */
export const socketCorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => callback(null, isOriginAllowed(origin)),
  methods: ["GET", "POST"],
  credentials: true,
};
