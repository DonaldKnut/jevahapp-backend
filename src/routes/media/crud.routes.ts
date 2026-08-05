import { Router } from "express";
import {
  getAllMedia,
  getAllContentForAllTab,
  getMediaByIdentifier,
  deleteMedia,
  searchMedia,
  getMediaStats,
  refreshVideoUrl,
  getUploadCounts,
} from "../../controllers/media.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { apiRateLimiter } from "../../middleware/rateLimiter";
import { cacheMiddleware } from "../../middleware/cache.middleware";

const router = Router();

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
  cacheMiddleware(15, undefined, { allowAuthenticated: true }),
  searchMedia
);

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
  cacheMiddleware(120, undefined, {
    allowAuthenticated: true,
    varyByUserId: true,
  }),
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

export default router;
