import { Router } from "express";
import {
  getEbookText,
  renderTTS,
  getTTSStatus,
  generateEbookTTS,
  getEbookTTS,
  getTTSConfig,
} from "../controllers/ebook.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = Router();

/**
 * @swagger
 * /api/ebooks/text:
 *   get:
 *     summary: Get text from ebook PDF
 *     description: Extract per-page text from a PDF. Optionally normalize with Gemini AI for TTS.
 *     tags: [Ebooks]
 *     parameters:
 *       - in: query
 *         name: url
 *         schema:
 *           type: string
 *         description: Direct PDF URL
 *       - in: query
 *         name: contentId
 *         schema:
 *           type: string
 *         description: Content ID to resolve to PDF URL
 *       - in: query
 *         name: normalize
 *         schema:
 *           type: boolean
 *         description: Whether to normalize text with Gemini AI (default false)
 *     responses:
 *       200:
 *         description: Successfully extracted text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     totalPages:
 *                       type: number
 *                     pages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           page:
 *                             type: number
 *                           text:
 *                             type: string
 *       400:
 *         description: Bad request (missing parameters or invalid URL)
 *       404:
 *         description: Content not found
 *       500:
 *         description: Server error
 */
router.get(
  "/text",
  apiRateLimiter,
  cacheMiddleware(300), // 5 minutes for ebook text (doesn't change often)
  getEbookText
);

/**
 * @swagger
 * /api/tts/render:
 *   post:
 *     summary: Render TTS audio for ebook
 *     description: Use a neural TTS provider to render audio for better voice quality (optional)
 *     tags: [TTS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentId
 *               - pages
 *             properties:
 *               contentId:
 *                 type: string
 *               pages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                     text:
 *                       type: string
 *               voiceId:
 *                 type: string
 *                 default: en-US-female-1
 *               language:
 *                 type: string
 *                 default: en-US
 *               speed:
 *                 type: number
 *                 default: 1.0
 *               pitch:
 *                 type: number
 *                 default: 0
 *               format:
 *                 type: string
 *                 default: mp3
 *               cache:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: TTS rendering completed
 *       202:
 *         description: TTS rendering in progress
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/render", verifyToken, apiRateLimiter, renderTTS);

/**
 * @swagger
 * /api/tts/status/{jobId}:
 *   get:
 *     summary: Get TTS job status
 *     description: Check the status of an async TTS rendering job
 *     tags: [TTS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: TTS job ID
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  "/status/:jobId",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(10), // 10 seconds for TTS status (changes frequently)
  getTTSStatus
);

/**
 * @swagger
 * /api/ebooks/{ebookId}/tts:
 *   get:
 *     summary: Get TTS audio URL for ebook
 *     description: Retrieve TTS audio URL if it has been generated for the ebook. Optionally include timings for text sync highlighting.
 *     tags: [Ebooks, TTS]
 *     parameters:
 *       - in: path
 *         name: ebookId
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID of the ebook
 *       - in: query
 *         name: includeTimings
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include segment-level timings for text sync highlighting
 *     responses:
 *       200:
 *         description: TTS audio URL retrieved successfully
 *       404:
 *         description: TTS audio not generated for this ebook
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/ebooks/tts/config:
 *   get:
 *     summary: Get TTS provider configuration status
 *     description: Check if TTS service is configured and available
 *     tags: [Ebooks, TTS]
 *     responses:
 *       200:
 *         description: TTS configuration status retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  "/tts/config",
  apiRateLimiter,
  getTTSConfig
);

router.get(
  "/:ebookId/tts",
  apiRateLimiter,
  cacheMiddleware(300), // 5 minutes cache for TTS URLs
  getEbookTTS
);

/**
 * @swagger
 * /api/ebooks/{ebookId}/tts/generate:
 *   post:
 *     summary: Generate TTS audio for ebook
 *     description: Auto-generate TTS audio when ebook is opened. Returns audio URL and segment timings for text sync highlighting.
 *     tags: [Ebooks, TTS]
 *     parameters:
 *       - in: path
 *         name: ebookId
 *         required: true
 *         schema:
 *           type: string
 *         description: Media ID of the ebook
 *       - in: query
 *         name: voice
 *         schema:
 *           type: string
 *           enum: [male, female, custom]
 *           default: female
 *         description: Voice type
 *       - in: query
 *         name: voiceName
 *         schema:
 *           type: string
 *         description: Custom voice name (optional)
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *           default: en-US
 *         description: Language code (e.g., en-US, en-GB)
 *       - in: query
 *         name: speed
 *         schema:
 *           type: number
 *           default: 1.0
 *         description: Speaking rate (0.25-4.0)
 *       - in: query
 *         name: pitch
 *         schema:
 *           type: number
 *           default: 0
 *         description: Voice pitch (-20.0 to 20.0)
 *     responses:
 *       200:
 *         description: TTS audio generated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Ebook not found
 *       503:
 *         description: TTS service not available
 *       500:
 *         description: Server error
 */
router.post(
  "/:ebookId/tts/generate",
  apiRateLimiter,
  generateEbookTTS
);

export default router;






















