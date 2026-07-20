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
import { requireAdmin } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// User endpoints
router.post("/register", verifyToken, apiRateLimiter, registerDeviceToken);
router.post("/unregister", verifyToken, apiRateLimiter, unregisterDeviceToken);
router.put("/preferences", verifyToken, apiRateLimiter, updatePreferences);
router.put("/enabled", verifyToken, apiRateLimiter, setEnabled);
router.post("/test", verifyToken, apiRateLimiter, sendTestNotification);

// Admin endpoints
router.get("/stats", verifyToken, requireAdmin, apiRateLimiter, getStats);
router.post(
  "/cleanup",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  cleanupInvalidTokens
);
router.post(
  "/send-to-users",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  sendToUsers
);
router.post("/send-to-all", verifyToken, requireAdmin, apiRateLimiter, sendToAll);

export default router;
