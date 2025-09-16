"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const media_controller_1 = require("../controllers/media.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
// Configure Multer for in-memory file uploads
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const router = (0, express_1.Router)();
/**
 * @route   GET /api/media/public
 * @desc    Retrieve all media items with optional filters (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get("/public", rateLimiter_1.apiRateLimiter, media_controller_1.getPublicMedia);
/**
 * @route   GET /api/media/public/all-content
 * @desc    Retrieve ALL media content for the "All" tab (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @returns { success: boolean, media: object[], total: number }
 */
router.get("/public/all-content", rateLimiter_1.apiRateLimiter, media_controller_1.getPublicAllContent);
/**
 * @route   GET /api/media/public/search
 * @desc    Search media items by title, type, category, topics, etc. (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, message: string, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get("/public/search", rateLimiter_1.apiRateLimiter, media_controller_1.searchPublicMedia);
/**
 * @route   GET /api/media/public/:id
 * @desc    Retrieve a single media item by its identifier (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, media: object }
 */
router.get("/public/:id", rateLimiter_1.apiRateLimiter, media_controller_1.getPublicMediaByIdentifier);
/**
 * @route   POST /api/media/upload
 * @desc    Upload a new media item (music, video, or book) with thumbnail
 * @access  Protected (Authenticated users only)
 * @body    { title: string, contentType: "music" | "videos" | "books", description?: string, category?: string, topics?: string[], duration?: number, file: File, thumbnail: File }
 * @returns { success: boolean, message: string, media: object }
 */
const logRequest = (req, res, next) => {
    console.log("Incoming Request Body:", req.body);
    console.log("Incoming Request Files:", req.files);
    next();
};
router.post("/upload", auth_middleware_1.verifyToken, rateLimiter_1.mediaUploadRateLimiter, logRequest, upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
]), media_controller_1.uploadMedia);
/**
 * @route   GET /api/media
 * @desc    Retrieve all media items with optional filters (e.g., contentType, category)
 * @access  Protected (Authenticated users only)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get("/", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getAllMedia);
/**
 * @route   GET /api/media/all-content
 * @desc    Retrieve ALL media content for the "All" tab - no pagination, no user-specific filtering
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, media: object[], total: number }
 */
router.get("/all-content", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getAllContentForAllTab);
/**
 * @route   GET /api/media/search
 * @desc    Search media items by title, type, category, topics, etc.
 * @access  Protected (Authenticated users only)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, message: string, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get("/search", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.searchMedia);
/**
 * @route   GET /api/media/analytics
 * @desc    Retrieve analytics dashboard data (admin or creator-specific views)
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, message: string, data: { isAdmin: boolean, mediaCountByContentType: object, totalInteractionCounts: object, totalBookmarks: number, recentMedia: object[], uploadsLastThirtyDays: number, interactionsLastThirtyDays: number } }
 */
router.get("/analytics", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getAnalyticsDashboard);
/**
 * @route   GET /api/media/default
 * @desc    Get default/onboarding content for new users (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { contentType?: string, limit?: string }
 * @returns { success: boolean, data: { total: number, grouped: object, all: object[] } }
 */
router.get("/default", rateLimiter_1.apiRateLimiter, media_controller_1.getDefaultContent);
/**
 * @route   GET /api/media/:id
 * @desc    Retrieve a single media item by its identifier
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, media: object }
 */
router.get("/:id", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getMediaByIdentifier);
/**
 * @route   GET /api/media/:id/stats
 * @desc    Retrieve interaction statistics for a media item (views, listens, reads, downloads, favorites, shares)
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string, stats: { viewCount?: number, listenCount?: number, readCount?: number, downloadCount?: number, favoriteCount?: number, shareCount?: number } }
 */
router.get("/:id/stats", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getMediaStats);
/**
 * @route   DELETE /api/media/:id
 * @desc    Delete a media item (restricted to admins or the creator)
 * @access  Protected & Role Restricted (Admin or Content Creator)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string }
 */
