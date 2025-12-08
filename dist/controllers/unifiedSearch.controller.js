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
exports.getUnifiedTrendingSearches = exports.getUnifiedSearchSuggestions = exports.unifiedSearch = void 0;
const unifiedSearch_service_1 = __importDefault(require("../service/unifiedSearch.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Unified search across all content types
 * GET /api/search
 *
 * Searches across:
 * - Media (videos, music, audio, ebook, etc.)
 * - Copyright-free songs
 *
 * Supports filtering, sorting, and pagination
 */
const unifiedSearch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const { q, page, limit, contentType, mediaType, category, sort } = req.query;
        const userId = req.userId;
        // Validate query parameter (required)
        if (!q || typeof q !== "string" || !q.trim()) {
            res.status(400).json({
                success: false,
                error: "Search query is required",
                code: "BAD_REQUEST",
            });
            return;
        }
        // Parse and validate pagination parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        // Validate limit (max 100)
        if (limitNum > 100) {
            res.status(400).json({
                success: false,
                error: "Invalid limit. Maximum is 100",
                code: "BAD_REQUEST",
            });
            return;
        }
        // Validate sort option
        const validSorts = ["relevance", "popular", "newest", "oldest", "title"];
        const sortOption = sort || "relevance";
        if (sort && !validSorts.includes(sortOption)) {
            res.status(400).json({
                success: false,
                error: `Invalid sort option. Must be one of: ${validSorts.join(", ")}`,
                code: "BAD_REQUEST",
            });
            return;
        }
        // Validate contentType filter
        const validContentTypes = ["all", "media", "copyright-free"];
        const contentTypeFilter = contentType || "all";
        if (contentType && !validContentTypes.includes(contentTypeFilter)) {
            res.status(400).json({
                success: false,
                error: `Invalid contentType. Must be one of: ${validContentTypes.join(", ")}`,
                code: "BAD_REQUEST",
            });
            return;
        }
        // Perform unified search
        const result = yield unifiedSearch_service_1.default.search(q.trim(), {
            page: pageNum,
            limit: limitNum,
            contentType: contentTypeFilter,
            mediaType: mediaType,
            category: category,
            sort: sortOption,
            userId: userId || undefined,
        });
        const searchTime = Date.now() - startTime;
        // Return success response
        res.status(200).json({
            success: true,
            data: {
                results: result.results,
                pagination: {
                    page: result.page,
                    limit: limitNum,
                    total: result.total,
                    totalPages: result.totalPages,
                    hasMore: result.hasMore,
                },
                breakdown: result.breakdown,
                query: q.trim(),
                searchTime,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error in unified search:", error);
        // Handle validation errors
        if (error.message === "Search query is required") {
            res.status(400).json({
                success: false,
                error: "Search query is required",
                code: "BAD_REQUEST",
            });
            return;
        }
        // Generic server error
        res.status(500).json({
            success: false,
            error: "Failed to perform search",
            code: "SERVER_ERROR",
        });
    }
});
exports.unifiedSearch = unifiedSearch;
/**
 * Get search suggestions across all content types
 * GET /api/search/suggestions
 */
const getUnifiedSearchSuggestions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, limit } = req.query;
        const limitNum = parseInt(limit) || 10;
        // Validate query parameter
        if (!q || typeof q !== "string" || !q.trim()) {
            res.status(400).json({
                success: false,
                error: "Search query is required",
                code: "BAD_REQUEST",
            });
            return;
        }
        const suggestions = yield unifiedSearch_service_1.default.getSuggestions(q.trim(), limitNum);
        res.status(200).json({
            success: true,
            data: {
                suggestions,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting unified search suggestions:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get search suggestions",
            code: "SERVER_ERROR",
        });
    }
});
exports.getUnifiedSearchSuggestions = getUnifiedSearchSuggestions;
/**
 * Get trending searches across all content types
 * GET /api/search/trending
 */
const getUnifiedTrendingSearches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { limit, period } = req.query;
        const limitNum = parseInt(limit) || 10;
        const periodOption = period || "week";
        const trending = yield unifiedSearch_service_1.default.getTrending(limitNum, periodOption);
        res.status(200).json({
            success: true,
            data: {
                trending,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting unified trending searches:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get trending searches",
            code: "SERVER_ERROR",
        });
    }
});
exports.getUnifiedTrendingSearches = getUnifiedTrendingSearches;
