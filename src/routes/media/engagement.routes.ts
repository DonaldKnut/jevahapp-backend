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
import { bindMediaCommentShims } from "../../modules/engagement/shared/routeAdapters";

const router = Router();

/**
 * @route   GET /api/media/:mediaId/engagement
 * @desc    Get media with engagement metrics and user-specific data
 * @access  Public (Optional authentication for user-specific data)
 */
router.get(
  "/:mediaId/engagement",
  cacheMiddleware(60),
  getMediaWithEngagement
);

// FE comment fallbacks — same handlers as /api/content (deprecation headers set)
bindMediaCommentShims(router);

/**
 * Frontend fallback: POST /api/media/interactions/:id/save
 * Prefer POST /api/bookmark/:contentId/toggle
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

router.post(
  "/:id/interact",
  verifyToken,
  mediaInteractionRateLimiter,
  deprecatedEndpoint("POST /api/content/media/:contentId/view"),
  deprecatedRecordInteract
);

router.post(
  "/:id/track-view",
  verifyToken,
  mediaInteractionRateLimiter,
  deprecatedEndpoint("POST /api/content/media/:contentId/view"),
  deprecatedTrackView
);

router.get(
  "/:id/action-status",
  verifyToken,
  apiRateLimiter,
  getUserActionStatus
);

router.post(
  "/viewed",
  verifyToken,
  mediaInteractionRateLimiter,
  addToViewedMedia
);

router.get(
  "/viewed",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(30, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getViewedMedia
);

export default router;
