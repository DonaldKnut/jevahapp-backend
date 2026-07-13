import { Request, Response } from "express";
import { Types } from "mongoose";
import { Media } from "../../models/media.model";
import { mediaService } from "../../service/media.service";
import cacheService from "../../service/cache.service";
import logger from "../../utils/logger";
import { extractObjectKeyFromUrl, mapContentType } from "./shared";

export const getPublicMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const filters = request.query;
    const cacheKey = `media:public:${JSON.stringify(filters)}`;

    // Cache for 15 minutes (900 seconds)
    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const mediaList = await mediaService.getAllMedia(filters, {
          actingUserId: request.userId
        });
        return {
          success: true,
          media: mediaList.media,
          pagination: mediaList.pagination,
        };
      },
      900 // 15 minutes cache - aggressive caching for stable public data
    );

    response.status(200).json(result);
  } catch (error: any) {
    console.error("Fetch public media error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve media",
    });
  }
};

export const getPublicAllContent = async (
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
    const mood = (request.query.mood as string) || undefined;

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

    // Cache key includes query params so pagination/filters return correct data
    const cacheKeyHash = JSON.stringify({
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
      mood,
    });
    const cacheKey = `media:public:all-content:${Buffer.from(cacheKeyHash).toString("base64").slice(0, 48)}`;

    // Cache for 30 seconds (short TTL) so new uploads appear soon after approved
    const result = await cacheService.getOrSetWithHeaders(
      cacheKey,
      async () => {
        const mediaResult = await mediaService.getAllContentForAllTab(options);

        // Public endpoint can still include non-personalized recommendations
        let recommendations: any = undefined;
        try {
          recommendations = await mediaService.getRecommendationsForAllContent(
            undefined,
            {
              limitPerSection: 12,
              mood,
            }
          );
        } catch (err) {
          recommendations = undefined;
        }

        return {
          success: true,
          data: {
            media: mediaResult.media,
            pagination: mediaResult.pagination,
          },
          ...(recommendations && { recommendations }),
        };
      },
      response,
      30 // 30 seconds TTL as specified
    );

    // Log performance metrics
    const duration = Date.now() - startTime;
    const responseSize = JSON.stringify(result).length;

    if (duration > 1000) {
      logger.warn("Slow public all-content query detected", {
        duration,
        page,
        limit,
        contentType,
        total: result.data?.pagination?.total,
      });
    }

    if (responseSize > 500 * 1024) {
      logger.warn("Large public response detected", {
        size: responseSize,
        page,
        limit,
        contentType,
      });
    }

    logger.info("Public all content fetched", {
      page,
      limit,
      contentType,
      total: result.data?.pagination?.total,
      duration,
      responseSize,
    });

    response.status(200).json(result);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error("Fetch public all content error", {
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

export const getPublicMediaByIdentifier = async (
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

    const cacheKey = `media:public:${id}`;

    // Cache for 10 minutes (600 seconds)
    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const media = await mediaService.getMediaByIdentifier(id, {
          actingUserId: request.userId,
          userRole: request.userRole
        });

        if (!media) {
          return {
            success: false,
            message: "Media not found",
          };
        }

        return {
          success: true,
          media: media.toObject(),
        };
      },
      600 // 10 minutes cache
    );

    if (!result.success) {
      response.status(404).json(result);
      return;
    }

    response.status(200).json(result);
  } catch (error: any) {
    console.error("Fetch public media by ID error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve media",
    });
  }
};

export const searchPublicMedia = async (
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
    } = request.query;

    if (page && isNaN(parseInt(page as string))) {
      response.status(400).json({
        success: false,
        message: "Invalid page number",
      });
      return;
    }

    if (limit && isNaN(parseInt(limit as string))) {
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
    console.error("Search public media error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to search media",
    });
  }
};

