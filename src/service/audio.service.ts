import { Types } from "mongoose";
import { Media, IMedia } from "../models/media.model";
import { MediaService } from "./media.service";
import logger from "../utils/logger";

export interface CopyrightFreeSongInput {
  title: string;
  description?: string;
  artist?: string;
  speaker?: string;
  year?: number;
  category?: string;
  topics?: string[];
  duration?: number;
  fileUrl: string;
  thumbnailUrl?: string;
  tags?: string[];
  uploadedBy: Types.ObjectId | string;
  file?: Buffer;
  fileMimeType?: string;
  thumbnail?: Buffer;
  thumbnailMimeType?: string;
}

export interface AudioSearchFilters {
  search?: string;
  category?: string;
  artist?: string;
  year?: number;
  minDuration?: number;
  maxDuration?: number;
  tags?: string[];
  sortBy?: "newest" | "oldest" | "popular" | "duration" | "title";
  page?: number;
  limit?: number;
}

export interface AudioQueryResult {
  songs: IMedia[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Service for managing copyright-free audio library (YouTube Audio Library style)
 * Admin-only uploads, public viewing
 */
export class AudioService {
  private mediaService: MediaService;

  constructor() {
    this.mediaService = new MediaService();
  }

  /**
   * Get all copyright-free songs with pagination and filters
   */
  async getCopyrightFreeSongs(
    filters: AudioSearchFilters = {}
  ): Promise<AudioQueryResult> {
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
        page = 1,
        limit = 20,
      } = filters;

      const query: any = {
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
        isHidden: { $ne: true },
        moderationStatus: { $ne: "rejected" },
      };

      // Search filter
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { speaker: { $regex: search, $options: "i" } },
        ];
      }

      // Category filter
      if (category) {
        query.category = { $regex: category, $options: "i" };
      }

      // Artist/Speaker filter
      if (artist) {
        query.$or = [
          { speaker: { $regex: artist, $options: "i" } },
          { "uploadedBy.firstName": { $regex: artist, $options: "i" } },
        ];
      }

      // Year filter
      if (year) {
        query.year = year;
      }

      // Duration filters
      if (minDuration !== undefined || maxDuration !== undefined) {
        query.duration = {};
        if (minDuration !== undefined) {
          query.duration.$gte = minDuration;
        }
        if (maxDuration !== undefined) {
          query.duration.$lte = maxDuration;
        }
      }

