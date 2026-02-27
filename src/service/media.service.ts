import { Media, IMedia } from "../models/media.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { Bookmark } from "../models/bookmark.model";
import { User } from "../models/user.model";
import { UserViewedMedia } from "../models/userViewedMedia.model";
import { MediaUserAction } from "../models/mediaUserAction.model";
import { Types, ClientSession } from "mongoose";
import fileUploadService from "./fileUpload.service";
import { EmailService } from "../config/email.config";
import enhancedMediaService from "./enhancedMedia.service";
import { recommendationEngineService } from "./recommendationEngine.service";
import logger from "../utils/logger";

interface MediaInput {
  title: string;
  description?: string;
  contentType: "music" | "videos" | "books" | "live" | "sermon";
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
      sermon: [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/avi",
        "video/mov",
      ], // Sermons use same video formats as videos
      books: ["application/pdf", "application/epub+zip"],
      live: [],
    };
    const validThumbnailMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!["music", "videos", "books", "live", "sermon"].includes(data.contentType)) {
      throw new Error(
        `Invalid content type: ${data.contentType}. Must be 'music', 'videos', 'books', 'live', or 'sermon'`
      );
    }

    if (data.contentType !== "live") {
      if (!data.file || !data.fileMimeType) {
        throw new Error(
          `File and file MIME type are required for ${data.contentType} content type`
        );
      }

      // Map sermon to videos for MIME type validation (sermons are videos)
      const contentTypeForValidation = data.contentType === "sermon" ? "videos" : data.contentType;

      if (!validMimeTypes[contentTypeForValidation as keyof typeof validMimeTypes].includes(data.fileMimeType)) {
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

    // Generate contentId upfront for immutable URL structure
    // This ensures URLs use the format: media/{type}/{contentId}/filename
    const contentId = new Types.ObjectId().toString();

    try {
      if (data.contentType !== "live" && data.file && data.fileMimeType) {
        // Map contentType to folder structure
        const contentTypeFolder = data.contentType === "sermon" ? "videos" : data.contentType;
        const filename = contentTypeFolder === "videos" ? "video" : contentTypeFolder === "music" ? "audio" : "document";

        const uploadResult = await fileUploadService.uploadMedia(
          data.file,
          `media-${contentTypeFolder}`,
          data.fileMimeType,
          contentId, // Use contentId for immutable URL structure
          filename
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
          data.thumbnailMimeType,
          contentId, // Use same contentId for thumbnail
          "thumb" // Thumbnail filename
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
        _id: new Types.ObjectId(contentId), // Use the pre-generated contentId as _id
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
        shareUrl: `${process.env.FRONTEND_URL || "https://example.com"}/media/${contentId}`, // Use contentId in share URL
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

  async getAllMedia(filters: any = {}, options: { enforceModeration?: boolean; actingUserId?: string } = { enforceModeration: true }) {
    const query: any = {};

    // Apply strict moderation if enforced (defaulted to true for safety)
    const shouldEnforce = options.enforceModeration !== false;

    if (shouldEnforce) {
      if (options.actingUserId) {
        // Show only approved OR content uploaded by the current user
        query.$or = [
          { moderationStatus: "approved", isHidden: { $ne: true } },
          { uploadedBy: new Types.ObjectId(options.actingUserId) }
        ];
      } else {
        // Show only approved content
        query.moderationStatus = "approved";
        query.isHidden = { $ne: true };
      }
    }

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
      .select("title description contentType category fileUrl playbackUrl hlsUrl thumbnailUrl coverImageUrl uploadedBy createdAt viewCount likeCount shareCount duration fileSize width height bitrate topics")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("uploadedBy", "firstName lastName avatar")
      .lean();

    const total = await Media.countDocuments(query);

    // Transform to include imageUrl alias and ensure all required fields
    const transformedMedia = mediaList.map((media: any) => ({
      ...media,
      id: media._id, // Alias for _id
      imageUrl: media.coverImageUrl, // Alias coverImageUrl to imageUrl
    }));

    return {
      media: transformedMedia,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getAllContentForAllTab(options?: {
    page?: number;
    limit?: number;
    contentType?: string;
    category?: string;
    minViews?: number;
    minLikes?: number;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sort?: string;
    order?: "asc" | "desc";
  }) {
    try {
      // Always enforce pagination for mobile-friendly payloads (prevents excessive data usage)
      // Default: page 1, limit 50 (mobile-optimized to save data/airtime)
      const page = options?.page && options.page > 0 ? options.page : 1;
      const rawLimit = options?.limit && options.limit > 0 ? options.limit : 50;

      // Clamp for mobile-friendly payloads (min 10, max 100)
      const limit = Math.min(Math.max(rawLimit, 10), 100);
      const skip = (page - 1) * limit;

      // Build match query for filtering
      // Global feed: all content on the platform (everyone's uploads). No filter by uploader.
      // STRICT FILTERING: Only show approved content that hasn't been hidden.
      const matchQuery: Record<string, any> = {
        isHidden: { $ne: true },
        moderationStatus: "approved",
      };

      // Content type filter
      if (options?.contentType && options.contentType !== "ALL") {
        matchQuery.contentType = options.contentType;
      }

      // Category filter
      if (options?.category) {
        matchQuery.category = { $regex: options.category, $options: "i" };
      }

      // View count filter
      if (options?.minViews !== undefined) {
        matchQuery.viewCount = { $gte: options.minViews };
      }

      // Like count filter
      if (options?.minLikes !== undefined) {
        matchQuery.likeCount = { $gte: options.minLikes };
      }

      // Date range filter
      if (options?.dateFrom || options?.dateTo) {
        matchQuery.createdAt = {};
        if (options.dateFrom) {
          matchQuery.createdAt.$gte = new Date(options.dateFrom);
        }
        if (options.dateTo) {
          matchQuery.createdAt.$lte = new Date(options.dateTo);
        }
      }

      // Text search filter
      const searchText = options?.search?.trim();

      // Add text search to match query if provided
      if (searchText) {
        if (matchQuery.$or) {
          // If there's already an $or, combine with $and
          matchQuery.$and = [
            { ...matchQuery },
            {
              $or: [
                { title: { $regex: searchText, $options: "i" } },
                { description: { $regex: searchText, $options: "i" } },
              ],
            },
          ];
          // Remove original fields that are now in $and
          const { $or, ...rest } = matchQuery;
          matchQuery.$and[0] = rest;
        } else {
          matchQuery.$or = [
            { title: { $regex: searchText, $options: "i" } },
            { description: { $regex: searchText, $options: "i" } },
          ];
        }
      }

      // Build sort object
      const sortField = options?.sort || "createdAt";
      const sortOrder = options?.order === "asc" ? 1 : -1;
      const sortObj: Record<string, 1 | -1> = {};

      // Map sort fields to aggregation-compatible fields
      if (sortField === "views" || sortField === "viewCount") {
        sortObj.totalViews = sortOrder;
      } else if (sortField === "likes" || sortField === "likeCount") {
        sortObj.totalLikes = sortOrder;
      } else if (sortField === "createdAt") {
        sortObj.createdAt = sortOrder;
      } else {
        sortObj.createdAt = sortOrder; // Default
      }

      // Reuse the shared aggregation pipeline with author + engagement info
      const pipeline = this.buildAggregationPipeline(
        matchQuery,
        {
          sort: sortObj,
        }
      );

      if (skip > 0) {
        pipeline.push({ $skip: skip });
      }
      pipeline.push({ $limit: limit });

      // Count query uses the same matchQuery (search already included)
      const [mediaList, total] = await Promise.all([
        Media.aggregate(pipeline),
        Media.countDocuments(matchQuery),
      ]);

      return {
        media: mediaList,
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1,
        },
      };
    } catch (error: any) {
      logger.error("Error fetching all content", {
        error: error?.message,
        options,
      });
      throw new Error("Failed to retrieve all content");
    }
  }

  /**
   * Build a reusable aggregation pipeline that mirrors getAllContentForAllTab's projection
   * OPTIMIZED: Uses pre-calculated fields (likeCount, viewCount, shareCount) instead of expensive $lookup operations
   * This provides 5-10x performance improvement by avoiding N+1 queries
   */
  private buildAggregationPipeline(
    matchStage: Record<string, any>,
    options?: {
      sort?: Record<string, 1 | -1>;
      sampleSize?: number;
      limit?: number;
    }
  ) {
    const pipeline: any[] = [];
    if (matchStage && Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Only lookup user info (needed for author details)
    // REMOVED: Expensive lookups on mediauseractions and mediainteractions
    // Instead, use pre-calculated fields: likeCount, viewCount, shareCount
    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "uploadedBy",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: "$author" },
      {
        $addFields: {
          // Use pre-calculated fields directly (already stored in Media document)
          // This is MUCH faster than doing $lookup and $filter on related collections
          totalLikes: { $ifNull: ["$likeCount", 0] },
          totalShares: { $ifNull: ["$shareCount", 0] },
          totalViews: { $ifNull: ["$viewCount", 0] },
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
          formattedCreatedAt: {
            $dateToString: {
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
              date: "$createdAt",
            },
          },
          thumbnail: "$thumbnailUrl",
          // ⭐ Critical: Compute video URL with fallbacks (fileUrl > playbackUrl > hlsUrl)
          // This ensures videos always have a playable URL, especially for live streams
          videoUrl: {
            $cond: {
              if: { $ne: ["$fileUrl", null] },
              then: "$fileUrl",
              else: {
                $cond: {
                  if: { $ne: ["$playbackUrl", null] },
                  then: "$playbackUrl",
                  else: "$hlsUrl",
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          id: "$_id", // Alias for _id (frontend may expect this)
          title: 1,
          description: 1,
          contentType: 1,
          category: 1,
          // ⭐ MEDIA URLS (Priority: fileUrl > playbackUrl > hlsUrl)
          fileUrl: 1, // PRIMARY - Always required for playback
          playbackUrl: 1, // OPTIONAL - Lower quality fallback
          hlsUrl: 1, // OPTIONAL - HLS stream URL (for long videos)
          // ⭐ THUMBNAILS (Never used for playback - separate from media URLs)
          thumbnailUrl: 1, // REQUIRED - Thumbnail/preview image
          imageUrl: "$coverImageUrl", // OPTIONAL - High-res cover art (aliased from coverImageUrl)
          // ⭐ METADATA
          topics: 1,
          duration: 1,
          fileSize: 1,
          width: 1, // Video width (videos only)
          height: 1, // Video height (videos only)
          bitrate: 1, // Bitrate in bps
          // ⭐ AUTHOR INFO
          authorInfo: 1,
          uploadedBy: 1, // Keep for backward compatibility
          // ⭐ ENGAGEMENT METRICS
          totalLikes: 1,
          totalShares: 1,
          totalViews: 1,
          likeCount: 1, // Keep for backward compatibility
          shareCount: 1, // Keep for backward compatibility
          viewCount: 1, // Keep for backward compatibility
          commentCount: 1,
          // ⭐ TIMESTAMPS
          createdAt: 1,
          formattedCreatedAt: 1,
          updatedAt: 1,
          thumbnail: 1, // Backward compatibility alias
          videoUrl: 1, // ⭐ Computed field with proper priority (fileUrl > playbackUrl > hlsUrl)
        },
      }
    );

    if (options?.sort) {
      pipeline.push({ $sort: options.sort });
    }
    if (options?.sampleSize && options.sampleSize > 0) {
      pipeline.push({ $sample: { size: options.sampleSize } });
    }
    if (options?.limit && options.limit > 0) {
      pipeline.push({ $limit: options.limit });
    }

    return pipeline;
  }

  /**
   * Generate dynamic recommendations to accompany the all-content feed.
   * Includes seeded default content, personalized picks, trending, and random explores.
   * Enhanced with collaborative filtering, topic embeddings, and A/B testing.
   */
  async getRecommendationsForAllContent(
    userId?: string,
    options?: { limitPerSection?: number; mood?: string }
  ): Promise<{
    sections: {
      key: string;
      title: string;
      media: any[];
      reason?: string;
      metadata?: {
        abTestVariant?: string;
        qualityScore?: number;
        collaborativeScore?: number;
      };
    }[];
  }> {
    const limitPerSection = options?.limitPerSection || 12;

    // Track media already seen by the user to de-duplicate recommendations
    const seenMediaIds = new Set<string>();
    let lastViewedMedia: any | null = null;
    let userProfile: any = null;

    if (userId && Types.ObjectId.isValid(userId)) {
      try {
        // Build comprehensive user profile with all signals
        userProfile =
          await recommendationEngineService.buildUserProfile(userId);

        // Get recently viewed for "because you watched" section
        const viewed = (await UserViewedMedia.findOne({
          user: new Types.ObjectId(userId),
        })
          .populate({
            path: "viewedMedia.media",
            select:
              "title topics category contentType uploadedBy createdAt thumbnailUrl fileUrl",
            populate: {
              path: "uploadedBy",
              select: "firstName lastName avatar",
            },
          })
          .lean()) as unknown as LeanUserViewedMedia | null;

        const viewedList = viewed?.viewedMedia || [];
        if (viewedList.length > 0) {
          lastViewedMedia = viewedList[viewedList.length - 1]?.media || null;
        }

        // Add all user's media to seen set
        [
          ...userProfile.viewedMedia,
          ...userProfile.favoriteMedia,
          ...userProfile.sharedMedia,
          ...userProfile.bookmarkedMedia,
        ].forEach(m => seenMediaIds.add(m.mediaId));
      } catch (err: any) {
        logger.warn("Personalization bootstrap failed", {
          error: err?.message,
          userId,
        });
      }
    }

    // Helper to exclude seen ids
    const excludeSeen = (match: Record<string, any> = {}) => {
      if (seenMediaIds.size > 0) {
        return {
          ...match,
          _id: {
            $nin: Array.from(seenMediaIds).map(id => new Types.ObjectId(id)),
          },
        };
      }
      return match;
    };

    // Get A/B test variant for section ordering
    const abTestVariant = userId
      ? recommendationEngineService.generateABTestVariant(userId)
      : "control";
    const sectionOrdering =
      recommendationEngineService.getSectionOrdering(userId);

    const sections: {
      key: string;
      title: string;
      media: any[];
      reason?: string;
      metadata?: {
        abTestVariant?: string;
        qualityScore?: number;
        collaborativeScore?: number;
      };
    }[] = [];

    // 1) Editorial picks (ensure seeded default content shows)
    try {
      const editorial = await Media.aggregate(
        this.buildAggregationPipeline(excludeSeen({ isDefaultContent: true }), {
          sampleSize: limitPerSection,
        })
      );
      if (editorial.length > 0) {
        editorial.forEach((m: any) => seenMediaIds.add(String(m._id)));
        sections.push({
          key: "editorial",
          title: "Jevah Picks",
          media: editorial,
          metadata: { abTestVariant },
        });
      }
    } catch { }

    // 2) Enhanced personalized For You with collaborative filtering
    try {
      let match: any = {};
      if (userProfile) {
        const topTopics = Object.keys(userProfile.topTopics).slice(0, 10);
        const topCategories = Object.keys(userProfile.topCategories).slice(
          0,
          5
        );
        const topTypes = Object.keys(userProfile.topContentTypes).slice(0, 3);

        const orClauses: any[] = [];
        if (topTopics.length > 0)
          orClauses.push({ topics: { $in: topTopics } });
        if (topCategories.length > 0)
          orClauses.push({ category: { $in: topCategories } });
        if (topTypes.length > 0)
          orClauses.push({ contentType: { $in: topTypes } });
        if (orClauses.length > 0) match = { $or: orClauses };
      }

      const personalized = await Media.aggregate(
        this.buildAggregationPipeline(excludeSeen(match), {
          sampleSize: limitPerSection,
        })
      );

      if (personalized.length > 0) {
        // Enhance with collaborative filtering scores
        const enhancedPersonalized = await Promise.all(
          personalized.map(async (media: any) => {
            const collaborativeSignals =
              await recommendationEngineService.getCollaborativeSignals(
                media._id,
                userId
              );
            const qualityScore =
              recommendationEngineService.calculateContentQualityScore(media);
            const collaborativeScore =
              collaborativeSignals.length > 0
                ? collaborativeSignals[0].predictedScore
                : 0;

            return {
              ...media,
              _collaborativeScore: collaborativeScore,
              _qualityScore: qualityScore,
            };
          })
        );

        // Sort by combined score
        enhancedPersonalized.sort(
          (a, b) =>
            b._collaborativeScore +
            b._qualityScore -
            (a._collaborativeScore + a._qualityScore)
        );

        enhancedPersonalized.forEach((m: any) =>
          seenMediaIds.add(String(m._id))
        );
        sections.push({
          key: "for_you",
          title: "For You",
          media: enhancedPersonalized,
          reason: "Based on your activity and similar users",
          metadata: {
            abTestVariant,
            qualityScore:
              enhancedPersonalized.reduce(
                (sum, m) => sum + m._qualityScore,
                0
              ) / enhancedPersonalized.length,
            collaborativeScore:
              enhancedPersonalized.reduce(
                (sum, m) => sum + m._collaborativeScore,
                0
              ) / enhancedPersonalized.length,
          },
        });
      }
    } catch { }

    // 3) Because you watched/listened/read (similar to last item with topic embeddings)
    try {
      if (lastViewedMedia && lastViewedMedia._id) {
        const lv = lastViewedMedia as any;
        const similarMatch: any = {
          _id: { $ne: new Types.ObjectId(String(lv._id)) },
        };
        const or: any[] = [];
        if (Array.isArray(lv.topics) && lv.topics.length > 0) {
          or.push({ topics: { $in: lv.topics } });
        }
        if (lv.category) {
          or.push({ category: lv.category });
        }
        if (lv.contentType) {
          or.push({ contentType: lv.contentType });
        }
        if (or.length > 0) similarMatch.$or = or;

        const similar = await Media.aggregate(
          this.buildAggregationPipeline(excludeSeen(similarMatch), {
            sampleSize: limitPerSection,
          })
        );

        if (similar.length > 0) {
          // Enhance with topic similarity scoring
          const enhancedSimilar = similar.map((media: any) => {
            const topicSimilarity = userProfile
              ? recommendationEngineService["calculateTopicSimilarity"](
                lv.topics || [],
                media.topics || []
              )
              : 0;

            return {
              ...media,
              _topicSimilarity: topicSimilarity,
            };
          });

          enhancedSimilar.sort(
            (a, b) => b._topicSimilarity - a._topicSimilarity
          );
          enhancedSimilar.forEach((m: any) => seenMediaIds.add(String(m._id)));

          sections.push({
            key: "because_you_watched",
            title: "Because you watched",
            media: enhancedSimilar,
            metadata: { abTestVariant },
          });
        }
      }
    } catch { }

    // 4) Trending now (recent window)
    try {
      const trending = await enhancedMediaService.getTrendingMedia(
        undefined,
        limitPerSection,
        14
      );
      if (Array.isArray(trending) && trending.length > 0) {
        const trendingProjected = await Media.aggregate(
          this.buildAggregationPipeline(
            excludeSeen({
              _id: {
                $in: trending.map(
                  (t: any) => new Types.ObjectId(String(t._id))
                ),
              },
            }),
            { limit: limitPerSection }
          )
        );
        if (trendingProjected.length > 0) {
          trendingProjected.forEach((m: any) =>
            seenMediaIds.add(String(m._id))
          );
          sections.push({
            key: "trending",
            title: "Trending",
            media: trendingProjected,
            metadata: { abTestVariant },
          });
        }
      }
    } catch { }

    // 5) Quick picks (random explore with light filtering by mood/type when provided)
    try {
      const mood = (options?.mood || "").toLowerCase();
      const moodFilters: Record<string, any> = {};
      if (["worship", "praise", "inspiration"].includes(mood)) {
        moodFilters.category = mood;
      }
      const quickPicks = await Media.aggregate(
        this.buildAggregationPipeline(excludeSeen(moodFilters), {
          sampleSize: limitPerSection,
        })
      );
      if (quickPicks.length > 0) {
        quickPicks.forEach((m: any) => seenMediaIds.add(String(m._id)));
        sections.push({
          key: "quick_picks",
          title: "Explore",
          media: quickPicks,
          metadata: { abTestVariant },
        });
      }
    } catch { }

    // Reorder sections based on A/B test variant
    const orderedSections = sectionOrdering
      .map(key => sections.find(s => s.key === key))
      .filter(Boolean) as typeof sections;

    return { sections: orderedSections };
  }

  async getMediaByIdentifier(mediaIdentifier: string, options: { actingUserId?: string; userRole?: string } = {}) {
    if (!Types.ObjectId.isValid(mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(mediaIdentifier)
      .select(
        "title description contentType category fileUrl playbackUrl hlsUrl thumbnailUrl coverImageUrl topics uploadedBy duration fileSize width height bitrate createdAt updatedAt isDownloadable downloadUrl shareUrl viewThreshold moderationStatus isHidden"
      )
      .populate("uploadedBy", "firstName lastName avatar");
    if (!media) {
      throw new Error("Media not found");
    }

    // Security check: If not approved and not admin/uploader, don't return media
    const isUploader = options.actingUserId && media.uploadedBy && (media.uploadedBy as any)._id.toString() === options.actingUserId;
    const isAdmin = options.userRole === "admin";
    const isApproved = media.moderationStatus === "approved" && !media.isHidden;

    if (!isApproved && !isUploader && !isAdmin) {
      throw new Error("Media not found or under review");
    }

    // Transform to match spec: ensure imageUrl is returned (aliased from coverImageUrl)
    const mediaObj = media.toObject();
    return {
      ...mediaObj,
      id: mediaObj._id, // Alias for _id
      imageUrl: mediaObj.coverImageUrl, // Alias coverImageUrl to imageUrl for spec compliance
    };
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
    if (!Types.ObjectId.isValid(data.mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(data.mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    // Allow "download" interaction for all content types
    // Other interaction types have specific restrictions per content type
    if (data.interactionType !== "download") {
      if (
        (media.contentType === "videos" && data.interactionType !== "view") ||
        (media.contentType === "music" && data.interactionType !== "listen") ||
        (media.contentType === "ebook" &&
          !["read", "download"].includes(data.interactionType))
      ) {
        throw new Error(
          `Invalid interaction type ${data.interactionType} for ${media.contentType} media`
        );
      }
    }

    const session: ClientSession = await Media.startSession();
    try {
      const interaction = await session.withTransaction(async () => {
        const isUserAuth = Types.ObjectId.isValid(data.userIdentifier);
        let interactionResult = null;

        if (isUserAuth) {
          const userIdObj = new Types.ObjectId(data.userIdentifier);
          const existingInteraction = await MediaInteraction.findOne({
            user: userIdObj,
            media: new Types.ObjectId(data.mediaIdentifier),
            interactionType: data.interactionType,
          }).session(session);

          if (!existingInteraction) {
            const created = await MediaInteraction.create(
              [
                {
                  user: userIdObj,
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
            interactionResult = created[0];
          } else {
            // Update existing interaction but don't error - allow count increment
            await MediaInteraction.updateOne(
              { _id: existingInteraction._id },
              {
                $inc: { count: 1 },
                $set: { lastInteraction: new Date() },
                $push: {
                  interactions: data.duration
                    ? {
                      timestamp: new Date(),
                      duration: data.duration,
                      isComplete: false,
                    }
                    : undefined,
                },
              },
              { session }
            );
            interactionResult = existingInteraction;
          }
        }

        // Atomic global count increment (always happens, even for anonymous or repeat views)
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

        return interactionResult;
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

    // Optimize: Only fetch media (user check is not critical for view tracking)
    const media = await Media.findById(mediaIdentifier).select("viewThreshold uploadedBy title").lean();
    if (!media) {
      throw new Error("Media not found");
    }

    let shouldCountAsView = false;
    const session: ClientSession = await Media.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const viewThreshold = (media as any).viewThreshold || 30;
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

          // Add to viewed media (non-blocking, can fail silently)
          this.addToViewedMedia(userIdentifier, mediaIdentifier).catch(() => { });

          // Send email notification in background (non-blocking)
          if ((media as any).uploadedBy?.toString() !== userIdentifier) {
            User.findById((media as any).uploadedBy)
              .select("email emailNotifications firstName artistProfile")
              .lean()
              .then((artist: any) => {
                if (
                  artist &&
                  artist.email &&
                  artist.emailNotifications?.mediaLikes
                ) {
                  EmailService.sendMediaLikedEmail(
                    artist.email,
                    (media as any).title,
                    artist.firstName ||
                    artist.artistProfile?.artistName ||
                    "Artist"
                  ).catch(() => { });
                }
              })
              .catch(() => { }); // Never block on email
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
    fileSize?: number;
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

      // Check if media is marked as downloadable (if such flag exists)
      if (media.isDownloadable === false) {
        throw new Error("This media is not available for download");
      }

      // Generate signed download URL from Cloudflare R2
      const { default: fileUploadService } = await import(
        "./fileUpload.service"
      );

      // Extract object key from fileUrl
      const objectKey = this.extractObjectKeyFromUrl(media.fileUrl);
      if (!objectKey) {
        // If we can't extract object key, use public URL as fallback
        console.log("[Download Service] Could not extract object key, using public URL as fallback");
        const downloadUrl = media.fileUrl;
        const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
        const contentType = this.getContentTypeFromMedia(media);

        // Prepare response data
        const responseData = {
          success: true,
          downloadUrl,
          fileName: media.title || "Untitled",
          fileSize: media.fileSize || fileSize || 0,
          contentType,
          mediaId: media._id.toString(),
          downloadId: `dl_${media._id.toString()}`,
          expiresAt: expiresAt.toISOString(),
        };

        // Try to add to offline downloads (non-critical)
        try {
          await this.addToOfflineDownloads(userId, mediaId, {
            fileName: media.title || "Untitled",
            fileSize: media.fileSize || fileSize || 0,
            contentType,
            downloadUrl,
          });
        } catch (offlineError) {
          console.warn("[Download Service] Failed to add to offline downloads (non-critical):", {
            error: offlineError instanceof Error ? offlineError.message : String(offlineError),
          });
          // Continue - download URL is still valid
        }

        // Always return the download URL, even if recording failed
        return responseData;
      }

      // Generate signed URL with 1 hour expiration
      // If signed URL generation fails, fall back to public URL
      let downloadUrl: string;
      let expiresAt: Date;

      try {
        const expiresInSeconds = 3600; // 1 hour
        downloadUrl = await fileUploadService.getPresignedGetUrl(
          objectKey,
          expiresInSeconds
        );
        expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
        console.log("[Download Service] Generated signed URL successfully");
      } catch (urlError) {
        // Fallback to public URL if signed URL generation fails
        console.warn("[Download Service] Signed URL generation failed, using public URL:", {
          error: urlError instanceof Error ? urlError.message : String(urlError),
        });
        downloadUrl = media.fileUrl;
        expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
      }

      // Determine content type
      const contentType = this.getContentTypeFromMedia(media);

      // Prepare response data
      const responseData = {
        success: true,
        downloadUrl,
        fileName: media.title || "Untitled",
        fileSize: media.fileSize || fileSize || 0,
        contentType,
        mediaId: media._id.toString(),
        downloadId: `dl_${media._id.toString()}`,
        expiresAt: expiresAt.toISOString(),
      };

      // Add to user's offline downloads (upsert - update if exists, create if not)
      // This is non-critical - if it fails, we still return the download URL
      try {
        console.log("[Download Service] Adding to offline downloads:", {
          userId,
          mediaId,
          fileName: media.title || "Untitled",
        });

        await this.addToOfflineDownloads(userId, mediaId, {
          fileName: media.title || "Untitled",
          fileSize: media.fileSize || fileSize || 0,
          contentType,
          downloadUrl,
        });
        console.log("[Download Service] Successfully added to offline downloads");
      } catch (offlineError) {
        // Log but don't fail the download - user can still download the file
        console.error("[Download Service] Failed to add to offline downloads (non-critical):", {
          error: offlineError instanceof Error ? offlineError.message : String(offlineError),
          stack: offlineError instanceof Error ? offlineError.stack : undefined,
          userId,
          mediaId,
        });
        // Continue - download URL is still valid and will be returned
      }

      // Always return the download URL, even if recording failed
      return responseData;
    } catch (error) {
      console.error("[Download Service] Error in downloadMedia:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        mediaId: data.mediaId,
        userId: data.userId,
      });
      throw error;
    }
  }

  /**
   * Get content type from media object
   */
  private getContentTypeFromMedia(media: any): string {
    if (media.fileMimeType) {
      return media.fileMimeType;
    }
    // Fallback based on contentType field
    const contentTypeMap: { [key: string]: string } = {
      videos: "video/mp4",
      music: "audio/mpeg",
      sermon: "video/mp4",
      ebook: "application/pdf",
      podcast: "audio/mpeg",
    };
    return contentTypeMap[media.contentType] || "application/octet-stream";
  }

  /**
   * Extract object key from Cloudflare R2 URL
   * Handles formats like:
   * - https://pub-xxx.r2.dev/jevah/media-videos/file.mp4
   * - https://custom-domain.com/jevah/media-videos/file.mp4
   */
  private extractObjectKeyFromUrl(url: string): string | null {
    try {
      if (!url) return null;

      // Parse URL
      const urlObj = new URL(url);

      // Extract pathname and remove leading slash
      let pathname = urlObj.pathname;
      if (pathname.startsWith("/")) {
        pathname = pathname.substring(1);
      }

      // For R2 public URLs, the pathname is the object key
      // e.g., "jevah/media-videos/file.mp4"
      if (pathname) {
        return decodeURIComponent(pathname);
      }

      // Fallback: try to extract from full URL
      const parts = url.split("/");
      if (parts.length > 0) {
        // Get everything after the domain
        const domainIndex = url.indexOf("://");
        if (domainIndex !== -1) {
          const afterProtocol = url.substring(domainIndex + 3);
          const pathStart = afterProtocol.indexOf("/");
          if (pathStart !== -1) {
            return decodeURIComponent(afterProtocol.substring(pathStart + 1));
          }
        }
      }

      return null;
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
      console.log("[Download Service] addToOfflineDownloads called:", {
        userId,
        mediaId,
        fileName: downloadInfo.fileName,
      });

      const { User } = await import("../models/user.model");

      // Validate userId and mediaId
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error(`Invalid userId format: ${userId}`);
      }
      if (!Types.ObjectId.isValid(mediaId)) {
        throw new Error(`Invalid mediaId format: ${mediaId}`);
      }

      const offlineDownload = {
        mediaId: new Types.ObjectId(mediaId),
        downloadDate: new Date(),
        fileName: downloadInfo.fileName,
        fileSize: downloadInfo.fileSize,
        contentType: downloadInfo.contentType,
        downloadUrl: downloadInfo.downloadUrl,
        isDownloaded: false, // Will be updated by frontend
        downloadStatus: "pending", // Initial status
        downloadProgress: 0, // Initial progress
      };

      console.log("[Download Service] Attempting to update existing download record");

      // Avoid unbounded duplicates:
      // - If the item already exists in offlineDownloads, just refresh its metadata/date.
      // - Only increment totalDownloads and push a new entry when it's a new mediaId.
      const existingUpdate = await User.updateOne(
        {
          _id: new Types.ObjectId(userId),
          "offlineDownloads.mediaId": new Types.ObjectId(mediaId),
        },
        {
          $set: {
            "offlineDownloads.$.downloadDate": offlineDownload.downloadDate,
            "offlineDownloads.$.fileName": offlineDownload.fileName,
            "offlineDownloads.$.fileSize": offlineDownload.fileSize,
            "offlineDownloads.$.contentType": offlineDownload.contentType,
            "offlineDownloads.$.downloadUrl": offlineDownload.downloadUrl,
            "offlineDownloads.$.downloadStatus": "pending",
            "offlineDownloads.$.downloadProgress": 0,
          },
        }
      );

      if ((existingUpdate as any)?.modifiedCount > 0) {
        console.log("[Download Service] Updated existing download record");
        return;
      }

      console.log("[Download Service] Creating new download record");

      // Check if user exists
      const userExists = await User.findById(userId);
      if (!userExists) {
        throw new Error(`User not found: ${userId}`);
      }

      const newRecordResult = await User.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $push: { offlineDownloads: offlineDownload },
          $inc: { totalDownloads: 1 },
        }
      );

      console.log("[Download Service] Created new download record:", {
        matched: newRecordResult.matchedCount,
        modified: newRecordResult.modifiedCount,
      });

      if (newRecordResult.matchedCount === 0) {
        throw new Error(`User not found when creating download record: ${userId}`);
      }

      console.log("[Download Service] Successfully added to offline downloads:", {
        userId,
        mediaId,
        fileName: downloadInfo.fileName,
      });
    } catch (error) {
      // Log error but don't throw - this is non-critical
      // The download URL is still valid and will be returned to the user
      console.error("[Download Service] Error adding to offline downloads (non-critical):", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        mediaId,
      });
      // Silently fail - don't throw, don't block the download
    }
  }

  /**
   * Get user's offline downloads with filtering
   */
  async getUserOfflineDownloads(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: string;
      contentType?: string;
    }
  ) {
    try {
      const { User } = await import("../models/user.model");

      const user = await User.findById(userId)
        .populate(
          "offlineDownloads.mediaId",
          "title description thumbnailUrl contentType duration isPublicDomain speaker year category tags fileUrl"
        )
        .lean();

      if (!user) {
        throw new Error("User not found");
      }

      let downloads = (user as any).offlineDownloads || [];

      // Apply filters
      if (filters?.status) {
        downloads = downloads.filter(
          (d: any) => d.downloadStatus === filters.status
        );
      }

      if (filters?.contentType) {
        // Map frontend contentType to backend contentType
        const contentTypeMap: { [key: string]: string } = {
          video: "videos",
          audio: "music",
          ebook: "ebook",
        };
        const backendContentType = contentTypeMap[filters.contentType] || filters.contentType;

        downloads = downloads.filter((d: any) => {
          const mediaContentType = d.mediaId?.contentType || d.contentType;
          return mediaContentType === backendContentType;
        });
      }

      // Sort by downloadDate descending (newest first)
      downloads = downloads.sort(
        (a: any, b: any) =>
          new Date(b.downloadDate).getTime() -
          new Date(a.downloadDate).getTime()
      );

      const total = downloads.length;
      const skip = (page - 1) * limit;
      const paginatedDownloads = downloads.slice(skip, skip + limit);

      // Transform downloads to match spec format
      const transformedDownloads = paginatedDownloads.map((download: any) => ({
        _id: download._id || download.mediaId?._id,
        mediaId: download.mediaId?._id || download.mediaId,
        userId: userId,
        fileName: download.fileName,
        fileSize: download.fileSize,
        contentType: download.contentType,
        downloadStatus: download.downloadStatus || "pending",
        downloadProgress: download.downloadProgress || 0,
        isDownloaded: download.isDownloaded || false,
        localPath: download.localPath,
        downloadUrl: download.downloadUrl, // Original download URL (may be expired)
        // Include media object with fileUrl for playback
        media: download.mediaId
          ? {
            _id: download.mediaId._id,
            title: download.mediaId.title,
            description: download.mediaId.description,
            thumbnailUrl: download.mediaId.thumbnailUrl,
            fileUrl: download.mediaId.fileUrl, // For playback - always available
            contentType: download.mediaId.contentType,
            duration: download.mediaId.duration,
            category: download.mediaId.category,
          }
          : undefined,
        createdAt: download.downloadDate,
        updatedAt: download.downloadDate,
      }));

      return {
        downloads: transformedDownloads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
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

      const result = await User.findByIdAndUpdate(userId, {
        $pull: { offlineDownloads: { mediaId: new Types.ObjectId(mediaId) } },
        $inc: { totalDownloads: -1 },
      });

      if (!result) {
        throw new Error("User not found");
      }

      console.log("Removed from offline downloads:", { userId, mediaId });
    } catch (error) {
      console.error("Error removing from offline downloads:", error);
      throw error;
    }
  }

  /**
   * Update download status, progress, and local path
   */
  async updateDownloadStatus(
    userId: string,
    mediaId: string,
    updates: {
      localPath?: string;
      isDownloaded?: boolean;
      downloadStatus?: "pending" | "downloading" | "completed" | "failed" | "cancelled";
      downloadProgress?: number;
    }
  ) {
    try {
      const { User } = await import("../models/user.model");

      // Validate downloadStatus
      if (updates.downloadStatus) {
        const validStatuses = ["pending", "downloading", "completed", "failed", "cancelled"];
        if (!validStatuses.includes(updates.downloadStatus)) {
          throw new Error("Invalid download status");
        }
      }

      // Validate downloadProgress (0-100)
      if (updates.downloadProgress !== undefined) {
        if (updates.downloadProgress < 0 || updates.downloadProgress > 100) {
          throw new Error("Download progress must be between 0 and 100");
        }
      }

      // Build update object
      const updateFields: any = {};
      if (updates.localPath !== undefined) {
        updateFields["offlineDownloads.$.localPath"] = updates.localPath;
      }
      if (updates.isDownloaded !== undefined) {
        updateFields["offlineDownloads.$.isDownloaded"] = updates.isDownloaded;
      }
      if (updates.downloadStatus !== undefined) {
        updateFields["offlineDownloads.$.downloadStatus"] = updates.downloadStatus;
      }
      if (updates.downloadProgress !== undefined) {
        updateFields["offlineDownloads.$.downloadProgress"] = updates.downloadProgress;
      }

      // Update the download record
      const result = await User.updateOne(
        {
          _id: new Types.ObjectId(userId),
          "offlineDownloads.mediaId": new Types.ObjectId(mediaId),
        },
        {
          $set: updateFields,
        }
      );

      if (result.matchedCount === 0) {
        // Download record doesn't exist, create it
        const media = await Media.findById(mediaId);
        if (!media) {
          throw new Error("Media not found");
        }

        const newDownload = {
          mediaId: new Types.ObjectId(mediaId),
          downloadDate: new Date(),
          fileName: media.title || "Untitled",
          fileSize: media.fileSize || 0,
          contentType: this.getContentTypeFromMedia(media),
          downloadUrl: media.fileUrl || "",
          localPath: updates.localPath,
          isDownloaded: updates.isDownloaded || false,
          downloadProgress: updates.downloadProgress || 0,
          downloadStatus: updates.downloadStatus || "pending",
        };

        await User.updateOne(
          { _id: new Types.ObjectId(userId) },
          {
            $push: { offlineDownloads: newDownload },
          }
        );
      }

      // Fetch updated download record
      const user = await User.findById(userId)
        .select("offlineDownloads")
        .lean();

      const download = (user as any)?.offlineDownloads?.find(
        (d: any) => d.mediaId?.toString() === mediaId
      );

      if (!download) {
        throw new Error("Download record not found");
      }

      return {
        mediaId: download.mediaId?.toString() || mediaId,
        downloadStatus: download.downloadStatus || "pending",
        downloadProgress: download.downloadProgress || 0,
        isDownloaded: download.isDownloaded || false,
        localPath: download.localPath,
        fileName: download.fileName,
        fileSize: download.fileSize,
        contentType: download.contentType,
        updatedAt: download.downloadDate || new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get download status for a specific media item
   */
  async getDownloadStatus(userId: string, mediaId: string) {
    try {
      const { User } = await import("../models/user.model");

      const user = await User.findById(userId)
        .select("offlineDownloads")
        .lean();

      if (!user) {
        throw new Error("User not found");
      }

      const download = (user as any)?.offlineDownloads?.find(
        (d: any) => d.mediaId?.toString() === mediaId
      );

      if (!download) {
        throw new Error("Download not found");
      }

      return {
        _id: download._id,
        mediaId: download.mediaId?.toString() || mediaId,
        downloadStatus: download.downloadStatus || "pending",
        downloadProgress: download.downloadProgress || 0,
        isDownloaded: download.isDownloaded || false,
        localPath: download.localPath,
        fileName: download.fileName,
        fileSize: download.fileSize,
        contentType: download.contentType,
        createdAt: download.downloadDate,
        updatedAt: download.downloadDate,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Download media file directly (for UI components)
   */
  async downloadMediaFile(data: { mediaId: string; userId: string; range?: string }) {
    try {
      const { mediaId, userId } = data;

      const media = await Media.findById(mediaId);
      if (!media) {
        throw new Error("Media not found");
      }

      // Check if media is available for download
      if (!media.fileUrl) {
        throw new Error("Media file not available for download");
      }

      // NOTE: Do not buffer large media into memory. Stream it through the API when needed.
      // Also forward Range requests so clients can resume downloads and stream efficiently.
      const rangeHeader = data.range;
      // If the client is resuming via Range requests, avoid duplicate DB writes on every chunk.
      if (!rangeHeader) {
        // Record download interaction
        await this.recordInteraction({
          userIdentifier: userId,
          mediaIdentifier: mediaId,
          interactionType: "download",
          duration: 0,
        });
      }
      const fileResponse = await fetch(media.fileUrl, {
        headers: rangeHeader ? { Range: rangeHeader } : undefined,
      });
      if (!fileResponse.ok) {
        throw new Error("Failed to fetch media file");
      }

      const contentType =
        fileResponse.headers.get("content-type") ||
        (media.mimeType as any) ||
        "application/octet-stream";
      const contentLengthHeader = fileResponse.headers.get("content-length");
      const contentLength = contentLengthHeader
        ? parseInt(contentLengthHeader, 10)
        : undefined;

      // Add to user's offline downloads only for the initial request
      // (Range resume requests should not create/refresh records repeatedly).
      if (!rangeHeader) {
        await this.addToOfflineDownloads(userId, mediaId, {
          fileName: media.title || "Untitled",
          fileSize: media.fileSize || contentLength || 0,
          contentType: media.contentType,
          downloadUrl: media.fileUrl,
        });
      }

      return {
        success: true,
        // Stream instead of buffering.
        // Express response will pipe this to the client.
        stream: fileResponse.body,
        fileName: media.title || "Untitled",
        fileSize: media.fileSize || contentLength || 0,
        contentType,
        status: fileResponse.status,
        headers: {
          acceptRanges: fileResponse.headers.get("accept-ranges"),
          contentRange: fileResponse.headers.get("content-range"),
          contentLength: contentLengthHeader,
        },
        message: "File downloaded successfully",
      };
    } catch (error) {
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
