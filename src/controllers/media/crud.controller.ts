import { Request, Response } from "express";
import { Types } from "mongoose";
import { mediaService } from "../../service/media.service";
import cacheService, { CACHE_TTL } from "../../service/cache.service";
import {
  feedCacheHash,
  feedGlobalKey,
  feedUserKey,
} from "../../lib/cacheKeys";
import { getFeedGeneration } from "../../lib/invalidateFeedCaches";
import logger from "../../utils/logger";
import { SearchQueryParameters } from "./shared";
import { attachFeedUserInteractionFlags } from "../../service/media/feedUserFlags";
import { attachFreshEngagementCounts } from "../../service/media/feedCountOverlay";
import { invalidateFeedCaches } from "../../lib/invalidateFeedCaches";

export const getAllMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const filters = request.query;
    const mediaList = await mediaService.getAllMedia(filters);

    response.status(200).json({
      success: true,
      media: mediaList.media,
      pagination: mediaList.pagination,
    });
  } catch (error: any) {
    logger.error("Fetch media error", { error: error?.message });
    response.status(500).json({
      success: false,
      message: "Failed to retrieve media",
    });
  }
};

// Global feed: all content on the platform (everyone's uploads). Used by both /api/media/all-content and /api/media/public/all-content. No filter by uploader; ordered by recency (or sort param). New uploads appear as soon as approved/live.
export const getAllContentForAllTab = async (
  request: Request,
  response: Response
): Promise<void> => {
  const startTime = Date.now();
  try {
    // Validate pagination parameters
    const pageParam = request.query.page
      ? parseInt(request.query.page as string, 10)
      : 1;
    const limitParam = request.query.limit
      ? parseInt(request.query.limit as string, 10)
      : 50;

    if (
      (request.query.page && isNaN(pageParam)) ||
      (request.query.limit && isNaN(limitParam))
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid page or limit",
        code: "INVALID_PAGINATION",
      });
      return;
    }

    // Validate and clamp limit (min 10, max 100)
    const page = Math.max(1, pageParam);
    const limit = Math.min(Math.max(10, limitParam), 100);

    // Extract filtering parameters
    const contentType = (request.query.contentType as string) || "ALL";
    const category = request.query.category as string | undefined;
    const minViews = request.query.minViews
      ? parseInt(request.query.minViews as string, 10)
      : undefined;
    const minLikes = request.query.minLikes
      ? parseInt(request.query.minLikes as string, 10)
      : undefined;
    const dateFrom = request.query.dateFrom as string | undefined;
    const dateTo = request.query.dateTo as string | undefined;
    const search = request.query.search as string | undefined;
    const sort = (request.query.sort as string) || "createdAt";
    const order = (request.query.order as "asc" | "desc") || "desc";

    // Build options object
    const options: any = {
      page,
      limit,
      contentType,
      sort,
      order,
    };

    if (category) options.category = category;
    if (minViews !== undefined) options.minViews = minViews;
    if (minLikes !== undefined) options.minLikes = minLikes;
    if (dateFrom) options.dateFrom = dateFrom;
    if (dateTo) options.dateTo = dateTo;
    if (search) options.search = search;

    const userIdentifier = request.userId;

    /**
     * Feed caching (IG/TikTok pattern):
     * - Shared list under feed:global:v2:{generation}:{sha256}
     * - Generation bump on structural changes (no stale resurrection)
     * - SWR + single-flight on miss; empty feeds are valid hits
     * - Counts overlaid from Redis counters (cold-seeded on miss)
     * - Per-user liked/saved flags from Redis tri-state cache
     */
    const hash = feedCacheHash({
      page: options.page,
      limit: options.limit,
      contentType: options.contentType,
      category: options.category,
      minViews: options.minViews,
      minLikes: options.minLikes,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      search: options.search,
      sort: options.sort,
      order: options.order,
    });

    const generation = await getFeedGeneration();
    let media: any[];
    let pagination: any;
    let cacheStatus: "HIT" | "STALE" | "MISS" | "BYPASS" = "BYPASS";
    let fromMongoMiss = false;

    if (generation === null) {
      // Redis unavailable — bypass cache entirely
      const result = await mediaService.getAllContentForAllTab(options);
      media = result.media;
      pagination = result.pagination;
      fromMongoMiss = true;
      cacheStatus = "BYPASS";
    } else {
      const listKey = feedGlobalKey(hash, generation);
      const loaded = await cacheService.getOrSetSwr(
        listKey,
        async () => {
          const result = await mediaService.getAllContentForAllTab(options);
          return { media: result.media, pagination: result.pagination };
        },
        {
          freshTtlSeconds: CACHE_TTL.feed,
          staleTtlSeconds: CACHE_TTL.feedStale,
        }
      );
      media = loaded.value.media;
      pagination = loaded.value.pagination;
      cacheStatus = loaded.status;
      fromMongoMiss = loaded.status === "MISS" || loaded.status === "BYPASS";
    }

    // Personalized recommendations: SWR per user, 500ms budget
    let recommendations: any = undefined;
    if (userIdentifier) {
      const mood = (request.query?.mood as string) || "default";
      const recKey = feedUserKey(userIdentifier, feedCacheHash({ mood, kind: "rec" }));
      try {
        const recLoaded = await cacheService.getOrSetSwr(
          recKey,
          async () => {
            const raced = await Promise.race([
              mediaService.getRecommendationsForAllContent(userIdentifier, {
                limitPerSection: 12,
                mood: mood === "default" ? undefined : mood,
              }),
              new Promise(resolve => setTimeout(() => resolve(null), 500)),
            ]);
            return raced ?? null;
          },
          {
            freshTtlSeconds: CACHE_TTL.recommendations,
            staleTtlSeconds: 60,
          }
        );
        recommendations = recLoaded.value || undefined;
      } catch {
        recommendations = undefined;
      }
    }

    const mediaWithFreshCounts = await attachFreshEngagementCounts(media, {
      fromMongoMiss,
    });
    const mediaWithFlags = await attachFeedUserInteractionFlags(
      mediaWithFreshCounts,
      userIdentifier
    );

    response.setHeader("X-Cache", cacheStatus);

    const duration = Date.now() - startTime;
    if (duration > 500) {
      logger.warn("Slow feed query", {
        duration,
        page,
        limit,
        contentType,
        cached: cacheStatus,
      });
    }

    response.status(200).json({
      success: true,
      data: {
        media: mediaWithFlags,
        pagination,
      },
      ...(recommendations && { recommendations }),
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error("Fetch all content error", {
      error: error.message,
      duration,
      query: request.query,
    });

    response.status(500).json({
      success: false,
      message: "Failed to retrieve all content",
      code: "FETCH_ERROR",
    });
  }
};

