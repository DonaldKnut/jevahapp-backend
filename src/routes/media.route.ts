import { Router, Request, Response } from "express";
import multer from "multer";
import {
  uploadMedia,
  getAllMedia,
  getAllContentForAllTab,
  getMediaByIdentifier,
  deleteMedia,
  bookmarkMedia,
  recordMediaInteraction,
  searchMedia,
  getAnalyticsDashboard,
  startMuxLiveStream,
  endMuxLiveStream,
  getLiveStreams,
  getMediaStats,
  recordUserAction,
  addToViewedMedia,
  getViewedMedia,
  getUserActionStatus,
  // New enhanced methods
  trackViewWithDuration,
  downloadMedia,
  downloadMediaFile,
  shareMedia,
  getOfflineDownloads,
  removeFromOfflineDownloads,
  updateDownloadStatus,
  getDownloadStatus,
  // New Contabo streaming methods
  getStreamStatus,
  scheduleLiveStream,
  getStreamStats,
  // Recording methods
  startRecording,
  stopRecording,
  getRecordingStatus,
  getUserRecordings,
  // New go live method
  goLive,
  // Public methods (no authentication required)
  getPublicMedia,
  getPublicAllContent,
  getPublicMediaByIdentifier,
  searchPublicMedia,
  getMediaWithEngagement,
  // Default content methods
  getDefaultContent,
  getOnboardingContent,
  // Video URL refresh method
  refreshVideoUrl,
  // AI description generation
  generateMediaDescription,
  // Upload counts helper
  getUploadCounts,
} from "../controllers/media.controller";
import {
  getMediaAnalytics,
  getCreatorAnalytics,
} from "../controllers/mediaAnalytics.controller";
import { UPLOAD_LIMITS } from "../controllers/media.controller";
import { verifyToken } from "../middleware/auth.middleware";
import {
  apiRateLimiter,
  mediaUploadRateLimiter,
  mediaInteractionRateLimiter,
  aiDescriptionRateLimiter,
} from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";

// Define interface for the request body of /favorite and /share routes
interface UserActionRequestBody {
  actionType: "favorite" | "share";
}

// Configure Multer for in-memory file uploads (max single file = sermon limit 300MB)
const MAX_UPLOAD_BYTES = UPLOAD_LIMITS.FILE_SIZE.SERMON_MB * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const router = Router();

/**
 * @route   GET /api/media/public
 * @desc    Retrieve all media items with optional filters (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get(
  "/public",
  apiRateLimiter,
  cacheMiddleware(30), // 30 seconds cache (faster refresh, content type filtering already cached separately)
  getPublicMedia
);

/**
 * @route   GET /api/media/public/all-content
 * @desc    Global feed: ALL content on the platform (everyone's uploads), same as /api/media/all-content. Recency-ordered; new uploads appear when approved/live. No filter by uploader.
 * @access  Public (No authentication required)
 * @query   { page?, limit?, contentType?, category?, minViews?, minLikes?, dateFrom?, dateTo?, search?, sort? (default: "createdAt"), order? (default: "desc"), mood? }
 * @returns { success: boolean, data: { media: object[], pagination }, recommendations?: object }
 */
router.get(
  "/public/all-content",
  apiRateLimiter,
  cacheMiddleware(30), // Short TTL so new approved content appears quickly
  getPublicAllContent
);

/**
 * @route   GET /api/media/public/search
 * @desc    Search media items by title, type, category, topics, etc. (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, message: string, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get(
  "/public/search",
  apiRateLimiter,
  cacheMiddleware(15), // 15 seconds for search results (faster refresh, content type filtering cached separately)
  searchPublicMedia
);

/**
 * @route   GET /api/media/public/:id
 * @desc    Retrieve a single media item by its identifier (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, media: object }
 */
router.get(
  "/public/:id",
  apiRateLimiter,
  cacheMiddleware(120), // Cache public single-item reads (safe: public, non user-specific)
  getPublicMediaByIdentifier
);

/**
 * @route   POST /api/media/generate-description
 * @desc    Generate AI-powered description for media creation (helps users create engaging descriptions)
 *          Enhanced with multimodal analysis: analyzes video frames, audio transcript, and thumbnail image
 * @access  Protected (Authenticated users only - optional, works without auth too)
 * @body    { title: string, contentType: "music" | "videos" | "books" | "live" | "audio" | "sermon" | "devotional" | "ebook" | "podcast", category?: string, topics?: string[] }
 * @files   Optional: { file?: File (video/audio), thumbnail?: File (image) }
 * @returns { success: boolean, description: string, bibleVerses?: string[], enhancedDescription?: string, message: string }
 */
