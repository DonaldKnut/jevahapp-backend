// src/index.ts

import mongoose from "mongoose";
import { server } from "./app";
import logger from "./utils/logger";

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

const PORT = process.env.PORT || 4000;

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => {
    logger.info("✅ MongoDB connected successfully");

    server.listen(PORT, () => {
      logger.info(`✅ Server running at http://localhost:${PORT}`);
      logger.info(`🔌 Socket.IO server ready for real-time connections`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

      if (process.env.NODE_ENV === "production") {
        logger.info("🚀 Production mode enabled");
      }

      // Keep the server running
      logger.info("✅ Server is ready to accept requests!");
    });
  })
  .catch(err => {
    logger.error("❌ MongoDB connection failed:", err);
    process.exit(1);
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
