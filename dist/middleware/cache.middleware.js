"use strict";
// src/middleware/cache.middleware.ts
// Response caching middleware for improved performance
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
exports.invalidateCache = exports.cacheMiddleware = void 0;
const cache_service_1 = __importDefault(require("../service/cache.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Cache middleware factory
 * @param ttl - Time to live in seconds (default: 5 minutes)
 * @param keyGenerator - Optional function to generate cache key
 */
const cacheMiddleware = (ttl = 300, keyGenerator, options) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Only cache GET requests
        if (req.method !== "GET") {
            return next();
        }
        const allowAuthenticated = (options === null || options === void 0 ? void 0 : options.allowAuthenticated) === true;
        const varyByUserId = (options === null || options === void 0 ? void 0 : options.varyByUserId) === true;
        if (req.userId && !allowAuthenticated)
            return next();
        // Skip if Redis is not connected
        if (!cache_service_1.default.isReady()) {
            return next();
        }
        // Generate cache key
        const cacheKey = keyGenerator
            ? keyGenerator(req)
            : `cache:${req.originalUrl}:${JSON.stringify(req.query)}${varyByUserId && req.userId ? `:user=${req.userId}` : ""}`;
        try {
            // Try to get from cache
            const cached = yield cache_service_1.default.get(cacheKey);
            if (cached) {
                res.setHeader("X-Cache", "HIT");
                res.setHeader("X-Cache-Key", cacheKey);
                logger_1.default.debug(`Cache HIT: ${cacheKey}`);
                res.json(cached);
                return;
            }
            // Cache miss - store original json method
            const originalJson = res.json.bind(res);
            res.json = function (data) {
                // Store in cache (async, don't block response)
                cache_service_1.default.set(cacheKey, data, ttl).catch((error) => {
                    logger_1.default.error("Cache set error in middleware:", error);
                });
                res.setHeader("X-Cache", "MISS");
                res.setHeader("X-Cache-Key", cacheKey);
                logger_1.default.debug(`Cache MISS: ${cacheKey}`);
                return originalJson(data);
            };
            next();
        }
        catch (error) {
            // If cache fails, continue without caching
            logger_1.default.error("Cache middleware error:", error);
            next();
        }
    });
};
exports.cacheMiddleware = cacheMiddleware;
/**
 * Invalidate cache middleware - clears cache after mutation operations
 * @param pattern - Pattern to match keys for invalidation
 */
const invalidateCache = (pattern) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // Store original json method
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            // Invalidate cache after successful mutation
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cache_service_1.default.delPattern(pattern).catch((error) => {
                    logger_1.default.error("Cache invalidation error:", error);
                });
                logger_1.default.debug(`Cache invalidated: ${pattern}`);
            }
            return originalJson(data);
        };
        next();
    });
};
exports.invalidateCache = invalidateCache;