router.delete("/:id", auth_middleware_1.verifyToken, role_middleware_1.requireAdminOrCreator, media_controller_1.deleteMedia);
// REMOVED: Duplicate bookmark endpoints - use unified bookmark system instead
// POST /api/bookmark/:mediaId/toggle - Unified bookmark toggle
// GET /api/bookmark/:mediaId/status - Check bookmark status
// GET /api/bookmark/user - Get user bookmarks
/**
 * @route   POST /api/media/:id/interact
 * @desc    Record an interaction with a media item (view, listen, read, download)
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @body    { interactionType: "view" | "listen" | "read" | "download" }
 * @returns { success: boolean, message: string, interaction: object }
 */
router.post("/:id/interact", auth_middleware_1.verifyToken, rateLimiter_1.mediaInteractionRateLimiter, media_controller_1.recordMediaInteraction);
// REMOVED: Duplicate track-view endpoint - use media-specific endpoint instead
// POST /api/media/:id/track-view - Media-specific track view
/**
 * @route   POST /api/media/:id/download
 * @desc    Initiate download for offline use
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @body    { fileSize: number }
 * @returns { success: boolean, message: string, data: { downloadUrl: string, fileName: string, fileSize: number, contentType: string } }
 */
router.post("/:id/download", auth_middleware_1.verifyToken, rateLimiter_1.mediaInteractionRateLimiter, media_controller_1.downloadMedia);
/**
 * @route   GET /api/media/offline-downloads
 * @desc    Get user's offline downloads
 * @access  Protected (Authenticated users only)
 * @query   { page?: number, limit?: number }
 * @returns { success: boolean, data: { downloads: array, pagination: object } }
 */
router.get("/offline-downloads", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getOfflineDownloads);
/**
 * @route   DELETE /api/media/offline-downloads/:mediaId
 * @desc    Remove media from offline downloads
 * @access  Protected (Authenticated users only)
 * @param   { mediaId: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string }
 */
router.delete("/offline-downloads/:mediaId", auth_middleware_1.verifyToken, rateLimiter_1.mediaInteractionRateLimiter, media_controller_1.removeFromOfflineDownloads);
/**
 * @route   GET /api/media/:mediaId/engagement
 * @desc    Get media with engagement metrics and user-specific data
 * @access  Public (Optional authentication for user-specific data)
 * @returns { success: boolean, data: MediaWithEngagement }
 */
router.get("/:mediaId/engagement", media_controller_1.getMediaWithEngagement);
/**
 * @route   POST /api/media/:id/track-view
 * @desc    Track view with duration for accurate view counting
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @body    { duration: number, isComplete?: boolean }
 * @returns { success: boolean, message: string, countedAsView: boolean, duration: number }
 */
router.post("/:id/track-view", auth_middleware_1.verifyToken, rateLimiter_1.mediaInteractionRateLimiter, media_controller_1.trackViewWithDuration);
// REMOVED: Duplicate download endpoint - keeping the first one above
// REMOVED: Legacy share redirect - use universal content interaction instead
// POST /api/content/:contentType/:contentId/share - Universal share
// REMOVED: Legacy favorite redirect - use universal content interaction instead
// POST /api/content/:contentType/:contentId/like - Universal like/favorite
/**
 * @route   GET /api/media/:id/action-status
 * @desc    Get the current user's action status for a media item (favorite, share)
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string, status: { isFavorited: boolean, isShared: boolean } }
 */
router.get("/:id/action-status", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getUserActionStatus);
/**
 * @route   POST /api/viewed
 * @desc    Add a media item to the authenticated user's previously viewed list (capped at 50 items)
 * @access  Protected (Authenticated users only)
 * @body    { mediaId: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string, viewedMedia: object[] }
 */
