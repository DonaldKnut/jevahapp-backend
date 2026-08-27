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
  keyGenerator?: (req: Request) => string,
  options?: {
    /**
     * If true, authenticated requests can be cached too.
     * Use only when the response is NOT user-specific (or when you provide a per-user key).
     */
    allowAuthenticated?: boolean;
    /**
     * If true, cache varies by userId when authenticated.
     * Useful for "feed"/personalized endpoints with a short TTL.
     */
    varyByUserId?: boolean;
    /**
     * Request headers that change the response body (e.g. client profile).
     * They join the cache key and are echoed in Vary, so one caller's variant
     * is never replayed to another.
     */
    varyByHeaders?: string[];
  }
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const allowAuthenticated = options?.allowAuthenticated === true;
    const varyByUserId = options?.varyByUserId === true;
    if (req.userId && !allowAuthenticated) return next();

    // Skip if Redis is not connected
    if (!cacheService.isReady()) {
      return next();
    }

    const varyByHeaders = options?.varyByHeaders || [];
    const headerVariant = varyByHeaders
      .map(
        (name) =>
          `${name.toLowerCase()}=${String(
            req.headers[name.toLowerCase()] || ""
          ).toLowerCase()}`
      )
      .join("&");
    const varyHeaderValue = ["Accept-Encoding", ...varyByHeaders].join(", ");

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `cache:${req.originalUrl}:${JSON.stringify(req.query)}${
          varyByUserId && req.userId ? `:user=${req.userId}` : ""
        }${headerVariant ? `:${headerVariant}` : ""}`;

    try {
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        const etag = `"${cacheKey}"`;
        const ifNoneMatch = req.headers["if-none-match"];
        // 304 Not Modified: client has current version, skip sending body (faster, less data)
        if (ifNoneMatch && ifNoneMatch.split(/,\s*/).some((tag) => tag.trim() === etag)) {
          res.setHeader("X-Cache", "HIT");
          res.setHeader("ETag", etag);
          res.setHeader("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
          res.status(304).end();
          return;
        }
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Key", cacheKey);
        res.setHeader("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
        res.setHeader("ETag", etag);
        res.setHeader("Vary", varyHeaderValue);
        logger.debug(`Cache HIT: ${cacheKey}`);
        // Only 2xx bodies are ever stored, so a hit is always a success replay.
        res.status(200).json(cached);
        return;
      }

      // Cache miss - store original json method
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        // Never cache errors. A stored 404/400 body would be replayed as a 200
        // on the next hit, so clients checking response.ok would accept it.
        const cacheable = res.statusCode >= 200 && res.statusCode < 300;
        if (!cacheable) {
          res.setHeader("X-Cache", "BYPASS");
          res.setHeader("Cache-Control", "no-store");
          return originalJson(data);
        }

        // Store in cache (async, don't block response)
        cacheService.set(cacheKey, data, ttl).catch((error) => {
          logger.error("Cache set error in middleware:", error);
        });
        
        // Set headers (HTTP headers help CDN/proxy caching, not React Native directly)
        res.setHeader("X-Cache", "MISS");
        res.setHeader("X-Cache-Key", cacheKey);
        // HTTP headers help CDN/proxy caching, but React Native needs client-side caching (React Query/SWR)
        res.setHeader("Cache-Control", `public, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`);
        res.setHeader("ETag", `"${cacheKey}"`);
        res.setHeader("Vary", varyHeaderValue);
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

