import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimiter";
import {
  getSettingsConfig,
  getProfile,
  uploadAvatar,
  updateName,
  updateProfileLock,
  updateLiveSettings,
  updatePushNotifications,
  updateRecommendations,
  updateProfile,
} from "../controllers/profileSettings.controller";

const router = Router();

// Rate limiters
const profileRateLimiter = rateLimiter(10, 60000); // 10 requests per minute
const uploadRateLimiter = rateLimiter(5, 60000); // 5 uploads per minute

/**
 * @route   GET /api/user/profile/settings-config
 * @desc    Get profile settings configuration for dynamic UI
 * @access  Protected
 */
router.get(
  "/settings-config",
  verifyToken,
  profileRateLimiter,
  getSettingsConfig
);

/**
 * @route   GET /api/user/profile
 * @desc    Get current user profile
 * @access  Protected
 */
router.get("/", verifyToken, profileRateLimiter, getProfile);

/**
 * @route   POST /api/user/profile/upload-avatar
 * @desc    Upload/Update profile avatar
 * @access  Protected
 */
router.post(
  "/upload-avatar",
  verifyToken,
  uploadRateLimiter,
  uploadAvatar
);

/**
 * @route   PUT /api/user/profile/update-name
 * @desc    Update user name
 * @access  Protected
 */
router.put(
  "/update-name",
  verifyToken,
  profileRateLimiter,
  updateName
);

/**
 * @route   PUT /api/user/profile/update-lock
 * @desc    Update profile lock setting
 * @access  Protected
 */
router.put(
  "/update-lock",
  verifyToken,
  profileRateLimiter,
  updateProfileLock
);

/**
 * @route   PUT /api/user/profile/update-live-settings
 * @desc    Update live settings (placeholder - coming soon)
 * @access  Protected
 */
router.put(
  "/update-live-settings",
  verifyToken,
  profileRateLimiter,
  updateLiveSettings
);

/**
 * @route   PUT /api/user/profile/update-push-notifications
 * @desc    Update push notification settings
 * @access  Protected
 */
router.put(
  "/update-push-notifications",
  verifyToken,
  profileRateLimiter,
  updatePushNotifications
);

/**
 * @route   PUT /api/user/profile/update-recommendations
 * @desc    Update recommendation settings
 * @access  Protected
 */
router.put(
  "/update-recommendations",
  verifyToken,
  profileRateLimiter,
  updateRecommendations
);

/**
 * @route   PUT /api/user/profile
 * @desc    Combined profile update (alternative endpoint)
 * @access  Protected
 */
router.put("/", verifyToken, profileRateLimiter, updateProfile);

export default router;

