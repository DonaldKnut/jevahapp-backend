import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { rateLimiter } from "../middleware/rateLimiter";
import {
  getAnalyticsDashboard,
  getUserEngagementMetrics,
  getContentPerformanceMetrics,
  getUserActivityAnalytics,
  getAdvancedAnalytics,
  getRealTimeAnalytics,
  exportAnalyticsData,
} from "../controllers/analytics.controller";

const router = express.Router();

// Rate limiters
const analyticsRateLimiter = rateLimiter(20, 60000); // 20 requests per minute
const exportRateLimiter = rateLimiter(5, 300000); // 5 exports per 5 minutes

// =============================================================================
// Analytics Routes
// =============================================================================

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get comprehensive analytics dashboard
 * @access  Protected (Admin or User)
 * @query   { startDate?: string, endDate?: string, timeRange?: string }
 * @returns { success: boolean, data: AnalyticsDashboard }
 */
router.get(
  "/dashboard",
  verifyToken,
  analyticsRateLimiter,
  getAnalyticsDashboard
);

/**
 * @route   GET /api/analytics/user-engagement
 * @desc    Get user engagement metrics
 * @access  Protected
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: UserEngagementMetrics }
 */
router.get(
  "/user-engagement",
  verifyToken,
  analyticsRateLimiter,
  getUserEngagementMetrics
);

/**
 * @route   GET /api/analytics/content-performance
 * @desc    Get content performance metrics
 * @access  Protected
 * @query   { startDate?: string, endDate?: string, userId?: string }
 * @returns { success: boolean, data: ContentPerformanceMetrics }
 */
router.get(
  "/content-performance",
  verifyToken,
  analyticsRateLimiter,
  getContentPerformanceMetrics
);

/**
 * @route   GET /api/analytics/user-activity
 * @desc    Get user activity analytics (Admin only)
 * @access  Protected (Admin only)
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: UserActivityAnalytics }
 */
router.get(
  "/user-activity",
  verifyToken,
  requireAdmin,
  analyticsRateLimiter,
  getUserActivityAnalytics
);

/**
 * @route   GET /api/analytics/advanced
 * @desc    Get advanced analytics (Admin only)
 * @access  Protected (Admin only)
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: AdvancedAnalytics }
 */
router.get(
  "/advanced",
  verifyToken,
  requireAdmin,
  analyticsRateLimiter,
  getAdvancedAnalytics
);

/**
 * @route   GET /api/analytics/real-time
 * @desc    Get real-time analytics metrics
 * @access  Protected
 * @returns { success: boolean, data: RealTimeMetrics }
 */
router.get(
  "/real-time",
  verifyToken,
  analyticsRateLimiter,
  getRealTimeAnalytics
);

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data (Admin only)
 * @access  Protected (Admin only)
 * @query   { format?: string, startDate?: string, endDate?: string }
 * @returns { success: boolean, data: ExportData }
 */
router.get(
  "/export",
  verifyToken,
  requireAdmin,
  exportRateLimiter,
  exportAnalyticsData
);

export default router;
