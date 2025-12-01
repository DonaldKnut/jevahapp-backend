"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const playbackSession_controller_1 = require("../controllers/playbackSession.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
/**
 * @route   POST /api/media/:id/playback/start
 * @desc    Start playback session (automatically pauses any existing active session)
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @body    { duration: number, position?: number, deviceInfo?: string }
 * @returns { success: boolean, data: { session: PlaybackSession, previousSessionPaused?: SessionInfo, resumeFrom?: number } }
 */
router.post("/:id/playback/start", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.startPlayback);
/**
 * @route   POST /api/media/playback/progress
 * @desc    Update playback progress (call every 5-10 seconds during playback)
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, position: number, duration: number, progressPercentage: number }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number, progressPercentage: number } }
 */
router.post("/playback/progress", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.updateProgress);
/**
 * @route   POST /api/media/playback/pause
 * @desc    Pause playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number } }
 */
router.post("/playback/pause", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.pausePlayback);
/**
 * @route   POST /api/media/playback/resume
 * @desc    Resume playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number } }
 */
router.post("/playback/resume", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.resumePlayback);
/**
 * @route   POST /api/media/playback/end
 * @desc    End playback session (video finished or user stopped)
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, reason?: "completed" | "stopped" | "error", finalPosition?: number }
 * @returns { success: boolean, data: { session: PlaybackSession, viewRecorded: boolean } }
 */
router.post("/playback/end", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.endPlayback);
/**
 * @route   GET /api/media/playback/active
 * @desc    Get currently active playback session for user
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: { session: PlaybackSession | null } }
 */
router.get("/playback/active", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.getActivePlayback);
/**
 * @route   GET /api/media/playback/history
 * @desc    Get playback history for user
 * @access  Protected (Authenticated users only)
 * @query   { page?: number, limit?: number, includeInactive?: boolean }
 * @returns { success: boolean, data: PlaybackSession[], pagination: object }
 */
router.get("/playback/history", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playbackSession_controller_1.getPlaybackHistory);
exports.default = router;
