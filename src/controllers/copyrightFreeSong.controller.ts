import { Request, Response } from "express";
import { CopyrightFreeSongService } from "../service/copyrightFreeSong.service";
import logger from "../utils/logger";
import { CopyrightFreeSongInteractionService } from "../service/copyrightFreeSongInteraction.service";

const songService = new CopyrightFreeSongService();
const interactionService = new CopyrightFreeSongInteractionService();

export const getAllSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await songService.getAllSongs(page, limit);

    res.status(200).json({
      success: true,
      data: {
        songs: result.songs,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error getting all songs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve songs",
      error: error.message,
    });
  }
};

export const getSongById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    const song = await songService.getSongById(songId);

    if (!song) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    // Don't increment view count on GET - only count on actual playback (≥30 seconds)
    // View count is now tracked via playback sessions (POST /playback/track)

    let isLiked = false;
    if (userId) {
      isLiked = await interactionService.isLiked(userId, songId);
    }

    res.status(200).json({
      success: true,
      data: {
        ...song,
        isLiked,
      },
    });
  } catch (error: any) {
    logger.error("Error getting song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve song",
      error: error.message,
    });
  }
};

export const createSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, singer, fileUrl, thumbnailUrl, duration } = req.body;
    const uploadedBy = req.userId;

    if (!title || !singer || !fileUrl || !uploadedBy) {
      res.status(400).json({
        success: false,
        message: "Title, singer, fileUrl, and uploadedBy are required",
      });
      return;
    }

    const song = await songService.createSong({
      title,
      singer,
      fileUrl,
      thumbnailUrl,
      duration,
      uploadedBy,
    });

    res.status(201).json({
      success: true,
      data: song,
    });
  } catch (error: any) {
    logger.error("Error creating song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create song",
      error: error.message,
    });
  }
};

export const updateSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const { title, singer, thumbnailUrl, duration } = req.body;

    const song = await songService.updateSong(songId, {
      title,
      singer,
      thumbnailUrl,
      duration,
    });

    if (!song) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: song,
    });
  } catch (error: any) {
    logger.error("Error updating song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update song",
      error: error.message,
    });
  }
};

export const deleteSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;

    const deleted = await songService.deleteSong(songId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Song deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete song",
      error: error.message,
    });
  }
};

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

    const { liked, likeCount, shareCount, viewCount } = await interactionService.toggleLike(userId, songId);

    // Get updated song to ensure we have latest counts
    const updatedSong = await songService.getSongById(songId);

    // listenCount doesn't exist in CopyrightFreeSong model, return 0 (optional field)
    const listenCount = 0;

    // Emit realtime update to all clients viewing this song
    try {
      const { getIO } = await import("../socket/socketManager");
      const io = getIO();
      if (io) {
        const roomKey = `content:audio:${songId}`;
        io.to(roomKey).emit("copyright-free-song-interaction-updated", {
          songId,
          likeCount: updatedSong?.likeCount || likeCount,
          viewCount: updatedSong?.viewCount || viewCount,
          liked,
          listenCount,
        });

        logger.debug("Emitted realtime like update", {
          songId,
          roomKey,
          likeCount: updatedSong?.likeCount || likeCount,
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
        likeCount: updatedSong?.likeCount || likeCount,
        viewCount: updatedSong?.viewCount || viewCount,
        listenCount,
      },
    });
  } catch (error: any) {
    logger.error("Error toggling like:", error);
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

export const searchSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!q || typeof q !== "string") {
      res.status(400).json({
        success: false,
        message: "Search query (q) is required",
      });
      return;
    }

    const result = await songService.searchSongs(q, page, limit);

    res.status(200).json({
      success: true,
      data: {
        songs: result.songs,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error searching songs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search songs",
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

    const result = await songService.trackPlayback(songId, playbackDuration, threshold);

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
 * Record view for a copyright-free song (matches frontend expectations)
 * Frontend calls this when user views/listens to a song
 */
export const recordView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;
    const { durationMs, progressPct, isComplete } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Check if user already viewed this song (one view per user per song)
    const interaction = await interactionService.getInteraction(userId, songId);
    const hasViewed = interaction?.hasViewed || false;

    let viewCount: number;
    if (!hasViewed) {
      // First view - increment count
      await songService.incrementViewCount(songId);
      // Mark as viewed
      await interactionService.markAsViewed(userId, songId);
    }
    
    // Get updated song with latest counts
    const updatedSong = await songService.getSongById(songId);
    viewCount = updatedSong?.viewCount || 0;

    // Emit realtime update to all clients viewing this song
    try {
      const { getIO } = await import("../socket/socketManager");
      const io = getIO();
      if (io) {
        const roomKey = `content:audio:${songId}`;
        io.to(roomKey).emit("copyright-free-song-interaction-updated", {
          songId,
          viewCount,
          likeCount: updatedSong?.likeCount || 0,
        });

        logger.debug("Emitted realtime view update", {
          songId,
          roomKey,
          viewCount,
        });
      }
    } catch (socketError: any) {
      // Don't fail the request if socket emission fails
      logger.warn("Failed to emit realtime view update", {
        error: socketError?.message,
        songId,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        viewCount,
        hasViewed: true, // Always true after this call
      },
    });
  } catch (error: any) {
    logger.error("Error recording view:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record view",
      error: error.message,
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

    const { UnifiedBookmarkService } = await import("../service/unifiedBookmark.service");
    const result = await UnifiedBookmarkService.toggleBookmark(userId, songId);

    // Get updated song to include all counts
    const updatedSong = await songService.getSongById(songId);

    // Emit realtime update to all clients viewing this song
    try {
      const { getIO } = await import("../socket/socketManager");
      const io = getIO();
      if (io) {
        const roomKey = `content:audio:${songId}`;
        io.to(roomKey).emit("copyright-free-song-interaction-updated", {
          songId,
          bookmarkCount: result.bookmarkCount,
          bookmarked: result.bookmarked,
          likeCount: updatedSong?.likeCount || 0,
          viewCount: updatedSong?.viewCount || 0,
        });

        logger.debug("Emitted realtime save update", {
          songId,
          roomKey,
          bookmarkCount: result.bookmarkCount,
        });
      }
    } catch (socketError: any) {
      // Don't fail the request if socket emission fails
      logger.warn("Failed to emit realtime save update", {
        error: socketError?.message,
        songId,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bookmarked: result.bookmarked,
        bookmarkCount: result.bookmarkCount,
      },
    });
  } catch (error: any) {
    logger.error("Error toggling save:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle save",
      error: error.message,
    });
  }
};

