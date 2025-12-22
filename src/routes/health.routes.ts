import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import logger from "../utils/logger";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

interface HealthServices {
  database?: {
    status: string;
    responseTime: number;
    connectionState: number;
    error?: string;
  };
  memory?: {
    status: string;
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu?: {
    status: string;
    usage: number;
    cores: number;
  };
}

interface HealthData {
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: HealthServices;
  status?: string;
  responseTime?: number;
  error?: string;
}

/**
 * @route   GET /api/health/database
 * @desc    Check database connectivity and health
 * @access  Public
 * @returns { success: boolean, status: string, responseTime: number, details: object }
 */
router.get("/database", asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      const responseTime = Date.now() - startTime;
      
      logger.warn("Database health check failed", {
        status: "unhealthy",
        connectionState: mongoose.connection.readyState,
        responseTime
      });

      return res.status(503).json({
        success: false,
        status: "unhealthy",
        responseTime,
        details: {
          connectionState: mongoose.connection.readyState,
          message: "Database is not connected"
        }
      });
    }

    // Ping the database
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not available");
    }
    
    await db.admin().ping();
    const responseTime = Date.now() - startTime;

    // Get database stats
    const dbStats = await db.stats();
    
    logger.info("Database health check successful", {
      status: "healthy",
      responseTime,
      connectionState: mongoose.connection.readyState
    });

    res.status(200).json({
      success: true,
      status: "healthy",
      responseTime,
      details: {
        connectionState: mongoose.connection.readyState,
        database: mongoose.connection.name,
        collections: dbStats.collections,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        indexes: dbStats.indexes,
        indexSize: dbStats.indexSize
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error("Database health check error", {
      error: errorMessage,
      responseTime
    });

    res.status(503).json({
      success: false,
      status: "error",
      responseTime,
      details: {
        error: errorMessage,
        connectionState: mongoose.connection.readyState
      }
    });
  }
}));

/**
 * @route   GET /api/health/full
 * @desc    Comprehensive health check including all services
 * @access  Public
 * @returns { success: boolean, status: string, services: object }
 */
router.get("/full", asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const health: HealthData = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "2.0.0",
    services: {}
  };

  try {
    // Database health check
    const dbStartTime = Date.now();
    if (mongoose.connection.readyState === 1) {
      const db = mongoose.connection.db;
      if (db) {
        await db.admin().ping();
        health.services.database = {
          status: "healthy",
          responseTime: Date.now() - dbStartTime,
          connectionState: mongoose.connection.readyState
        };
      } else {
        health.services.database = {
          status: "unhealthy",
          responseTime: Date.now() - dbStartTime,
          connectionState: mongoose.connection.readyState,
          error: "Database connection not available"
        };
      }
    } else {
      health.services.database = {
        status: "unhealthy",
        responseTime: Date.now() - dbStartTime,
        connectionState: mongoose.connection.readyState,
        error: "Database not connected"
      };
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    health.services.memory = {
      status: "healthy",
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    };

    // CPU usage (simplified)
    const cpus = require("os").cpus();
    const totalIdle = cpus.reduce((acc: number, cpu: any) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc: number, cpu: any) => 
      acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq, 0);
    
    health.services.cpu = {
      status: "healthy",
      usage: Math.round((1 - totalIdle / totalTick) * 100),
      cores: cpus.length
    };

    // Overall status
    const allHealthy = Object.values(health.services).every((service: any) => service.status === "healthy");
    health.status = allHealthy ? "healthy" : "degraded";
    health.responseTime = Date.now() - startTime;

    const statusCode = allHealthy ? 200 : 503;

    logger.info("Full health check completed", {
      status: health.status,
      responseTime: health.responseTime,
      services: Object.keys(health.services)
    });

    res.status(statusCode).json({
      success: allHealthy,
      ...health
    });

  } catch (error) {
    health.status = "error";
    health.responseTime = Date.now() - startTime;
    health.error = error instanceof Error ? error.message : 'Unknown error';

    logger.error("Full health check failed", {
      error: health.error,
      responseTime: health.responseTime
    });

    res.status(503).json({
      success: false,
      ...health
    });
  }
}));

/**
 * @route   GET /api/health/warmup
 * @desc    Lightweight endpoint to wake up backend from cold start
 * @access  Public
 * @returns { status: string, timestamp: number }
 * 
 * This endpoint is designed to be called FIRST by the frontend on app start.
 * It's lightweight (no database queries) and helps wake up Render.com instances.
 */
router.get("/warmup", (req: Request, res: Response) => {
  res.status(200).json({
    status: "warm",
    timestamp: Date.now(),
    message: "Backend is ready",
  });
});

export default router;
