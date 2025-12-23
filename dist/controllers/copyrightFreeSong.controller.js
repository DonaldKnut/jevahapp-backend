"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getCategories = exports.toggleSave = exports.getTrendingSearches = exports.getSearchSuggestions = exports.recordView = exports.trackPlayback = exports.searchSongs = exports.shareSong = exports.toggleLike = exports.deleteSong = exports.updateSong = exports.createSong = exports.getSongById = exports.getAllSongs = void 0;
const copyrightFreeSong_service_1 = require("../service/copyrightFreeSong.service");
const logger_1 = __importDefault(require("../utils/logger"));
const copyrightFreeSongInteraction_service_1 = require("../service/copyrightFreeSongInteraction.service");
const songService = new copyrightFreeSong_service_1.CopyrightFreeSongService();
const interactionService = new copyrightFreeSongInteraction_service_1.CopyrightFreeSongInteractionService();
const getAllSongs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 20;
        // Enforce maximum limit for mobile-friendly payloads
        limit = Math.min(Math.max(limit, 1), 100);
        const result = yield songService.getAllSongs(page, limit);
        res.status(200).json({
            success: true,
            data: {
                songs: result.songs,
                pagination: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                    limit,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting all songs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve songs",
            error: error.message,
        });
    }
});
exports.getAllSongs = getAllSongs;
const getSongById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        const song = yield songService.getSongById(songId);
        if (!song) {
            res.status(404).json({
                success: false,
                message: "Song not found",
            });
            return;
        }
        // Don't increment view count on GET - only count on actual playback (≥30 seconds)
        // View count is now tracked via playback sessions (POST /playback/track)
        let isLiked = false;
        if (userId) {
            isLiked = yield interactionService.isLiked(userId, songId);
        }
        res.status(200).json({
            success: true,
            data: Object.assign(Object.assign({}, song), { isLiked }),
        });
    }
    catch (error) {
        logger_1.default.error("Error getting song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve song",
            error: error.message,
        });
    }
});
exports.getSongById = getSongById;
const createSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, singer, fileUrl, thumbnailUrl, duration } = req.body;
        const uploadedBy = req.userId;
        if (!title || !singer || !fileUrl || !uploadedBy) {
            res.status(400).json({
                success: false,
                message: "Title, singer, fileUrl, and uploadedBy are required",
            });
            return;
        }
        const song = yield songService.createSong({
            title,
            singer,
            fileUrl,
            thumbnailUrl,
            duration,
            uploadedBy,
        });
        res.status(201).json({
            success: true,
            data: song,
        });
    }
    catch (error) {
        logger_1.default.error("Error creating song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create song",
            error: error.message,
        });
    }
});
exports.createSong = createSong;
const updateSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const { title, singer, thumbnailUrl, duration } = req.body;
        const song = yield songService.updateSong(songId, {
            title,
            singer,
            thumbnailUrl,
            duration,
        });
        if (!song) {
            res.status(404).json({
                success: false,
                message: "Song not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: song,
        });
    }
    catch (error) {
        logger_1.default.error("Error updating song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update song",
            error: error.message,
        });
    }
});
exports.updateSong = updateSong;
const deleteSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const deleted = yield songService.deleteSong(songId);
        if (!deleted) {
            res.status(404).json({
                success: false,
                message: "Song not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: "Song deleted successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Error deleting song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete song",
            error: error.message,
        });
    }
});
exports.deleteSong = deleteSong;
const toggleLike = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { liked, likeCount, shareCount, viewCount } = yield interactionService.toggleLike(userId, songId);
        // Get updated song to ensure we have latest counts
        const updatedSong = yield songService.getSongById(songId);
        // listenCount doesn't exist in CopyrightFreeSong model, return 0 (optional field)
        const listenCount = 0;
        // Emit realtime update to all clients viewing this song
        try {
            const { getIO } = yield Promise.resolve().then(() => __importStar(require("../socket/socketManager")));
            const io = getIO();
            if (io) {
                const roomKey = `content:audio:${songId}`;
                io.to(roomKey).emit("copyright-free-song-interaction-updated", {
                    songId,
                    likeCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.likeCount) || likeCount,
                    viewCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) || viewCount,
                    liked,
                    listenCount,
                });
                logger_1.default.debug("Emitted realtime like update", {
                    songId,
                    roomKey,
                    likeCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.likeCount) || likeCount,
                });
            }
        }
        catch (socketError) {
            // Don't fail the request if socket emission fails
            logger_1.default.warn("Failed to emit realtime like update", {
                error: socketError === null || socketError === void 0 ? void 0 : socketError.message,
                songId,
            });
        }
        res.status(200).json({
            success: true,
            data: {
                liked,
                likeCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.likeCount) || likeCount,
                viewCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) || viewCount,
                listenCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error toggling like:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle like",
            error: error.message,
        });
    }
});
exports.toggleLike = toggleLike;
const shareSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { shareCount, likeCount, viewCount } = yield interactionService.shareSong(userId, songId);
        res.status(200).json({
            success: true,
            data: {
                shareCount,
                likeCount,
                viewCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error sharing song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to share song",
            error: error.message,
        });
    }
});
exports.shareSong = shareSong;
/**
 * Search copyright-free songs
 * GET /api/audio/copyright-free/search
 *
 * Supports multi-field search, category filtering, sorting, and pagination
 * Returns user-specific data (isLiked, isInLibrary) if authenticated
 */
