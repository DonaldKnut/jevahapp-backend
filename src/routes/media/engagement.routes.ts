import { Router } from "express";
import { deprecatedEndpoint } from "../../middleware/deprecation.middleware";
import {
  deprecatedRecordInteract,
  deprecatedTrackView,
} from "../../modules/engagement/legacy/mediaInteraction.shim";
import {
  addToViewedMedia,
  getViewedMedia,
  getUserActionStatus,
  getMediaWithEngagement,
} from "../../controllers/media.controller";
import { toggleBookmark } from "../../controllers/unifiedBookmark.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import {
  apiRateLimiter,
  mediaInteractionRateLimiter,
} from "../../middleware/rateLimiter";
import { idempotencyMiddleware } from "../../middleware/idempotency.middleware";
import { bookmarkRateLimiter } from "../../middleware/bookmarkRateLimiter.middleware";
import { cacheMiddleware } from "../../middleware/cache.middleware";

const router = Router();

/**
 * @route   GET /api/media/:mediaId/engagement
 * @desc    Get media with engagement metrics and user-specific data
 * @access  Public (Optional authentication for user-specific data)
 * @returns { success: boolean, data: MediaWithEngagement }
 */
router.get(
  "/:mediaId/engagement",
  cacheMiddleware(60),
  getMediaWithEngagement
);

/**
 * @deprecated Prefer POST /api/bookmark/:contentId/toggle
 * Frontend fallback: POST /api/media/interactions/:id/save
 */
router.post(
  "/interactions/:id/save",
  verifyToken,
  idempotencyMiddleware(),
  bookmarkRateLimiter,
  deprecatedEndpoint("POST /api/bookmark/:contentId/toggle"),
  async (req, res) => {
    req.params.mediaId = req.params.id;
    if (!req.body) (req as any).body = {};
    if (!req.body.contentType) req.body.contentType = "media";
    await toggleBookmark(req, res);
  }
);

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
  deprecatedEndpoint("POST /api/content/media/:contentId/view"),
  deprecatedRecordInteract
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
  deprecatedEndpoint("POST /api/content/media/:contentId/view"),
  deprecatedTrackView
);

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

export default router;
