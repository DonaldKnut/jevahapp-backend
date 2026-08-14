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

    // Single durable toggle — do NOT also call toggleLikeFast then toggleLike
    // (both paths fully flip CF likes → background call undoes the like).
    const result = await likeService.toggleLike(
      userId,
      songId,
      "copyright_free_song"
    );

    const liked = result.liked;
    const likeCount = result.likeCount;

    // Get updated song to ensure we have latest counts (invariant already applied by service)
    const updatedSong = await songService.getSongByIdAdmin(songId);
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
    const platform =
      typeof req.body?.platform === "string"
        ? req.body.platform.slice(0, 64)
        : undefined;

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

    const result = await interactionService.shareSong(userId, songId, {
      platform,
    });

    try {
      const { getIO } = await import("../../socket/socketManager");
      const io = getIO();
      if (io) {
        const roomKey = `content:audio:${songId}`;
        io.to(roomKey).emit("copyright-free-song-interaction-updated", {
          songId,
          shareCount: result.shareCount,
          likeCount: result.likeCount,
          viewCount: result.viewCount,
          shared: true,
        });
      }
    } catch (socketError: any) {
      logger.warn("Failed to emit realtime share update", {
        error: socketError?.message,
        songId,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        shared: true,
        shareCount: result.shareCount,
        likeCount: result.likeCount,
        viewCount: result.viewCount,
        shareUrl: result.shareUrl,
        platform: result.platform,
      },
    });
  } catch (error: any) {
    logger.error("Error sharing song:", error);
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
    // Never trust client-supplied counters — ignore if present.
    const {
      durationMs,
      progressPct,
      isComplete,
      viewCount: _ignoreViewCount,
      likeCount: _ignoreLikeCount,
      counted: _ignoreCounted,
      ..._rest
    } = req.body || {};
    void _ignoreViewCount;
    void _ignoreLikeCount;
    void _ignoreCounted;
    void _rest;

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

    // Soft-fail geo stamp for Studio topRegions (CF-IPCountry / edge headers only)
    if (result.hasViewed) {
      const { countryCodeFromRequest, stampInteractionCountryCode } = await import(
        "../../modules/creators/creatorAnalytics.service"
      );
      void stampInteractionCountryCode(
        userId,
        songId,
        countryCodeFromRequest(req.headers as Record<string, unknown>)
      );
    }

    // Get updated song for real-time updates
    const updatedSong = await songService.getSongByIdAdmin(songId);

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
        // Server-owned durable total — source of truth for UI lifetime views
        viewCount: result.viewCount,
        hasViewed: result.hasViewed,
        // Always present — FE must not treat omit as counted.
        // true only when THIS request incremented the song viewCount.
        counted: result.isNewView === true,
        isNewView: result.isNewView === true,
        // Explicit: this is NOT live presence (socket viewer-count-update)
        metric: "lifetime_view",
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

    const updatedSong = await songService.getSongByIdAdmin(songId);

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

/**
 * POST /api/audio/copyright-free/:songId/play
 * Also used for artist-lane tracks (same collection).
 * Increments playCount (scrobble-style; not unique).
 *
 * Studio / admin inspect must send `source=studio_preview` or `admin` so public
 * playCount and creator analytics stay honest. Those sources are not counted.
 */
export const recordPlay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    const mongoose = await import("mongoose");
    if (!songId || !mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ success: false, message: "Invalid song ID" });
      return;
    }

    const source = String(
      (req.body && (req.body.source || req.body.playSource)) ||
        req.query.source ||
        ""
    )
      .trim()
      .toLowerCase();
    const { isNonStatPlaySource } = await import(
      "../../modules/creators/creatorAudience.service"
    );
    const counted = !isNonStatPlaySource(source);

    const { CopyrightFreeSong } = await import("../../models/copyrightFreeSong.model");
    const updated = counted
      ? await CopyrightFreeSong.findByIdAndUpdate(
          songId,
          { $inc: { playCount: 1 } },
          { new: true }
        )
          .select("playCount viewCount likeCount lane artistSlug title")
          .lean()
      : await CopyrightFreeSong.findById(songId)
          .select("playCount viewCount likeCount lane artistSlug title")
          .lean();

    if (!updated) {
      res.status(404).json({ success: false, message: "Track not found" });
      return;
    }

    if (counted) {
      try {
        const { getIO } = await import("../../socket/socketManager");
        const io = getIO();
        if (io) {
          io.to(`content:audio:${songId}`).emit("copyright-free-song-interaction-updated", {
            songId,
            playCount: (updated as any).playCount ?? 0,
            viewCount: (updated as any).viewCount ?? 0,
            likeCount: (updated as any).likeCount ?? 0,
          });
        }
      } catch {
        /* ignore */
      }
    }

    res.status(200).json({
      success: true,
      data: {
        playCount: (updated as any).playCount ?? 0,
        id: songId,
        counted,
        source: source || "listener",
      },
    });
  } catch (error: any) {
    logger.error("Error recording play:", error);
    res.status(500).json({ success: false, message: "Failed to record play" });
  }
};