const searchSongs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    try {
        const { q, page, limit, category, sort } = req.query;
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
        // Validate limit (max 100 per spec)
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
        if (!validSorts.includes(sortOption)) {
            res.status(400).json({
                success: false,
                error: `Invalid sort option. Must be one of: ${validSorts.join(", ")}`,
                code: "BAD_REQUEST",
            });
            return;
        }
        // Perform search
        const result = yield songService.searchSongs(q.trim(), {
            page: pageNum,
            limit: limitNum,
            category: category,
            sort: sortOption,
            userId: userId || undefined,
        });
        // Add user-specific data if authenticated
        let enrichedSongs = result.songs;
        if (userId) {
            const songIds = result.songs.map((s) => s._id.toString());
            // Get user's likes and bookmarks in parallel
            const [userLikes, userBookmarks] = yield Promise.all([
                Promise.all(songIds.map((songId) => interactionService.isLiked(userId, songId))),
                Promise.all(songIds.map((songId) => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        const { UnifiedBookmarkService } = yield Promise.resolve().then(() => __importStar(require("../service/unifiedBookmark.service")));
                        return yield UnifiedBookmarkService.isBookmarked(userId, songId);
                    }
                    catch (_a) {
                        return false;
                    }
                }))),
            ]);
            // Enrich songs with user-specific data
            enrichedSongs = result.songs.map((song, index) => {
                var _a, _b, _c;
                const songObj = song;
                return Object.assign(Object.assign({}, songObj), { id: ((_a = songObj._id) === null || _a === void 0 ? void 0 : _a.toString()) || songObj.id, views: songObj.viewCount || 0, likes: songObj.likeCount || 0, isLiked: userLikes[index] || false, isInLibrary: userBookmarks[index] || false, isPublicDomain: true, contentType: "copyright-free-music", audioUrl: songObj.fileUrl, artist: songObj.singer, uploadedBy: ((_c = (_b = songObj.uploadedBy) === null || _b === void 0 ? void 0 : _b._id) === null || _c === void 0 ? void 0 : _c.toString()) || "system" });
            });
        }
        else {
            // For non-authenticated users, add default values
            enrichedSongs = result.songs.map((song) => {
                var _a, _b, _c;
                const songObj = song;
                return Object.assign(Object.assign({}, songObj), { id: ((_a = songObj._id) === null || _a === void 0 ? void 0 : _a.toString()) || songObj.id, views: songObj.viewCount || 0, likes: songObj.likeCount || 0, isLiked: false, isInLibrary: false, isPublicDomain: true, contentType: "copyright-free-music", audioUrl: songObj.fileUrl, artist: songObj.singer, uploadedBy: ((_c = (_b = songObj.uploadedBy) === null || _b === void 0 ? void 0 : _b._id) === null || _c === void 0 ? void 0 : _c.toString()) || "system" });
            });
        }
        const searchTime = Date.now() - startTime;
        // Return success response (per spec format)
        res.status(200).json({
            success: true,
            data: {
                songs: enrichedSongs,
                pagination: {
                    page: result.page,
                    limit: limitNum,
                    total: result.total,
                    totalPages: result.totalPages,
                    hasMore: result.hasMore,
                },
                query: q.trim(),
                searchTime,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error searching songs:", error);
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
exports.searchSongs = searchSongs;
/**
 * Track playback end and increment view count if threshold is met
 * Called when user stops or completes playback
 */
const trackPlayback = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const { playbackDuration, thresholdSeconds } = req.body;
        if (!playbackDuration || typeof playbackDuration !== "number" || playbackDuration < 0) {
            res.status(400).json({
                success: false,
                message: "playbackDuration is required and must be a positive number",
            });
            return;
        }
        const threshold = thresholdSeconds && typeof thresholdSeconds === "number"
            ? thresholdSeconds
            : 30; // Default 30 seconds
        const result = yield songService.trackPlayback(songId, playbackDuration, threshold);
        res.status(200).json({
            success: true,
            message: result.viewCountIncremented
                ? "View count incremented"
                : "Playback tracked (did not meet threshold)",
            data: {
                viewCountIncremented: result.viewCountIncremented,
                newViewCount: result.newViewCount,
                playbackDuration,
                thresholdSeconds: threshold,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error tracking playback:", error);
        res.status(500).json({
            success: false,
            message: "Failed to track playback",
            error: error.message,
        });
    }
});
exports.trackPlayback = trackPlayback;
/**
 * Record view for a copyright-free song
 * POST /api/audio/copyright-free/:songId/view
 *
 * Records a view with engagement metrics (durationMs, progressPct, isComplete)
 * Implements one view per user per song with proper deduplication
 *
 * @param req - Express request with songId param and engagement payload
 * @param res - Express response
 */
const recordView = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { songId } = req.params;
        const userId = req.userId;
        const { durationMs, progressPct, isComplete } = req.body;
        // Authentication check (required per spec)
        if (!userId) {
            res.status(401).json({
                success: false,
                error: "Authentication required",
                code: "UNAUTHORIZED",
            });
            return;
        }
        // Validate songId exists and is valid ObjectId format
        if (!songId) {
            res.status(400).json({
                success: false,
                error: "Song ID is required",
                code: "BAD_REQUEST",
            });
            return;
        }
        // Validate songId format (MongoDB ObjectId)
        const mongoose = yield Promise.resolve().then(() => __importStar(require("mongoose")));
        if (!mongoose.Types.ObjectId.isValid(songId)) {
            res.status(400).json({
                success: false,
                error: "Invalid song ID format",
                code: "BAD_REQUEST",
            });
            return;
        }
        // Validate optional fields if present
        if (durationMs !== undefined && (typeof durationMs !== "number" || durationMs < 0)) {
            res.status(400).json({
                success: false,
                error: "durationMs must be a non-negative number",
                code: "BAD_REQUEST",
            });
            return;
        }
        if (progressPct !== undefined && (typeof progressPct !== "number" || progressPct < 0 || progressPct > 100)) {
            res.status(400).json({
                success: false,
                error: "progressPct must be a number between 0 and 100",
                code: "BAD_REQUEST",
            });
            return;
        }
        // Record the view with engagement metrics
        // All request body fields are optional per spec
        const result = yield interactionService.recordView(userId, songId, {
            durationMs: durationMs !== undefined ? Number(durationMs) : undefined,
            progressPct: progressPct !== undefined ? Number(progressPct) : undefined,
            isComplete: isComplete === true || isComplete === "true",
        });
        // Get updated song for real-time updates
        const updatedSong = yield songService.getSongById(songId);
        // Emit real-time update via WebSocket (per spec)
        // Event: copyright-free-song-interaction-updated
        // Room: content:audio:{songId}
        // Note: Emitting for both new views and engagement updates to ensure frontend has latest data
        try {
            const { getIO } = yield Promise.resolve().then(() => __importStar(require("../socket/socketManager")));
            const io = getIO();
            if (io) {
                const roomKey = `content:audio:${songId}`;
                io.to(roomKey).emit("copyright-free-song-interaction-updated", {
                    songId,
                    viewCount: result.viewCount,
                    likeCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.likeCount) || 0,
                });
                logger_1.default.debug("Emitted realtime view update", {
                    songId,
                    roomKey,
                    viewCount: result.viewCount,
                    isNewView: result.isNewView,
                });
            }
        }
        catch (socketError) {
            // Don't fail the request if socket emission fails (per spec)
            logger_1.default.warn("Failed to emit realtime view update", {
                error: socketError === null || socketError === void 0 ? void 0 : socketError.message,
                songId,
            });
        }
        // Return success response (per spec format)
        res.status(200).json({
            success: true,
            data: {
                viewCount: result.viewCount,
                hasViewed: result.hasViewed,
            },
        });
    }
    catch (error) {
        // Enhanced error logging with all diagnostic information
        logger_1.default.error("Error recording view:", {
            error: error.message,
            stack: error.stack,
            code: error.code,
            codeName: error.codeName,
            name: error.name,
            songId: req.params.songId,
            userId: req.userId,
            body: req.body,
            mongoError: error.code,
            mongoErrorCode: error.codeName,
            errorType: error.constructor.name,
        });
        // Handle specific error types (per spec)
        if (error.message === "Song not found" || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("Song not found"))) {
            res.status(404).json({
                success: false,
                error: "Song not found",
                code: "NOT_FOUND",
            });
            return;
        }
        if (((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("Invalid userId format")) || ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("Invalid songId format"))) {
            res.status(400).json({
                success: false,
                error: error.message || "Invalid ID format",
                code: "BAD_REQUEST",
            });
            return;
        }
        // Generic server error (per spec)
        // Include error code in development mode for debugging
        const isDevelopment = process.env.NODE_ENV === "development";
        res.status(500).json(Object.assign({ success: false, error: isDevelopment ? error.message : "Failed to record view", code: "SERVER_ERROR" }, (isDevelopment && error.code ? { errorCode: error.code } : {})));
    }
});
exports.recordView = recordView;
/**
 * Get search suggestions (autocomplete)
 * GET /api/audio/copyright-free/search/suggestions
 *
 * Returns search suggestions based on partial query
 */
