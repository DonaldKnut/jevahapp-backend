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
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const copyrightFreeSong_controller_1 = require("../controllers/copyrightFreeSong.controller");
const audio_controller_1 = require("../controllers/audio.controller");
const playlist_controller_1 = require("../controllers/playlist.controller");
const playbackSession_controller_1 = require("../controllers/playbackSession.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Configure Multer for in-memory file uploads
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// ============================================================================
// COPYRIGHT-FREE SONGS ROUTES
// ============================================================================
/**
 * @route   GET /api/audio/copyright-free
 * @desc    Get all copyright-free songs (Public)
 * @access  Public (No authentication required)
 * @query   { search?, category?, artist?, year?, minDuration?, maxDuration?, tags?, sortBy?, page?, limit? }
 * @returns { success: boolean, data: { songs: Song[], pagination: object } }
 */
router.get("/copyright-free", rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.getAllSongs);
/**
 * @route   GET /api/audio/copyright-free/:songId
 * @desc    Get a single copyright-free song (Public)
 * @access  Public (No authentication required)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, data: Song }
 */
router.get("/copyright-free/:songId", rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.getSongById);
/**
 * @route   GET /api/audio/copyright-free/search
 * @desc    Search copyright-free songs (Public)
 * @access  Public (No authentication required)
 * @query   { q: string (required), page?, limit? }
 * @returns { success: boolean, data: { songs: Song[], pagination: object } }
 */
router.get("/copyright-free/search", rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.searchSongs);
/**
 * @route   POST /api/audio/copyright-free
 * @desc    Create a copyright-free song (Admin Only)
 * @access  Protected (Admin only)
 * @body    { title: string, singer: string, fileUrl: string, thumbnailUrl?: string, duration?: number }
 * @returns { success: boolean, data: Song }
 */
router.post("/copyright-free", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.createSong);
/**
 * @route   PUT /api/audio/copyright-free/:songId
 * @desc    Update a copyright-free song (Admin Only)
 * @access  Protected (Admin only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @body    { title?, singer?, thumbnailUrl?, duration? }
 * @returns { success: boolean, data: Song }
 */
router.put("/copyright-free/:songId", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.updateSong);
/**
 * @route   DELETE /api/audio/copyright-free/:songId
 * @desc    Delete a copyright-free song (Admin Only)
 * @access  Protected (Admin only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, message: string }
 */
router.delete("/copyright-free/:songId", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.deleteSong);
/**
 * @route   POST /api/audio/copyright-free/:songId/like
 * @desc    Like/unlike a copyright-free song (Authenticated)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, data: { liked: boolean, likeCount: number } }
 */
router.post("/copyright-free/:songId/like", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.toggleLike);
/**
 * @route   POST /api/audio/copyright-free/:songId/share
 * @desc    Share a copyright-free song (Authenticated)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, data: { shareCount: number, likeCount: number } }
 */
router.post("/copyright-free/:songId/share", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.shareSong);
/**
 * @route   POST /api/audio/copyright-free/:songId/download
 * @desc    Download a copyright-free song for offline listening (Authenticated)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @body    { fileSize?: number } - Optional file size in bytes
 * @returns { success: boolean, downloadUrl: string, fileName: string, fileSize: number, contentType: string }
 */
router.post("/copyright-free/:songId/download", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, audio_controller_1.downloadCopyrightFreeSong);
/**
 * @route   POST /api/audio/copyright-free/:songId/playback/track
 * @desc    Track playback and increment view count if threshold is met (Authenticated)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @body    { playbackDuration: number (required), thresholdSeconds?: number (optional, default: 30) }
 * @returns { success: boolean, data: { viewCountIncremented: boolean, newViewCount: number, playbackDuration: number, thresholdSeconds: number } }
 */
router.post("/copyright-free/:songId/playback/track", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.trackPlayback);
/**
 * @route   POST /api/audio/copyright-free/:songId/view
 * @desc    Record view for a copyright-free song (one view per user per song)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @body    { durationMs?: number, progressPct?: number, isComplete?: boolean }
 * @returns { success: boolean, data: { viewCount: number, hasViewed: boolean } }
 */
router.post("/copyright-free/:songId/view", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.recordView);
/**
 * @route   POST /api/audio/copyright-free/:songId/save
 * @desc    Toggle save/bookmark for a copyright-free song
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, data: { bookmarked: boolean, bookmarkCount: number } }
 */
router.post("/copyright-free/:songId/save", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, copyrightFreeSong_controller_1.toggleSave);
// ============================================================================
// AUDIO PLAYLIST ROUTES (Wrapper for existing playlist routes)
// ============================================================================
/**
 * @route   GET /api/audio/playlists
 * @desc    Get all playlists for the authenticated user
 * @access  Protected (Authenticated users only)
 * @query   { page?, limit? }
 * @returns { success: boolean, data: Playlist[], pagination: object }
 */
router.get("/playlists", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.getUserPlaylists);
/**
 * @route   POST /api/audio/playlists
 * @desc    Create a new playlist
 * @access  Protected (Authenticated users only)
 * @body    { name: string, description?, isPublic?, coverImageUrl?, tags? }
 * @returns { success: boolean, data: Playlist }
 */
router.post("/playlists", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.createPlaylist);
/**
 * @route   GET /api/audio/playlists/:playlistId
 * @desc    Get a specific playlist by ID
 * @access  Protected (Authenticated users only - own playlists or public playlists)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, data: Playlist }
 */
router.get("/playlists/:playlistId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.getPlaylistById);
/**
 * @route   PUT /api/audio/playlists/:playlistId
 * @desc    Update playlist details
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { name?, description?, isPublic?, coverImageUrl?, tags? }
 * @returns { success: boolean, data: Playlist }
 */
router.put("/playlists/:playlistId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.updatePlaylist);
/**
 * @route   DELETE /api/audio/playlists/:playlistId
 * @desc    Delete a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, message: string }
 */
router.delete("/playlists/:playlistId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.deletePlaylist);
/**
 * @route   POST /api/audio/playlists/:playlistId/songs
 * @desc    Add a song to a playlist (wrapper for /tracks endpoint)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { mediaId: string, notes?, position? }
 * @returns { success: boolean, data: Playlist }
 */
router.post("/playlists/:playlistId/songs", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.addTrackToPlaylist);
/**
 * @route   DELETE /api/audio/playlists/:playlistId/songs/:songId
 * @desc    Remove a song from a playlist (wrapper for /tracks/:mediaId endpoint)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @param   { songId: string } - MongoDB ObjectId of the song/media
 * @returns { success: boolean, data: Playlist }
 */
router.delete("/playlists/:playlistId/songs/:songId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (req, res, next) => {
    // Map songId param to mediaId for the controller (which expects mediaId)
    req.params.mediaId = req.params.songId;
    delete req.params.songId;
    next();
}, playlist_controller_1.removeTrackFromPlaylist);
/**
 * @route   PUT /api/audio/playlists/:playlistId/songs/reorder
 * @desc    Reorder songs in a playlist (wrapper for /tracks/reorder endpoint)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { tracks: Array<{ mediaId: string, order: number }> }
 * @returns { success: boolean, data: Playlist }
 */
router.put("/playlists/:playlistId/songs/reorder", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.reorderPlaylistTracks);
// ============================================================================
// AUDIO PLAYBACK ROUTES (Wrapper for existing playback routes)
// ============================================================================
/**
 * @route   POST /api/audio/playback/start
 * @desc    Start playback session for audio (wrapper for /api/media/:id/playback/start)
 * @access  Protected (Authenticated users only)
 * @body    { trackId: string, duration: number, position?, deviceInfo? }
 * @returns { success: boolean, data: { session: PlaybackSession, previousSessionPaused?, resumeFrom? } }
 */
router.post("/playback/start", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (req, res, next) => {
    // Transform request: extract trackId and pass as :id param
    const { trackId } = req.body;
    if (!trackId) {
        res.status(400).json({
            success: false,
            message: "trackId is required",
        });
        return;
    }
    req.params.id = trackId;
    next();
}, playbackSession_controller_1.startPlayback);
/**
 * @route   POST /api/audio/playback/progress
 * @desc    Update playback progress
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, position: number, duration: number, progressPercentage: number }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number, progressPercentage: number } }
 */
router.post("/playback/progress", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.updateProgress);
/**
 * @route   POST /api/audio/playback/pause
 * @desc    Pause playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number } }
 */
router.post("/playback/pause", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.pausePlayback);
/**
 * @route   POST /api/audio/playback/resume
 * @desc    Resume playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number } }
 */
router.post("/playback/resume", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.resumePlayback);
/**
 * @route   POST /api/audio/playback/complete
 * @desc    Complete playback session (alias for /end)
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, reason?, finalPosition? }
 * @returns { success: boolean, data: { session: PlaybackSession, viewRecorded: boolean } }
 */
router.post("/playback/complete", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.endPlayback);
/**
 * @route   POST /api/audio/playback/end
 * @desc    End playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, reason?, finalPosition? }
 * @returns { success: boolean, data: { session: PlaybackSession, viewRecorded: boolean } }
 */
router.post("/playback/end", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.endPlayback);
/**
 * @route   GET /api/audio/playback/history
 * @desc    Get playback history for user
 * @access  Protected (Authenticated users only)
 * @query   { page?, limit?, includeInactive? }
 * @returns { success: boolean, data: PlaybackSession[], pagination: object }
 */
router.get("/playback/history", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.getPlaybackHistory);
/**
 * @route   GET /api/audio/playback/last-position/:trackId
 * @desc    Get last playback position for a track
 * @access  Protected (Authenticated users only)
 * @param   { trackId: string } - MongoDB ObjectId of the track
 * @returns { success: boolean, data: { position: number, progressPercentage: number } | null }
 */
router.get("/playback/last-position/:trackId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { trackId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
            return;
        }
        // Get active playback session for this track
        const { PlaybackSession } = yield Promise.resolve().then(() => __importStar(require("../models/playbackSession.model")));
        const { Types } = yield Promise.resolve().then(() => __importStar(require("mongoose")));
        const session = yield PlaybackSession.findOne({
            userId: new Types.ObjectId(userId),
            mediaId: new Types.ObjectId(trackId),
            isActive: true,
        }).lean();
        if (!session) {
            res.status(200).json({
                success: true,
                data: null,
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                position: session.currentPosition || 0,
                progressPercentage: session.progressPercentage || 0,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to get last position",
            error: error.message,
        });
    }
}));
// ============================================================================
// AUDIO LIBRARY ROUTES
// ============================================================================
/**
 * @route   GET /api/audio/library
 * @desc    Get user's audio library (saved songs)
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: Song[] }
 */
router.get("/library", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, audio_controller_1.getUserAudioLibrary);
exports.default = router;
