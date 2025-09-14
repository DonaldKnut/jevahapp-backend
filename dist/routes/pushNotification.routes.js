"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pushNotification_controller_1 = require("../controllers/pushNotification.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
// import { requireRole } from "../middleware/role.middleware";
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// User endpoints
// POST /api/push-notifications/register - Register device token
router.post("/register", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.registerDeviceToken);
// POST /api/push-notifications/unregister - Unregister device token
router.post("/unregister", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.unregisterDeviceToken);
// PUT /api/push-notifications/preferences - Update notification preferences
router.put("/preferences", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.updatePreferences);
// PUT /api/push-notifications/enabled - Enable/disable push notifications
router.put("/enabled", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.setEnabled);
// POST /api/push-notifications/test - Send test notification
router.post("/test", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.sendTestNotification);
// Admin endpoints
// GET /api/push-notifications/stats - Get push notification statistics
router.get("/stats", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.getStats);
// POST /api/push-notifications/cleanup - Clean up invalid tokens
router.post("/cleanup", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.cleanupInvalidTokens);
// POST /api/push-notifications/send-to-users - Send to specific users
router.post("/send-to-users", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.sendToUsers);
// POST /api/push-notifications/send-to-all - Send to all users
router.post("/send-to-all", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, pushNotification_controller_1.sendToAll);
exports.default = router;
