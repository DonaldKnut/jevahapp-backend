// src/app.ts
// Note: Environment variables are loaded in index.ts

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { requestIdMiddleware } from "./middleware/requestId.middleware";
import { sessionMiddleware } from "./config/session.config";

// Modular route registration (see src/modules/)
import { registerModules } from "./modules";

// Import services and utilities
import SocketService from "./service/socket.service";
import logger from "./utils/logger";
import swaggerSpec from "./config/swagger.config";
import swaggerUi from "swagger-ui-express";
import socketManager from "./socket/socketManager";

// Create Express app
const app = express();
const server = createServer(app);

// Request ID must be first so every log line can include it
app.use(requestIdMiddleware);

// Initialize Socket.IO service
const socketService = new SocketService(server);

// Initialize socket manager with io instance
socketManager.setIO(socketService.getIO());

// Initialize upload progress service with Socket.IO
import { uploadProgressService } from "./service/uploadProgress.service";
uploadProgressService.initialize(socketService.getIO());

// Production-grade middleware setup
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration - Allow all frontend origins
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:19006", // Expo local dev server
  "http://10.0.2.2:4000", // Android emulator
  "http://localhost:4000", // iOS simulator
  // Add network-based origins dynamically
  ...(process.env.ALLOWED_ORIGINS?.split(",") || []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (
        allowedOrigins.some(allowed =>
          origin.includes(allowed.replace(/^https?:\/\//, ""))
        )
      ) {
        return callback(null, true);
      }

      // For development, allow any localhost/network origin
      if (process.env.NODE_ENV === "development") {
        if (
          origin.includes("localhost") ||
          origin.includes("127.0.0.1") ||
          /^http:\/\/192\.168\.\d+\.\d+:19006$/.test(origin) || // Expo network
          /^http:\/\/10\.\d+\.\d+\.\d+:4000$/.test(origin) // Network backend
        ) {
          return callback(null, true);
        }
      }

      // Allow Render preview deployments
      if (origin.includes(".onrender.com")) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "expo-platform",
    ],
  })
);

// Compression middleware - Optimized for mobile data savings
// Compresses JSON/text responses to reduce mobile data usage (airtime)
// This significantly reduces the amount of data transferred, saving users' mobile data/airtime
app.use(
  compression({
    // OPTIMIZED: Lower threshold to 512 bytes for better mobile data savings
    // Modern CPUs handle compression efficiently, so compress more responses
    threshold: 512,
    // Use compression level 6 (good balance between CPU usage and compression ratio)
    // Higher levels (7-9) use more CPU but compress better - 6 is optimal for mobile
    level: 6,
    // Filter: compress JSON, text, and common API response types
    // Skip already-compressed formats (images, videos, etc.) to save CPU
    filter: (req, res) => {
      // Don't compress if client explicitly doesn't want it
      if (req.headers["x-no-compression"]) {
        return false;
      }
      
      // Get content type from response headers
      const contentType = res.getHeader("content-type");
      if (typeof contentType === "string") {
        // Compress JSON and text responses (most API responses)
        // These compress very well (often 70-90% reduction)
        const compressibleTypes = [
          "application/json",
          "text/",
          "application/javascript",
          "application/xml",
          "application/x-www-form-urlencoded",
        ];
        
        return compressibleTypes.some((type) => contentType.includes(type));
      }
      
      // For responses without content-type or unknown types, use default behavior
      // Default compression filter checks Accept-Encoding header
      return true;
    },
  })
);

// Keep-Alive headers for better connection reuse
app.use((req, res, next) => {
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Keep-Alive", "timeout=5, max=100");
  next();
});

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser()); // Parse cookies for refresh token support

// Redis-based session management
// Sessions are stored in Redis for scalability and performance
// To use cloud Redis, update REDIS_URL in .env
app.use(sessionMiddleware);

// Request logging middleware
let firstRequestLogged = false;
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log marker for the very first request after (re)start
  if (!firstRequestLogged) {
    firstRequestLogged = true;
    logger.info("FIRST REQUEST AFTER STARTUP", {
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  // Log request
  logger.info("Incoming request", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.userId || "anonymous",
    requestId: req.requestId,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any): any {
    const duration = Date.now() - startTime;
    logger.logHttpRequest(req, res, duration);
    return originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Root endpoint - API information
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Jevah API v2.0.0 - Gospel Media Platform",
    version: process.env.npm_package_version || "2.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      health: "/health",
      apiDocs: "/api-docs",
      apiDocsJson: "/api-docs.json",
      test: "/api/test",
      auth: "/api/auth",
      users: "/api/users",
      media: "/api/media",
      aiChatbot: "/api/ai-chatbot",
      trending: "/api/trending",
      userProfiles: "/api/user-profiles",
      healthCheck: "/api/health",
      hymns: "/api/hymns",
      ebooks: "/api/ebooks",
      tts: "/api/tts",
      bible: "/api/bible",
      community: "/api/community/modules",
      audio: "/api/audio",
    },
    features: [
      "User Authentication & Authorization",
      "Media Upload & Streaming",
      "AI Biblical Counseling",
      "Live Streaming with Contabo",
      "Trending Analytics",
      "Real-time Interactions",
      "User Profile Management",
      "Hymns & Scripture-based Music",
      "Ebook Text Extraction & TTS",
      "Complete Bible Access & Search",
    ],
    documentation: "https://jevahapp-backend-rped.onrender.com/api-docs",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "2.0.0",
  });
});

// API documentation - enabled for testing
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Jevah API Documentation",
    customfavIcon: "/favicon.ico",
  })
);

app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// API Routes (modular: each domain in src/modules/<domain>/index.ts)
registerModules(app);

// Add a simple test route
app.get("/api/test", (req, res) => {
  res.json({
    message: "Server is working!",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  logger.warn("Route not found", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error", {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.originalUrl,
      userId: req.userId || "anonymous",
      requestId: (req as any).requestId,
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === "development";

    res.status(error.status || 500).json({
      success: false,
      message: isDevelopment ? error.message : "Internal server error",
      ...(isDevelopment && { stack: error.stack }),
    });
  }
);

// Lightweight self-ping to mitigate cold starts (configurable)
(() => {
  const enabled =
    (process.env.SELF_PING_ENABLED || "true").toLowerCase() !== "false";
  const intervalMinutes = parseInt(
    process.env.SELF_PING_INTERVAL_MIN || "10",
    10
  );
  const baseUrl =
    process.env.SELF_PING_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.BACKEND_BASE_URL ||
    "http://localhost:4000";

  if (enabled && intervalMinutes > 0) {
    const ping = async () => {
      try {
        const url = `${baseUrl.replace(/\/$/, "")}/health`;
        const response = await fetch(url, { method: "GET" });
        if (response.ok) {
          logger.info("Self-ping successful", {
            url,
            timestamp: new Date().toISOString(),
          });
        } else {
          logger.warn("Self-ping non-200", { status: response.status, url });
        }
      } catch (error: any) {
        logger.warn("Self-ping failed", { error: error?.message });
      }
    };

    // Initial ping shortly after boot, then on interval
    setTimeout(ping, 5000);
    setInterval(ping, intervalMinutes * 60 * 1000);

    logger.info("Self-ping enabled", {
      baseUrl,
      intervalMinutes,
    });
  } else {
    logger.info("Self-ping disabled", { enabled, intervalMinutes });
  }
})();

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

// Export both app and server for testing and Socket.IO access
export { app, server, socketService };
export default app;
