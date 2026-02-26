import { Types } from "mongoose";
import { CopyrightFreeSong, ICopyrightFreeSong } from "../models/copyrightFreeSong.model";
import logger from "../utils/logger";

export interface CreateSongInput {
  title: string;
  singer: string;
  fileUrl: string;
  thumbnailUrl?: string;
  category?: string;
  duration?: number;
  uploadedBy: Types.ObjectId | string;
}

export interface UpdateSongInput {
  title?: string;
  singer?: string;
  thumbnailUrl?: string;
  category?: string;
  duration?: number;
}

export class CopyrightFreeSongService {
  async getAllSongs(
    page: number = 1,
    limit: number = 20,
    category?: string
  ): Promise<{
    songs: ICopyrightFreeSong[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      // Build query with optional category filter
      const query: any = {};
      if (category && category.trim()) {
        query.category = { $regex: new RegExp(category.trim(), "i") };
      }
      
      const [songs, total] = await Promise.all([
        CopyrightFreeSong.find(query)
          .populate("uploadedBy", "firstName lastName avatar")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CopyrightFreeSong.countDocuments(query),
      ]);

      return {
        songs: songs as unknown as ICopyrightFreeSong[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error("Error getting all copyright-free songs:", error);
      throw error;
    }
  }

  async getSongById(songId: string): Promise<ICopyrightFreeSong | null> {
    try {
      const song = await CopyrightFreeSong.findById(songId)
        .populate("uploadedBy", "firstName lastName avatar")
        .lean();

      return song as ICopyrightFreeSong | null;
    } catch (error: any) {
      logger.error("Error getting copyright-free song:", error);
      throw error;
    }
  }

  async createSong(input: CreateSongInput): Promise<ICopyrightFreeSong> {
    try {
      const song = await CopyrightFreeSong.create({
        title: input.title,
        singer: input.singer,
        fileUrl: input.fileUrl,
        thumbnailUrl: input.thumbnailUrl,
        category: input.category,
        duration: input.duration,
        uploadedBy: input.uploadedBy,
        likeCount: 0,
        shareCount: 0,
        viewCount: 0,
      });

      return song;
    } catch (error: any) {
      logger.error("Error creating copyright-free song:", error);
      throw error;
    }
  }

  async updateSong(songId: string, input: UpdateSongInput): Promise<ICopyrightFreeSong | null> {
    try {
      const song = await CopyrightFreeSong.findByIdAndUpdate(
        songId,
        { $set: input },
        { new: true, runValidators: true }
      );

      return song;
    } catch (error: any) {
      logger.error("Error updating copyright-free song:", error);
      throw error;
    }
  }

  async deleteSong(songId: string): Promise<boolean> {
    try {
      const result = await CopyrightFreeSong.findByIdAndDelete(songId);
      return !!result;
    } catch (error: any) {
      logger.error("Error deleting copyright-free song:", error);
      throw error;
    }
  }

  async incrementLikeCount(songId: string): Promise<void> {
    try {
      await CopyrightFreeSong.findByIdAndUpdate(songId, {
        $inc: { likeCount: 1 },
      });
    } catch (error: any) {
      logger.error("Error incrementing like count:", error);
      throw error;
    }
  }

  async decrementLikeCount(songId: string): Promise<void> {
    try {
      await CopyrightFreeSong.findByIdAndUpdate(songId, {
        $inc: { likeCount: -1 },
      });
    } catch (error: any) {
      logger.error("Error decrementing like count:", error);
      throw error;
    }
  }

  async incrementShareCount(songId: string): Promise<void> {
    try {
      await CopyrightFreeSong.findByIdAndUpdate(songId, {
        $inc: { shareCount: 1 },
      });
    } catch (error: any) {
      logger.error("Error incrementing share count:", error);
      throw error;
    }
  }

  async incrementViewCount(songId: string): Promise<void> {
    try {
      await CopyrightFreeSong.findByIdAndUpdate(songId, {
        $inc: { viewCount: 1 },
      });
    } catch (error: any) {
      logger.error("Error incrementing view count:", error);
      throw error;
    }
  }

  /**
   * Enforce viewCount >= likeCount invariant. If likeCount > viewCount, set viewCount = likeCount and persist.
   * Call after like or view updates so the client never sees likes > views.
   */
  async ensureViewCountInvariant(songId: string): Promise<void> {
    try {
      const song = await CopyrightFreeSong.findById(songId).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
      if (!song) return;
      const viewCount = song.viewCount ?? 0;
      const likeCount = song.likeCount ?? 0;
      if (likeCount > viewCount) {
        await CopyrightFreeSong.findByIdAndUpdate(songId, {
          $set: { viewCount: likeCount },
        });
        logger.debug("Enforced viewCount >= likeCount invariant", { songId, likeCount, previousViewCount: viewCount });
      }
    } catch (error: any) {
      logger.error("Error ensuring viewCount invariant:", error);
      throw error;
    }
  }

  /**
   * Return viewCount normalized so it is always >= likeCount (for responses without persisting).
   */
  static normalizedViewCount(song: { viewCount?: number; likeCount?: number } | null): number {
    if (!song) return 0;
    const v = song.viewCount ?? 0;
    const l = song.likeCount ?? 0;
    return Math.max(v, l);
  }

  /**
   * Track playback and increment view count if threshold is met (30 seconds)
   * This is called when playback ends
   */
  async trackPlayback(
    songId: string,
    playbackDuration: number,
    thresholdSeconds: number = 30
  ): Promise<{ viewCountIncremented: boolean; newViewCount: number }> {
    try {
      const song = await CopyrightFreeSong.findById(songId);
      if (!song) {
        throw new Error("Song not found");
      }

      let viewCountIncremented = false;

      // Only increment view count if user listened for at least threshold seconds
      if (playbackDuration >= thresholdSeconds) {
        await CopyrightFreeSong.findByIdAndUpdate(songId, {
          $inc: { viewCount: 1 },
        });
        viewCountIncremented = true;
      }

      // Get updated view count
      const updatedSong = await CopyrightFreeSong.findById(songId).select("viewCount").lean() as { viewCount?: number } | null;
      const newViewCount = updatedSong?.viewCount ?? song.viewCount;

      logger.info("Playback tracked for copyright-free song", {
        songId,
        playbackDuration,
        thresholdSeconds,
        viewCountIncremented,
        newViewCount,
      });

      return {
        viewCountIncremented,
        newViewCount,
      };
    } catch (error: any) {
      logger.error("Error tracking playback:", error);
      throw error;
    }
  }

  /**
   * Search copyright-free songs with advanced filtering and sorting
   * @param query - Search query string
   * @param options - Search options (page, limit, category, sort, userId)
   * @returns Search results with pagination
   */
  async searchSongs(
    query: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
      sort?: "relevance" | "popular" | "newest" | "oldest" | "title";
      userId?: string;
    } = {}
  ): Promise<{
    songs: ICopyrightFreeSong[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    try {
      const startTime = Date.now();
      const { page = 1, limit = 20, category, sort = "relevance", userId } = options;
      const skip = (page - 1) * limit;

      // Sanitize query
      const searchTerm = query.trim().toLowerCase();
      if (!searchTerm) {
        throw new Error("Search query is required");
      }

      // Build search conditions - search in title and singer (artist)
      const searchRegex = new RegExp(searchTerm, "i");
      const searchConditions: any = {
        $or: [
          { title: searchRegex },
          { singer: searchRegex },
        ],
      };

      // Add category filter if provided
      if (category && category.trim()) {
        searchConditions.category = { $regex: new RegExp(category.trim(), "i") };
      }

      // Build sort object based on sort option
      let sortObject: any = {};
      switch (sort) {
        case "relevance":
          // For relevance, prioritize title matches, then sort by popularity
          // MongoDB text search would be ideal, but regex works for now
          sortObject = { viewCount: -1, likeCount: -1, createdAt: -1 };
          break;
        case "popular":
          sortObject = { viewCount: -1, likeCount: -1 };
          break;
        case "newest":
          sortObject = { createdAt: -1 };
          break;
        case "oldest":
          sortObject = { createdAt: 1 };
          break;
        case "title":
          sortObject = { title: 1 };
          break;
        default:
          sortObject = { viewCount: -1, createdAt: -1 };
      }

      // Execute search query
      const [songs, total] = await Promise.all([
        CopyrightFreeSong.find(searchConditions)
          .populate("uploadedBy", "firstName lastName avatar")
          .sort(sortObject)
          .skip(skip)
          .limit(limit)
          .lean(),
        CopyrightFreeSong.countDocuments(searchConditions),
      ]);

      // Calculate pagination
      const totalPages = Math.ceil(total / limit);
      const hasMore = skip + limit < total;

      const searchTime = Date.now() - startTime;

      logger.debug("Search completed", {
        query: searchTerm,
        total,
        page,
        limit,
        searchTime,
      });

      return {
        songs: songs as unknown as ICopyrightFreeSong[],
        total,
        page,
        totalPages,
        hasMore,
      };
    } catch (error: any) {
      logger.error("Error searching copyright-free songs:", error);
      throw error;
    }
  }
}

