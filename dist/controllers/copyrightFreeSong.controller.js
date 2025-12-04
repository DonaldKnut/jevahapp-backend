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
exports.toggleSave = exports.recordView = exports.trackPlayback = exports.searchSongs = exports.shareSong = exports.toggleLike = exports.deleteSong = exports.updateSong = exports.createSong = exports.getSongById = exports.getAllSongs = void 0;
const copyrightFreeSong_service_1 = require("../service/copyrightFreeSong.service");
const logger_1 = __importDefault(require("../utils/logger"));
const copyrightFreeSongInteraction_service_1 = require("../service/copyrightFreeSongInteraction.service");
const songService = new copyrightFreeSong_service_1.CopyrightFreeSongService();
const interactionService = new copyrightFreeSongInteraction_service_1.CopyrightFreeSongInteractionService();
const getAllSongs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
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
const searchSongs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        if (!q || typeof q !== "string") {
            res.status(400).json({
                success: false,
                message: "Search query (q) is required",
            });
            return;
        }
        const result = yield songService.searchSongs(q, page, limit);
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
        logger_1.default.error("Error searching songs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search songs",
            error: error.message,
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
 * Record view for a copyright-free song (matches frontend expectations)
 * Frontend calls this when user views/listens to a song
 */
const recordView = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        const { durationMs, progressPct, isComplete } = req.body;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        // Check if user already viewed this song (one view per user per song)
        const interaction = yield interactionService.getInteraction(userId, songId);
        const hasViewed = (interaction === null || interaction === void 0 ? void 0 : interaction.hasViewed) || false;
        let viewCount;
        if (!hasViewed) {
            // First view - increment count
            yield songService.incrementViewCount(songId);
            // Mark as viewed
            yield interactionService.markAsViewed(userId, songId);
        }
        // Get updated song with latest counts
        const updatedSong = yield songService.getSongById(songId);
        viewCount = (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) || 0;
        // Emit realtime update to all clients viewing this song
        try {
            const { getIO } = yield Promise.resolve().then(() => __importStar(require("../socket/socketManager")));
            const io = getIO();
            if (io) {
                const roomKey = `content:audio:${songId}`;
                io.to(roomKey).emit("copyright-free-song-interaction-updated", {
                    songId,
                    viewCount,
                    likeCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.likeCount) || 0,
                });
                logger_1.default.debug("Emitted realtime view update", {
                    songId,
                    roomKey,
                    viewCount,
                });
            }
        }
        catch (socketError) {
            // Don't fail the request if socket emission fails
            logger_1.default.warn("Failed to emit realtime view update", {
                error: socketError === null || socketError === void 0 ? void 0 : socketError.message,
                songId,
            });
        }
        res.status(200).json({
            success: true,
            data: {
                viewCount,
                hasViewed: true, // Always true after this call
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error recording view:", error);
        res.status(500).json({
            success: false,
            message: "Failed to record view",
            error: error.message,
        });
    }
});
exports.recordView = recordView;
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
