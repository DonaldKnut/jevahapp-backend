import { Request, Response } from "express";
import { Types } from "mongoose";
import audioService from "../service/audio.service";
import { ContentInteractionService } from "../service/contentInteraction.service";
import { UnifiedBookmarkService } from "../service/unifiedBookmark.service";
import logger from "../utils/logger";
import { MediaService } from "../service/media.service";

const contentInteractionService = new ContentInteractionService();

/**
 * Get all copyright-free songs (Public)
 */
export const getCopyrightFreeSongs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      search,
      category,
      artist,
      year,
      minDuration,
      maxDuration,
      tags,
      sortBy = "newest",
      page = "1",
      limit = "20",
    } = req.query;

    const filters: any = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 20,
      sortBy: sortBy as any,
    };

    if (search) filters.search = search as string;
    if (category) filters.category = category as string;
    if (artist) filters.artist = artist as string;
    if (year) filters.year = parseInt(year as string);
    if (minDuration) filters.minDuration = parseInt(minDuration as string);
    if (maxDuration) filters.maxDuration = parseInt(maxDuration as string);
    if (tags) {
      filters.tags = Array.isArray(tags) ? tags : [tags];
    }

    const result = await audioService.getCopyrightFreeSongs(filters);

    res.status(200).json({
      success: true,
      message: "Copyright-free songs retrieved successfully",
      data: {
        songs: result.songs,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: parseInt(limit as string) || 20,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error getting copyright-free songs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve copyright-free songs",
      error: error.message,
    });
  }
};

/**
 * Get a single copyright-free song (Public)
 */
export const getCopyrightFreeSong = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID",
      });
      return;
    }

    const song = await audioService.getCopyrightFreeSongById(songId, userId);

    if (!song) {
      res.status(404).json({
        success: false,
        message: "Copyright-free song not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Song retrieved successfully",
      data: song,
    });
  } catch (error: any) {
    logger.error("Error getting copyright-free song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve song",
      error: error.message,
    });
  }
};

/**
 * Search copyright-free songs (Public)
 */
export const searchCopyrightFreeSongs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { q, category, artist, sortBy, page, limit } = req.query;

    if (!q || (q as string).trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Search query is required",
      });
      return;
    }

    const filters: any = {};
    if (category) filters.category = category as string;
    if (artist) filters.artist = artist as string;
    if (sortBy) filters.sortBy = sortBy as any;
    if (page) filters.page = parseInt(page as string);
    if (limit) filters.limit = parseInt(limit as string);

    const result = await audioService.searchCopyrightFreeSongs(
      q as string,
      filters
    );

    res.status(200).json({
      success: true,
      message: "Search completed successfully",
      data: {
        songs: result.songs,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error searching copyright-free songs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search songs",
      error: error.message,
    });
  }
};

/**
 * Get categories for copyright-free songs (Public)
 */
export const getCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const categories = await audioService.getCategories();

    res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
    });
  } catch (error: any) {
    logger.error("Error getting categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
      error: error.message,
    });
  }
};

/**
 * Get artists for copyright-free songs (Public)
 */
export const getArtists = async (req: Request, res: Response): Promise<void> => {
  try {
    const artists = await audioService.getArtists();

    res.status(200).json({
      success: true,
      message: "Artists retrieved successfully",
      data: artists,
    });
  } catch (error: any) {
    logger.error("Error getting artists:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve artists",
      error: error.message,
    });
  }
};

/**
 * Upload a copyright-free song (Admin Only)
 */
export const uploadCopyrightFreeSong = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const {
      title,
      description,
      artist,
      speaker,
      year,
      category,
      topics,
      duration,
      tags,
    } = req.body;

    // Validate required fields
    if (!title) {
      res.status(400).json({
        success: false,
        message: "Title is required",
      });
      return;
    }

    // Get files from multer
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    const file = files?.file?.[0];
    const thumbnail = files?.thumbnail?.[0];

    if (!file || !file.buffer) {
      res.status(400).json({
        success: false,
        message: "Audio file is required",
      });
      return;
    }

    if (!thumbnail || !thumbnail.buffer) {
      res.status(400).json({
        success: false,
        message: "Thumbnail is required",
      });
      return;
    }

    // Parse topics and tags
    let parsedTopics: string[] = [];
    if (topics) {
      try {
        parsedTopics = Array.isArray(topics) ? topics : JSON.parse(topics);
      } catch (error) {
        parsedTopics = [];
      }
    }

    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
      } catch (error) {
        parsedTags = [];
      }
    }

    // Prepare upload data
    const uploadData = {
      title: title.trim(),
      description: description?.trim(),
      artist: artist?.trim(),
      speaker: speaker?.trim() || artist?.trim(),
      year: year ? parseInt(year) : undefined,
      category: category?.trim(),
      topics: parsedTopics,
      duration: duration ? parseFloat(duration) : undefined,
      tags: parsedTags,
      uploadedBy: new Types.ObjectId(userId),
      file: file.buffer,
      fileMimeType: file.mimetype,
      thumbnail: thumbnail.buffer,
      thumbnailMimeType: thumbnail.mimetype,
    };

    // Upload the song using MediaService first (handles file uploads to Cloudflare R2)
    const mediaService = new MediaService();
    
    // Use MediaService to handle file uploads
    const mediaInput: any = {
      title: uploadData.title,
      description: uploadData.description,
      contentType: file.mimetype.startsWith("audio/") ? "music" : "audio",
      category: uploadData.category,
      topics: uploadData.topics,
      duration: uploadData.duration,
      uploadedBy: uploadData.uploadedBy,
      file: uploadData.file,
      fileMimeType: uploadData.fileMimeType,
      thumbnail: uploadData.thumbnail,
      thumbnailMimeType: uploadData.thumbnailMimeType,
    };

    const media = await mediaService.uploadMedia(mediaInput);

    // Update with copyright-free specific fields using Media model directly
    const { Media } = await import("../models/media.model");
    const updatedMedia = await Media.findByIdAndUpdate(
      media._id,
      {
        isPublicDomain: true,
        moderationStatus: "approved",
        speaker: uploadData.speaker,
        year: uploadData.year,
        tags: uploadData.tags,
      },
      { new: true }
    )
      .populate("uploadedBy", "firstName lastName avatar")
      .lean();

    if (!updatedMedia) {
      res.status(500).json({
        success: false,
        message: "Failed to update song with copyright-free fields",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Copyright-free song uploaded successfully",
      data: updatedMedia,
    });
  } catch (error: any) {
    logger.error("Error uploading copyright-free song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload song",
      error: error.message,
    });
  }
};

