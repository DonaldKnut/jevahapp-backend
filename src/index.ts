// src/index.ts

import mongoose from "mongoose";
import { server } from "./app";
import logger from "./utils/logger";
import { mongooseConfig } from "./config/database.config";

// Environment variables are loaded in app.ts

// Validate required environment variables
const requiredEnvVars = ["MONGODB_URI", "PORT", "JWT_SECRET"];

const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  logger.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || "4000", 10);

// Disable mongoose buffering globally (before connection)
mongoose.set("bufferCommands", false);

// Start server immediately so Render can detect the port
// MongoDB connection will happen in the background
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`✅ Server running on port ${PORT}`);
  logger.info(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
  logger.info(`🔌 Socket.IO server ready for real-time connections`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

  if (process.env.NODE_ENV === "production") {
    logger.info("🚀 Production mode enabled");
  }

  logger.info("⏳ Connecting to MongoDB...");
});

// Connect to MongoDB with optimized connection pooling (in background)
mongoose
  .connect(process.env.MONGODB_URI!, mongooseConfig)
  .then(() => {
    logger.info("✅ MongoDB connected with connection pooling", {
      maxPoolSize: mongooseConfig.maxPoolSize,
      minPoolSize: mongooseConfig.minPoolSize,
    });
    logger.info("✅ Server is ready to accept requests!");
  })
  .catch(err => {
    logger.error("❌ MongoDB connection failed:", err);
    // Don't exit - server is already running, health check will show DB status
    logger.warn("⚠️ Server running but MongoDB connection failed. Health check will show degraded status.");
  });

// Handle uncaught exceptions
process.on("uncaughtException", error => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
  process.exit(1);
});
