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
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeBookmark = exports.addBookmark = exports.getBookmarkedMedia = void 0;
const bookmark_model_1 = require("../models/bookmark.model");
const mongoose_1 = require("mongoose");
const unifiedBookmark_service_1 = require("../service/unifiedBookmark.service");
/**
 * Get all bookmarked media for the current user
 */
const getBookmarkedMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { page = 1, limit = 20 } = request.query;
        const skip = (Number(page) - 1) * Number(limit);
        const bookmarks = yield bookmark_model_1.Bookmark.find({ user: userId })
            .populate("media")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const bookmarkedMedia = bookmarks.map(bookmark => (Object.assign(Object.assign({}, bookmark.media.toObject()), { isInLibrary: true, bookmarkedBy: userId, bookmarkedAt: bookmark.createdAt, isDefaultContent: false, isOnboardingContent: false })));
        const total = yield bookmark_model_1.Bookmark.countDocuments({ user: userId });
        response.status(200).json({
            success: true,
            data: {
                media: bookmarkedMedia,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit)),
                },
            },
        });
    }
    catch (error) {
        console.error("Fetch bookmarks error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to fetch bookmarked media",
        });
    }
});
exports.getBookmarkedMedia = getBookmarkedMedia;
/**
 * Add a media item to the user's bookmarks
 */
const addBookmark = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        const mediaId = request.params.mediaId; // Fixed: route uses :mediaId
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mediaId || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        // Delegate to unified bookmark toggle for idempotent behavior
        const already = yield unifiedBookmark_service_1.UnifiedBookmarkService.isBookmarked(userId, mediaId);
        const result = already
            ? {
                bookmarked: true,
                bookmarkCount: yield unifiedBookmark_service_1.UnifiedBookmarkService.getBookmarkCount(mediaId),
            }
            : yield unifiedBookmark_service_1.UnifiedBookmarkService.toggleBookmark(userId, mediaId);
        response.status(200).json({
            success: true,
            message: "Media saved to library",
            data: result,
        });
    }
    catch (error) {
        console.error("Add bookmark error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to save media",
        });
    }
});
exports.addBookmark = addBookmark;
/**
 * Remove a media item from the user's bookmarks
 */
const removeBookmark = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        const mediaId = request.params.mediaId; // Fixed: route uses :mediaId
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mediaId || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        // Delegate to unified bookmark toggle for idempotent behavior
        const isBookmarked = yield unifiedBookmark_service_1.UnifiedBookmarkService.isBookmarked(userId, mediaId);
        const result = isBookmarked
            ? yield unifiedBookmark_service_1.UnifiedBookmarkService.toggleBookmark(userId, mediaId)
            : {
                bookmarked: false,
                bookmarkCount: yield unifiedBookmark_service_1.UnifiedBookmarkService.getBookmarkCount(mediaId),
            };
        response.status(200).json({
            success: true,
            message: "Media removed from library",
            data: result,
        });
    }
    catch (error) {
        console.error("Remove bookmark error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to remove bookmark",
        });
    }
});
exports.removeBookmark = removeBookmark;
