import { Request, Response } from "express";
import { CopyrightFreeSongService } from "../service/copyrightFreeSong.service";
import logger from "../utils/logger";
import { CopyrightFreeSongInteractionService } from "../service/copyrightFreeSongInteraction.service";

const songService = new CopyrightFreeSongService();
const interactionService = new CopyrightFreeSongInteractionService();

export const getAllSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    
    // Enforce maximum limit for mobile-friendly payloads
    limit = Math.min(Math.max(limit, 1), 100);

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

/**
 * Search copyright-free songs
 * GET /api/audio/copyright-free/search
 * 
 * Supports multi-field search, category filtering, sorting, and pagination
 * Returns user-specific data (isLiked, isInLibrary) if authenticated
 */
export const searchSongs = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { q, page, limit, category, sort } = req.query;
    const userId = req.userId;

    // Validate query parameter (required)
    if (!q || typeof q !== "string" || !q.trim()) {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Parse and validate pagination parameters
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;

    // Validate limit (max 100 per spec)
    if (limitNum > 100) {
      res.status(400).json({
        success: false,
        error: "Invalid limit. Maximum is 100",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Validate sort option
    const validSorts = ["relevance", "popular", "newest", "oldest", "title"];
    const sortOption = (sort as string) || "relevance";
    if (!validSorts.includes(sortOption)) {
      res.status(400).json({
        success: false,
        error: `Invalid sort option. Must be one of: ${validSorts.join(", ")}`,
        code: "BAD_REQUEST",
      });
      return;
    }

    // Perform search
    const result = await songService.searchSongs(q.trim(), {
      page: pageNum,
      limit: limitNum,
      category: category as string | undefined,
      sort: sortOption as "relevance" | "popular" | "newest" | "oldest" | "title",
      userId: userId || undefined,
    });

    // Add user-specific data if authenticated
    let enrichedSongs = result.songs;
    if (userId) {
      const songIds = result.songs.map((s: any) => s._id.toString());
      
      // Get user's likes and bookmarks in parallel
      const [userLikes, userBookmarks] = await Promise.all([
        Promise.all(
          songIds.map((songId: string) => interactionService.isLiked(userId, songId))
        ),
        Promise.all(
          songIds.map(async (songId: string) => {
            try {
              const { UnifiedBookmarkService } = await import("../service/unifiedBookmark.service");
              return await UnifiedBookmarkService.isBookmarked(userId, songId);
            } catch {
              return false;
            }
          })
        ),
      ]);

      // Enrich songs with user-specific data
      enrichedSongs = result.songs.map((song: any, index: number) => {
        const songObj = song as any;
        return {
          ...songObj,
          id: songObj._id?.toString() || songObj.id,
          views: songObj.viewCount || 0, // For compatibility
          likes: songObj.likeCount || 0, // For compatibility
          isLiked: userLikes[index] || false,
          isInLibrary: userBookmarks[index] || false,
          isPublicDomain: true,
          contentType: "copyright-free-music",
          audioUrl: songObj.fileUrl,
          artist: songObj.singer,
          uploadedBy: songObj.uploadedBy?._id?.toString() || "system",
        };
      });
    } else {
      // For non-authenticated users, add default values
      enrichedSongs = result.songs.map((song: any) => {
        const songObj = song as any;
        return {
          ...songObj,
          id: songObj._id?.toString() || songObj.id,
          views: songObj.viewCount || 0,
          likes: songObj.likeCount || 0,
          isLiked: false,
          isInLibrary: false,
          isPublicDomain: true,
          contentType: "copyright-free-music",
          audioUrl: songObj.fileUrl,
          artist: songObj.singer,
          uploadedBy: songObj.uploadedBy?._id?.toString() || "system",
        };
      });
    }

    const searchTime = Date.now() - startTime;

    // Return success response (per spec format)
    res.status(200).json({
      success: true,
      data: {
        songs: enrichedSongs,
        pagination: {
          page: result.page,
          limit: limitNum,
          total: result.total,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
        },
        query: q.trim(),
        searchTime,
      },
    });
  } catch (error: any) {
    logger.error("Error searching songs:", error);

    // Handle validation errors
    if (error.message === "Search query is required") {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: "Failed to perform search",
      code: "SERVER_ERROR",
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
 * Record view for a copyright-free song
 * POST /api/audio/copyright-free/:songId/view
 * 
 * Records a view with engagement metrics (durationMs, progressPct, isComplete)
 * Implements one view per user per song with proper deduplication
 * 
 * @param req - Express request with songId param and engagement payload
 * @param res - Express response
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
    // All request body fields are optional per spec
    const result = await interactionService.recordView(userId, songId, {
      durationMs: durationMs !== undefined ? Number(durationMs) : undefined,
      progressPct: progressPct !== undefined ? Number(progressPct) : undefined,
      isComplete: isComplete === true || isComplete === "true",
    });

    // Get updated song for real-time updates
    const updatedSong = await songService.getSongById(songId);

    // Emit real-time update via WebSocket (per spec)
    // Event: copyright-free-song-interaction-updated
    // Room: content:audio:{songId}
    // Note: Emitting for both new views and engagement updates to ensure frontend has latest data
    try {
      const { getIO } = await import("../socket/socketManager");
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
      // Don't fail the request if socket emission fails (per spec)
      logger.warn("Failed to emit realtime view update", {
        error: socketError?.message,
        songId,
      });
    }

    // Return success response (per spec format)
    res.status(200).json({
      success: true,
      data: {
        viewCount: result.viewCount,
        hasViewed: result.hasViewed,
      },
    });
  } catch (error: any) {
    // Enhanced error logging with all diagnostic information
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

    // Handle specific error types (per spec)
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

    // Generic server error (per spec)
    // Include error code in development mode for debugging
    const isDevelopment = process.env.NODE_ENV === "development";
    res.status(500).json({
      success: false,
      error: isDevelopment ? error.message : "Failed to record view",
      code: "SERVER_ERROR",
      ...(isDevelopment && error.code ? { errorCode: error.code } : {}),
    });
  }
};

/**
 * Get search suggestions (autocomplete)
 * GET /api/audio/copyright-free/search/suggestions
 * 
 * Returns search suggestions based on partial query
 */
export const getSearchSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, limit } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 20); // Max 20 suggestions

    // Validate query parameter
    if (!q || typeof q !== "string" || !q.trim()) {
      res.status(400).json({
        success: false,
        error: "Search query is required",
        code: "BAD_REQUEST",
      });
      return;
    }

    const searchTerm = q.trim().toLowerCase();
    const searchRegex = new RegExp(`^${searchTerm}`, "i");

    // Use efficient database query instead of fetching all songs
    const { CopyrightFreeSong } = await import("../models/copyrightFreeSong.model");
    
    // Query for matching titles and singers in a single efficient query
    const [titleMatches, artistMatches] = await Promise.all([
      CopyrightFreeSong.find({
        title: { $regex: searchRegex, $options: "i" }
      })
        .select("title")
        .limit(50)
        .lean(),
      CopyrightFreeSong.find({
        singer: { $regex: searchRegex, $options: "i" }
      })
        .select("singer")
        .limit(50)
        .lean(),
    ]);

    const suggestions = new Set<string>();
    
    // Add unique title matches
    titleMatches.forEach((song: any) => {
      if (song.title) {
        suggestions.add(song.title.toLowerCase());
      }
    });

    // Add unique artist matches
    artistMatches.forEach((song: any) => {
      if (song.singer) {
        suggestions.add(song.singer.toLowerCase());
      }
    });

    // Convert to array and limit
    const suggestionsArray = Array.from(suggestions).slice(0, limitNum);

    res.status(200).json({
      success: true,
      data: {
        suggestions: suggestionsArray,
      },
    });
  } catch (error: any) {
    logger.error("Error getting search suggestions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get search suggestions",
      code: "SERVER_ERROR",
    });
  }
};

/**
 * Get trending searches
 * GET /api/audio/copyright-free/search/trending
 * 
 * Returns popular search terms (simplified implementation)
 */
export const getTrendingSearches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit, period } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 20); // Max 20 trending
    const periodOption = (period as string) || "week";

    // Use efficient database query to get trending songs directly sorted by viewCount
    const { CopyrightFreeSong } = await import("../models/copyrightFreeSong.model");
    
    const trendingSongs = await CopyrightFreeSong.find()
      .select("title singer viewCount")
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limitNum)
      .lean();

    const trending = trendingSongs.map((song: any) => ({
      query: song.title || song.singer,
      count: song.viewCount || 0,
      category: "Gospel Music", // Default category
    }));

    res.status(200).json({
      success: true,
      data: {
        trending,
      },
    });
  } catch (error: any) {
    logger.error("Error getting trending searches:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get trending searches",
      code: "SERVER_ERROR",
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

