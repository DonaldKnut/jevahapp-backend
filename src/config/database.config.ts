// src/config/database.config.ts
// Optimized MongoDB connection configuration

import type { ConnectOptions } from "mongoose";

/**
 * Default readPreference MUST be `primary` for this API.
 * Engagement paths (CF views, likes, shares, comments) use multi-document
 * transactions; MongoDB rejects `primaryPreferred` / secondary reads inside
 * transactions ("Read preference in a transaction must be primary").
 * Opt into secondary reads per-query for analytics if needed later.
 */
export const mongooseConfig: ConnectOptions = {
  maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || "10"),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || "2"),
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true,
  retryReads: true,
  // Performance optimizations
  maxIdleTimeMS: 30000, // Close idle connections after 30s
  connectTimeoutMS: 10000, // 10s connection timeout
  heartbeatFrequencyMS: 10000, // Check connection health every 10s
  readPreference: "primary",
};