router.post("/viewed", auth_middleware_1.verifyToken, rateLimiter_1.mediaInteractionRateLimiter, media_controller_1.addToViewedMedia);
/**
 * @route   GET /api/viewed
 * @desc    Retrieve the authenticated user's last 50 viewed media items
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, message: string, viewedMedia: object[] }
 */
router.get("/viewed", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getViewedMedia);
/**
 * @route   POST /api/media/live/start
 * @desc    Start a new Mux live stream
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string, category?: string, topics?: string[] }
 * @returns { success: boolean, message: string, stream: { streamKey: string, rtmpUrl: string, playbackUrl: string } }
 */
router.post("/live/start", auth_middleware_1.verifyToken, rateLimiter_1.mediaUploadRateLimiter, media_controller_1.startMuxLiveStream);
/**
 * @route   POST /api/media/live/go-live
 * @desc    Start live streaming immediately (go live now)
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string }
 * @returns { success: boolean, message: string, stream: { streamKey: string, rtmpUrl: string, playbackUrl: string } }
 */
router.post("/live/go-live", auth_middleware_1.verifyToken, rateLimiter_1.mediaUploadRateLimiter, media_controller_1.goLive);
/**
 * @route   POST /api/media/live/:id/end
 * @desc    End a live stream by its ID
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the live stream
 * @returns { success: boolean, message: string }
 */
router.post("/live/:id/end", auth_middleware_1.verifyToken, rateLimiter_1.mediaInteractionRateLimiter, media_controller_1.endMuxLiveStream);
/**
 * @route   GET /api/media/live
 * @desc    Retrieve all active live streams
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, streams: object[] }
 */
router.get("/live", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getLiveStreams);
/**
 * @route   POST /api/media/live/schedule
 * @desc    Schedule a new live stream
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string, category?: string, topics?: string[], scheduledStart: Date, scheduledEnd?: Date }
 * @returns { success: boolean, message: string, stream: object }
 */
router.post("/live/schedule", auth_middleware_1.verifyToken, rateLimiter_1.mediaUploadRateLimiter, media_controller_1.scheduleLiveStream);
/**
 * @route   GET /api/media/live/:streamId/status
 * @desc    Get live stream status and viewer count
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, status: object }
 */
router.get("/live/:streamId/status", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getStreamStatus);
/**
 * @route   GET /api/media/live/:streamId/stats
 * @desc    Get live stream statistics
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, stats: object }
 */
router.get("/live/:streamId/stats", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getStreamStats);
// Recording routes
/**
 * @route   POST /api/media/recording/start
 * @desc    Start recording a live stream
 * @access  Protected (Authenticated users only)
 * @body    { streamId: string, streamKey: string, title: string, description?: string, category?: string, topics?: string[] }
 * @returns { success: boolean, message: string, recording: object }
 */
router.post("/recording/start", auth_middleware_1.verifyToken, rateLimiter_1.mediaUploadRateLimiter, media_controller_1.startRecording);
/**
 * @route   POST /api/media/recording/:streamId/stop
 * @desc    Stop recording a live stream
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, message: string, recording: object }
 */
router.post("/recording/:streamId/stop", auth_middleware_1.verifyToken, rateLimiter_1.mediaInteractionRateLimiter, media_controller_1.stopRecording);
/**
 * @route   GET /api/media/recording/:streamId/status
 * @desc    Get recording status
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, status: object }
 */
router.get("/recording/:streamId/status", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getRecordingStatus);
/**
 * @route   GET /api/media/recordings
 * @desc    Get user's recordings
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, recordings: object[] }
 */
router.get("/recordings", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getUserRecordings);
// Default Content routes
/**
 * @route   GET /api/media/onboarding
 * @desc    Get curated onboarding content experience for new users
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: { welcome: object, quickStart: object, featured: object, devotionals: object } }
 */
router.get("/onboarding", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, media_controller_1.getOnboardingContent);
exports.default = router;
