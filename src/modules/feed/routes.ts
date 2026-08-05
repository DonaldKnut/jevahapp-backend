import express from "express";
import { verifyToken } from "../../middleware/auth.middleware";
import { apiRateLimiter, rateLimiter } from "../../middleware/rateLimiter";
import { getForYou, postFeedEvents } from "./feed.controller";

const router = express.Router();
const feedEventsLimiter = rateLimiter(60, 60000); // 60 batches / min / IP bucket

/**
 * TikTok-style feed surface (additive — does not replace /api/media/all-content).
 *
 * GET  /api/feed/for-you
 * POST /api/feed/events
 */
router.get("/for-you", verifyToken, apiRateLimiter, getForYou);
router.post("/events", verifyToken, feedEventsLimiter, postFeedEvents);

export default router;