export const searchMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const {
      search,
      contentType,
      category,
      topics,
      sort,
      page,
      limit,
      creator,
      duration,
      startDate,
      endDate,
    } = request.query as SearchQueryParameters;

    if (page && isNaN(parseInt(page))) {
      response.status(400).json({
        success: false,
        message: "Invalid page number",
      });
      return;
    }
    if (limit && isNaN(parseInt(limit))) {
      response.status(400).json({
        success: false,
        message: "Invalid limit",
      });
      return;
    }

    const filters: any = {};
    if (search) filters.search = search;
    if (contentType) filters.contentType = contentType;
    if (category) filters.category = category;
    if (topics) filters.topics = topics;
    if (sort) filters.sort = sort;
    if (page) filters.page = page;
    if (limit) filters.limit = limit;
    if (creator) filters.creator = creator;
    if (duration) filters.duration = duration;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const result = await mediaService.getAllMedia(filters);

    response.status(200).json({
      success: true,
      message: "Media search completed",
      media: result.media,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error("Search media error", { error: error?.message });
    response.status(500).json({
      success: false,
      message: "Failed to search media",
    });
  }
};

export const getMediaByIdentifier = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    if (!Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media identifier",
      });
      return;
    }

    const media = await mediaService.getMediaByIdentifier(id);
    const interactionCounts = await mediaService.getInteractionCounts(id);

    // media is already an object (not a Mongoose document) from the service transformation
    response.status(200).json({
      success: true,
      media: {
        ...media,
        ...interactionCounts,
      },
    });
  } catch (error: any) {
    logger.error("Get media by identifier error", { error: error?.message });
    response.status(error.message === "Media not found" ? 404 : 400).json({
      success: false,
      message: error.message || "Failed to fetch media item",
    });
  }
};

export const getMediaStats = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    if (!Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media identifier",
      });
      return;
    }

    const stats = await mediaService.getInteractionCounts(id);

    response.status(200).json({
      success: true,
      message: "Media stats retrieved successfully",
      stats,
    });
  } catch (error: any) {
    logger.error("Get media stats error", { error: error?.message });
    response.status(error.message === "Media not found" ? 404 : 400).json({
      success: false,
      message: error.message || "Failed to fetch media stats",
    });
  }
};

export const deleteMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const userIdentifier = request.userId;
    const userRole = request.user?.role;

    // Debug logging
    logger.debug("Delete Media Request", {
      mediaId: id,
      userId: userIdentifier,
      userRole: userRole,
      hasUser: !!request.user,
      authHeader: request.headers.authorization ? "present" : "missing",
    });

    if (!userIdentifier) {
      logger.warn("Delete Media: No user identifier found");
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media identifier",
      });
      return;
    }

    await mediaService.deleteMedia(id, userIdentifier, userRole || "");

    // Invalidate cache for this media and related caches
    await cacheService.del(`media:public:${id}`);
    await cacheService.del(`media:${id}`);
    await cacheService.delPattern("media:public:*");
    await cacheService.delPattern("media:all:*");
    // Structural feed change — drop shared feed list caches
    await invalidateFeedCaches(id, "");

    response.status(200).json({
      success: true,
      message: "Media deleted successfully",
    });
  } catch (error: any) {
    logger.error("Delete media error", { error: error?.message });
    response.status(error.message === "Media not found" ? 404 : 400).json({
      success: false,
      message: error.message || "Failed to delete media",
    });
  }
};
