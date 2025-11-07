// src/config/database.config.ts
// Optimized MongoDB connection configuration

export const mongooseConfig = {
  maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || "10"),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || "2"),
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true,
  retryReads: true,
};

