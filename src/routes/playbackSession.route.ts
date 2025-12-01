import { Router } from "express";
import {
  startPlayback,
  updateProgress,
  pausePlayback,
  resumePlayback,
  endPlayback,
  getActivePlayback,
  getPlaybackHistory,
} from "../controllers/playbackSession.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

/**
 * @route   POST /api/media/:id/playback/start
 * @desc    Start playback session (automatically pauses any existing active session)
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @body    { duration: number, position?: number, deviceInfo?: string }
 * @returns { success: boolean, data: { session: PlaybackSession, previousSessionPaused?: SessionInfo, resumeFrom?: number } }
 */
router.post(
  "/:id/playback/start",
  verifyToken,
  apiRateLimiter,
  startPlayback
);

/**
 * @route   POST /api/media/playback/progress
 * @desc    Update playback progress (call every 5-10 seconds during playback)
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, position: number, duration: number, progressPercentage: number }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number, progressPercentage: number } }
 */
router.post("/playback/progress", verifyToken, apiRateLimiter, updateProgress);

/**
 * @route   POST /api/media/playback/pause
 * @desc    Pause playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number } }
 */
router.post("/playback/pause", verifyToken, apiRateLimiter, pausePlayback);

/**
 * @route   POST /api/media/playback/resume
 * @desc    Resume playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number } }
 */
router.post("/playback/resume", verifyToken, apiRateLimiter, resumePlayback);

/**
 * @route   POST /api/media/playback/end
 * @desc    End playback session (video finished or user stopped)
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, reason?: "completed" | "stopped" | "error", finalPosition?: number }
 * @returns { success: boolean, data: { session: PlaybackSession, viewRecorded: boolean } }
 */
router.post("/playback/end", verifyToken, apiRateLimiter, endPlayback);

/**
 * @route   GET /api/media/playback/active
 * @desc    Get currently active playback session for user
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: { session: PlaybackSession | null } }
 */
router.get("/playback/active", verifyToken, apiRateLimiter, getActivePlayback);

/**
 * @route   GET /api/media/playback/history
 * @desc    Get playback history for user
 * @access  Protected (Authenticated users only)
 * @query   { page?: number, limit?: number, includeInactive?: boolean }
 * @returns { success: boolean, data: PlaybackSession[], pagination: object }
 */
router.get(
  "/playback/history",
  verifyToken,
  apiRateLimiter,
  getPlaybackHistory
);

export default router;


