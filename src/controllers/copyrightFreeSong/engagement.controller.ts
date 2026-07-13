import { Request, Response } from "express";
import likeService from "../../modules/engagement/like/like.service";
import logger from "../../utils/logger";
import deprecatedPlaybackService from "../../service/deprecated/copyrightFreePlayback.service";
import { interactionService, songService } from "./shared";

export const toggleLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const mongoose = await import("mongoose");
    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID format",
        code: "BAD_REQUEST",
      });
      return;
    }

    const fast = await likeService.toggleLikeFast(userId, songId, "copyright_free_song");
    likeService.toggleLike(userId, songId, "copyright_free_song").catch((err: Error) => {
      logger.error("Background copyright-free like sync failed", { error: err.message, songId, userId });
    });

    const liked = fast.liked;
    const likeCount = fast.likeCount;

    // Get updated song to ensure we have latest counts (invariant already applied by service)
    const updatedSong = await songService.getSongById(songId);
    const outViewCount = Math.max(updatedSong?.viewCount ?? 0, updatedSong?.likeCount ?? likeCount);
    const listenCount = 0;

    // Emit realtime update with invariant viewCount
    try {
      const { getIO } = await import("../../socket/socketManager");
      const io = getIO();
      if (io) {
        const roomKey = `content:audio:${songId}`;
        io.to(roomKey).emit("copyright-free-song-interaction-updated", {
          songId,
          likeCount: updatedSong?.likeCount ?? likeCount,
          viewCount: outViewCount,
          liked,
          listenCount,
        });

        logger.debug("Emitted realtime like update", {
          songId,
          roomKey,
          likeCount: updatedSong?.likeCount ?? likeCount,
          viewCount: outViewCount,
        });
      }
    } catch (socketError: any) {
      // Don't fail the request if socket emission fails
      logger.warn("Failed to emit realtime like update", {
        error: socketError?.message,
        songId,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        liked,
        likeCount: updatedSong?.likeCount ?? likeCount,
        viewCount: outViewCount,
        listenCount,
      },
    });
  } catch (error: any) {
    logger.error("Error toggling like:", error);
    if (error.name === "CastError" || (error.message && String(error.message).includes("ObjectId"))) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID format",
        code: "BAD_REQUEST",
      });
      return;
    }
    if (error.message === "Song not found" || error.message?.includes("Song not found")) {
      res.status(404).json({
        success: false,
        message: "Song not found",
        code: "NOT_FOUND",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to toggle like",
      error: error.message,
    });
  }
};

export const shareSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const mongoose = await import("mongoose");
    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID format",
        code: "BAD_REQUEST",
      });
      return;
    }

    const { shareCount, likeCount, viewCount } = await interactionService.shareSong(userId, songId);

    res.status(200).json({
      success: true,
      data: {
        shareCount,
        likeCount,
        viewCount,
      },
    });
  } catch (error: any) {
    logger.error("Error sharing song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to share song",
      error: error.message,
    });
  }
};

/**
 * Track playback end and increment view count if threshold is met
 * Called when user stops or completes playback
 */
export const trackPlayback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const { playbackDuration, thresholdSeconds } = req.body;

    if (!playbackDuration || typeof playbackDuration !== "number" || playbackDuration < 0) {
      res.status(400).json({
        success: false,
        message: "playbackDuration is required and must be a positive number",
      });
      return;
    }

    const threshold = thresholdSeconds && typeof thresholdSeconds === "number"
      ? thresholdSeconds
      : 30; // Default 30 seconds

    const result = await deprecatedPlaybackService.trackPlayback(songId, playbackDuration, threshold);

    res.status(200).json({
      success: true,
      message: result.viewCountIncremented
        ? "View count incremented"
        : "Playback tracked (did not meet threshold)",
      data: {
        viewCountIncremented: result.viewCountIncremented,
        newViewCount: result.newViewCount,
        playbackDuration,
        thresholdSeconds: threshold,
      },
    });
  } catch (error: any) {
    logger.error("Error tracking playback:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track playback",
      error: error.message,
    });
  }
};

/**
 * Record view for a copyright-free song
 * POST /api/audio/copyright-free/:songId/view
 *
 * Records a view with engagement metrics (durationMs, progressPct, isComplete)
 * Implements one view per user per song with proper deduplication
 */
