"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const unifiedSearch_controller_1 = require("../controllers/unifiedSearch.controller");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/search
 * @desc    Unified search across all content types (Media, Copyright-free songs, etc.)
 * @access  Public (Optional authentication for personalized results)
 * @query   { q: string (required), page?, limit?, contentType?, mediaType?, category?, sort? }
 * @returns { success: boolean, data: { results: UnifiedSearchItem[], pagination: object, breakdown: object, query: string, searchTime: number } }
 */
router.get("/", rateLimiter_1.apiRateLimiter, unifiedSearch_controller_1.unifiedSearch);
/**
 * @route   GET /api/search/suggestions
 * @desc    Get search suggestions/autocomplete across all content types
 * @access  Public (No authentication required)
 * @query   { q: string (required), limit? }
 * @returns { success: boolean, data: { suggestions: string[] } }
 */
router.get("/suggestions", rateLimiter_1.apiRateLimiter, unifiedSearch_controller_1.getUnifiedSearchSuggestions);
/**
 * @route   GET /api/search/trending
 * @desc    Get trending searches across all content types
 * @access  Public (No authentication required)
 * @query   { limit?, period? }
 * @returns { success: boolean, data: { trending: TrendingSearch[] } }
 */
router.get("/trending", rateLimiter_1.apiRateLimiter, unifiedSearch_controller_1.getUnifiedTrendingSearches);
exports.default = router;
