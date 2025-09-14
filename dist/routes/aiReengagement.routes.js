"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiReengagement_controller_1 = require("../controllers/aiReengagement.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
// import { requireRole } from "../middleware/role.middleware";
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// User endpoints
// GET /api/ai-reengagement/status - Get user's re-engagement status
router.get("/status", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, aiReengagement_controller_1.getUserReEngagementStatus);
// POST /api/ai-reengagement/track-return - Track user return (for testing)
router.post("/track-return", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, aiReengagement_controller_1.trackUserReturn);
// Admin endpoints
// GET /api/ai-reengagement/analytics - Get re-engagement analytics
router.get("/analytics", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, aiReengagement_controller_1.getReEngagementAnalytics);
// POST /api/ai-reengagement/trigger/:userId - Manually trigger re-engagement
router.post("/trigger/:userId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, aiReengagement_controller_1.triggerReEngagement);
exports.default = router;
