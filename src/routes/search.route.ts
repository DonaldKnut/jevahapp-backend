import { Router } from "express";
import {
  unifiedSearch,
  getUnifiedSearchSuggestions,
  getUnifiedTrendingSearches,
} from "../controllers/unifiedSearch.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = Router();

/**
 * @route   GET /api/search
 * @desc    Unified search across all content types (Media, Copyright-free songs, etc.)
 * @access  Public (Optional authentication for personalized results)
 * @query   { q: string (required), page?, limit?, contentType?, mediaType?, category?, sort? }
 * @returns { success: boolean, data: { results: UnifiedSearchItem[], pagination: object, breakdown: object, query: string, searchTime: number } }
 */
router.get("/", apiRateLimiter, unifiedSearch);

/**
 * @route   GET /api/search/suggestions
 * @desc    Get search suggestions/autocomplete across all content types
 * @access  Public (No authentication required)
 * @query   { q: string (required), limit? }
 * @returns { success: boolean, data: { suggestions: string[] } }
 */
router.get(
  "/suggestions",
  apiRateLimiter,
  cacheMiddleware(60), // 1 minute for search suggestions
  getUnifiedSearchSuggestions
);

/**
 * @route   GET /api/search/trending
 * @desc    Get trending searches across all content types
 * @access  Public (No authentication required)
 * @query   { limit?, period? }
 * @returns { success: boolean, data: { trending: TrendingSearch[] } }
 */
router.get("/trending", apiRateLimiter, cacheMiddleware(120), getUnifiedTrendingSearches);

export default router;



