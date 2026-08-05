import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { idempotencyMiddleware } from "../middleware/idempotency.middleware";
import { bookmarkRateLimiter } from "../middleware/bookmarkRateLimiter.middleware";
import {
  toggleBookmark,
  getBookmarkStatus,
  getUserBookmarks,
  getBookmarkStats,
  bulkBookmark,
} from "../controllers/unifiedBookmark.controller";

const router = Router();

/**
 * @swagger
 * /api/bookmark/user:
 *   get:
 *     summary: Get user's bookmarked media
 *     tags: [Bookmark]
 *     security:
 *       - bearerAuth: []
 */
// Static paths before /:mediaId/*
router.get("/user", verifyToken, apiRateLimiter, getUserBookmarks);
router.post("/bulk", verifyToken, apiRateLimiter, bulkBookmark);

/**
 * @swagger
 * /api/bookmark/{mediaId}/toggle:
 *   post:
 *     summary: Toggle bookmark status (save/unsave)
 *     tags: [Bookmark]
 *     security:
 *       - bearerAuth: []
 */
// Controller accepts :mediaId or :contentId param names
router.post(
  "/:mediaId/toggle",
  verifyToken,
  idempotencyMiddleware(),
  bookmarkRateLimiter,
  toggleBookmark
);

/**
 * @swagger
 * /api/bookmark/{mediaId}/status:
 *   get:
 *     summary: Get bookmark status for media
 *     tags: [Bookmark]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:mediaId/status", verifyToken, apiRateLimiter, getBookmarkStatus);

/**
 * @swagger
 * /api/bookmark/{mediaId}/stats:
 *   get:
 *     summary: Get bookmark statistics for media
 *     tags: [Bookmark]
 */
router.get("/:mediaId/stats", apiRateLimiter, getBookmarkStats);

export default router;
