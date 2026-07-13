import { Router } from "express";
import {
  downloadMedia,
  downloadMediaFile,
  getOfflineDownloads,
  removeFromOfflineDownloads,
  updateDownloadStatus,
  getDownloadStatus,
} from "../../controllers/media.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import {
  apiRateLimiter,
  mediaInteractionRateLimiter,
} from "../../middleware/rateLimiter";
import { cacheMiddleware } from "../../middleware/cache.middleware";

const router = Router();

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

export default router;
