import { Router } from "express";
import {
  startMuxLiveStream,
  endMuxLiveStream,
  getLiveStreams,
  getStreamStatus,
  scheduleLiveStream,
  getStreamStats,
  startRecording,
  stopRecording,
  getRecordingStatus,
  getUserRecordings,
  goLive,
} from "../../controllers/media.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import {
  apiRateLimiter,
  mediaUploadRateLimiter,
  mediaInteractionRateLimiter,
} from "../../middleware/rateLimiter";

const router = Router();

/**
 * @route   POST /api/media/live/start
 * @desc    Start a new Mux live stream
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string, category?: string, topics?: string[] }
 * @returns { success: boolean, message: string, stream: { streamKey: string, rtmpUrl: string, playbackUrl: string } }
 */
router.post(
  "/live/start",
  verifyToken,
  mediaUploadRateLimiter,
  startMuxLiveStream
);

/**
 * @route   POST /api/media/live/go-live
 * @desc    Start live streaming immediately (go live now)
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string }
 * @returns { success: boolean, message: string, stream: { streamKey: string, rtmpUrl: string, playbackUrl: string } }
 */
router.post("/live/go-live", verifyToken, mediaUploadRateLimiter, goLive);

/**
 * @route   POST /api/media/live/:id/end
 * @desc    End a live stream by its ID
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the live stream
 * @returns { success: boolean, message: string }
 */
router.post(
  "/live/:id/end",
  verifyToken,
  mediaInteractionRateLimiter,
  endMuxLiveStream
);

/**
 * @route   GET /api/media/live
 * @desc    Retrieve all active live streams
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, streams: object[] }
 */
router.get("/live", verifyToken, apiRateLimiter, getLiveStreams);

/**
 * @route   POST /api/media/live/schedule
 * @desc    Schedule a new live stream
 * @access  Protected (Authenticated users only)
 * @body    { title: string, description?: string, category?: string, topics?: string[], scheduledStart: Date, scheduledEnd?: Date }
 * @returns { success: boolean, message: string, stream: object }
 */
router.post(
  "/live/schedule",
  verifyToken,
  mediaUploadRateLimiter,
  scheduleLiveStream
);

/**
 * @route   GET /api/media/live/:streamId/status
 * @desc    Get live stream status and viewer count
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, status: object }
 */
router.get(
  "/live/:streamId/status",
  verifyToken,
  apiRateLimiter,
  getStreamStatus
);

/**
 * @route   GET /api/media/live/:streamId/stats
 * @desc    Get live stream statistics
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, stats: object }
 */
router.get(
  "/live/:streamId/stats",
  verifyToken,
  apiRateLimiter,
  getStreamStats
);

/**
 * @route   POST /api/media/recording/start
 * @desc    Start recording a live stream
 * @access  Protected (Authenticated users only)
 * @body    { streamId: string, streamKey: string, title: string, description?: string, category?: string, topics?: string[] }
 * @returns { success: boolean, message: string, recording: object }
 */
router.post(
  "/recording/start",
  verifyToken,
  mediaUploadRateLimiter,
  startRecording
);

/**
 * @route   POST /api/media/recording/:streamId/stop
 * @desc    Stop recording a live stream
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, message: string, recording: object }
 */
router.post(
  "/recording/:streamId/stop",
  verifyToken,
  mediaInteractionRateLimiter,
  stopRecording
);

/**
 * @route   GET /api/media/recording/:streamId/status
 * @desc    Get recording status
 * @access  Protected (Authenticated users only)
 * @param   { streamId: string } - Stream ID
 * @returns { success: boolean, status: object }
 */
router.get(
  "/recording/:streamId/status",
  verifyToken,
  apiRateLimiter,
  getRecordingStatus
);

/**
 * @route   GET /api/media/recordings
 * @desc    Get user's recordings
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, recordings: object[] }
 */
router.get("/recordings", verifyToken, apiRateLimiter, getUserRecordings);

export default router;
