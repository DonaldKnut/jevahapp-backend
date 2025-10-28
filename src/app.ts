// src/app.ts
// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// Import routes
import userRoutes from "./routes/user.route";
import authRoutes from "./routes/auth.route";
import locationRoutes from "./routes/location.routes";
import mediaRoutes from "./routes/media.route";
import pushNotificationRoutes from "./routes/pushNotification.routes";
import aiReengagementRoutes from "./routes/aiReengagement.routes";
import bibleFactsRoutes from "./routes/bibleFacts.routes";
import adminRoutes from "./routes/admin.routes";
import devotionalsRoutes from "./routes/devotionals.routes";
import logsRoutes from "./routes/logs.routes";
// import artistRoutes from "./routes/artist.route";
import gamesRoutes from "./routes/games.route";
import paymentRoutes from "./routes/payment.route";
import bookmarksRoutes from "./routes/unifiedBookmark.routes";
import interactionRoutes from "./routes/interaction.routes";
import contentInteractionRoutes from "./routes/contentInteraction.routes";
import aiChatbotRoutes from "./routes/aiChatbot.routes";
import trendingRoutes from "./routes/trending.routes";
import userProfileRoutes from "./routes/userProfile.routes";
import healthRoutes from "./routes/health.routes";
import enhancedMediaRoutes from "./routes/enhancedMedia.route";
import merchandiseRoutes from "./routes/merchandise.route";
import analyticsRoutes from "./routes/analytics.routes";
import notificationRoutes from "./routes/notification.routes";
import hymnsRoutes from "./routes/hymns.routes";
import placesRoutes from "./routes/places.routes";
import churchesAdminRoutes from "./routes/churches.admin.routes";
import userContentRoutes from "./routes/userContent.routes";
import ebookRoutes from "./routes/ebook.routes";
import bibleRoutes from "./routes/bible.routes";
// import datingRoutes from "./routes/dating.route";

// Import services and utilities
import SocketService from "./service/socket.service";
import logger from "./utils/logger";
import swaggerSpec from "./config/swagger.config";
import swaggerUi from "swagger-ui-express";

// Create Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO service
const socketService = new SocketService(server);

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
  "http://10.0.2.2:4000",   // Android emulator
  "http://localhost:4000",  // iOS simulator
  // Add network-based origins dynamically
  ...(process.env.ALLOWED_ORIGINS?.split(",") || []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.some(allowed => origin.includes(allowed.replace(/^https?:\/\//, "")))) {
        return callback(null, true);
      }
      
      // For development, allow any localhost/network origin
      if (process.env.NODE_ENV === "development") {
        if (
          origin.includes("localhost") ||
          origin.includes("127.0.0.1") ||
          /^http:\/\/192\.168\.\d+\.\d+:19006$/.test(origin) || // Expo network
          /^http:\/\/10\.\d+\.\d+\.\d+:4000$/.test(origin)      // Network backend
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
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "expo-platform"],
  })
);

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info("Incoming request", {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.userId || "anonymous",
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
    documentation: "https://jevahapp-backend.onrender.com/api-docs",
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

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/push-notifications", pushNotificationRoutes);
app.use("/api/ai-reengagement", aiReengagementRoutes);
app.use("/api/bible-facts", bibleFactsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/devotionals", devotionalsRoutes);
app.use("/api/logs", logsRoutes);
// app.use("/api/artist", artistRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/payment", paymentRoutes);
// Mount unified bookmark routes at both singular and plural paths for compatibility
app.use("/api/bookmark", bookmarksRoutes);
app.use("/api/bookmarks", bookmarksRoutes);
logger.info("Bookmark routes mounted", {
  paths: ["/api/bookmark", "/api/bookmarks"],
});
app.use("/api/interactions", interactionRoutes);
app.use("/api/content", contentInteractionRoutes);
app.use("/api/ai-chatbot", aiChatbotRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/user-profiles", userProfileRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/enhanced-media", enhancedMediaRoutes);
app.use("/api/merchandise", merchandiseRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/hymns", hymnsRoutes);
app.use("/api", placesRoutes);
app.use("/api", churchesAdminRoutes);
app.use("/api", userContentRoutes);
app.use("/api/ebooks", ebookRoutes);
app.use("/api/tts", ebookRoutes);
app.use("/api/bible", bibleRoutes);

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
