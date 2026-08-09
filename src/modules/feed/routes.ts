import express from "express";
import { verifyToken } from "../../middleware/auth.middleware";
import { apiRateLimiter, rateLimiter } from "../../middleware/rateLimiter";
import { getForYou, getMusicForYou, postFeedEvents } from "./feed.controller";

const router = express.Router();
const feedEventsLimiter = rateLimiter(60, 60000); // 60 batches / min / IP bucket

/**
 * TikTok-style feed surface (additive — does not replace /api/media/all-content).
 *
 * GET  /api/feed/for-you
 * GET  /api/feed/music-for-you
 * POST /api/feed/events
 */
router.get("/for-you", verifyToken, apiRateLimiter, getForYou);
router.get("/music-for-you", verifyToken, apiRateLimiter, getMusicForYou);
router.post("/events", verifyToken, feedEventsLimiter, postFeedEvents);

export default router;
