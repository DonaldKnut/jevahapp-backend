import { Router } from "express";
import {
  registerDeviceToken,
  unregisterDeviceToken,
  updatePreferences,
  setEnabled,
  sendTestNotification,
  getStats,
  cleanupInvalidTokens,
  sendToUsers,
  sendToAll,
} from "../controllers/pushNotification.controller";
import { verifyToken } from "../middleware/auth.middleware";
// import { requireRole } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// User endpoints
// POST /api/push-notifications/register - Register device token
router.post("/register", verifyToken, apiRateLimiter, registerDeviceToken);

// POST /api/push-notifications/unregister - Unregister device token
router.post("/unregister", verifyToken, apiRateLimiter, unregisterDeviceToken);

// PUT /api/push-notifications/preferences - Update notification preferences
router.put("/preferences", verifyToken, apiRateLimiter, updatePreferences);

// PUT /api/push-notifications/enabled - Enable/disable push notifications
router.put("/enabled", verifyToken, apiRateLimiter, setEnabled);

// POST /api/push-notifications/test - Send test notification
router.post("/test", verifyToken, apiRateLimiter, sendTestNotification);

// Admin endpoints
// GET /api/push-notifications/stats - Get push notification statistics
router.get("/stats", verifyToken, apiRateLimiter, getStats);

// POST /api/push-notifications/cleanup - Clean up invalid tokens
router.post("/cleanup", verifyToken, apiRateLimiter, cleanupInvalidTokens);

// POST /api/push-notifications/send-to-users - Send to specific users
router.post("/send-to-users", verifyToken, apiRateLimiter, sendToUsers);

// POST /api/push-notifications/send-to-all - Send to all users
router.post("/send-to-all", verifyToken, apiRateLimiter, sendToAll);

export default router;
