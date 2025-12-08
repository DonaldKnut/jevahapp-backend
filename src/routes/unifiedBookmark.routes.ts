import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
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
 * /api/bookmark/{mediaId}/toggle:
 *   post:
 *     summary: Toggle bookmark status (save/unsave)
 *     tags: [Bookmark]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID to toggle bookmark
 *     responses:
 *       200:
 *         description: Bookmark status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookmarked:
 *                       type: boolean
 *                     bookmarkCount:
 *                       type: number
 *       400:
 *         description: Invalid media ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Media not found
 *       500:
 *         description: Internal server error
 */
// Support both :mediaId and :contentId for frontend compatibility
router.post("/:mediaId/toggle", verifyToken, apiRateLimiter, toggleBookmark);
// Alias route for frontend spec compatibility (contentId = mediaId)
router.post("/:contentId/toggle", verifyToken, apiRateLimiter, async (req, res) => {
  req.params.mediaId = req.params.contentId;
  delete req.params.contentId;
  await toggleBookmark(req, res);
});

/**
 * @swagger
 * /api/bookmark/{mediaId}/status:
 *   get:
 *     summary: Get bookmark status for media
 *     tags: [Bookmark]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID to check
 *     responses:
 *       200:
 *         description: Bookmark status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isBookmarked:
 *                       type: boolean
 *                     bookmarkCount:
 *                       type: number
 *       400:
 *         description: Invalid media ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/:mediaId/status", verifyToken, apiRateLimiter, getBookmarkStatus);
// Alias route for frontend spec compatibility (contentId = mediaId)
router.get("/:contentId/status", verifyToken, apiRateLimiter, async (req, res) => {
  req.params.mediaId = req.params.contentId;
  delete req.params.contentId;
  await getBookmarkStatus(req, res);
});

/**
 * @swagger
 * /api/bookmark/user:
 *   get:
 *     summary: Get user's bookmarked media
 *     tags: [Bookmark]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: User bookmarks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookmarks:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         total:
 *                           type: number
 *                         totalPages:
 *                           type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/user", verifyToken, apiRateLimiter, getUserBookmarks);

/**
 * @swagger
 * /api/bookmark/{mediaId}/stats:
 *   get:
 *     summary: Get bookmark statistics for media
 *     tags: [Bookmark]
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID to get stats for
 *     responses:
 *       200:
 *         description: Bookmark statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBookmarks:
 *                       type: number
 *                     recentBookmarks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: object
 *                           bookmarkedAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Invalid media ID
 *       500:
 *         description: Internal server error
 */
router.get("/:mediaId/stats", apiRateLimiter, getBookmarkStats);

/**
 * @swagger
 * /api/bookmark/bulk:
 *   post:
 *     summary: Perform bulk bookmark operations
 *     tags: [Bookmark]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediaIds
 *               - action
 *             properties:
 *               mediaIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 50
 *                 description: Array of media IDs
 *               action:
 *                 type: string
 *                 enum: [add, remove]
 *                 description: Action to perform
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: number
 *                     failed:
 *                       type: number
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           mediaId:
 *                             type: string
 *                           success:
 *                             type: boolean
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/bulk", verifyToken, apiRateLimiter, bulkBookmark);

export default router;
