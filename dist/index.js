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
const PORT = process.env.PORT || 4000;
// Connect to MongoDB with optimized connection pooling
mongoose_1.default
    .connect(process.env.MONGODB_URI, database_config_1.mongooseConfig)
    .then(() => {
    logger_1.default.info("✅ MongoDB connected with connection pooling", {
        maxPoolSize: database_config_1.mongooseConfig.maxPoolSize,
        minPoolSize: database_config_1.mongooseConfig.minPoolSize,
    });
    app_1.server.listen(PORT, () => {
        logger_1.default.info(`✅ Server running at http://localhost:${PORT}`);
        logger_1.default.info(`🔌 Socket.IO server ready for real-time connections`);
        logger_1.default.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
        if (process.env.NODE_ENV === "production") {
            logger_1.default.info("🚀 Production mode enabled");
        }
        // Keep the server running
        logger_1.default.info("✅ Server is ready to accept requests!");
    });
})
    .catch(err => {
    logger_1.default.error("❌ MongoDB connection failed:", err);
    process.exit(1);
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
