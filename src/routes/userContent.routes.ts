import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import {
  getProfileTabs,
  getUserPhotos,
  getUserPosts,
  getUserVideos,
  getUserAudios,
  getUserContentById,
  getMyContent,
} from "../controllers/userContent.controller";

const router = express.Router();

/**
 * @route   GET /api/user-content/my-content
 * @desc    Get all authenticated user's uploaded content with engagement metrics
 * @access  Protected (Authenticated users only)
 * @query   { page?: number, limit?: number, sort?: "recent" | "popular", contentType?: "all" | "video" | "audio" | "photo" | "post" }
 * @returns { success: boolean, data: Array<ContentItem>, pagination: object }
 */
router.get("/my-content", verifyToken, apiRateLimiter, getMyContent);

router.get("/user/tabs", verifyToken, apiRateLimiter, getProfileTabs);
router.get("/user/photos", verifyToken, apiRateLimiter, getUserPhotos);
router.get("/user/posts", verifyToken, apiRateLimiter, getUserPosts);
router.get("/user/videos", verifyToken, apiRateLimiter, getUserVideos);
router.get("/user/audios", verifyToken, apiRateLimiter, getUserAudios);
router.get(
  "/user/content/:id",
  verifyToken,
  apiRateLimiter,
  getUserContentById
);

export default router;