export const getDefaultContent = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { contentType, limit = "10", page = "1" } = request.query;

    const limitNum = parseInt(limit as string) || 10;
    const pageNum = parseInt(page as string) || 1;
    const skip = (pageNum - 1) * limitNum;

    // Build filter for default content
    const filter: any = {
      isDefaultContent: true,
      isOnboardingContent: true,
    };

    // Add contentType filter if provided
    if (contentType && contentType !== "all") {
      filter.contentType = contentType;
    }

    // Get total count for pagination
    const total = await Media.countDocuments(filter);

    // Get default content with pagination
    const defaultContentRaw = await Media.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("uploadedBy", "firstName lastName username email avatar")
      .lean();

    // Use direct public URLs - no need for signed URL generation
    const content = defaultContentRaw.map((item: any) => {
      // Transform to frontend-expected format
      return {
        _id: item._id,
        title: item.title || "Untitled",
        description: item.description || "",
        mediaUrl: item.fileUrl, // Use direct public URL
        thumbnailUrl: item.thumbnailUrl || item.fileUrl, // Use direct public URL
        contentType: mapContentType(item.contentType),
        duration: item.duration || null,
        author: {
          _id: item.uploadedBy?._id || item.uploadedBy,
          firstName: item.uploadedBy?.firstName || "Unknown",
          lastName: item.uploadedBy?.lastName || "User",
          avatar: item.uploadedBy?.avatar || null,
        },
        likeCount: item.likeCount || 0,
        commentCount: item.commentCount || 0,
        shareCount: item.shareCount || 0,
        viewCount: item.viewCount || 0,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    response.status(200).json({
      success: true,
      data: {
        content,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    console.error("Get default content error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve default content",
    });
  }
};

// Video URL refresh endpoint for seamless playback
export const refreshVideoUrl = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { mediaId } = request.params;
    const userIdentifier = request.userId;

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    // Find the media
    const media = await Media.findById(mediaId);
    if (!media) {
      response.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    // Check if media is public or user has access
    if (!media.isPublic && media.uploadedBy.toString() !== userIdentifier) {
      response.status(403).json({
        success: false,
        message: "Access denied",
      });
      return;
    }

    // Import file upload service
    const { default: fileUploadService } = await import(
      "../../service/fileUpload.service"
    );

    // Extract object key from fileUrl
    const objectKey = extractObjectKeyFromUrl(media.fileUrl);
    if (!objectKey) {
      response.status(400).json({
        success: false,
        message: "Invalid media file URL",
      });
      return;
    }

    // Since we use public URLs, just return the existing public URL
    // No need to generate signed URLs as they're permanent public URLs
    const publicUrl = media.fileUrl; // This is already a permanent public URL

    response.status(200).json({
      success: true,
      data: {
        mediaId: media._id,
        newUrl: publicUrl, // Return the same public URL (it doesn't expire)
        expiresIn: null, // Public URLs don't expire
        expiresAt: null, // Public URLs don't expire
        isPublicUrl: true, // Indicate this is a permanent public URL
      },
      message: "Video URL refreshed successfully (using permanent public URL)",
    });
  } catch (error: any) {
    console.error("Refresh video URL error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to refresh video URL",
    });
  }
};

export const getOnboardingContent = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    // Get a curated selection of onboarding content
    const onboardingContent = await Media.find({
      isOnboardingContent: true,
      isDefaultContent: true,
    })
      .sort({ createdAt: -1 })
      .limit(15) // Show 15 items for onboarding
      .populate("uploadedBy", "firstName lastName username email avatar")
      .lean();

    // Create onboarding experience with different sections
    const onboardingExperience = {
      welcome: {
        title: "Welcome to Jevah",
        subtitle: "Your spiritual journey starts here",
        content: onboardingContent.slice(0, 3), // First 3 items
      },
      quickStart: {
        title: "Quick Start",
        subtitle: "Short content to get you started",
        content: onboardingContent
          .filter(
            item =>
              item.contentType === "audio" &&
              item.duration &&
              item.duration <= 300
          )
          .slice(0, 3),
      },
      discoverWeekly: {
        title: "**Discover Weekly**",
        subtitle: "**Fresh gospel music, sermons, and inspirational content curated weekly to uplift your spirit and strengthen your faith journey**",
        description: "**Discover Weekly** brings you handpicked gospel content including **worship music**, **powerful sermons**, **inspiring teachings**, and **spiritual resources** designed to deepen your relationship with God and enrich your daily walk with Christ.",
        content: onboardingContent
          .filter(
            item =>
              item.contentType === "music" ||
              item.contentType === "sermon" ||
              item.contentType === "audio"
          )
          .slice(0, 5),
      },
      featured: {
        title: "**Featured Playlist**",
        subtitle: "**Popular gospel content** - **Hand-selected worship songs, powerful sermons, and inspirational messages** that are transforming lives and spreading the gospel",
        description: "**Featured Playlist** showcases the **best gospel content** on Jevah, including **anointed worship music**, **life-changing sermons**, **biblical teachings**, and **spiritual resources** that will inspire, encourage, and draw you closer to God.",
        content: onboardingContent
          .filter(
            item =>
              item.contentType === "music" || item.contentType === "sermon"
          )
          .slice(0, 3),
      },
      devotionals: {
        title: "Daily Devotionals",
        subtitle: "Start your day with prayer",
        content: onboardingContent
          .filter(item => item.contentType === "devotional")
          .slice(0, 2),
      },
    };

    response.status(200).json({
      success: true,
      message: "Onboarding content retrieved successfully",
      data: onboardingExperience,
    });
  } catch (error: any) {
    console.error("Get onboarding content error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve onboarding content",
    });
  }
};
