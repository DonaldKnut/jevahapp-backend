"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/health/database
 * @desc    Check database connectivity and health
 * @access  Public
 * @returns { success: boolean, status: string, responseTime: number, details: object }
 */
router.get("/database", (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        // Check if MongoDB is connected
        if (mongoose_1.default.connection.readyState !== 1) {
            const responseTime = Date.now() - startTime;
            logger_1.default.warn("Database health check failed", {
                status: "unhealthy",
                connectionState: mongoose_1.default.connection.readyState,
                responseTime
            });
            return res.status(503).json({
                success: false,
                status: "unhealthy",
                responseTime,
                details: {
                    connectionState: mongoose_1.default.connection.readyState,
                    message: "Database is not connected"
                }
            });
        }
        // Ping the database
        const db = mongoose_1.default.connection.db;
        if (!db) {
            throw new Error("Database connection not available");
        }
        yield db.admin().ping();
        const responseTime = Date.now() - startTime;
        // Get database stats
        const dbStats = yield db.stats();
        logger_1.default.info("Database health check successful", {
            status: "healthy",
            responseTime,
            connectionState: mongoose_1.default.connection.readyState
        });
        res.status(200).json({
            success: true,
            status: "healthy",
            responseTime,
            details: {
                connectionState: mongoose_1.default.connection.readyState,
                database: mongoose_1.default.connection.name,
                collections: dbStats.collections,
                dataSize: dbStats.dataSize,
                storageSize: dbStats.storageSize,
                indexes: dbStats.indexes,
                indexSize: dbStats.indexSize
            }
        });
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error("Database health check error", {
            error: errorMessage,
            responseTime
        });
        res.status(503).json({
            success: false,
            status: "error",
            responseTime,
            details: {
                error: errorMessage,
                connectionState: mongoose_1.default.connection.readyState
            }
        });
    }
})));
/**
 * @route   GET /api/health/full
 * @desc    Comprehensive health check including all services
 * @access  Public
 * @returns { success: boolean, status: string, services: object }
 */
router.get("/full", (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    const health = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        version: process.env.npm_package_version || "2.0.0",
        services: {}
    };
    try {
        // Database health check
        const dbStartTime = Date.now();
        if (mongoose_1.default.connection.readyState === 1) {
            const db = mongoose_1.default.connection.db;
            if (db) {
                yield db.admin().ping();
                health.services.database = {
                    status: "healthy",
                    responseTime: Date.now() - dbStartTime,
                    connectionState: mongoose_1.default.connection.readyState
                };
            }
            else {
                health.services.database = {
                    status: "unhealthy",
                    responseTime: Date.now() - dbStartTime,
                    connectionState: mongoose_1.default.connection.readyState,
                    error: "Database connection not available"
                };
            }
        }
        else {
            health.services.database = {
                status: "unhealthy",
                responseTime: Date.now() - dbStartTime,
                connectionState: mongoose_1.default.connection.readyState,
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
        const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
        const totalTick = cpus.reduce((acc, cpu) => acc + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq, 0);
        health.services.cpu = {
            status: "healthy",
            usage: Math.round((1 - totalIdle / totalTick) * 100),
            cores: cpus.length
        };
        // Overall status
        const allHealthy = Object.values(health.services).every((service) => service.status === "healthy");
        health.status = allHealthy ? "healthy" : "degraded";
        health.responseTime = Date.now() - startTime;
        const statusCode = allHealthy ? 200 : 503;
        logger_1.default.info("Full health check completed", {
            status: health.status,
            responseTime: health.responseTime,
            services: Object.keys(health.services)
        });
        res.status(statusCode).json(Object.assign({ success: allHealthy }, health));
    }
    catch (error) {
        health.status = "error";
        health.responseTime = Date.now() - startTime;
        health.error = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error("Full health check failed", {
            error: health.error,
            responseTime: health.responseTime
        });
        res.status(503).json(Object.assign({ success: false }, health));
    }
})));
/**
 * @route   GET /api/health/warmup
 * @desc    Lightweight endpoint to wake up backend from cold start
 * @access  Public
 * @returns { status: string, timestamp: number }
 *
 * This endpoint is designed to be called FIRST by the frontend on app start.
 * It's lightweight (no database queries) and helps wake up Render.com instances.
 */
router.get("/warmup", (req, res) => {
    res.status(200).json({
        status: "warm",
        timestamp: Date.now(),
        message: "Backend is ready",
    });
});
exports.default = router;
