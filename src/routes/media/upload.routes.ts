import { Router } from "express";
import {
  uploadMedia,
  generateMediaDescription,
} from "../../controllers/media.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import {
  mediaUploadRateLimiter,
  aiDescriptionRateLimiter,
} from "../../middleware/rateLimiter";
import { logRequest, upload } from "./shared";

const router = Router();

/**
 * @route   POST /api/media/generate-description
 * @desc    Generate AI-powered description for media creation (helps users create engaging descriptions)
 *          Enhanced with multimodal analysis: analyzes video frames, audio transcript, and thumbnail image
 * @access  Protected (Authenticated users only - optional, works without auth too)
 * @body    { title: string, contentType: "music" | "videos" | "books" | "live" | "audio" | "sermon" | "devotional" | "ebook" | "podcast", category?: string, topics?: string[] }
 * @files   Optional: { file?: File (video/audio), thumbnail?: File (image) }
 * @returns { success: boolean, description: string, bibleVerses?: string[], enhancedDescription?: string, message: string }
 */
router.post(
  "/generate-description",
  verifyToken,
  aiDescriptionRateLimiter,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  generateMediaDescription
);

/**
 * @route   POST /api/media/upload
 * @desc    Upload a new media item (music, video, or book) with thumbnail
 * @access  Protected (Authenticated users only)
 * @body    { title: string, contentType: "music" | "videos" | "books", description?: string, category?: string, topics?: string[], duration?: number, file: File, thumbnail: File }
 * @returns { success: boolean, message: string, media: object }
 */
router.post(
  "/upload",
  verifyToken,
  mediaUploadRateLimiter,
  logRequest,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  uploadMedia
);

export default router;
