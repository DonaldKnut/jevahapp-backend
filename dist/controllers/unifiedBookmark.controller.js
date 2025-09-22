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
exports.bulkBookmark = exports.getBookmarkStats = exports.getUserBookmarks = exports.getBookmarkStatus = exports.toggleBookmark = void 0;
const mongoose_1 = require("mongoose");
const unifiedBookmark_service_1 = require("../service/unifiedBookmark.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Toggle bookmark status (save/unsave)
 */
const toggleBookmark = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mediaId } = req.params;
        const userId = req.userId;
        // Enhanced logging for debugging
        logger_1.default.info("Toggle bookmark request", {
            userId,
            mediaId,
            userAgent: req.get("User-Agent"),
            ip: req.ip,
            timestamp: new Date().toISOString(),
        });
        if (!userId) {
            logger_1.default.warn("Unauthorized bookmark request - no user ID", {
                mediaId,
                ip: req.ip,
            });
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mediaId || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            logger_1.default.warn("Invalid media ID in bookmark request", {
                userId,
                mediaId,
                ip: req.ip,
            });
            res.status(400).json({
                success: false,
                message: "Invalid media ID format",
            });
            return;
        }
        const result = yield unifiedBookmark_service_1.UnifiedBookmarkService.toggleBookmark(userId, mediaId);
        // Send real-time notification via Socket.IO
        try {
            const io = require("../socket/socketManager").getIO();
            if (io) {
                io.emit("content-bookmark-update", {
                    mediaId,
                    bookmarkCount: result.bookmarkCount,
                    userBookmarked: result.bookmarked,
                    userId,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        catch (socketError) {
            logger_1.default.warn("Failed to send real-time bookmark update", {
                error: socketError,
                mediaId,
            });
        }
        logger_1.default.info("Toggle bookmark successful", {
            userId,
            mediaId,
            bookmarked: result.bookmarked,
            bookmarkCount: result.bookmarkCount,
        });
        res.status(200).json({
            success: true,
            message: result.bookmarked
                ? "Media saved to library successfully"
                : "Media removed from library successfully",
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Toggle bookmark error", {
            error: error.message,
            stack: error.stack,
            userId: req.userId,
            mediaId: req.params.mediaId,
            ip: req.ip,
            timestamp: new Date().toISOString(),
        });
        // Handle specific error types with appropriate status codes
        if (error.message.includes("not found") ||
            error.message.includes("Media not found")) {
            res.status(404).json({
                success: false,
                message: "Media not found",
            });
            return;
        }
        if (error.message.includes("Invalid")) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        // Default to 500 for unexpected errors
        res.status(500).json({
            success: false,
            message: "An unexpected error occurred while processing your request",
        });
    }
});
exports.toggleBookmark = toggleBookmark;
/**
 * Get bookmark status for media
 */
const getBookmarkStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mediaId } = req.params;
        const userId = req.userId;
        logger_1.default.info("Get bookmark status request", {
            userId,
            mediaId,
            ip: req.ip,
        });
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mediaId || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            res.status(400).json({
                success: false,
                message: "Invalid media ID format",
            });
            return;
        }
        const isBookmarked = yield unifiedBookmark_service_1.UnifiedBookmarkService.isBookmarked(userId, mediaId);
        const bookmarkCount = yield unifiedBookmark_service_1.UnifiedBookmarkService.getBookmarkCount(mediaId);
        res.status(200).json({
            success: true,
            data: {
                isBookmarked,
                bookmarkCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Get bookmark status error", {
            error: error.message,
            userId: req.userId,
            mediaId: req.params.mediaId,
        });
        res.status(500).json({
            success: false,
            message: "Failed to get bookmark status",
        });
    }
});
exports.getBookmarkStatus = getBookmarkStatus;
/**
 * Get user's bookmarked media
 */
const getUserBookmarks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        logger_1.default.info("Get user bookmarks request", {
            userId,
            page,
            limit,
            ip: req.ip,
        });
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        // Validate pagination parameters
        if (page < 1 || limit < 1 || limit > 100) {
            res.status(400).json({
                success: false,
                message: "Invalid pagination parameters",
            });
            return;
        }
        const result = yield unifiedBookmark_service_1.UnifiedBookmarkService.getUserBookmarks(userId, page, limit);
        res.status(200).json({
            success: true,
            data: {
                bookmarks: result.bookmarks,
                pagination: {
                    page: result.page,
                    limit,
                    total: result.total,
                    totalPages: result.totalPages,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Get user bookmarks error", {
            error: error.message,
            userId: req.userId,
        });
        res.status(500).json({
            success: false,
            message: "Failed to get user bookmarks",
        });
    }
});
exports.getUserBookmarks = getUserBookmarks;
/**
 * Get bookmark statistics for media
 */
const getBookmarkStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { mediaId } = req.params;
        logger_1.default.info("Get bookmark stats request", {
            mediaId,
            ip: req.ip,
        });
        if (!mediaId || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            res.status(400).json({
                success: false,
                message: "Invalid media ID format",
            });
            return;
        }
        const stats = yield unifiedBookmark_service_1.UnifiedBookmarkService.getBookmarkStats(mediaId);
        res.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        logger_1.default.error("Get bookmark stats error", {
            error: error.message,
            mediaId: req.params.mediaId,
        });
        res.status(500).json({
            success: false,
            message: "Failed to get bookmark statistics",
        });
    }
});
exports.getBookmarkStats = getBookmarkStats;
/**
 * Bulk bookmark operations
 */
const bulkBookmark = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { mediaIds, action } = req.body;
        logger_1.default.info("Bulk bookmark request", {
            userId,
            mediaIds,
            action,
            ip: req.ip,
        });
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
            res.status(400).json({
                success: false,
                message: "mediaIds must be a non-empty array",
            });
            return;
        }
        if (!action || !["add", "remove"].includes(action)) {
            res.status(400).json({
                success: false,
                message: "action must be 'add' or 'remove'",
            });
            return;
        }
        if (mediaIds.length > 50) {
            res.status(400).json({
                success: false,
                message: "Cannot process more than 50 media items at once",
            });
            return;
        }
        const result = yield unifiedBookmark_service_1.UnifiedBookmarkService.bulkBookmark(userId, mediaIds, action);
        res.status(200).json({
            success: true,
            message: `Bulk ${action} operation completed`,
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Bulk bookmark error", {
            error: error.message,
            userId: req.userId,
        });
        res.status(500).json({
            success: false,
            message: "Failed to perform bulk bookmark operation",
        });
    }
});
exports.bulkBookmark = bulkBookmark;