const getSearchSuggestions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, limit } = req.query;
        const limitNum = Math.min(parseInt(limit) || 10, 20); // Max 20 suggestions
        // Validate query parameter
        if (!q || typeof q !== "string" || !q.trim()) {
            res.status(400).json({
                success: false,
                error: "Search query is required",
                code: "BAD_REQUEST",
            });
            return;
        }
        const searchTerm = q.trim().toLowerCase();
        const searchRegex = new RegExp(`^${searchTerm}`, "i");
        // Use efficient database query instead of fetching all songs
        const { CopyrightFreeSong } = yield Promise.resolve().then(() => __importStar(require("../models/copyrightFreeSong.model")));
        // Query for matching titles and singers in a single efficient query
        const [titleMatches, artistMatches] = yield Promise.all([
            CopyrightFreeSong.find({
                title: { $regex: searchRegex, $options: "i" }
            })
                .select("title")
                .limit(50)
                .lean(),
            CopyrightFreeSong.find({
                singer: { $regex: searchRegex, $options: "i" }
            })
                .select("singer")
                .limit(50)
                .lean(),
        ]);
        const suggestions = new Set();
        // Add unique title matches
        titleMatches.forEach((song) => {
            if (song.title) {
                suggestions.add(song.title.toLowerCase());
            }
        });
        // Add unique artist matches
        artistMatches.forEach((song) => {
            if (song.singer) {
                suggestions.add(song.singer.toLowerCase());
            }
        });
        // Convert to array and limit
        const suggestionsArray = Array.from(suggestions).slice(0, limitNum);
        res.status(200).json({
            success: true,
            data: {
                suggestions: suggestionsArray,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting search suggestions:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get search suggestions",
            code: "SERVER_ERROR",
        });
    }
});
exports.getSearchSuggestions = getSearchSuggestions;
/**
 * Get trending searches
 * GET /api/audio/copyright-free/search/trending
 *
 * Returns popular search terms (simplified implementation)
 */