      // Tags filter
      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }

      // Sort options
      let sort: any = {};
      switch (sortBy) {
        case "newest":
          sort = { createdAt: -1 };
          break;
        case "oldest":
          sort = { createdAt: 1 };
          break;
        case "popular":
          sort = { listenCount: -1, viewCount: -1 };
          break;
        case "duration":
          sort = { duration: 1 };
          break;
        case "title":
          sort = { title: 1 };
          break;
        default:
          sort = { createdAt: -1 };
      }

      const skip = (page - 1) * limit;

      const [songs, total] = await Promise.all([
        Media.find(query)
          .select("title description contentType category fileUrl thumbnailUrl topics uploadedBy createdAt updatedAt viewCount listenCount likeCount commentCount shareCount isPublicDomain speaker year duration tags")
          .populate("uploadedBy", "firstName lastName avatar")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Media.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        songs: songs as any as IMedia[],
        total,
        page,
        totalPages,
      };
    } catch (error: any) {
      logger.error("Error fetching copyright-free songs:", error);
      throw error;
    }
  }

  /**
   * Get a single copyright-free song by ID
   */
  async getCopyrightFreeSongById(
    songId: string,
    userId?: string
  ): Promise<IMedia | null> {
    try {
      if (!Types.ObjectId.isValid(songId)) {
        throw new Error("Invalid song ID");
      }

      const song = await Media.findOne({
        _id: new Types.ObjectId(songId),
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
        isHidden: { $ne: true },
      })
        .select("title description contentType category fileUrl thumbnailUrl topics uploadedBy createdAt updatedAt viewCount listenCount likeCount commentCount shareCount isPublicDomain speaker year duration tags")
        .populate("uploadedBy", "firstName lastName avatar")
        .lean();

      return song as IMedia | null;
    } catch (error: any) {
      logger.error("Error fetching copyright-free song:", error);
      throw error;
    }
  }

  /**
   * Search copyright-free songs
   */
  async searchCopyrightFreeSongs(
    query: string,
    filters: Omit<AudioSearchFilters, "search"> = {}
  ): Promise<AudioQueryResult> {
    return this.getCopyrightFreeSongs({
      ...filters,
      search: query,
    });
  }

  /**
   * Get distinct categories from copyright-free songs
   */
  async getCategories(): Promise<string[]> {
    try {
      const categories = await Media.distinct("category", {
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
        category: { $exists: true, $ne: null },
      });

      return categories.filter(Boolean) as string[];
    } catch (error: any) {
      logger.error("Error fetching categories:", error);
      throw error;
    }
  }

  /**
   * Get distinct artists/speakers from copyright-free songs
   */
  async getArtists(): Promise<string[]> {
    try {
      const speakers = await Media.distinct("speaker", {
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
        speaker: { $exists: true, $ne: null },
      });

      return speakers.filter(Boolean) as string[];
    } catch (error: any) {
      logger.error("Error fetching artists:", error);
      throw error;
    }
  }

  /**
   * Upload a copyright-free song (Admin only)
   */
  async uploadCopyrightFreeSong(
    data: CopyrightFreeSongInput
  ): Promise<IMedia> {
    try {
      // Validate required fields
      if (!data.title || !data.fileUrl) {
        throw new Error("Title and fileUrl are required");
      }

      // Determine content type (music or audio)
      const contentType = data.fileMimeType?.startsWith("audio/")
        ? "music"
        : "audio";

      // Prepare media input for MediaService
      const mediaInput: any = {
        title: data.title,
        description: data.description,
        contentType,
        category: data.category,
        topics: data.topics || [],
        duration: data.duration,
        uploadedBy: data.uploadedBy,
        file: data.file,
        fileMimeType: data.fileMimeType,
        thumbnail: data.thumbnail,
        thumbnailMimeType: data.thumbnailMimeType,
      };

      // Upload media using existing MediaService
      const media = await this.mediaService.uploadMedia(mediaInput);

      // Update media with copyright-free specific fields
      const updatedMedia = await Media.findByIdAndUpdate(
        media._id,
        {
          isPublicDomain: true,
          speaker: data.speaker || data.artist,
          year: data.year,
          tags: data.tags || [],
          moderationStatus: "approved", // Admin uploads are pre-approved
          fileUrl: data.fileUrl || media.fileUrl,
          thumbnailUrl: data.thumbnailUrl || media.thumbnailUrl,
        },
        { new: true }
      );

      if (!updatedMedia) {
        throw new Error("Failed to update media with copyright-free fields");
      }

      logger.info("Copyright-free song uploaded", {
        songId: updatedMedia._id,
        title: updatedMedia.title,
        uploadedBy: data.uploadedBy,
      });

      return updatedMedia;
    } catch (error: any) {
      logger.error("Error uploading copyright-free song:", error);
      throw error;
    }
  }

  /**
   * Update a copyright-free song (Admin only)
   */
  async updateCopyrightFreeSong(
    songId: string,
    updates: Partial<CopyrightFreeSongInput>,
    adminId: string
  ): Promise<IMedia | null> {
    try {
      if (!Types.ObjectId.isValid(songId)) {
        throw new Error("Invalid song ID");
      }

      const song = await Media.findOne({
        _id: new Types.ObjectId(songId),
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
      });

      if (!song) {
        throw new Error("Copyright-free song not found");
      }

      const updateData: any = {};

      if (updates.title) updateData.title = updates.title;
      if (updates.description !== undefined)
        updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.topics) updateData.topics = updates.topics;
      if (updates.speaker) updateData.speaker = updates.speaker;
      if (updates.artist) updateData.speaker = updates.artist;
      if (updates.year) updateData.year = updates.year;
      if (updates.duration) updateData.duration = updates.duration;
      if (updates.tags) updateData.tags = updates.tags;
      if (updates.fileUrl) updateData.fileUrl = updates.fileUrl;
      if (updates.thumbnailUrl) updateData.thumbnailUrl = updates.thumbnailUrl;

      const updatedSong = await Media.findByIdAndUpdate(
        songId,
        updateData,
        { new: true }
      )
        .populate("uploadedBy", "firstName lastName avatar")
        .lean();

      logger.info("Copyright-free song updated", {
        songId,
        updatedBy: adminId,
        updates: Object.keys(updateData),
      });

      return updatedSong as IMedia | null;
    } catch (error: any) {
      logger.error("Error updating copyright-free song:", error);
      throw error;
    }
  }

  /**
   * Delete a copyright-free song (Admin only)
   */
  async deleteCopyrightFreeSong(songId: string, adminId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(songId)) {
        throw new Error("Invalid song ID");
      }

      const song = await Media.findOne({
        _id: new Types.ObjectId(songId),
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
      });

      if (!song) {
        throw new Error("Copyright-free song not found");
      }

      // Soft delete by marking as hidden
      await Media.findByIdAndUpdate(songId, {
        isHidden: true,
        moderationStatus: "rejected",
      });

      logger.info("Copyright-free song deleted", {
        songId,
        deletedBy: adminId,
      });

      return true;
    } catch (error: any) {
      logger.error("Error deleting copyright-free song:", error);
      throw error;
    }
  }

  /**
   * Get trending copyright-free songs
   */
  async getTrendingSongs(limit: number = 20): Promise<IMedia[]> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const songs = await Media.find({
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
        isHidden: { $ne: true },
        createdAt: { $gte: sevenDaysAgo },
      })
        .sort({ listenCount: -1, viewCount: -1, createdAt: -1 })
        .limit(limit)
        .populate("uploadedBy", "firstName lastName avatar")
        .lean();

      return songs as any as IMedia[];
    } catch (error: any) {
      logger.error("Error fetching trending songs:", error);
      throw error;
    }
  }

  /**
   * Get recently added copyright-free songs
   */
  async getRecentlyAddedSongs(limit: number = 20): Promise<IMedia[]> {
    try {
      const songs = await Media.find({
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
        isHidden: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("uploadedBy", "firstName lastName avatar")
        .lean();

      return songs as any as IMedia[];
    } catch (error: any) {
      logger.error("Error fetching recently added songs:", error);
      throw error;
    }
  }
}

export default new AudioService();

