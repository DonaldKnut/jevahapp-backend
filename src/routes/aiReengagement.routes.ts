import { Router } from "express";
import {
  getReEngagementAnalytics,
  triggerReEngagement,
  trackUserReturn,
  getUserReEngagementStatus,
} from "../controllers/aiReengagement.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/status", verifyToken, apiRateLimiter, getUserReEngagementStatus);
router.post("/track-return", verifyToken, apiRateLimiter, trackUserReturn);

router.get(
  "/analytics",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getReEngagementAnalytics
);
router.post(
  "/trigger/:userId",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  triggerReEngagement
);

export default router;
