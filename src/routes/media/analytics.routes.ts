import { Router } from "express";
import { getAnalyticsDashboard } from "../../controllers/media.controller";
import {
  getMediaAnalytics,
  getCreatorAnalytics,
} from "../../controllers/mediaAnalytics.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { apiRateLimiter } from "../../middleware/rateLimiter";

const router = Router();

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

export default router;
