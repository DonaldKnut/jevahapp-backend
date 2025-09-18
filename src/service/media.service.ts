import { Media, IMedia } from "../models/media.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { Bookmark } from "../models/bookmark.model";
import { User } from "../models/user.model";
import { UserViewedMedia } from "../models/userViewedMedia.model";
import { MediaUserAction } from "../models/mediaUserAction.model";
import { Types, ClientSession } from "mongoose";
import fileUploadService from "./fileUpload.service";
import { EmailService } from "../config/email.config";

interface MediaInput {
  title: string;
  description?: string;
  contentType: "music" | "videos" | "books" | "live";
  category?: string;
  uploadedBy: Types.ObjectId | string;
  file?: Buffer;
  fileMimeType?: string;
  thumbnail?: Buffer;
  thumbnailMimeType?: string;
  topics?: string[];
  duration?: number;
  isLive?: boolean;
  liveStreamStatus?: "scheduled" | "live" | "ended" | "archived";
  streamKey?: string;
  rtmpUrl?: string;
  playbackUrl?: string;
  isDownloadable?: boolean;
  viewThreshold?: number;
}

interface MediaInteractionInput {
  userIdentifier: string;
  mediaIdentifier: string;
  interactionType: "view" | "listen" | "read" | "download";
  duration?: number;
}

interface MediaUserActionInput {
  userIdentifier: string;
  mediaIdentifier: string;
  actionType: "favorite" | "share";
  metadata?: Record<string, any>;
}

interface ViewTrackingInput {
  userIdentifier: string;
  mediaIdentifier: string;
  duration: number;
  isComplete?: boolean;
}

interface DownloadInput {
  userIdentifier: string;
  mediaIdentifier: string;
  fileSize: number;
}

interface ShareInput {
  userIdentifier: string;
  mediaIdentifier: string;
  platform?: string;
}

interface PopulatedMedia {
  _id: Types.ObjectId;
  title: string;
  contentType: "music" | "videos" | "books" | "live";
  category?: string;
  createdAt: Date;
  thumbnailUrl?: string;
  fileUrl?: string;
  topics?: string[];
  uploadedBy: {
    _id: Types.ObjectId;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  duration?: number;
}

interface LeanUserViewedMedia {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  viewedMedia: { media: PopulatedMedia; viewedAt: Date }[];
  __v: number;
}

type DurationRangeKey = "short" | "medium" | "long";

export class MediaService {
  async uploadMedia(data: MediaInput): Promise<IMedia> {
    const validMimeTypes: { [key in MediaInput["contentType"]]: string[] } = {
      videos: [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/avi",
        "video/mov",
      ],
      music: [
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/ogg",
        "audio/aac",
        "audio/flac",
      ],
      books: ["application/pdf", "application/epub+zip"],
      live: [],
    };
    const validThumbnailMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!["music", "videos", "books", "live"].includes(data.contentType)) {
      throw new Error(
        `Invalid content type: ${data.contentType}. Must be 'music', 'videos', 'books', or 'live'`
      );
    }

    if (data.contentType !== "live") {
      if (!data.file || !data.fileMimeType) {
        throw new Error(
          `File and file MIME type are required for ${data.contentType} content type`
        );
      }

      if (!validMimeTypes[data.contentType].includes(data.fileMimeType)) {
        throw new Error(
          `Invalid file MIME type for ${data.contentType}: ${data.fileMimeType}`
        );
      }

      if (!data.thumbnail || !data.thumbnailMimeType) {
        throw new Error(
          `Thumbnail and thumbnail MIME type are required for ${data.contentType} content type`
        );
      }

      if (!validThumbnailMimeTypes.includes(data.thumbnailMimeType)) {
        throw new Error(
          `Invalid thumbnail MIME type: ${data.thumbnailMimeType}. Must be JPEG, PNG, or WebP`
        );
      }

      if (data.thumbnail.length > 5 * 1024 * 1024) {
        throw new Error("Thumbnail size must be less than 5MB");
      }
    }

    let fileUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let fileObjectKey: string | undefined;
    let thumbnailObjectKey: string | undefined;

