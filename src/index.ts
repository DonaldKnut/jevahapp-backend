// src/index.ts
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { server } from "./app";
import logger from "./utils/logger";
import { mongooseConfig } from "./config/database.config";
import { connectRedis } from "./lib/redisClient";

// Validate required environment variables
const requiredEnvVars = ["MONGODB_URI", "PORT", "JWT_SECRET"];
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  logger.warn(
    `Missing required environment variables: ${missingVars.join(
      ", "
    )}. Using defaults where possible.`
  );
}

// Defaults for local/dev
const PORT = parseInt(process.env.PORT || "4000", 10);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/jevah";

// Disable mongoose buffering globally (before connection)
mongoose.set("bufferCommands", false);

// Start server immediately
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`✅ Server running on port ${PORT}`);
  logger.info(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
  logger.info(`🔌 Socket.IO server ready`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

  if (process.env.NODE_ENV === "production") {
    logger.info("🚀 Production mode enabled");
  }

  logger.info("⏳ Connecting to MongoDB...");
  logger.info("⏳ Connecting to Redis...");
});

// Connect to Redis (non-blocking, will retry on use if fails)
connectRedis().catch(() => {
  logger.warn("Redis connection will be attempted on first use");
});

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, mongooseConfig)
  .then(() => {
    logger.info("✅ MongoDB connected with pooling", {
      maxPoolSize: mongooseConfig.maxPoolSize,
      minPoolSize: mongooseConfig.minPoolSize,
    });
    logger.info("✅ Server ready for requests!");
  })
  .catch(err => {
    logger.error("❌ MongoDB connection failed:", err);
    logger.warn(
      "⚠️ Server running but MongoDB connection failed. Health check will show degraded status."
    );
  });

// Handle exceptions
process.on("uncaughtException", error => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
  process.exit(1);
});