const getTrendingSearches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { limit, period } = req.query;
        const limitNum = Math.min(parseInt(limit) || 10, 20); // Max 20 trending
        const periodOption = period || "week";
        // Use efficient database query to get trending songs directly sorted by viewCount
        const { CopyrightFreeSong } = yield Promise.resolve().then(() => __importStar(require("../models/copyrightFreeSong.model")));
        const trendingSongs = yield CopyrightFreeSong.find()
            .select("title singer viewCount")
            .sort({ viewCount: -1, createdAt: -1 })
            .limit(limitNum)
            .lean();
        const trending = trendingSongs.map((song) => ({
            query: song.title || song.singer,
            count: song.viewCount || 0,
            category: "Gospel Music", // Default category
        }));
        res.status(200).json({
            success: true,
            data: {
                trending,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting trending searches:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get trending searches",
            code: "SERVER_ERROR",
        });
    }
});
exports.getTrendingSearches = getTrendingSearches;
/**
 * Toggle save/bookmark for a copyright-free song
 */
const toggleSave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { UnifiedBookmarkService } = yield Promise.resolve().then(() => __importStar(require("../service/unifiedBookmark.service")));
        const result = yield UnifiedBookmarkService.toggleBookmark(userId, songId);
        // Get updated song to include all counts
        const updatedSong = yield songService.getSongById(songId);
        // Emit realtime update to all clients viewing this song
        try {
            const { getIO } = yield Promise.resolve().then(() => __importStar(require("../socket/socketManager")));
            const io = getIO();
            if (io) {
                const roomKey = `content:audio:${songId}`;
                io.to(roomKey).emit("copyright-free-song-interaction-updated", {
                    songId,
                    bookmarkCount: result.bookmarkCount,
                    bookmarked: result.bookmarked,
                    likeCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.likeCount) || 0,
                    viewCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) || 0,
                });
                logger_1.default.debug("Emitted realtime save update", {
                    songId,
                    roomKey,
                    bookmarkCount: result.bookmarkCount,
                });
            }
        }
        catch (socketError) {
            // Don't fail the request if socket emission fails
            logger_1.default.warn("Failed to emit realtime save update", {
                error: socketError === null || socketError === void 0 ? void 0 : socketError.message,
                songId,
            });
        }
        res.status(200).json({
            success: true,
            data: {
                bookmarked: result.bookmarked,
                bookmarkCount: result.bookmarkCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error toggling save:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle save",
            error: error.message,
        });
    }
});
exports.toggleSave = toggleSave;
/**
 * Get categories for copyright-free songs
 * GET /api/audio/copyright-free/categories
 *
 * Returns a list of available categories for filtering songs
 * Since the CopyrightFreeSong model doesn't have a category field,
 * this returns default gospel music categories
 */
const getCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Since CopyrightFreeSong model doesn't have a category field,
        // we return a default list of common gospel music categories
        const defaultCategories = [
            "Gospel Music",
            "Traditional Gospel",
            "Contemporary Gospel",
            "Worship",
            "Praise",
            "Hymns",
            "Inspirational",
            "Christian Rock",
            "Gospel Choir",
            "Spiritual",
        ];
        res.status(200).json({
            success: true,
            data: {
                categories: defaultCategories,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve categories",
            error: error.message,
        });
    }
});
exports.getCategories = getCategories;
