import { Router } from "express";
import {
  getReEngagementAnalytics,
  triggerReEngagement,
  trackUserReturn,
  getUserReEngagementStatus,
} from "../controllers/aiReengagement.controller";
import { verifyToken } from "../middleware/auth.middleware";
// import { requireRole } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// User endpoints
// GET /api/ai-reengagement/status - Get user's re-engagement status
router.get("/status", verifyToken, apiRateLimiter, getUserReEngagementStatus);

// POST /api/ai-reengagement/track-return - Track user return (for testing)
router.post("/track-return", verifyToken, apiRateLimiter, trackUserReturn);

// Admin endpoints
// GET /api/ai-reengagement/analytics - Get re-engagement analytics
router.get("/analytics", verifyToken, apiRateLimiter, getReEngagementAnalytics);

// POST /api/ai-reengagement/trigger/:userId - Manually trigger re-engagement
router.post(
  "/trigger/:userId",
  verifyToken,
  apiRateLimiter,
  triggerReEngagement
);

export default router;
