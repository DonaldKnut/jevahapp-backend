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
exports.UnifiedBookmarkService = void 0;
const mongoose_1 = require("mongoose");
const bookmark_model_1 = require("../models/bookmark.model");
const media_model_1 = require("../models/media.model");
const logger_1 = __importDefault(require("../utils/logger"));
const notification_service_1 = require("./notification.service");
class UnifiedBookmarkService {
    /**
     * Toggle bookmark status (save/unsave)
     */
    static toggleBookmark(userId, mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Enhanced validation
            if (!mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
                throw new Error("Invalid user or media ID");
            }
            logger_1.default.info("Toggle bookmark request", {
                userId,
                mediaId,
                timestamp: new Date().toISOString(),
            });
            const session = yield bookmark_model_1.Bookmark.startSession();
            try {
                let bookmarked = false;
                yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    // Verify media exists
                    const mediaExists = yield this.verifyMediaExists(mediaId, session);
                    if (!mediaExists) {
                        throw new Error(`Media not found: ${mediaId}`);
                    }
                    // Check existing bookmark
                    const existingBookmark = yield bookmark_model_1.Bookmark.findOne({
                        user: new mongoose_1.Types.ObjectId(userId),
                        media: new mongoose_1.Types.ObjectId(mediaId),
                    }).session(session);
                    if (existingBookmark) {
                        // Remove bookmark (unsave)
                        yield bookmark_model_1.Bookmark.findByIdAndDelete(existingBookmark._id, { session });
                        bookmarked = false;
                        logger_1.default.info("Bookmark removed", {
                            userId,
                            mediaId,
                            bookmarkId: existingBookmark._id,
                        });
                    }
                    else {
                        // Add bookmark (save)
                        const newBookmark = yield bookmark_model_1.Bookmark.create([
                            {
                                user: new mongoose_1.Types.ObjectId(userId),
                                media: new mongoose_1.Types.ObjectId(mediaId),
                            },
                        ], { session });
                        bookmarked = true;
                        logger_1.default.info("Bookmark created", {
                            userId,
                            mediaId,
                            bookmarkId: newBookmark[0]._id,
                        });
                    }
                }));
                const bookmarkCount = yield this.getBookmarkCount(mediaId);
                // Send notification only when a bookmark is added (not removed)
                if (bookmarked) {
                    try {
                        yield notification_service_1.NotificationService.notifyContentBookmark(userId, mediaId, "media");
                    }
                    catch (notificationError) {
                        // Do not fail the operation if notification sending fails
                        logger_1.default.warn("Failed to send bookmark notification", {
                            error: notificationError === null || notificationError === void 0 ? void 0 : notificationError.message,
                            userId,
                            mediaId,
                        });
                    }
                }
                logger_1.default.info("Toggle bookmark completed", {
                    userId,
                    mediaId,
                    bookmarked,
                    bookmarkCount,
                    timestamp: new Date().toISOString(),
                });
                return {
                    bookmarked,
                    bookmarkCount,
                };
            }
            catch (error) {
                logger_1.default.error("Toggle bookmark transaction failed", {
                    error: error.message,
                    stack: error.stack,
                    userId,
                    mediaId,
                    timestamp: new Date().toISOString(),
                });
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
    /**
     * Verify media exists in database
     */
    static verifyMediaExists(mediaId, session) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const media = yield media_model_1.Media.findById(mediaId)
                    .session(session)
                    .select("_id");
                return !!media;
            }
            catch (error) {
                logger_1.default.error("Failed to verify media exists", {
                    mediaId,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Get bookmark count for media
     */
    static getBookmarkCount(mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield bookmark_model_1.Bookmark.countDocuments({
                    media: new mongoose_1.Types.ObjectId(mediaId),
                });
            }
            catch (error) {
                logger_1.default.error("Failed to get bookmark count", {
                    mediaId,
                    error: error.message,
                });
                return 0;
            }
        });
    }
    /**
     * Check if user has bookmarked media
     */
    static isBookmarked(userId, mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
                    return false;
                }
                const bookmark = yield bookmark_model_1.Bookmark.findOne({
                    user: new mongoose_1.Types.ObjectId(userId),
                    media: new mongoose_1.Types.ObjectId(mediaId),
                });
                return !!bookmark;
            }
            catch (error) {
                logger_1.default.error("Failed to check bookmark status", {
                    userId,
                    mediaId,
                    error: error.message,
                });
                return false;
            }
        });
    }
    /**
     * Get user's bookmarked media with pagination
     */
    static getUserBookmarks(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20) {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(userId)) {
                    throw new Error("Invalid user ID");
                }
                const skip = (page - 1) * limit;
                // First, get bookmarks with populated media, filtering out any with null media
                const bookmarks = yield bookmark_model_1.Bookmark.find({
                    user: new mongoose_1.Types.ObjectId(userId),
                })
                    .populate({
                    path: "media",
                    match: { _id: { $exists: true } }, // Only populate if media exists
                })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit);
                // Filter out bookmarks where media is null (orphaned bookmarks)
                const validBookmarks = bookmarks.filter(bookmark => bookmark.media !== null);
                // Clean up orphaned bookmarks in the background (don't await)
                const orphanedBookmarks = bookmarks.filter(bookmark => bookmark.media === null);
                if (orphanedBookmarks.length > 0) {
                    logger_1.default.warn("Found orphaned bookmarks, cleaning up", {
                        userId,
                        orphanedCount: orphanedBookmarks.length,
                        orphanedIds: orphanedBookmarks.map(b => b._id),
                    });
                    // Clean up orphaned bookmarks asynchronously
                    bookmark_model_1.Bookmark.deleteMany({
                        _id: { $in: orphanedBookmarks.map(b => b._id) },
                    }).catch(cleanupError => {
                        logger_1.default.error("Failed to clean up orphaned bookmarks", {
                            error: cleanupError.message,
                            userId,
                        });
                    });
                }
                const total = yield bookmark_model_1.Bookmark.countDocuments({
                    user: new mongoose_1.Types.ObjectId(userId),
                });
                const bookmarkedMedia = validBookmarks.map(bookmark => (Object.assign(Object.assign({}, bookmark.media.toObject()), { isBookmarked: true, bookmarkedAt: bookmark.createdAt, bookmarkId: bookmark._id })));
                logger_1.default.info("Get user bookmarks successful", {
                    userId,
                    page,
                    limit,
                    totalBookmarks: total,
                    validBookmarks: validBookmarks.length,
                    orphanedBookmarks: orphanedBookmarks.length,
                });
                return {
                    bookmarks: bookmarkedMedia,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get user bookmarks", {
                    userId,
                    page,
                    limit,
                    error: error.message,
                    stack: error.stack,
                });
                throw error;
            }
        });
    }
    /**
     * Get bookmark statistics for media
     */
    static getBookmarkStats(mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(mediaId)) {
                    throw new Error("Invalid media ID");
                }
                const totalBookmarks = yield bookmark_model_1.Bookmark.countDocuments({
                    media: new mongoose_1.Types.ObjectId(mediaId),
                });
                const recentBookmarks = yield bookmark_model_1.Bookmark.find({
                    media: new mongoose_1.Types.ObjectId(mediaId),
                })
                    .populate("user", "firstName lastName avatar")
                    .sort({ createdAt: -1 })
                    .limit(10);
                return {
                    totalBookmarks,
                    recentBookmarks: recentBookmarks.map(bookmark => ({
                        user: bookmark.user,
                        bookmarkedAt: bookmark.createdAt,
                    })),
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get bookmark stats", {
                    mediaId,
                    error: error.message,
                });
                throw error;
            }
        });
    }
    /**
     * Bulk bookmark operations
     */
    static bulkBookmark(userId, mediaIds, action) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(userId)) {
                    throw new Error("Invalid user ID");
                }
                const results = [];
                let successCount = 0;
                let failedCount = 0;
                for (const mediaId of mediaIds) {
                    try {
                        if (!mongoose_1.Types.ObjectId.isValid(mediaId)) {
                            results.push({
                                mediaId,
                                success: false,
                                error: "Invalid media ID format",
                            });
                            failedCount++;
                            continue;
                        }
                        if (action === "add") {
                            const existing = yield bookmark_model_1.Bookmark.findOne({
                                user: new mongoose_1.Types.ObjectId(userId),
                                media: new mongoose_1.Types.ObjectId(mediaId),
                            });
                            if (!existing) {
                                const created = yield bookmark_model_1.Bookmark.create({
                                    user: new mongoose_1.Types.ObjectId(userId),
                                    media: new mongoose_1.Types.ObjectId(mediaId),
                                });
                                // Fire-and-forget notification for each added bookmark
                                try {
                                    yield notification_service_1.NotificationService.notifyContentBookmark(userId, mediaId, "media");
                                }
                                catch (e) {
                                    logger_1.default.warn("Bulk bookmark notify failed", {
                                        userId,
                                        mediaId,
                                        error: e === null || e === void 0 ? void 0 : e.message,
                                    });
                                }
                            }
                        }
                        else {
                            yield bookmark_model_1.Bookmark.findOneAndDelete({
                                user: new mongoose_1.Types.ObjectId(userId),
                                media: new mongoose_1.Types.ObjectId(mediaId),
                            });
                        }
                        results.push({
                            mediaId,
                            success: true,
                        });
                        successCount++;
                    }
                    catch (error) {
                        results.push({
                            mediaId,
                            success: false,
                            error: error.message,
                        });
                        failedCount++;
                    }
                }
                return {
                    success: successCount,
                    failed: failedCount,
                    results,
                };
            }
            catch (error) {
                logger_1.default.error("Failed to perform bulk bookmark operation", {
                    userId,
                    mediaIds,
                    action,
                    error: error.message,
                });
                throw error;
            }
        });
    }
}
exports.UnifiedBookmarkService = UnifiedBookmarkService;
