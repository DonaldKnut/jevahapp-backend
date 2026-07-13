import { Media } from "../../models/media.model";
import { Interaction } from "../../models/interaction.model";
import { Bookmark } from "../../models/bookmark.model";
import { Like } from "../../models/like.model";
import { Types } from "mongoose";

export class MediaAnalyticsService {
  async getMediaCountByContentType() {
    const result = await Media.aggregate([
      { $group: { _id: "$contentType", count: { $sum: 1 } } },
      { $project: { contentType: "$_id", count: 1, _id: 0 } },
    ]);

    const counts: {
      music: number;
      videos: number;
      books: number;
      live: number;
    } = {
      music: 0,
      videos: 0,
      books: 0,
      live: 0,
    };

    result.forEach(item => {
      counts[item.contentType as keyof typeof counts] = item.count;
    });

    return counts;
  }

  async getTotalInteractionCounts() {
    const result = await Media.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$viewCount" },
          totalListens: { $sum: "$listenCount" },
          totalReads: { $sum: "$readCount" },
          totalDownloads: { $sum: "$downloadCount" },
          totalFavorites: { $sum: "$favoriteCount" },
          totalLikes: { $sum: "$likeCount" },
          totalShares: { $sum: "$shareCount" },
        },
      },
    ]);

    return {
      totalViews: result[0]?.totalViews || 0,
      totalListens: result[0]?.totalListens || 0,
      totalReads: result[0]?.totalReads || 0,
      totalDownloads: result[0]?.totalDownloads || 0,
      totalFavorites: result[0]?.totalFavorites || 0,
      totalLikes: result[0]?.totalLikes || 0,
      totalShares: result[0]?.totalShares || 0,
    };
  }

  async getMediaCountSinceDate(since: Date) {
    return await Media.countDocuments({ createdAt: { $gte: since } });
  }

  async getInteractionCountSinceDate(since: Date) {
    return await Interaction.countDocuments({
      createdAt: { $gte: since },
    });
  }

  async getUserMediaCountByContentType(userIdentifier: string) {
    if (!Types.ObjectId.isValid(userIdentifier)) {
      throw new Error("Invalid user identifier");
    }

    const result = await Media.aggregate([
      { $match: { uploadedBy: new Types.ObjectId(userIdentifier) } },
      { $group: { _id: "$contentType", count: { $sum: 1 } } },
      { $project: { contentType: "$_id", count: 1, _id: 0 } },
    ]);

    const counts: {
      music: number;
      videos: number;
      books: number;
      live: number;
    } = {
      music: 0,
      videos: 0,
      books: 0,
      live: 0,
    };

    result.forEach(item => {
      counts[item.contentType as keyof typeof counts] = item.count;
    });

    return counts;
  }

  async getUserInteractionCounts(userIdentifier: string) {
    if (!Types.ObjectId.isValid(userIdentifier)) {
      throw new Error("Invalid user identifier");
    }

    const [interactionResults, likeCount] = await Promise.all([
      Interaction.aggregate([
        { $match: { user: new Types.ObjectId(userIdentifier) } },
        { $group: { _id: "$interactionType", count: { $sum: "$count" } } },
        { $project: { interactionType: "$_id", count: 1, _id: 0 } },
      ]),
      Like.countDocuments({ userId: new Types.ObjectId(userIdentifier) })
    ]);

    const counts: {
      totalViews: number;
      totalListens: number;
      totalReads: number;
      totalDownloads: number;
      totalLikes: number;
    } = {
      totalViews: 0,
      totalListens: 0,
      totalReads: 0,
      totalDownloads: 0,
      totalLikes: likeCount,
    };

    interactionResults.forEach(item => {
      if (item.interactionType === "view") counts.totalViews = item.count;
      if (item.interactionType === "listen") counts.totalListens = item.count;
      if (item.interactionType === "read") counts.totalReads = item.count;
      if (item.interactionType === "download")
        counts.totalDownloads = item.count;
    });

    return counts;
  }

  async getUserBookmarkCount(userIdentifier: string) {
    if (!Types.ObjectId.isValid(userIdentifier)) {
      throw new Error("Invalid user identifier");
    }

    return await Bookmark.countDocuments({
      user: new Types.ObjectId(userIdentifier),
    });
  }

  async getUserRecentMedia(userIdentifier: string, limit: number) {
    if (!Types.ObjectId.isValid(userIdentifier)) {
      throw new Error("Invalid user identifier");
    }

    return await Media.find({ uploadedBy: new Types.ObjectId(userIdentifier) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "title contentType category createdAt thumbnailUrl fileUrl duration"
      )
      .populate("uploadedBy", "firstName lastName avatar")
      .lean();
  }

  async getUserMediaCountSinceDate(userIdentifier: string, since: Date) {
    if (!Types.ObjectId.isValid(userIdentifier)) {
      throw new Error("Invalid user identifier");
    }

    return await Media.countDocuments({
      uploadedBy: new Types.ObjectId(userIdentifier),
      createdAt: { $gte: since },
    });
  }

  async getUserInteractionCountSinceDate(userIdentifier: string, since: Date) {
    if (!Types.ObjectId.isValid(userIdentifier)) {
      throw new Error("Invalid user identifier");
    }

    return await Interaction.countDocuments({
      user: new Types.ObjectId(userIdentifier),
      createdAt: { $gte: since },
    });
  }
}

export const mediaAnalyticsService = new MediaAnalyticsService();
