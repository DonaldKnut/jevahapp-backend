import { Router } from "express";
import {
  startPlayback,
  updateProgress,
  pausePlayback,
  resumePlayback,
  endPlayback,
  getPlaybackHistory,
} from "../../controllers/playbackSession.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { apiRateLimiter } from "../../middleware/rateLimiter";

const router = Router();

/**
 * @route   POST /api/audio/playback/start
 * @desc    Start playback session for audio
 * @access  Protected (Authenticated users only)
 */
router.post(
  "/playback/start",
  verifyToken,
  apiRateLimiter,
  (req, res, next) => {
    const { trackId } = req.body;
    if (!trackId) {
      res.status(400).json({
        success: false,
        message: "trackId is required",
      });
      return;
    }
    req.params.id = trackId;
    next();
  },
  startPlayback
);

/**
 * @route   POST /api/audio/playback/progress
 * @desc    Update playback progress
 * @access  Protected (Authenticated users only)
 */
router.post("/playback/progress", verifyToken, apiRateLimiter, updateProgress);

/**
 * @route   POST /api/audio/playback/pause
 * @desc    Pause playback session
 * @access  Protected (Authenticated users only)
 */
router.post("/playback/pause", verifyToken, apiRateLimiter, pausePlayback);

/**
 * @route   POST /api/audio/playback/resume
 * @desc    Resume playback session
 * @access  Protected (Authenticated users only)
 */
router.post("/playback/resume", verifyToken, apiRateLimiter, resumePlayback);

/**
 * @route   POST /api/audio/playback/complete
 * @desc    Complete playback session (alias for /end)
 * @access  Protected (Authenticated users only)
 */
router.post("/playback/complete", verifyToken, apiRateLimiter, endPlayback);

/**
 * @route   POST /api/audio/playback/end
 * @desc    End playback session
 * @access  Protected (Authenticated users only)
 */
router.post("/playback/end", verifyToken, apiRateLimiter, endPlayback);

/**
 * @route   GET /api/audio/playback/history
 * @desc    Get playback history for user
 * @access  Protected (Authenticated users only)
 */
router.get("/playback/history", verifyToken, apiRateLimiter, getPlaybackHistory);

/**
 * @route   GET /api/audio/playback/last-position/:trackId
 * @desc    Get last playback position for a track
 * @access  Protected (Authenticated users only)
 */
router.get(
  "/playback/last-position/:trackId",
  verifyToken,
  apiRateLimiter,
  async (req, res): Promise<void> => {
    try {
      const { trackId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const { PlaybackSession } = await import("../../models/playbackSession.model");
      const { Types } = await import("mongoose");

      const session: any = await PlaybackSession.findOne({
        userId: new Types.ObjectId(userId),
        mediaId: new Types.ObjectId(trackId),
        isActive: true,
      }).lean();

      if (!session) {
        res.status(200).json({
          success: true,
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          position: session.currentPosition || 0,
          progressPercentage: session.progressPercentage || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to get last position",
        error: error.message,
      });
    }
  }
);

export default router;