    try {
      if (data.contentType !== "live" && data.file && data.fileMimeType) {
        const uploadResult = await fileUploadService.uploadMedia(
          data.file,
          `media-${data.contentType}`,
          data.fileMimeType
        );
        fileUrl = uploadResult.secure_url;
        fileObjectKey = uploadResult.objectKey;
      }

      if (
        data.contentType !== "live" &&
        data.thumbnail &&
        data.thumbnailMimeType
      ) {
        const thumbnailResult = await fileUploadService.uploadMedia(
          data.thumbnail,
          "media-thumbnails",
          data.thumbnailMimeType
        );
        thumbnailUrl = thumbnailResult.secure_url;
        thumbnailObjectKey = thumbnailResult.objectKey;
      }

      const uploader = await User.findById(data.uploadedBy);
      if (!uploader) {
        throw new Error("Uploader not found");
      }

      const isArtist = uploader.role === "artist" && uploader.isVerifiedArtist;
      const isDownloadable = data.isDownloadable && isArtist;

      const shareUrl = `${process.env.FRONTEND_URL || "https://example.com"}/media/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let downloadUrl: string | undefined;
      if (isDownloadable && fileUrl) {
        downloadUrl = `${process.env.API_URL || "https://api.example.com"}/media/download/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const mediaData = {
        title: data.title,
        description: data.description,
        contentType: data.contentType,
        category: data.category,
        fileUrl,
        fileMimeType: data.fileMimeType,
        fileObjectKey,
        thumbnailUrl,
        thumbnailObjectKey,
        topics: data.topics,
        uploadedBy: new Types.ObjectId(data.uploadedBy),
        duration: data.duration,
        isLive: data.isLive || false,
        liveStreamStatus: data.liveStreamStatus,
        streamKey: data.streamKey,
        rtmpUrl: data.rtmpUrl,
        playbackUrl: data.playbackUrl,
        isDownloadable,
        downloadUrl,
        shareUrl,
        viewThreshold: data.viewThreshold || 30,
      };

      const media = await Media.create(mediaData);
      return media;
    } catch (error: any) {
      if (fileObjectKey) {
        try {
          await fileUploadService.deleteMedia(fileObjectKey);
        } catch (deleteError) {
          console.error("Failed to delete uploaded file from R2:", deleteError);
        }
      }
      if (thumbnailObjectKey) {
        try {
          await fileUploadService.deleteMedia(thumbnailObjectKey);
        } catch (deleteError) {
          console.error(
            "Failed to delete uploaded thumbnail from R2:",
            deleteError
          );
        }
      }
      throw error;
    }
  }

