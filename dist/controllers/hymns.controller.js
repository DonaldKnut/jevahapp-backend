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
exports.searchHymnsByTags = exports.getHymnsByCategory = exports.updateHymnInteractions = exports.getHymnStats = exports.syncPopularHymns = exports.searchHymnsByScripture = exports.getHymnById = exports.getHymns = void 0;
const hymns_service_1 = require("../service/hymns.service");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_service_1 = __importDefault(require("../service/cache.service"));
/**
 * Get hymns with pagination and filtering
 */
const getHymns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 20, category, search, sortBy = "title", sortOrder = "asc", source, tags, } = req.query;
        // Validate pagination parameters
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        // Validate sort parameters
        const validSortFields = [
            "title",
            "author",
            "year",
            "viewCount",
            "likeCount",
            "createdAt",
        ];
        const sortField = validSortFields.includes(sortBy)
            ? sortBy
            : "title";
        const sortDirection = sortOrder === "desc" ? "desc" : "asc";
        const cacheKey = `hymns:list:${pageNum}:${limitNum}:${category || "all"}:${search || "none"}:${sortField}:${sortDirection}:${source || "all"}:${tags || "none"}`;
        // Cache for 10 minutes (600 seconds)
        const result = yield cache_service_1.default.getOrSet(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
            return yield hymns_service_1.HymnsService.getHymns({
                page: pageNum,
                limit: limitNum,
                category: category,
                search: search,
                sortBy: sortField,
                sortOrder: sortDirection,
                source: source,
                tags: tags ? tags.split(",") : undefined,
            });
        }), 600 // 10 minutes cache
        );
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Get hymns error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get hymns",
        });
    }
});
exports.getHymns = getHymns;
/**
 * Get hymn by ID
 */
const getHymnById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                message: "Hymn ID is required",
            });
            return;
        }
        const cacheKey = `hymn:${id}`;
        // Cache for 30 minutes (1800 seconds) - hymns don't change often
        const result = yield cache_service_1.default.getOrSet(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
            const hymn = yield hymns_service_1.HymnsService.getHymnById(id);
            if (!hymn) {
                return { success: false, message: "Hymn not found" };
            }
            return { success: true, data: hymn };
        }), 1800 // 30 minutes cache
        );
        if (!result.success) {
            res.status(404).json(result);
            return;
        }
        // Increment view count (async, don't block response)
        hymns_service_1.HymnsService.incrementViewCount(id).catch(err => {
            logger_1.default.error("Failed to increment view count:", err);
        });
        res.status(200).json(result);
    }
    catch (error) {
        logger_1.default.error("Get hymn by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get hymn",
        });
    }
});
exports.getHymnById = getHymnById;
/**
 * Search hymns by Scripture reference using Hymnary.org API
 */
const searchHymnsByScripture = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reference, book, fromChapter, fromVerse, toChapter, toVerse, all } = req.query;
        // Validate that at least one search parameter is provided
        if (!reference && !book) {
            res.status(400).json({
                success: false,
                message: "Either reference or book parameter is required",
            });
            return;
        }
        let searchOptions = {};
        if (reference) {
            searchOptions.reference = reference;
        }
        else if (book) {
            searchOptions.book = book;
            if (fromChapter)
                searchOptions.fromChapter = parseInt(fromChapter);
            if (fromVerse)
                searchOptions.fromVerse = parseInt(fromVerse);
            if (toChapter)
                searchOptions.toChapter = parseInt(toChapter);
            if (toVerse)
                searchOptions.toVerse = parseInt(toVerse);
        }
        if (all === "true") {
            searchOptions.all = true;
        }
        const hymns = yield hymns_service_1.HymnsService.fetchHymnsFromHymnary(searchOptions);
        res.status(200).json({
            success: true,
            data: {
                hymns,
                searchOptions,
                count: hymns.length,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Search hymns by scripture error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search hymns by scripture",
        });
    }
});
exports.searchHymnsByScripture = searchHymnsByScripture;
/**
 * Sync popular hymns from Hymnary.org
 */
const syncPopularHymns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield hymns_service_1.HymnsService.syncPopularHymns();
        res.status(200).json({
            success: true,
            message: `Popular hymns sync completed. Synced: ${result.synced}, Errors: ${result.errors}`,
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Sync popular hymns error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to sync popular hymns",
        });
    }
});
exports.syncPopularHymns = syncPopularHymns;
/**
 * Get hymn statistics
 */
const getHymnStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield hymns_service_1.HymnsService.getHymnStats();
        res.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        logger_1.default.error("Get hymn stats error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get hymn statistics",
        });
    }
});
exports.getHymnStats = getHymnStats;
/**
 * Update hymn interaction counts
 */
const updateHymnInteractions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { likeCount, commentCount, shareCount, bookmarkCount } = req.body;
        if (!id) {
            res.status(400).json({
                success: false,
                message: "Hymn ID is required",
            });
            return;
        }
        // Validate that at least one count is provided
        if (likeCount === undefined &&
            commentCount === undefined &&
            shareCount === undefined &&
            bookmarkCount === undefined) {
            res.status(400).json({
                success: false,
                message: "At least one interaction count must be provided",
            });
            return;
        }
        yield hymns_service_1.HymnsService.updateInteractionCounts(id, {
            likeCount,
            commentCount,
            shareCount,
            bookmarkCount,
        });
        res.status(200).json({
            success: true,
            message: "Hymn interactions updated successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Update hymn interactions error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update hymn interactions",
        });
    }
});
exports.updateHymnInteractions = updateHymnInteractions;
/**
 * Get hymns by category
 */
const getHymnsByCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category } = req.params;
        const { page = 1, limit = 20, sortBy = "title", sortOrder = "asc", } = req.query;
        if (!category) {
            res.status(400).json({
                success: false,
                message: "Category is required",
            });
            return;
        }
        const validCategories = [
            "praise",
            "worship",
            "traditional",
            "contemporary",
            "gospel",
            "christmas",
            "easter",
        ];
        if (!validCategories.includes(category)) {
            res.status(400).json({
                success: false,
                message: "Invalid category",
            });
            return;
        }
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const cacheKey = `hymns:category:${category}:${pageNum}:${limitNum}:${sortBy}:${sortOrder}`;
        // Cache for 10 minutes (600 seconds)
        const result = yield cache_service_1.default.getOrSet(cacheKey, () => __awaiter(void 0, void 0, void 0, function* () {
            return yield hymns_service_1.HymnsService.getHymns({
                page: pageNum,
                limit: limitNum,
                category,
                sortBy: sortBy,
                sortOrder: sortOrder,
            });
        }), 600 // 10 minutes cache
        );
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Get hymns by category error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get hymns by category",
        });
    }
});
exports.getHymnsByCategory = getHymnsByCategory;
/**
 * Search hymns by tags
 */
const searchHymnsByTags = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tags } = req.query;
        const { page = 1, limit = 20, sortBy = "title", sortOrder = "asc", } = req.query;
        if (!tags) {
            res.status(400).json({
                success: false,
                message: "Tags parameter is required",
            });
            return;
        }
        const tagArray = tags
            .split(",")
            .map(tag => tag.trim())
            .filter(tag => tag);
        if (tagArray.length === 0) {
            res.status(400).json({
                success: false,
                message: "At least one valid tag is required",
            });
            return;
        }
        const result = yield hymns_service_1.HymnsService.getHymns({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            tags: tagArray,
            sortBy: sortBy,
            sortOrder: sortOrder,
        });
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Search hymns by tags error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search hymns by tags",
        });
    }
});
exports.searchHymnsByTags = searchHymnsByTags;
