import { Types } from "mongoose";
import { CopyrightFreeSong, ICopyrightFreeSong } from "../models/copyrightFreeSong.model";
import logger from "../utils/logger";

export interface CreateSongInput {
  title: string;
  singer: string;
  fileUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  uploadedBy: Types.ObjectId | string;
}

export interface UpdateSongInput {
  title?: string;
  singer?: string;
  thumbnailUrl?: string;
  duration?: number;
}

export class CopyrightFreeSongService {
  async getAllSongs(page: number = 1, limit: number = 20): Promise<{
    songs: ICopyrightFreeSong[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      const [songs, total] = await Promise.all([
        CopyrightFreeSong.find()
          .populate("uploadedBy", "firstName lastName avatar")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CopyrightFreeSong.countDocuments(),
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

  async searchSongs(query: string, page: number = 1, limit: number = 20): Promise<{
    songs: ICopyrightFreeSong[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      const searchRegex = new RegExp(query, "i");
      
      const [songs, total] = await Promise.all([
        CopyrightFreeSong.find({
          $or: [
            { title: searchRegex },
            { singer: searchRegex },
          ],
        })
          .populate("uploadedBy", "firstName lastName avatar")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CopyrightFreeSong.countDocuments({
          $or: [
            { title: searchRegex },
            { singer: searchRegex },
          ],
        }),
      ]);

      return {
        songs: songs as unknown as ICopyrightFreeSong[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error("Error searching copyright-free songs:", error);
      throw error;
    }
  }
}