  async getAllMedia(filters: any = {}) {
    const query: any = {};

    if (filters.search) {
      query.title = { $regex: filters.search, $options: "i" };
    }

    if (filters.contentType) {
      query.contentType = filters.contentType;
    }

    if (filters.category) {
      query.category = { $regex: filters.category, $options: "i" };
    }

    if (filters.topics) {
      const topicsArray = Array.isArray(filters.topics)
        ? filters.topics
        : filters.topics.split(",");
      query.topics = {
        $in: topicsArray.map((topic: string) => new RegExp(topic, "i")),
      };
    }

    if (filters.creator) {
      const user = await User.findOne({ username: filters.creator });
      if (user) {
        query.uploadedBy = user._id;
      } else {
        query.uploadedBy = null;
      }
    }

    const durationRanges: Record<
      DurationRangeKey,
      { $lte?: number; $gte?: number; $gt?: number }
    > = {
      short: { $lte: 5 * 60 },
      medium: { $gte: 5 * 60, $lte: 15 * 60 },
      long: { $gt: 15 * 60 },
    };

    if (filters.duration) {
      const durationKey = filters.duration as DurationRangeKey;
      if (durationRanges[durationKey]) {
        query.duration = durationRanges[durationKey];
      }
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    let sort = filters.sort || "-createdAt";
    if (filters.sort === "trending") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query.createdAt = { $gte: sevenDaysAgo };
      sort = "-viewCount -listenCount -readCount";
    }

    const page = parseInt(filters.page as string) || 1;
    const limit = parseInt(filters.limit as string) || 10;
    const skip = (page - 1) * limit;

    const mediaList = await Media.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("uploadedBy", "firstName lastName avatar")
      .lean();

    const total = await Media.countDocuments(query);

    return {
      media: mediaList,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getAllContentForAllTab() {
    try {
      // Aggregate media with author information and engagement metrics
      const mediaList = await Media.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "uploadedBy",
            foreignField: "_id",
            as: "author",
          },
        },
        {
          $unwind: "$author",
        },
        {
          $lookup: {
            from: "mediauseractions",
            localField: "_id",
            foreignField: "media",
            as: "userActions",
          },
        },
        {
          $lookup: {
            from: "mediainteractions",
            localField: "_id",
            foreignField: "media",
            as: "interactions",
          },
        },
        {
          $addFields: {
            // Calculate engagement metrics
            totalLikes: {
              $size: {
                $filter: {
                  input: "$userActions",
                  as: "action",
                  cond: { $eq: ["$$action.actionType", "like"] },
                },
              },
            },
            totalShares: {
              $size: {
                $filter: {
                  input: "$userActions",
                  as: "action",
                  cond: { $eq: ["$$action.actionType", "share"] },
                },
              },
            },
            totalViews: {
              $size: {
                $filter: {
                  input: "$interactions",
                  as: "interaction",
                  cond: { $eq: ["$$interaction.interactionType", "view"] },
                },
              },
            },
            // Author information
            authorInfo: {
              _id: "$author._id",
              firstName: "$author.firstName",
              lastName: "$author.lastName",
              fullName: {
                $concat: [
                  { $ifNull: ["$author.firstName", ""] },
                  " ",
                  { $ifNull: ["$author.lastName", ""] },
                ],
              },
              avatar: "$author.avatar",
              section: "$author.section",
            },
            // Format creation date
            formattedCreatedAt: {
              $dateToString: {
                format: "%Y-%m-%dT%H:%M:%S.%LZ",
                date: "$createdAt",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            description: 1,
            contentType: 1,
            category: 1,
            fileUrl: 1,
            thumbnailUrl: 1,
            topics: 1,
            duration: 1,
            authorInfo: 1,
            totalLikes: 1,
            totalShares: 1,
            totalViews: 1,
            likeCount: 1,
            shareCount: 1,
            viewCount: 1,
            commentCount: 1,
            createdAt: 1,
            formattedCreatedAt: 1,
            updatedAt: 1,
            // Ensure thumbnail is always included
            thumbnail: "$thumbnailUrl",
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ]);

      return {
        media: mediaList,
        total: mediaList.length,
      };
    } catch (error) {
      console.error("Error fetching all content:", error);
      throw new Error("Failed to retrieve all content");
    }
  }

  async getMediaByIdentifier(mediaIdentifier: string) {
    if (!Types.ObjectId.isValid(mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(mediaIdentifier)
      .select(
        "title contentType category fileUrl thumbnailUrl topics uploadedBy duration createdAt updatedAt isDownloadable downloadUrl shareUrl viewThreshold"
      )
      .populate("uploadedBy", "firstName lastName avatar");
    if (!media) {
      throw new Error("Media not found");
    }

    return media;
  }

  async deleteMedia(
    mediaIdentifier: string,
    userIdentifier: string,
    userRole: string
  ) {
    if (!Types.ObjectId.isValid(mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    if (
      media.uploadedBy.toString() !== userIdentifier &&
      userRole !== "admin"
    ) {
      throw new Error("Unauthorized to delete this media");
    }

    if (media.fileObjectKey) {
      try {
        await fileUploadService.deleteMedia(media.fileObjectKey);
      } catch (error) {
        console.error("Error deleting media file from R2:", error);
      }
    }

    if (media.thumbnailObjectKey) {
      try {
        await fileUploadService.deleteMedia(media.thumbnailObjectKey);
      } catch (error) {
        console.error("Error deleting thumbnail file from R2:", error);
      }
    }

    await Media.findByIdAndDelete(mediaIdentifier);
    return true;
  }

  async recordInteraction(data: MediaInteractionInput) {
    if (
      !Types.ObjectId.isValid(data.userIdentifier) ||
      !Types.ObjectId.isValid(data.mediaIdentifier)
    ) {
      throw new Error("Invalid user or media identifier");
    }

    const media = await Media.findById(data.mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    if (
      (media.contentType === "videos" && data.interactionType !== "view") ||
      (media.contentType === "music" && data.interactionType !== "listen") ||
      (media.contentType === "books" &&
        !["read", "download"].includes(data.interactionType))
    ) {
      throw new Error(
        `Invalid interaction type ${data.interactionType} for ${media.contentType} media`
      );
    }

    const session: ClientSession = await Media.startSession();
    try {
      const interaction = await session.withTransaction(async () => {
        const existingInteraction = await MediaInteraction.findOne({
          user: new Types.ObjectId(data.userIdentifier),
          media: new Types.ObjectId(data.mediaIdentifier),
          interactionType: data.interactionType,
        }).session(session);

        if (existingInteraction) {
          throw new Error(
            `User has already ${data.interactionType} this media`
          );
        }

        const interaction = await MediaInteraction.create(
          [
            {
              user: new Types.ObjectId(data.userIdentifier),
              media: new Types.ObjectId(data.mediaIdentifier),
              interactionType: data.interactionType,
              lastInteraction: new Date(),
              count: 1,
              interactions: data.duration
                ? [
                    {
                      timestamp: new Date(),
                      duration: data.duration,
                      isComplete: false,
                    },
                  ]
                : [],
            },
          ],
          { session }
        );

        const updateField: { [key: string]: number } = {};
        if (data.interactionType === "view") updateField.viewCount = 1;
        if (data.interactionType === "listen") updateField.listenCount = 1;
        if (data.interactionType === "read") updateField.readCount = 1;
        if (data.interactionType === "download") updateField.downloadCount = 1;

        await Media.findByIdAndUpdate(
          data.mediaIdentifier,
          { $inc: updateField },
          { session }
        );

        return interaction[0];
      });

      return interaction;
    } finally {
      session.endSession();
    }
  }

  async getInteractionCounts(mediaIdentifier: string) {
    if (!Types.ObjectId.isValid(mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(mediaIdentifier).select(
      "contentType viewCount listenCount readCount downloadCount favoriteCount shareCount"
    );
    if (!media) {
      throw new Error("Media not found");
    }

    const result: {
      viewCount?: number;
      listenCount?: number;
      readCount?: number;
      downloadCount?: number;
      favoriteCount?: number;
      shareCount?: number;
    } = {};

    if (media.contentType === "videos") result.viewCount = media.viewCount;
    if (media.contentType === "music") result.listenCount = media.listenCount;
    if (media.contentType === "books") {
      result.readCount = media.readCount;
      result.downloadCount = media.downloadCount;
    }
    result.favoriteCount = media.favoriteCount;
    result.shareCount = media.shareCount;

    return result;
  }

  async recordUserAction(data: MediaUserActionInput) {
    if (!data.userIdentifier || !data.mediaIdentifier || !data.actionType) {
      throw new Error(
        "User identifier, media identifier, and action type are required"
      );
    }

    if (!["favorite", "share"].includes(data.actionType)) {
      throw new Error("Invalid action type. Must be 'favorite' or 'share'");
    }

    const media = await Media.findById(data.mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    const user = await User.findById(data.userIdentifier);
    if (!user) {
      throw new Error("User not found");
    }

    if (media.uploadedBy.toString() === data.userIdentifier) {
      throw new Error("You cannot favorite or share your own content");
    }

    const session: ClientSession = await Media.startSession();
    try {
      const action = await session.withTransaction(async () => {
        const existingAction = await MediaUserAction.findOne({
          user: new Types.ObjectId(data.userIdentifier),
          media: new Types.ObjectId(data.mediaIdentifier),
          actionType: data.actionType,
        }).session(session);

        let resultAction;
        const updateField: { [key: string]: number } = {};

        if (existingAction) {
          await MediaUserAction.findByIdAndDelete(existingAction._id).session(
            session
          );
          if (data.actionType === "favorite") updateField.favoriteCount = -1;
          if (data.actionType === "share") updateField.shareCount = -1;

          resultAction = {
            ...existingAction.toObject(),
            _id: existingAction._id,
            removed: true,
          };
        } else {
          const newAction = await MediaUserAction.create(
            [
              {
                user: new Types.ObjectId(data.userIdentifier),
                media: new Types.ObjectId(data.mediaIdentifier),
                actionType: data.actionType,
                createdAt: new Date(),
              },
            ],
            { session }
          );

          if (data.actionType === "favorite") updateField.favoriteCount = 1;
          if (data.actionType === "share") updateField.shareCount = 1;

          resultAction = newAction[0];
        }

        await Media.findByIdAndUpdate(
          data.mediaIdentifier,
          { $inc: updateField },
          { session }
        );

        if (data.actionType === "favorite" && !resultAction.removed) {
          try {
            const artist = await User.findById(media.uploadedBy);
            if (
              artist &&
              artist.email &&
              artist.emailNotifications?.mediaLikes
            ) {
              await EmailService.sendMediaLikedEmail(
                artist.email,
                media.title,
                artist.firstName || artist.artistProfile?.artistName || "Artist"
              );
            }
          } catch (emailError) {
            console.error(
              "Failed to send like notification email:",
              emailError
            );
          }
        }

        return resultAction;
      });

      return action;
    } finally {
      session.endSession();
    }
  }

  async getUserActionStatus(userIdentifier: string, mediaIdentifier: string) {
    if (
      !Types.ObjectId.isValid(userIdentifier) ||
      !Types.ObjectId.isValid(mediaIdentifier)
    ) {
      throw new Error("Invalid user or media identifier");
    }

    const actions = await MediaUserAction.find({
      user: new Types.ObjectId(userIdentifier),
      media: new Types.ObjectId(mediaIdentifier),
    }).select("actionType");

    const status = { isFavorited: false, isShared: false };
    actions.forEach(action => {
      if (action.actionType === "favorite") status.isFavorited = true;
      if (action.actionType === "share") status.isShared = true;
    });

    return status;
  }

  async addToViewedMedia(userIdentifier: string, mediaIdentifier: string) {
    if (
      !Types.ObjectId.isValid(userIdentifier) ||
      !Types.ObjectId.isValid(mediaIdentifier)
    ) {
      throw new Error("Invalid user or media identifier");
    }

    const media = await Media.findById(mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    const session: ClientSession = await UserViewedMedia.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const update = await UserViewedMedia.findOneAndUpdate(
          { user: new Types.ObjectId(userIdentifier) },
          {
            $push: {
              viewedMedia: {
                $each: [
                  {
                    media: new Types.ObjectId(mediaIdentifier),
                    viewedAt: new Date(),
                  },
                ],
                $slice: -50,
              },
            },
          },
          { upsert: true, new: true, session }
        );

        return update;
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  async getViewedMedia(
    userIdentifier: string
  ): Promise<{ media: Partial<PopulatedMedia>; viewedAt: Date }[]> {
    if (!Types.ObjectId.isValid(userIdentifier)) {
      throw new Error("Invalid user identifier");
    }

    const viewedMedia = await UserViewedMedia.findOne({
      user: new Types.ObjectId(userIdentifier),
    })
      .populate<{ viewedMedia: { media: PopulatedMedia; viewedAt: Date }[] }>({
        path: "viewedMedia.media",
        select:
          "title contentType category createdAt thumbnailUrl fileUrl topics duration uploadedBy",
        populate: { path: "uploadedBy", select: "firstName lastName avatar" },
      })
      .lean<LeanUserViewedMedia>();

    return viewedMedia ? viewedMedia.viewedMedia : [];
  }

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
      totalShares: result[0]?.totalShares || 0,
    };
  }

  async getRecentMedia(limit: number) {
    return await Media.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "title contentType category createdAt thumbnailUrl fileUrl duration"
      )
      .populate("uploadedBy", "firstName lastName avatar")
      .lean();
  }

  async getMediaCountSinceDate(since: Date) {
    return await Media.countDocuments({ createdAt: { $gte: since } });
  }

  async getInteractionCountSinceDate(since: Date) {
    return await MediaInteraction.countDocuments({
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

    const result = await MediaInteraction.aggregate([
      { $match: { user: new Types.ObjectId(userIdentifier) } },
      { $group: { _id: "$interactionType", count: { $sum: "$count" } } },
      { $project: { interactionType: "$_id", count: 1, _id: 0 } },
    ]);

    const counts: {
      totalViews: number;
      totalListens: number;
      totalReads: number;
      totalDownloads: number;
    } = {
      totalViews: 0,
      totalListens: 0,
      totalReads: 0,
      totalDownloads: 0,
    };

    result.forEach(item => {
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

    return await MediaInteraction.countDocuments({
      user: new Types.ObjectId(userIdentifier),
      createdAt: { $gte: since },
    });
  }

  async trackViewWithDuration(data: ViewTrackingInput) {
    const {
      userIdentifier,
      mediaIdentifier,
      duration,
      isComplete = false,
    } = data;

    if (!userIdentifier || !mediaIdentifier) {
      throw new Error("User identifier and media identifier are required");
    }

    if (duration < 0) {
      throw new Error("Duration must be a positive number");
    }

    const media = await Media.findById(mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    const user = await User.findById(userIdentifier);
    if (!user) {
      throw new Error("User not found");
    }

    let shouldCountAsView = false;
    const session: ClientSession = await Media.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const viewThreshold = media.viewThreshold || 30;
        shouldCountAsView = duration >= viewThreshold;

        if (shouldCountAsView) {
          await Media.findByIdAndUpdate(
            mediaIdentifier,
            { $inc: { viewCount: 1 } },
            { session }
          );

          await MediaInteraction.findOneAndUpdate(
            {
              user: new Types.ObjectId(userIdentifier),
              media: new Types.ObjectId(mediaIdentifier),
              interactionType: "view",
            },
            {
              $inc: { count: 1 },
              $set: { lastInteraction: new Date() },
              $push: {
                interactions: {
                  timestamp: new Date(),
                  duration,
                  isComplete,
                },
              },
            },
            { upsert: true, session }
          );

          await this.addToViewedMedia(userIdentifier, mediaIdentifier);

          if (media.uploadedBy.toString() !== userIdentifier) {
            try {
              const artist = await User.findById(media.uploadedBy);
              if (
                artist &&
                artist.email &&
                artist.emailNotifications?.mediaLikes
              ) {
                await EmailService.sendMediaLikedEmail(
                  artist.email,
                  media.title,
                  artist.firstName ||
                    artist.artistProfile?.artistName ||
                    "Artist"
                );
              }
            } catch (emailError) {
              console.error(
                "Failed to send view notification email:",
                emailError
              );
            }
          }
        }

        return { success: true, countedAsView: shouldCountAsView };
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  async getMediaWithEngagement(mediaId: string, userId: string) {
    try {
      const media = await Media.findById(mediaId).populate(
        "uploadedBy",
        "firstName lastName avatar"
      );
      if (!media) {
        throw new Error("Media not found");
      }

      // Get user's interaction status
      const userAction = await MediaUserAction.findOne({
        user: userId,
        media: mediaId,
      });

      return {
        ...media.toObject(),
        userAction: userAction
          ? {
              isFavorited: userAction.actionType === "favorite",
              isShared: userAction.actionType === "share",
            }
          : {
              isFavorited: false,
              isShared: false,
            },
      };
    } catch (error) {
      throw error;
    }
  }

  async downloadMedia(data: {
    mediaId: string;
    userId: string;
    fileSize: number;
  }) {
    try {
      const { mediaId, userId, fileSize } = data;

      const media = await Media.findById(mediaId);
      if (!media) {
        throw new Error("Media not found");
      }

      // Check if media is available for download
      if (!media.fileUrl) {
        throw new Error("Media file not available for download");
      }

      // Record download interaction
      await this.recordInteraction({
        userIdentifier: userId,
        mediaIdentifier: mediaId,
        interactionType: "download",
        duration: 0,
      });

      // Generate signed download URL from Cloudflare R2
      const { default: fileUploadService } = await import(
        "./fileUpload.service"
      );

      // Extract object key from fileUrl
      const objectKey = this.extractObjectKeyFromUrl(media.fileUrl);
      if (!objectKey) {
        throw new Error("Invalid media file URL");
      }

      // Use direct public URL instead of signed URL
      const downloadUrl = media.fileUrl;

      // Add to user's offline downloads
      await this.addToOfflineDownloads(userId, mediaId, {
        fileName: media.title || "Untitled",
        fileSize: media.fileSize || fileSize,
        contentType: media.contentType,
        downloadUrl,
      });

      return {
        success: true,
        downloadUrl,
        fileName: media.title || "Untitled",
        fileSize: media.fileSize || fileSize,
        contentType: media.contentType,
        message: "Download initiated successfully",
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extract object key from Cloudflare R2 URL
   */
  private extractObjectKeyFromUrl(url: string): string | null {
    try {
      // Handle different URL formats
      if (url.includes("/")) {
        const parts = url.split("/");
        return parts[parts.length - 1];
      }
      return url;
    } catch (error) {
      console.error("Error extracting object key from URL:", error);
      return null;
    }
  }

  /**
   * Add media to user's offline downloads
   */
  private async addToOfflineDownloads(
    userId: string,
    mediaId: string,
    downloadInfo: {
      fileName: string;
      fileSize: number;
      contentType: string;
      downloadUrl: string;
    }
  ) {
    try {
      const { User } = await import("../models/user.model");

      const offlineDownload = {
        mediaId: new Types.ObjectId(mediaId),
        downloadDate: new Date(),
        fileName: downloadInfo.fileName,
        fileSize: downloadInfo.fileSize,
        contentType: downloadInfo.contentType,
        downloadUrl: downloadInfo.downloadUrl,
        isDownloaded: false, // Will be updated by frontend
      };

      await User.findByIdAndUpdate(
        userId,
        {
          $push: { offlineDownloads: offlineDownload },
          $inc: { totalDownloads: 1 },
        },
        { upsert: true }
      );

      console.log("Added to offline downloads:", {
        userId,
        mediaId,
        fileName: downloadInfo.fileName,
      });
    } catch (error) {
      console.error("Error adding to offline downloads:", error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get user's offline downloads
   */
  async getUserOfflineDownloads(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const { User } = await import("../models/user.model");

      const user = await User.findById(userId)
        .populate(
          "offlineDownloads.mediaId",
          "title description thumbnailUrl contentType duration"
        )
        .lean();

      if (!user) {
        throw new Error("User not found");
      }

      const downloads = (user as any).offlineDownloads || [];
      const skip = (page - 1) * limit;

      const paginatedDownloads = downloads
        .sort(
          (a: any, b: any) =>
            new Date(b.downloadDate).getTime() -
            new Date(a.downloadDate).getTime()
        )
        .slice(skip, skip + limit);

      return {
        downloads: paginatedDownloads,
        pagination: {
          page,
          limit,
          total: downloads.length,
          pages: Math.ceil(downloads.length / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove media from user's offline downloads
   */
  async removeFromOfflineDownloads(userId: string, mediaId: string) {
    try {
      const { User } = await import("../models/user.model");

      await User.findByIdAndUpdate(userId, {
        $pull: { offlineDownloads: { mediaId: new Types.ObjectId(mediaId) } },
        $inc: { totalDownloads: -1 },
      });

      console.log("Removed from offline downloads:", { userId, mediaId });
    } catch (error) {
      console.error("Error removing from offline downloads:", error);
      throw error;
    }
  }

  async shareMedia(data: {
    mediaId: string;
    userId: string;
    platform?: string;
  }) {
    try {
      const { mediaId, userId, platform } = data;

      const media = await Media.findById(mediaId);
      if (!media) {
        throw new Error("Media not found");
      }

      // Record share interaction
      await this.recordUserAction({
        userIdentifier: userId,
        mediaIdentifier: mediaId,
        actionType: "share",
        metadata: { platform },
      });

      // Generate share URL
      const shareUrl = `${process.env.FRONTEND_URL}/media/${mediaId}`;

      return {
        success: true,
        shareUrl,
        message: "Media shared successfully",
      };
    } catch (error) {
      throw error;
    }
  }
}

export const mediaService = new MediaService();
