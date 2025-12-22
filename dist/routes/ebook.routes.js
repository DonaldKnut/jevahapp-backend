"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ebook_controller_1 = require("../controllers/ebook.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const cache_middleware_1 = require("../middleware/cache.middleware");
const router = (0, express_1.Router)();
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
router.get("/text", rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(300), // 5 minutes for ebook text (doesn't change often)
ebook_controller_1.getEbookText);
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
router.post("/render", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, ebook_controller_1.renderTTS);
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
router.get("/status/:jobId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, (0, cache_middleware_1.cacheMiddleware)(10), // 10 seconds for TTS status (changes frequently)
ebook_controller_1.getTTSStatus);
exports.default = router;