/**
 * Update a copyright-free song (Admin Only)
 */
export const updateCopyrightFreeSong = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID",
      });
      return;
    }

    const updates = req.body;

    const updatedSong = await audioService.updateCopyrightFreeSong(
      songId,
      updates,
      userId
    );

    if (!updatedSong) {
      res.status(404).json({
        success: false,
        message: "Copyright-free song not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Song updated successfully",
      data: updatedSong,
    });
  } catch (error: any) {
    logger.error("Error updating copyright-free song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update song",
      error: error.message,
    });
  }
};

/**
 * Delete a copyright-free song (Admin Only)
 */
export const deleteCopyrightFreeSong = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID",
      });
      return;
    }

    await audioService.deleteCopyrightFreeSong(songId, userId);

    res.status(200).json({
      success: true,
      message: "Song deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting copyright-free song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete song",
      error: error.message,
    });
  }
};

/**
 * Like/Unlike a copyright-free song (Authenticated)
 * Toggle endpoint - same endpoint for like and unlike
 */
export const likeCopyrightFreeSong = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID",
      });
      return;
    }

    // Toggle like (ContentInteractionService handles real-time Socket.IO events)
    const result = await contentInteractionService.toggleLike(
      userId,
      songId,
      "media"
    );

    // Get updated song with all counts
    const { Media } = await import("../models/media.model");
    const song: any = await Media.findById(songId)
      .select("likeCount viewCount listenCount")
      .lean();

    const viewCount = song?.viewCount || 0;
    const listenCount = song?.listenCount || 0;

    // Emit additional real-time event specifically for audio/copyright-free songs
    try {
      const io = require("../socket/socketManager").getIO();
      if (io) {
        // Emit to audio-specific rooms
        io.to(`content:media:${songId}`).emit("audio-like-updated", {
          songId,
          liked: result.liked,
          likeCount: result.likeCount,
          viewCount,
          listenCount,
          userId,
          timestamp: new Date().toISOString(),
        });

        // Also emit to copyright-free specific room
        io.to(`audio:copyright-free:${songId}`).emit("like-updated", {
          songId,
          liked: result.liked,
          likeCount: result.likeCount,
          viewCount,
          listenCount,
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (socketError) {
      logger.warn("Failed to send audio-specific real-time like update", {
        error: socketError,
        songId,
      });
    }

    res.status(200).json({
      success: true,
      message: result.liked ? "Song liked successfully" : "Song unliked",
      data: {
        liked: result.liked,
        likeCount: result.likeCount,
        viewCount,
        listenCount,
      },
    });
  } catch (error: any) {
    logger.error("Error liking copyright-free song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to like song",
      error: error.message,
    });
  }
};

/**
 * Save a copyright-free song to library (Authenticated)
 */
export const saveCopyrightFreeSong = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID",
      });
      return;
    }

    const result = await UnifiedBookmarkService.toggleBookmark(userId, songId);

    res.status(200).json({
      success: true,
      message: result.bookmarked
        ? "Song saved to library"
        : "Song removed from library",
      data: result,
    });
  } catch (error: any) {
    logger.error("Error saving copyright-free song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save song",
      error: error.message,
    });
  }
};

/**
 * Get user's audio library (Authenticated)
 */
export const getUserAudioLibrary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { Bookmark } = await import("../models/bookmark.model");
    const { Media } = await import("../models/media.model");

    // Get all bookmarked media that are audio/music
    const bookmarks = await Bookmark.find({
      user: new Types.ObjectId(userId),
    })
      .populate({
        path: "media",
        match: {
          contentType: { $in: ["music", "audio"] },
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    // Filter out null media (populate failed)
    const audioBookmarks = bookmarks.filter((b: any) => b.media !== null);

    res.status(200).json({
      success: true,
      message: "Audio library retrieved successfully",
      data: audioBookmarks.map((b: any) => ({
        id: b.media._id,
        ...b.media,
        savedAt: b.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error("Error getting audio library:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve audio library",
      error: error.message,
    });
  }
};

