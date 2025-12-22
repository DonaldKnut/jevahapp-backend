"use strict";
// src/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
const logger_1 = __importDefault(require("./utils/logger"));
const database_config_1 = require("./config/database.config");
// Environment variables are loaded in app.ts
// Validate required environment variables
const requiredEnvVars = ["MONGODB_URI", "PORT", "JWT_SECRET"];
const missingVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingVars.length > 0) {
    logger_1.default.error(`Missing required environment variables: ${missingVars.join(", ")}`);
    process.exit(1);
}
const PORT = parseInt(process.env.PORT || "4000", 10);
// Disable mongoose buffering globally (before connection)
mongoose_1.default.set("bufferCommands", false);
// Start server immediately so Render can detect the port
// MongoDB connection will happen in the background
app_1.server.listen(PORT, "0.0.0.0", () => {
    logger_1.default.info(`✅ Server running on port ${PORT}`);
    logger_1.default.info(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
    logger_1.default.info(`🔌 Socket.IO server ready for real-time connections`);
    logger_1.default.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    if (process.env.NODE_ENV === "production") {
        logger_1.default.info("🚀 Production mode enabled");
    }
    logger_1.default.info("⏳ Connecting to MongoDB...");
});
// Connect to MongoDB with optimized connection pooling (in background)
mongoose_1.default
    .connect(process.env.MONGODB_URI, database_config_1.mongooseConfig)
    .then(() => {
    logger_1.default.info("✅ MongoDB connected with connection pooling", {
        maxPoolSize: database_config_1.mongooseConfig.maxPoolSize,
        minPoolSize: database_config_1.mongooseConfig.minPoolSize,
    });
    logger_1.default.info("✅ Server is ready to accept requests!");
})
    .catch(err => {
    logger_1.default.error("❌ MongoDB connection failed:", err);
    // Don't exit - server is already running, health check will show DB status
    logger_1.default.warn("⚠️ Server running but MongoDB connection failed. Health check will show degraded status.");
});
// Handle uncaught exceptions
process.on("uncaughtException", error => {
    logger_1.default.error("Uncaught Exception:", error);
    process.exit(1);
});
// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    logger_1.default.error("Unhandled Rejection", { reason, promise });
    process.exit(1);
});
