import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";
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
router.get(
  "/my-content",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getMyContent
);

router.get(
  "/user/tabs",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getProfileTabs
);
router.get(
  "/user/photos",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserPhotos
);
router.get(
  "/user/posts",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserPosts
);
router.get(
  "/user/videos",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserVideos
);
router.get(
  "/user/audios",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserAudios
);
router.get(
  "/user/content/:id",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getUserContentById
);

export default router;