export const recordView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;
    const { durationMs, progressPct, isComplete } = req.body;

    // Authentication check (required per spec)
    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    // Validate songId exists and is valid ObjectId format
    if (!songId) {
      res.status(400).json({
        success: false,
        error: "Song ID is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Validate songId format (MongoDB ObjectId)
    const mongoose = await import("mongoose");
    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        error: "Invalid song ID format",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Validate optional fields if present
    if (durationMs !== undefined && (typeof durationMs !== "number" || durationMs < 0)) {
      res.status(400).json({
        success: false,
        error: "durationMs must be a non-negative number",
        code: "BAD_REQUEST",
      });
      return;
    }

    if (progressPct !== undefined && (typeof progressPct !== "number" || progressPct < 0 || progressPct > 100)) {
      res.status(400).json({
        success: false,
        error: "progressPct must be a number between 0 and 100",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Record the view with engagement metrics
    const result = await interactionService.recordView(userId, songId, {
      durationMs: durationMs !== undefined ? Number(durationMs) : undefined,
      progressPct: progressPct !== undefined ? Number(progressPct) : undefined,
      isComplete: isComplete === true || isComplete === "true",
    });

    // Get updated song for real-time updates
    const updatedSong = await songService.getSongById(songId);

    // Emit real-time update via WebSocket
    try {
      const { getIO } = await import("../../socket/socketManager");
      const io = getIO();
      if (io) {
        const roomKey = `content:audio:${songId}`;
        io.to(roomKey).emit("copyright-free-song-interaction-updated", {
          songId,
          viewCount: result.viewCount,
          likeCount: updatedSong?.likeCount || 0,
        });

        logger.debug("Emitted realtime view update", {
          songId,
          roomKey,
          viewCount: result.viewCount,
          isNewView: result.isNewView,
        });
      }
    } catch (socketError: any) {
      logger.warn("Failed to emit realtime view update", {
        error: socketError?.message,
        songId,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        viewCount: result.viewCount,
        hasViewed: result.hasViewed,
      },
    });
  } catch (error: any) {
    logger.error("Error recording view:", {
      error: error.message,
      stack: error.stack,
      code: error.code,
      codeName: error.codeName,
      name: error.name,
      songId: req.params.songId,
      userId: req.userId,
      body: req.body,
      mongoError: error.code,
      mongoErrorCode: error.codeName,
      errorType: error.constructor.name,
    });

    if (error.message === "Song not found" || error.message?.includes("Song not found")) {
      res.status(404).json({
        success: false,
        error: "Song not found",
        code: "NOT_FOUND",
      });
      return;
    }

    if (error.message?.includes("Invalid userId format") || error.message?.includes("Invalid songId format")) {
      res.status(400).json({
        success: false,
        error: error.message || "Invalid ID format",
        code: "BAD_REQUEST",
      });
      return;
    }

    const isDevelopment = process.env.NODE_ENV === "development";
    const message = isDevelopment ? error.message : "Failed to record view. Please try again.";
    res.status(500).json({
      success: false,
      message,
      error: message,
      code: "SERVER_ERROR",
      ...(isDevelopment && error.code ? { errorCode: error.code } : {}),
    });
  }
};

/**
 * Toggle save/bookmark for a copyright-free song
 */
export const toggleSave = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const mongoose = await import("mongoose");
    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID format",
        code: "BAD_REQUEST",
      });
      return;
    }

    const result = await interactionService.toggleSave(userId, songId);

    const updatedSong = await songService.getSongById(songId);

    try {
      const { getIO } = await import("../../socket/socketManager");
      const io = getIO();
      if (io) {
        const roomKey = `content:audio:${songId}`;
        io.to(roomKey).emit("copyright-free-song-interaction-updated", {
          songId,
          saveCount: result.saveCount,
          saved: result.saved,
          bookmarkCount: result.saveCount,
          bookmarked: result.saved,
          likeCount: updatedSong?.likeCount || 0,
          viewCount: updatedSong?.viewCount || 0,
        });

        logger.debug("Emitted realtime save update", {
          songId,
          roomKey,
          saveCount: result.saveCount,
        });
      }
    } catch (socketError: any) {
      logger.warn("Failed to emit realtime save update", {
        error: socketError?.message,
        songId,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        saved: result.saved,
        saveCount: result.saveCount,
        bookmarked: result.saved,
        bookmarkCount: result.saveCount,
      },
    });
  } catch (error: any) {
    logger.error("Error toggling save:", error);
    if (error.name === "CastError" || (error.message && String(error.message).includes("ObjectId"))) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID format",
        code: "BAD_REQUEST",
      });
      return;
    }
    if (error.message === "Song not found" || error.message?.includes("Song not found")) {
      res.status(404).json({
        success: false,
        message: "Song not found",
        code: "NOT_FOUND",
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: "Failed to toggle save",
      error: error.message,
    });
  }
};