router.post(
  "/generate-description",
  verifyToken, // Optional - will work without user info too
  aiDescriptionRateLimiter, // Specific rate limiter for AI operations (5 requests/minute)
  upload.fields([
    { name: "file", maxCount: 1 }, // Optional: video or audio file for analysis (max 50MB)
    { name: "thumbnail", maxCount: 1 }, // Optional: thumbnail/cover image for analysis (max 5MB)
  ]),
  generateMediaDescription
);

/**
 * @route   GET /api/media/upload-counts
 * @desc    Get current upload counts and limits for the authenticated user (useful for frontend progress bars)
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: { music: { current, max, remaining, percentage, canUpload }, sermons: { current, max, remaining, percentage, canUpload }, limits: { fileSize, uploadCount } } }
 */
router.get(
  "/upload-counts",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(30, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUploadCounts
);

/**
 * @route   POST /api/media/upload
 * @desc    Upload a new media item (music, video, or book) with thumbnail
 * @access  Protected (Authenticated users only)
 * @body    { title: string, contentType: "music" | "videos" | "books", description?: string, category?: string, topics?: string[], duration?: number, file: File, thumbnail: File }
 * @returns { success: boolean, message: string, media: object }
 */
const logRequest = (req: Request, res: Response, next: Function) => {
  console.log("Incoming Request Body:", req.body);
  console.log("Incoming Request Files:", req.files);
  next();
};

router.post(
  "/upload",
  verifyToken,
  mediaUploadRateLimiter,
  logRequest,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  uploadMedia
);

/**
 * @route   GET /api/media
 * @desc    Retrieve all media items with optional filters (e.g., contentType, category)
 * @access  Protected (Authenticated users only)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get("/", verifyToken, apiRateLimiter, getAllMedia);

/**
 * @route   GET /api/media/all-content
 * @desc    Global feed: ALL content on the platform (everyone's uploads), same as /api/media/public/all-content. Recency-ordered; new uploads appear when approved/live. No filter by uploader.
 * @access  Protected (Authenticated users only)
 * @query   { page?: number (default: 1), limit?: number (default: 50, max: 100), contentType?: string (default: "ALL"), category?: string, minViews?: number, minLikes?: number, dateFrom?: ISO8601, dateTo?: ISO8601, search?: string, sort?: string (default: "createdAt"), order?: "asc" | "desc" (default: "desc"), mood?: string }
 * @returns { success: boolean, data: { media: object[], pagination: { page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean } }, recommendations?: object }
 */
router.get("/all-content", verifyToken, apiRateLimiter, getAllContentForAllTab);

/**
 * @route   GET /api/media/search
 * @desc    Search media items by title, type, category, topics, etc.
 * @access  Protected (Authenticated users only)
 * @query   { search?: string, contentType?: string, category?: string, topics?: string, sort?: string, page?: string, limit?: string, creator?: string, duration?: "short" | "medium" | "long", startDate?: string, endDate?: string }
 * @returns { success: boolean, message: string, media: object[], pagination: { page: number, limit: number, total: number, pages: number } }
 */
router.get(
  "/search",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(15, undefined, { allowAuthenticated: true }), // 15 seconds (faster refresh, content type filtering cached separately)
  searchMedia
);

/**
 * @route   GET /api/media/analytics
 * @desc    Retrieve analytics dashboard data (admin or creator-specific views)
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, message: string, data: { isAdmin: boolean, mediaCountByContentType: object, totalInteractionCounts: object, totalBookmarks: number, recentMedia: object[], uploadsLastThirtyDays: number, interactionsLastThirtyDays: number } }
 */
router.get("/analytics", verifyToken, apiRateLimiter, getAnalyticsDashboard);

/**
 * @route   GET /api/media/analytics/creator
 * @desc    Get comprehensive analytics for all media by a creator (Twitter/X style analytics dashboard)
 * @access  Protected (Authenticated users only - creators can only view their own analytics)
 * @query   { startDate?: string, endDate?: string } - Optional date range (ISO format)
 * @returns { success: boolean, data: CreatorMediaAnalytics }
 */
router.get(
  "/analytics/creator",
  verifyToken,
  apiRateLimiter,
  getCreatorAnalytics
);

/**
 * @route   GET /api/media/:mediaId/analytics
 * @desc    Get detailed analytics for a specific media item (Twitter/X style post analytics)
 * @access  Protected (Authenticated users only - creators can only view their own media analytics)
 * @param   { mediaId: string } - MongoDB ObjectId of the media item
 * @query   { startDate?: string, endDate?: string } - Optional date range (ISO format)
 * @returns { success: boolean, data: PerMediaAnalytics }
 */
router.get(
  "/:mediaId/analytics",
  verifyToken,
  apiRateLimiter,
  getMediaAnalytics
);

/**
 * @route   GET /api/media/default
 * @desc    Get default/onboarding content for new users (PUBLIC - no authentication required)
 * @access  Public (No authentication required)
 * @query   { contentType?: string, limit?: string }
 * @returns { success: boolean, data: { total: number, grouped: object, all: object[] } }
 */
router.get(
  "/default",
  apiRateLimiter,
  cacheMiddleware(600), // 10 minutes for default/onboarding content
  getDefaultContent
);

/**
 * @route   GET /api/media/:id
 * @desc    Retrieve a single media item by its identifier
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, media: object }
 */
router.get(
  "/:id",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getMediaByIdentifier
);

/**
 * @route   GET /api/media/:id/stats
 * @desc    Retrieve interaction statistics for a media item (views, listens, reads, downloads, favorites, shares)
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string, stats: { viewCount?: number, listenCount?: number, readCount?: number, downloadCount?: number, favoriteCount?: number, shareCount?: number } }
 */
router.get("/:id/stats", verifyToken, apiRateLimiter, getMediaStats);

/**
 * @route   DELETE /api/media/:id
 * @desc    Delete a media item (only the creator or admin can delete)
 * @access  Protected (Authenticated users only - authorization checked in service)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string }
 */
router.delete("/:id", verifyToken, deleteMedia);

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
router.post(
  "/:id/interact",
  verifyToken,
  mediaInteractionRateLimiter,
  recordMediaInteraction
);

// REMOVED: Duplicate track-view endpoint - use media-specific endpoint instead
// POST /api/media/:id/track-view - Media-specific track view

/**
 * @route   POST /api/media/:mediaId/download
 * @desc    Initiate download for offline use
 * @access  Protected (Authenticated users only)
 * @param   { mediaId: string } - MongoDB ObjectId of the media item
 * @body    { fileSize?: number }
 * @returns { success: boolean, downloadUrl: string, fileName: string, fileSize: number, contentType: string, mediaId: string, downloadId: string, expiresAt: string }
 */
router.post(
  "/:mediaId/download",
  verifyToken,
  mediaInteractionRateLimiter,
  downloadMedia
);

/**
 * @route   GET /api/media/:id/download-file
 * @desc    Download media file directly (for UI components)
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { Buffer } - File buffer with appropriate headers
 */
router.get(
  "/:id/download-file",
  verifyToken,
  mediaInteractionRateLimiter,
  downloadMediaFile
);

/**
 * @route   GET /api/media/offline-downloads
 * @desc    Get user's offline downloads
 * @access  Protected (Authenticated users only)
 * @query   { page?: number, limit?: number, status?: string, contentType?: string }
 * @returns { success: boolean, data: { downloads: array, pagination: object } }
 */
router.get(
  "/offline-downloads",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(60, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getOfflineDownloads
);

/**
 * @route   PATCH /api/media/offline-downloads/:mediaId
 * @desc    Update download status, progress, and local path
 * @access  Protected (Authenticated users only)
 * @param   { mediaId: string } - MongoDB ObjectId of the media item
 * @body    { localPath?: string, isDownloaded?: boolean, downloadStatus?: string, downloadProgress?: number }
 * @returns { success: boolean, data: object, message: string }
 */
router.patch(
  "/offline-downloads/:mediaId",
  verifyToken,
  mediaInteractionRateLimiter,
  updateDownloadStatus
);

/**
 * @route   GET /api/media/offline-downloads/:mediaId
 * @desc    Get download status for a specific media item
 * @access  Protected (Authenticated users only)
 * @param   { mediaId: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, data: object }
 */
router.get(
  "/offline-downloads/:mediaId",
  verifyToken,
  apiRateLimiter,
  getDownloadStatus
);

/**
 * @route   DELETE /api/media/offline-downloads/:mediaId
 * @desc    Remove media from offline downloads
 * @access  Protected (Authenticated users only)
 * @param   { mediaId: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string }
 */
router.delete(
  "/offline-downloads/:mediaId",
  verifyToken,
  mediaInteractionRateLimiter,
  removeFromOfflineDownloads
);

/**
 * @route   GET /api/media/:mediaId/engagement
 * @desc    Get media with engagement metrics and user-specific data
 * @access  Public (Optional authentication for user-specific data)
 * @returns { success: boolean, data: MediaWithEngagement }
 */
router.get(
  "/:mediaId/engagement",
  cacheMiddleware(60), // Public endpoint, cache for 1 minute
  getMediaWithEngagement
);

/**
 * @route   POST /api/media/:id/track-view
 * @desc    Track view with duration for accurate view counting
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @body    { duration: number, isComplete?: boolean }
 * @returns { success: boolean, message: string, countedAsView: boolean, duration: number }
 */
router.post(
  "/:id/track-view",
  verifyToken,
  mediaInteractionRateLimiter,
  trackViewWithDuration
);

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
router.get(
  "/:id/action-status",
  verifyToken,
  apiRateLimiter,
  getUserActionStatus
);

/**
 * @route   POST /api/viewed
 * @desc    Add a media item to the authenticated user's previously viewed list (capped at 50 items)
 * @access  Protected (Authenticated users only)
 * @body    { mediaId: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string, viewedMedia: object[] }
 */
router.post(
  "/viewed",
  verifyToken,
  mediaInteractionRateLimiter,
  addToViewedMedia
);

/**
 * @route   GET /api/viewed
 * @desc    Retrieve the authenticated user's last 50 viewed media items
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, message: string, viewedMedia: object[] }
 */
router.get(
  "/viewed",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(30, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getViewedMedia
);

/**
 * @route   POST /api/media/live/start
 * @desc    Start a new Mux live stream
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string, category?: string, topics?: string[] }
 * @returns { success: boolean, message: string, stream: { streamKey: string, rtmpUrl: string, playbackUrl: string } }
 */
router.post(
  "/live/start",
  verifyToken,
  mediaUploadRateLimiter,
  startMuxLiveStream
);

/**
 * @route   POST /api/media/live/go-live
 * @desc    Start live streaming immediately (go live now)
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string }
 * @returns { success: boolean, message: string, stream: { streamKey: string, rtmpUrl: string, playbackUrl: string } }
 */
router.post("/live/go-live", verifyToken, mediaUploadRateLimiter, goLive);

/**
 * @route   POST /api/media/live/:id/end
 * @desc    End a live stream by its ID
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the live stream
 * @returns { success: boolean, message: string }
 */
router.post(
  "/live/:id/end",
  verifyToken,
  mediaInteractionRateLimiter,
  endMuxLiveStream
);

/**
 * @route   GET /api/media/live
 * @desc    Retrieve all active live streams
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, streams: object[] }
 */
router.get("/live", verifyToken, apiRateLimiter, getLiveStreams);

/**
 * @route   POST /api/media/live/schedule
 * @desc    Schedule a new live stream
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string, category?: string, topics?: string[], scheduledStart: Date, scheduledEnd?: Date }
 * @returns { success: boolean, message: string, stream: object }
 */
router.post(
  "/live/schedule",
  verifyToken,
  mediaUploadRateLimiter,
  scheduleLiveStream
);

/**
 * @route   GET /api/media/live/:streamId/status
 * @desc    Get live stream status and viewer count
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, status: object }
 */
router.get(
  "/live/:streamId/status",
  verifyToken,
  apiRateLimiter,
  getStreamStatus
);

/**
 * @route   GET /api/media/live/:streamId/stats
 * @desc    Get live stream statistics
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, stats: object }
 */
router.get(
  "/live/:streamId/stats",
  verifyToken,
  apiRateLimiter,
  getStreamStats
);

// Recording routes
/**
 * @route   POST /api/media/recording/start
 * @desc    Start recording a live stream
 * @access  Protected (Authenticated users only)
 * @body    { streamId: string, streamKey: string, title: string, description?: string, category?: string, topics?: string[] }
 * @returns { success: boolean, message: string, recording: object }
 */
router.post(
  "/recording/start",
  verifyToken,
  mediaUploadRateLimiter,
  startRecording
);

/**
 * @route   POST /api/media/recording/:streamId/stop
 * @desc    Stop recording a live stream
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, message: string, recording: object }
 */
router.post(
  "/recording/:streamId/stop",
  verifyToken,
  mediaInteractionRateLimiter,
  stopRecording
);

/**
 * @route   GET /api/media/recording/:streamId/status
 * @desc    Get recording status
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, status: object }
 */
router.get(
  "/recording/:streamId/status",
  verifyToken,
  apiRateLimiter,
  getRecordingStatus
);

/**
 * @route   GET /api/media/recordings
 * @desc    Get user's recordings
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, recordings: object[] }
 */
router.get("/recordings", verifyToken, apiRateLimiter, getUserRecordings);

// Default Content routes

/**
 * @route   GET /api/media/onboarding
 * @desc    Get curated onboarding content experience for new users
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: { welcome: object, quickStart: object, featured: object, devotionals: object } }
 */
router.get("/onboarding", verifyToken, apiRateLimiter, getOnboardingContent);

// Video URL Refresh routes

/**
 * @route   GET /api/media/refresh-url/:mediaId
 * @desc    Refresh video URL for seamless playback (extends expiration)
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: { mediaId: string, newUrl: string, expiresIn: number, expiresAt: string } }
 */
router.get(
  "/refresh-url/:mediaId",
  verifyToken,
  apiRateLimiter,
  refreshVideoUrl
);

export default router;
