import { Media } from "../../models/media.model";
import { User } from "../../models/user.model";
import { UserViewedMedia } from "../../models/userViewedMedia.model";
import { Types } from "mongoose";
import enhancedMediaService from "../enhancedMedia.service";
import { recommendationEngineService } from "../recommendationEngine.service";
import logger from "../../utils/logger";
import { DurationRangeKey, LeanUserViewedMedia } from "./types";
import { buildMediaVisibilityQuery } from "./query/visibility";
import { PUBLIC_MEDIA_FILTER } from "../../lib/publicMediaVisibility";

export class MediaQueryService {
  async getAllMedia(filters: any = {}, options: { enforceModeration?: boolean; actingUserId?: string } = { enforceModeration: true }) {
    const query: any = {
      ...buildMediaVisibilityQuery(options),
    };

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

      // Global feed: same public visibility rules as like/view/metadata.
      // (Previously omitted publicationState → staged/draft items could appear then 404 on like.)
      const matchQuery: Record<string, any> = {
        ...PUBLIC_MEDIA_FILTER,
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

      // Sort on native Media fields BEFORE $lookup (page first, then join author)
      const sortField = options?.sort || "createdAt";
      const sortOrder = options?.order === "asc" ? 1 : -1;
      const sortObj: Record<string, 1 | -1> = {};
      if (sortField === "views" || sortField === "viewCount") {
        sortObj.viewCount = sortOrder;
      } else if (sortField === "likes" || sortField === "likeCount") {
        sortObj.likeCount = sortOrder;
      } else {
        sortObj.createdAt = sortOrder;
      }
      // Stable cursor tie-break
      if (!sortObj._id) sortObj._id = sortOrder;

      const pipeline = this.buildAggregationPipeline(matchQuery, {
        sort: sortObj,
        skip,
        limit,
        pageBeforeLookup: true,
      });

      // Avoid exact countDocuments on every page when possible — cache-friendly estimate for deep pages
      const countPromise =
        page === 1
          ? Media.countDocuments(matchQuery)
          : Media.countDocuments(matchQuery).maxTimeMS(2000).catch(() => -1);

      const [mediaList, totalRaw] = await Promise.all([
        Media.aggregate(pipeline),
        countPromise,
      ]);
      const total = typeof totalRaw === "number" && totalRaw >= 0 ? totalRaw : skip + mediaList.length;
      const totalPages = totalRaw >= 0 ? Math.ceil(total / limit) : undefined;

      const nextCursor =
        mediaList.length > 0
          ? Buffer.from(
              JSON.stringify({
                createdAt: mediaList[mediaList.length - 1].createdAt,
                _id: mediaList[mediaList.length - 1]._id,
              })
            ).toString("base64url")
          : undefined;

      return {
        media: mediaList,
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: totalPages ?? Math.ceil(total / limit),
          hasNextPage:
            totalRaw >= 0
              ? page < Math.ceil(total / limit)
              : mediaList.length === limit,
          hasPreviousPage: page > 1,
          nextCursor,
        },
      };
    } catch (error: any) {
      // Log the actual MongoDB error so it's visible in server logs
      // without leaking details to the API response.
      logger.error("Error fetching all content", {
        error: error?.message,
        stack: error?.stack,
        options,
      });
      throw new Error(`Failed to retrieve all content: ${error?.message}`);
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
      skip?: number;
      pageBeforeLookup?: boolean;
    }
  ) {
    const pipeline: any[] = [];
    if (matchStage && Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    if (options?.pageBeforeLookup) {
      if (options?.sort) {
        pipeline.push({ $sort: options.sort });
      }
      if (options?.skip && options.skip > 0) {
        pipeline.push({ $skip: options.skip });
      }
      if (options?.limit && options.limit > 0) {
        pipeline.push({ $limit: options.limit });
      }
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
      // preserveNullAndEmptyArrays: true ensures media whose uploader was deleted
      // still appears in the feed (with empty authorInfo) instead of being silently dropped.
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          // Use pre-calculated fields directly (already stored in Media document)
          // This is MUCH faster than doing $lookup and $filter on related collections
          totalLikes: { $ifNull: ["$likeCount", 0] },
          totalShares: { $ifNull: ["$shareCount", 0] },
          totalViews: { $ifNull: ["$viewCount", 0] },
          authorInfo: {
            $cond: {
              if: { $ifNull: ["$author._id", false] },
              then: {
                _id: "$author._id",
                firstName: { $ifNull: ["$author.firstName", ""] },
                lastName: { $ifNull: ["$author.lastName", ""] },
                fullName: {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: ["$author.firstName", ""] },
                        " ",
                        { $ifNull: ["$author.lastName", ""] },
                      ],
                    },
                  },
                },
                avatar: { $ifNull: ["$author.avatar", null] },
                section: { $ifNull: ["$author.section", null] },
              },
              else: {
                _id: null,
                firstName: "",
                lastName: "",
                fullName: "Unknown",
                avatar: null,
                section: null,
              },
            },
          },
          formattedCreatedAt: {
            $dateToString: {
              format: "%Y-%m-%dT%H:%M:%S.%LZ",
              // $ifNull guards against documents missing the createdAt field,
              // which would otherwise crash the entire aggregation pipeline.
              date: { $ifNull: ["$createdAt", "$$NOW"] },
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

    if (!options?.pageBeforeLookup) {
      if (options?.sort) {
        pipeline.push({ $sort: options.sort });
      }
      if (options?.sampleSize && options.sampleSize > 0) {
        pipeline.push({ $sample: { size: options.sampleSize } });
      }
      if (options?.limit && options.limit > 0) {
        pipeline.push({ $limit: options.limit });
      }
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
}

export const mediaQueryService = new MediaQueryService();
