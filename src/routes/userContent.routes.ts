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
} from "../controllers/userContent.controller";

const router = express.Router();

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
