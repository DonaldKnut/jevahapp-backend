// src/middleware/cache.middleware.ts
// Response caching middleware for improved performance

import { Request, Response, NextFunction } from "express";
import cacheService from "../service/cache.service";
import logger from "../utils/logger";

/**
 * Cache middleware factory
 * @param ttl - Time to live in seconds (default: 5 minutes)
 * @param keyGenerator - Optional function to generate cache key
 */
export const cacheMiddleware = (
  ttl: number = 300,
  keyGenerator?: (req: Request) => string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Skip cache for authenticated user-specific data
    if (req.userId) {
      return next();
    }

    // Skip if Redis is not connected
    if (!cacheService.isReady()) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;

    try {
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Key", cacheKey);
        logger.debug(`Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }

      // Cache miss - store original json method
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        // Store in cache (async, don't block response)
        cacheService.set(cacheKey, data, ttl).catch((error) => {
          logger.error("Cache set error in middleware:", error);
        });
        
        res.setHeader("X-Cache", "MISS");
        res.setHeader("X-Cache-Key", cacheKey);
        logger.debug(`Cache MISS: ${cacheKey}`);
        
        return originalJson(data);
      };

      next();
    } catch (error) {
      // If cache fails, continue without caching
      logger.error("Cache middleware error:", error);
      next();
    }
  };
};

/**
 * Invalidate cache middleware - clears cache after mutation operations
 * @param pattern - Pattern to match keys for invalidation
 */
export const invalidateCache = (pattern: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    res.json = function (data: any) {
      // Invalidate cache after successful mutation
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.delPattern(pattern).catch((error) => {
          logger.error("Cache invalidation error:", error);
        });
        logger.debug(`Cache invalidated: ${pattern}`);
      }
      
      return originalJson(data);
    };

    next();
  };
};

