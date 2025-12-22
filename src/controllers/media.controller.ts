import { Request, Response } from "express";
import { mediaService } from "../service/media.service";
import { Bookmark } from "../models/bookmark.model";
import { Types } from "mongoose";
import { Media } from "../models/media.model";
import contaboStreamingService from "../service/contaboStreaming.service";
import liveRecordingService from "../service/liveRecording.service";
import { NotificationService } from "../service/notification.service";
import cacheService from "../service/cache.service";
import { enqueueAnalyticsEvent, enqueueMediaPostUpload } from "../queues/enqueue";
import { incrPostCounter } from "../lib/redisCounters";
import { redisSafe } from "../lib/redis";
import { aiContentDescriptionService } from "../service/aiContentDescription.service";
import { User } from "../models/user.model";
import { contentModerationService } from "../service/contentModeration.service";
import { mediaProcessingService } from "../service/mediaProcessing.service";
import { transcriptionService } from "../service/transcription.service";
import { optimizedVerificationService } from "../service/optimizedVerification.service";
import { uploadProgressService } from "../service/uploadProgress.service";
import logger from "../utils/logger";
import resendEmailService from "../service/resendEmail.service";
import { MediaReport } from "../models/mediaReport.model";

interface UploadMediaRequestBody {
  title: string;
  description?: string;
  contentType: "music" | "videos" | "books" | "live";
  category?: string;
  topics?: string[] | string;
  duration?: number;
}
interface InteractionRequestBody {
  interactionType: "view" | "listen" | "read" | "download";
}

interface UserActionRequestBody {
  actionType: "favorite" | "share";
}

interface SearchQueryParameters {
  search?: string;
  contentType?: string;
  category?: string;
  topics?: string;
  sort?: string;
  page?: string;
  limit?: string;
  creator?: string;
  duration?: "short" | "medium" | "long";
  startDate?: string;
  endDate?: string;
}

// New interfaces for enhanced functionality
interface ViewTrackingRequestBody {
  duration: number; // Duration in seconds
  isComplete?: boolean;
}

interface DownloadRequestBody {
  fileSize?: number; // Optional - will be fetched from media document if not provided
}

interface ShareRequestBody {
  platform?: string;
}

export const getAnalyticsDashboard = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userIdentifier = request.userId;
    const userRole = request.userRole;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    let analyticsData: any;

    if (userRole === "admin") {
      const mediaCountByContentType =
        await mediaService.getMediaCountByContentType();
      const totalInteractionCounts =
        await mediaService.getTotalInteractionCounts();
      const totalBookmarks = await Bookmark.countDocuments();
      const recentMedia = await mediaService.getRecentMedia(10);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const uploadsLastThirtyDays =
        await mediaService.getMediaCountSinceDate(thirtyDaysAgo);
      const interactionsLastThirtyDays =
        await mediaService.getInteractionCountSinceDate(thirtyDaysAgo);

      analyticsData = {
        isAdmin: true,
        mediaCountByContentType,
        totalInteractionCounts,
        totalBookmarks,
        recentMedia,
        uploadsLastThirtyDays,
        interactionsLastThirtyDays,
      };
    } else {
      const userMediaCountByContentType =
        await mediaService.getUserMediaCountByContentType(userIdentifier);
      const userInteractionCounts =
        await mediaService.getUserInteractionCounts(userIdentifier);
      const userBookmarks =
        await mediaService.getUserBookmarkCount(userIdentifier);
      const userRecentMedia = await mediaService.getUserRecentMedia(
        userIdentifier,
        5
      );
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const userUploadsLastThirtyDays =
        await mediaService.getUserMediaCountSinceDate(
          userIdentifier,
          thirtyDaysAgo
        );
      const userInteractionsLastThirtyDays =
        await mediaService.getUserInteractionCountSinceDate(
          userIdentifier,
          thirtyDaysAgo
        );

      analyticsData = {
        isAdmin: false,
        userMediaCountByContentType,
        userInteractionCounts,
        userBookmarks,
        userRecentMedia,
        userUploadsLastThirtyDays,
        userInteractionsLastThirtyDays,
      };
    }

    response.status(200).json({
      success: true,
      message: "Analytics data retrieved successfully",
      data: analyticsData,
    });
  } catch (error: any) {
    console.error("Analytics error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
    });
  }
};

export const uploadMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, description, contentType, category, topics, duration } =
      request.body as UploadMediaRequestBody;

    // Type assertion for Multer files from upload.fields
    const files = request.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    // Check if files object exists
    if (!files) {
      console.log("No files received in request");
      response.status(400).json({
        success: false,
        message: "No files uploaded",
      });
      return;
    }

    const file = files?.file?.[0]; // Access the first file in the 'file' field
    const thumbnail = files?.thumbnail?.[0]; // Access the first file in the 'thumbnail' field

    // Detailed logging for debugging
    console.log("Request Files:", {
      fileExists: !!file,
      fileBufferExists: !!file?.buffer,
      fileMimetype: file?.mimetype,
      fileOriginalname: file?.originalname,
      fileSize: file?.size,
      thumbnailExists: !!thumbnail,
      thumbnailBufferExists: !!thumbnail?.buffer,
      thumbnailMimetype: thumbnail?.mimetype,
      thumbnailOriginalname: thumbnail?.originalname,
      thumbnailSize: thumbnail?.size,
      body: {
        title,
        description,
        contentType,
        category,
        topics,
        duration,
      },
    });

    // Validate required fields
    if (!title || !contentType) {
      response.status(400).json({
        success: false,
        message: "Title and contentType are required",
      });
      return;
    }

    // Validate contentType
    if (!["music", "videos", "books", "live"].includes(contentType)) {
      response.status(400).json({
        success: false,
        message:
          "Invalid content type. Must be 'music', 'videos', 'books', or 'live'",
      });
      return;
    }

    // Validate file presence
    if (!file || !file.buffer) {
      response.status(400).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    // Validate thumbnail presence
    if (!thumbnail || !thumbnail.buffer) {
      response.status(400).json({
        success: false,
        message: "No thumbnail uploaded",
      });
      return;
    }

    // Validate user authentication
    if (!request.userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    // Parse and validate topics
    let parsedTopics: string[] = [];
    if (topics) {
      try {
        parsedTopics = Array.isArray(topics) ? topics : JSON.parse(topics);
        if (!Array.isArray(parsedTopics)) {
          throw new Error("Topics must be an array");
        }
      } catch (error) {
        response.status(400).json({
          success: false,
          message: "Invalid topics format. Must be an array of strings",
        });
        return;
      }
    }

    // Validate duration (optional, only checked if provided)
    if (duration !== undefined && (isNaN(duration) || duration < 0)) {
      response.status(400).json({
        success: false,
        message: "Invalid duration. Must be a non-negative number",
      });
      return;
    }

    // Generate upload ID for progress tracking (used for all content types)
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const userId = request.userId || "";

    // PRE-UPLOAD VERIFICATION: Verify content before uploading to storage
    // Skip verification for "live" content type as it doesn't require file uploads
    let verificationResult: {
      isApproved: boolean;
      moderationResult: any;
      transcript?: string;
      videoFrames?: string[];
    } | null = null;

    if (contentType !== "live") {
      logger.info("Starting optimized pre-upload content verification with progress", {
        uploadId,
        contentType,
      });

      // Register upload session for progress tracking
      uploadProgressService.registerUploadSession(uploadId, userId);

      try {
        // Use optimized verification service with progress updates
        // Include thumbnail moderation (CRITICAL - first thing users see)
        verificationResult = await optimizedVerificationService.verifyContentWithProgress(
          file.buffer,
          file.mimetype,
          contentType,
          title,
          description,
          uploadId,
          (progress) => {
            // Send progress update via Socket.IO
            uploadProgressService.sendProgress(progress, userId);
          },
          thumbnail.buffer, // Include thumbnail for moderation
          thumbnail.mimetype
        );
      } catch (error: any) {
        logger.error("Pre-upload verification error:", error);
        
        // Send error progress
        uploadProgressService.sendProgress(
          {
            uploadId,
            progress: 0,
            stage: "error",
            message: `Verification failed: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
          userId
        );

        // Cleanup session
        uploadProgressService.clearUploadSession(uploadId);

        // If verification fails, reject the upload for safety
        response.status(400).json({
          success: false,
          message: "Content verification failed. Please try again or contact support.",
          error: error.message,
          uploadId, // Include uploadId in response for frontend tracking
        });
        return;
      }

      // Check if content is approved
      if (!verificationResult.isApproved) {
        const status = verificationResult.moderationResult.requiresReview
          ? "under_review"
          : "rejected";
        
        logger.warn("Content rejected during pre-upload verification", {
          status,
          reason: verificationResult.moderationResult.reason,
          flags: verificationResult.moderationResult.flags,
          uploadId,
        });

        // Send rejection progress
        uploadProgressService.sendProgress(
          {
            uploadId,
            progress: 0,
            stage: "rejected",
            message: "Content does not meet community guidelines",
            timestamp: new Date().toISOString(),
          },
          userId
        );

        // Cleanup session
        uploadProgressService.clearUploadSession(uploadId);

        // Return appropriate error response
        response.status(403).json({
          success: false,
          message: verificationResult.moderationResult.requiresReview
            ? "Content requires manual review before it can be uploaded. Please contact support."
            : "Content does not meet our community guidelines and cannot be uploaded.",
          moderationResult: {
            status,
            reason: verificationResult.moderationResult.reason,
            flags: verificationResult.moderationResult.flags,
            confidence: verificationResult.moderationResult.confidence,
          },
          uploadId,
        });
        return;
      }

      // Content is approved - send completion progress
      uploadProgressService.sendProgress(
        {
          uploadId,
          progress: 100,
          stage: "complete",
          message: "Content verified and approved!",
          timestamp: new Date().toISOString(),
        },
        userId
      );

      // Content is approved - proceed with upload
      logger.info("Content approved, proceeding with upload to storage", { uploadId });
    } else {
      logger.info("Skipping verification for live content type");
    }

    // Call mediaService to upload the media
    const media = await mediaService.uploadMedia({
      title,
      description,
      contentType,
      category,
      file: file.buffer,
      fileMimeType: file.mimetype,
      thumbnail: thumbnail.buffer,
      thumbnailMimeType: thumbnail.mimetype,
      uploadedBy: new Types.ObjectId(request.userId),
      topics: parsedTopics,
      duration,
    });

    // Update media with pre-upload verification result (if verification was performed)
    if (verificationResult) {
      const updateData: any = {
        moderationStatus: "approved",
        moderationResult: {
          ...verificationResult.moderationResult,
          moderatedAt: new Date(),
        },
        isHidden: false,
      };

      await Media.findByIdAndUpdate(media._id, updateData);
      
      // Update media object for response
      media.moderationStatus = "approved";
      media.moderationResult = updateData.moderationResult;
      media.isHidden = false;
    } else {
      // For live content, set to pending (will be moderated separately if needed)
      const updateData: any = {
        moderationStatus: "pending",
        isHidden: false,
      };
      await Media.findByIdAndUpdate(media._id, updateData);
      media.moderationStatus = "pending";
    }

    // Invalidate cache for media lists
    await cacheService.delPattern("media:public:*");
    await cacheService.delPattern("media:all:*");

    // Enqueue non-blocking post-upload processing + analytics event
    const mediaIdString = String((media as any)._id);

    enqueueMediaPostUpload({
      mediaId: mediaIdString,
      userId,
      contentType,
      fileUrl: media.fileUrl,
      requestId: (request as any).requestId,
    });
    enqueueAnalyticsEvent({
      name: "media_uploaded",
      payload: {
        mediaId: mediaIdString,
        userId,
        contentType,
        createdAt: new Date().toISOString(),
      },
      requestId: (request as any).requestId,
    });

    // Cleanup upload session
    if (contentType !== "live") {
      uploadProgressService.clearUploadSession(uploadId);
    }

    // Return success response
    response.status(201).json({
      success: true,
      message: verificationResult
        ? "Media uploaded successfully. Content has been verified and approved."
        : "Media uploaded successfully.",
      media: {
        ...media.toObject(),
        fileUrl: media.fileUrl,
        thumbnailUrl: media.thumbnailUrl,
        moderationStatus: media.moderationStatus || "pending",
        moderationResult: media.moderationResult,
      },
      uploadId: contentType !== "live" ? uploadId : undefined, // Include uploadId for tracking
    });
  } catch (error: any) {
    console.error("Upload media error:", error);
    
    // Cleanup upload session on error (only if variables are available)
    if (request.body && request.body.contentType && request.body.contentType !== "live") {
      const errorUploadId = request.headers['x-upload-id'] as string || undefined;
      const errorUserId = request.userId || "";
      
      if (errorUploadId && errorUserId) {
        uploadProgressService.sendProgress(
          {
            uploadId: errorUploadId,
            progress: 0,
            stage: "error",
            message: `Upload failed: ${error.message}`,
            timestamp: new Date().toISOString(),
          },
          errorUserId
        );
        uploadProgressService.clearUploadSession(errorUploadId);
      }
    }
    response.status(500).json({
      success: false,
      message: `Failed to upload media: ${error.message}`,
    });
  }
};

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
    console.error("Fetch media error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve media",
    });
  }
};

// New endpoint specifically for the "All" tab - returns all content for all users
export const getAllContentForAllTab = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    if (
      (request.query.page &&
        isNaN(parseInt(request.query.page as string))) ||
      (request.query.limit &&
        isNaN(parseInt(request.query.limit as string)))
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid page or limit",
      });
      return;
    }

    // Only pass pagination params if they're explicitly provided (backward compatible)
    const hasPage = request.query.page !== undefined;
    const hasLimit = request.query.limit !== undefined;
    
    const page = hasPage ? parseInt(request.query.page as string) : undefined;
    const limitParam = hasLimit ? parseInt(request.query.limit as string) : undefined;
    
    // Only pass options if pagination params were provided
    const options = (hasPage || hasLimit) ? {
      page: page && page > 0 ? page : undefined,
      limit: limitParam && limitParam > 0 ? limitParam : undefined,
    } : undefined;

    const userIdentifier = request.userId;

    /**
     * Per-user feed caching (IDs only) using Upstash Redis:
     * - Key: feed:user:{userId}
     * - TTL: ~45s
     *
     * On hit: fetch by IDs from MongoDB (DB remains source of truth)
     * On miss: generate feed, cache IDs, return response
     */
    const feedKey = userIdentifier ? `feed:user:${userIdentifier}` : null;
    if (feedKey) {
      const cachedIds = await redisSafe<string[] | null>(
        "feedGet",
        async (r) => {
          const ids = await r.get<string[]>(feedKey);
          return Array.isArray(ids) ? ids : null;
        },
        null
      );

      if (cachedIds && cachedIds.length > 0) {
        const docs = await Media.find({ _id: { $in: cachedIds } }).lean();
        const byId = new Map(docs.map((d: any) => [String(d._id), d]));
        const ordered = cachedIds.map((id) => byId.get(String(id))).filter(Boolean);

        // Recommendations remain user-specific and are computed separately.
        let recommendations: any = undefined;
        try {
          recommendations = await mediaService.getRecommendationsForAllContent(
            userIdentifier,
            {
              limitPerSection: 12,
              mood: (request.query?.mood as string) || undefined,
            }
          );
        } catch {
          recommendations = undefined;
        }

        response.status(200).json({
          success: true,
          media: ordered,
          total: ordered.length,
          recommendations,
        });
        return;
      }
    }

    // Global cache (heavy list) briefly using existing Redis/TCP cacheService.
    // Recommendations remain user-specific and are computed separately.
    const cacheKey = `media:all-content:${
      options ? `page=${options.page || 1}:limit=${options.limit || "default"}` : "default"
    }`;
    const result = await cacheService.getOrSet(
      cacheKey,
      () => mediaService.getAllContentForAllTab(options),
      60
    );

    // Optional personalization: include recommendations when user is authenticated
    let recommendations: any = undefined;
    try {
      recommendations = await mediaService.getRecommendationsForAllContent(
        userIdentifier,
        {
          limitPerSection: 12,
          mood: (request.query?.mood as string) || undefined,
        }
      );
    } catch (err) {
      // Non-blocking failure; proceed without recommendations
      recommendations = undefined;
    }

    // Cache IDs for this user feed (best-effort, never blocks)
    if (feedKey) {
      const ids = (result.media || []).map((m: any) => String(m._id)).filter(Boolean);
      redisSafe(
        "feedSet",
        async (r) => {
          await r.set(feedKey, ids, { ex: 45 });
          return true;
        },
        false
      ).catch(() => {});
    }

    response.status(200).json({
      success: true,
      media: result.media,
      total: result.total,
      ...(result.pagination && { pagination: result.pagination }), // Only include if pagination was used
      recommendations,
    });
  } catch (error: any) {
    console.error("Fetch all content error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve all content",
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
    console.error("Search media error:", error);
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

    response.status(200).json({
      success: true,
      media: {
        ...media.toObject(),
        ...interactionCounts,
      },
    });
  } catch (error: any) {
    console.error("Get media by identifier error:", error);
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
    console.error("Get media stats error:", error);
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
    console.log("Delete Media Request:", {
      mediaId: id,
      userId: userIdentifier,
      userRole: userRole,
      hasUser: !!request.user,
      authHeader: request.headers.authorization ? "present" : "missing",
    });

    if (!userIdentifier) {
      console.error("Delete Media: No user identifier found");
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

    response.status(200).json({
      success: true,
      message: "Media deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete media error:", error);
    response.status(error.message === "Media not found" ? 404 : 400).json({
      success: false,
      message: error.message || "Failed to delete media",
    });
  }
};

export const bookmarkMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
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

    const mediaExists = await mediaService.getMediaByIdentifier(id);
    if (!mediaExists) {
      response.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    const existingBookmark = await Bookmark.findOne({
      user: new Types.ObjectId(userIdentifier),
      media: new Types.ObjectId(id),
    });

    if (existingBookmark) {
      response.status(400).json({
        success: false,
        message: "Media already saved",
      });
      return;
    }

    const bookmark = await Bookmark.create({
      user: new Types.ObjectId(userIdentifier),
      media: new Types.ObjectId(id),
    });

    response.status(200).json({
      success: true,
      message: `Saved media ${id}`,
      bookmark,
    });
  } catch (error: any) {
    console.error("Bookmark media error:", error);
    if (error.code === 11000) {
      response.status(400).json({
        success: false,
        message: "Media already saved",
      });
      return;
    }
    response.status(500).json({
      success: false,
      message: "Failed to save media",
    });
  }
};

export const recordMediaInteraction = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const { interactionType } = request.body as InteractionRequestBody;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
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

    if (!["view", "listen", "read", "download"].includes(interactionType)) {
      response.status(400).json({
        success: false,
        message: "Invalid interaction type",
      });
      return;
    }

    const interaction = await mediaService.recordInteraction({
      userIdentifier,
      mediaIdentifier: id,
      interactionType,
    });

    // If interaction is a view, add to viewed media list
    if (interactionType === "view") {
      await mediaService.addToViewedMedia(userIdentifier, id);
      incrPostCounter({ postId: id, field: "views", delta: 1 }).catch(() => {});
    }

    // Non-blocking analytics event (aggregation/ranking can run offline)
    enqueueAnalyticsEvent({
      name: "media_interaction",
      payload: {
        userId: userIdentifier,
        mediaId: id,
        interactionType,
        createdAt: new Date().toISOString(),
      },
      requestId: (request as any).requestId,
    });

    response.status(201).json({
      success: true,
      message: `Recorded ${interactionType} for media ${id}`,
      interaction,
    });
  } catch (error: any) {
    console.error("Record media interaction error:", error);
    if (
      error.message.includes("Invalid") ||
      error.message.includes("already") ||
      error.message.includes("Media not found")
    ) {
      response.status(error.message === "Media not found" ? 404 : 400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    response.status(500).json({
      success: false,
      message: "Failed to record interaction",
    });
  }
};

// New method for tracking views with duration
export const trackViewWithDuration = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const { mediaId, duration, isComplete } = request.body;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
      return;
    }

    if (
      !mediaId ||
      typeof duration !== "number" ||
      typeof isComplete !== "boolean"
    ) {
      response.status(400).json({
        success: false,
        message: "Missing required fields: mediaId, duration, isComplete",
      });
      return;
    }

    const result = await mediaService.trackViewWithDuration({
      userIdentifier: userId,
      mediaIdentifier: mediaId,
      duration,
      isComplete,
    });

    incrPostCounter({ postId: mediaId, field: "views", delta: 1 }).catch(() => {});

    enqueueAnalyticsEvent({
      name: "media_view_duration",
      payload: {
        userId,
        mediaId,
        duration,
        isComplete,
        createdAt: new Date().toISOString(),
      },
      requestId: (request as any).requestId,
    });

    response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Track view error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to track view",
    });
  }
};

export const getMediaWithEngagement = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { mediaId } = request.params;
    const userId = request.userId; // Optional for public access

    if (!mediaId) {
      response.status(400).json({
        success: false,
        message: "Media ID is required",
      });
      return;
    }

    const media = await mediaService.getMediaWithEngagement(
      mediaId,
      userId || ""
    );

    response.status(200).json({
      success: true,
      data: media,
    });
  } catch (error: any) {
    console.error("Get media with engagement error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve media with engagement data",
    });
  }
};

// New method for downloading media
export const downloadMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const { fileSize } = request.body as { fileSize?: number };
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    // Fetch media to get fileSize if not provided in request
    const media = await Media.findById(id).select("fileSize fileUrl contentType title isDownloadable");
    if (!media) {
      response.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    // Use provided fileSize, or fallback to media.fileSize, or 0 as default
    const finalFileSize = fileSize && typeof fileSize === "number" && fileSize > 0
      ? fileSize
      : (media.fileSize && typeof media.fileSize === "number" && media.fileSize > 0
          ? media.fileSize
          : 0); // Default to 0 if neither available

    const result = await mediaService.downloadMedia({
      userId: userIdentifier,
      mediaId: id,
      fileSize: finalFileSize,
    });

    // Notify content owner about the download (if not self)
    try {
      await NotificationService.notifyContentDownload(
        userIdentifier,
        id,
        "media"
      );
    } catch (notifyError) {
      // Non-blocking
    }

    response.status(200).json({
      success: true,
      message: "Download recorded successfully",
      downloadUrl: result.downloadUrl,
      fileName: result.fileName,
      fileSize: result.fileSize,
      contentType: result.contentType,
    });
  } catch (error: unknown) {
    console.error("Download media error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        response.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message.includes("not available for download")) {
        response.status(403).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (
        error.message.includes("Invalid") ||
        error.message.includes("required")
      ) {
        response.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    response.status(500).json({
      success: false,
      message: "Failed to record download",
    });
  }
};

// New method for direct file download (for UI components)
export const downloadMediaFile = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    const result = await mediaService.downloadMediaFile({
      userId: userIdentifier,
      mediaId: id,
    });

    // Notify content owner about the download (if not self)
    try {
      await NotificationService.notifyContentDownload(
        userIdentifier,
        id,
        "media"
      );
    } catch (notifyError) {
      // Non-blocking
    }

    // Set appropriate headers for file download
    response.setHeader(
      "Content-Type",
      result.contentType || "application/octet-stream"
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    response.setHeader("Content-Length", result.fileSize);

    // Stream the file
    response.send(result.fileBuffer);
  } catch (error: unknown) {
    console.error("Download media file error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        response.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message.includes("not available for download")) {
        response.status(403).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (
        error.message.includes("Invalid") ||
        error.message.includes("required")
      ) {
        response.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    response.status(500).json({
      success: false,
      message: "Failed to download media file",
    });
  }
};

// New method for sharing media
export const shareMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const { platform } = request.body as ShareRequestBody;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    const result = await mediaService.shareMedia({
      userId: userIdentifier,
      mediaId: id,
      platform,
    });

    response.status(200).json({
      success: true,
      message: "Share recorded successfully",
      shareUrl: result.shareUrl,
    });
  } catch (error: unknown) {
    console.error("Share media error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        response.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (
        error.message.includes("Invalid") ||
        error.message.includes("required")
      ) {
        response.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    response.status(500).json({
      success: false,
      message: "Failed to record share",
    });
  }
};

export const recordUserAction = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const { actionType } = request.body as UserActionRequestBody;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    if (!["favorite", "share"].includes(actionType)) {
      response.status(400).json({
        success: false,
        message: "Invalid action type",
      });
      return;
    }

    const action = await mediaService.recordUserAction({
      userIdentifier,
      mediaIdentifier: id,
      actionType,
    });

    const isRemoved = (action as any).removed;
    const message = isRemoved
      ? `Removed ${actionType} from media ${id}`
      : `Added ${actionType} to media ${id}`;

    response.status(201).json({
      success: true,
      message,
      action: {
        ...action.toObject(),
        isRemoved,
      },
    });
  } catch (error: unknown) {
    console.error("Record user action error:", error);
    const safeActionType = request.body?.actionType || "unknown action";

    if (error instanceof Error) {
      if (error.message.includes("own content")) {
        response.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (
        error.message.includes("Invalid") ||
        error.message.includes("Media not found")
      ) {
        response.status(error.message === "Media not found" ? 404 : 400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    response.status(500).json({
      success: false,
      message: `Failed to record ${safeActionType}`,
    });
  }
};

export const getUserActionStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
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

    const status = await mediaService.getUserActionStatus(userIdentifier, id);

    response.status(200).json({
      success: true,
      message: "User action status retrieved successfully",
      status,
    });
  } catch (error: any) {
    console.error("Get user action status error:", error);
    response.status(error.message === "Media not found" ? 404 : 400).json({
      success: false,
      message: error.message || "Failed to get user action status",
    });
  }
};

export const addToViewedMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { mediaId } = request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(mediaId)) {
      response.status(400).json({
        success: false,
        message: "Invalid media identifier",
      });
      return;
    }

    const result = await mediaService.addToViewedMedia(userIdentifier, mediaId);

    response.status(201).json({
      success: true,
      message: "Added media to viewed list",
      viewedMedia: result.viewedMedia,
    });
  } catch (error: any) {
    console.error("Add to viewed media error:", error);
    response.status(error.message === "Media not found" ? 404 : 400).json({
      success: false,
      message: error.message || "Failed to add to viewed media",
    });
  }
};

export const getViewedMedia = async (
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

    const viewedMedia = await mediaService.getViewedMedia(userIdentifier);

    response.status(200).json({
      success: true,
      message: "Retrieved viewed media list",
      viewedMedia,
    });
  } catch (error: any) {
    console.error("Get viewed media error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve viewed media",
    });
  }
};

export const startMuxLiveStream = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, description, category, topics } = request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const stream = await contaboStreamingService.startLiveStream({
      title,
      description,
      category,
      topics: Array.isArray(topics)
        ? topics
        : typeof topics === "string"
          ? topics.split(",").map(t => t.trim())
          : [],
      uploadedBy: new Types.ObjectId(userIdentifier),
    });

    response.status(201).json({
      success: true,
      message: "Live stream started successfully",
      stream: {
        streamKey: stream.streamKey,
        rtmpUrl: stream.rtmpUrl,
        playbackUrl: stream.playbackUrl,
        hlsUrl: stream.hlsUrl,
        dashUrl: stream.dashUrl,
        streamId: stream.streamId,
      },
    });
  } catch (error: any) {
    console.error("Contabo live stream creation error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to start live stream",
    });
  }
};

export const endMuxLiveStream = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
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

    const stream = await Media.findById(id);

    if (!stream || !stream.isLive) {
      response.status(404).json({
        success: false,
        message: "Live stream not found",
      });
      return;
    }

    if (
      stream.uploadedBy.toString() !== userIdentifier &&
      request.userRole !== "admin"
    ) {
      response.status(403).json({
        success: false,
        message: "Unauthorized to end this live stream",
      });
      return;
    }

    await contaboStreamingService.endLiveStream(
      stream.streamId!,
      userIdentifier
    );

    response.status(200).json({
      success: true,
      message: "Live stream ended successfully",
    });
  } catch (error: any) {
    console.error("End live stream error:", error);
    response
      .status(error.message === "Live stream not found" ? 404 : 500)
      .json({
        success: false,
        message: error.message || "Failed to end live stream",
      });
  }
};

export const getLiveStreams = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const streams = await contaboStreamingService.getActiveStreams();

    response.status(200).json({
      success: true,
      streams,
    });
  } catch (error: any) {
    console.error("Get live streams error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve live streams",
    });
  }
};

// New Contabo-specific endpoints

export const getStreamStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const status = await contaboStreamingService.getStreamStatus(streamId);

    response.status(200).json({
      success: true,
      status,
    });
  } catch (error: any) {
    console.error("Get stream status error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get stream status",
    });
  }
};

export const scheduleLiveStream = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const {
      title,
      description,
      category,
      topics,
      scheduledStart,
      scheduledEnd,
    } = request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!scheduledStart) {
      response.status(400).json({
        success: false,
        message: "Scheduled start time is required",
      });
      return;
    }

    const stream = await contaboStreamingService.scheduleLiveStream({
      title,
      description,
      category,
      topics: Array.isArray(topics)
        ? topics
        : typeof topics === "string"
          ? topics.split(",").map(t => t.trim())
          : [],
      uploadedBy: new Types.ObjectId(userIdentifier),
      scheduledStart: new Date(scheduledStart),
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : undefined,
    });

    response.status(201).json({
      success: true,
      message: "Live stream scheduled successfully",
      stream: {
        streamKey: stream.streamKey,
        rtmpUrl: stream.rtmpUrl,
        playbackUrl: stream.playbackUrl,
        hlsUrl: stream.hlsUrl,
        dashUrl: stream.dashUrl,
        streamId: stream.streamId,
        scheduledStart,
        scheduledEnd,
      },
    });
  } catch (error: any) {
    console.error("Schedule live stream error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to schedule live stream",
    });
  }
};

export const getStreamStats = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const stats = await contaboStreamingService.getStreamStats(streamId);

    response.status(200).json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Get stream stats error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get stream statistics",
    });
  }
};

/**
 * Start recording a live stream
 */
export const startRecording = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId, streamKey, title, description, category, topics } =
      request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!streamId || !streamKey || !title) {
      response.status(400).json({
        success: false,
        message: "Stream ID, stream key, and title are required",
      });
      return;
    }

    const recording = await liveRecordingService.startRecording({
      streamId,
      streamKey,
      title,
      description,
      category,
      topics: topics ? JSON.parse(topics) : [],
      uploadedBy: new Types.ObjectId(userIdentifier),
    });

    response.status(201).json({
      success: true,
      message: "Recording started successfully",
      recording,
    });
  } catch (error: any) {
    console.error("Start recording error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to start recording",
    });
  }
};

/**
 * Stop recording a live stream
 */
export const stopRecording = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const recording = await liveRecordingService.stopRecording(
      streamId,
      userIdentifier
    );

    response.status(200).json({
      success: true,
      message: "Recording stopped successfully",
      recording,
    });
  } catch (error: any) {
    console.error("Stop recording error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to stop recording",
    });
  }
};

/**
 * Get recording status
 */
export const getRecordingStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const status = await liveRecordingService.getRecordingStatus(streamId);

    response.status(200).json({
      success: true,
      status,
    });
  } catch (error: any) {
    console.error("Get recording status error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get recording status",
    });
  }
};

/**
 * Get user's recordings
 */
export const getUserRecordings = async (
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

    const recordings =
      await liveRecordingService.getUserRecordings(userIdentifier);

    response.status(200).json({
      success: true,
      recordings,
    });
  } catch (error: any) {
    console.error("Get user recordings error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get user recordings",
    });
  }
};

export const goLive = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, description } = request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!title || title.trim() === "") {
      response.status(400).json({
        success: false,
        message: "Title is required for live stream",
      });
      return;
    }

    // Start live stream immediately with minimal info
    const stream = await contaboStreamingService.startLiveStream({
      title: title.trim(),
      description: description?.trim() || "Live stream",
      category: "live",
      topics: ["live-stream"],
      uploadedBy: new Types.ObjectId(userIdentifier),
    });

    response.status(201).json({
      success: true,
      message: "Live stream started successfully",
      stream: {
        streamKey: stream.streamKey,
        rtmpUrl: stream.rtmpUrl,
        playbackUrl: stream.playbackUrl,
        hlsUrl: stream.hlsUrl,
        dashUrl: stream.dashUrl,
        streamId: stream.streamId,
      },
    });
  } catch (error: any) {
    console.error("Go live stream creation error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to start live stream",
    });
  }
};

// Public endpoints for viewing media (no authentication required)
export const getPublicMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const filters = request.query;
    const cacheKey = `media:public:${JSON.stringify(filters)}`;
    
    // Cache for 5 minutes (300 seconds)
    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const mediaList = await mediaService.getAllMedia(filters);
        return {
          success: true,
          media: mediaList.media,
          pagination: mediaList.pagination,
        };
      },
      300 // 5 minutes cache
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
  try {
    if (
      (request.query.page &&
        isNaN(parseInt(request.query.page as string))) ||
      (request.query.limit &&
        isNaN(parseInt(request.query.limit as string)))
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid page or limit",
      });
      return;
    }

    // Only pass pagination params if they're explicitly provided (backward compatible)
    const hasPage = request.query.page !== undefined;
    const hasLimit = request.query.limit !== undefined;
    
    const page = hasPage ? parseInt(request.query.page as string) : undefined;
    const limitParam = hasLimit ? parseInt(request.query.limit as string) : undefined;
    
    // Only pass options if pagination params were provided
    const options = (hasPage || hasLimit) ? {
      page: page && page > 0 ? page : undefined,
      limit: limitParam && limitParam > 0 ? limitParam : undefined,
    } : undefined;

    const cacheKey = `media:public:all-content:${request.query.mood || "default"}${options ? `:page=${page || 1}:limit=${limitParam || "default"}` : ""}`;
    
    // Cache for 5 minutes (300 seconds)
    const result = await cacheService.getOrSet(
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
              mood: (request.query?.mood as string) || undefined,
            }
          );
        } catch (err) {
          recommendations = undefined;
        }

        return {
          success: true,
          media: mediaResult.media,
          total: mediaResult.total,
          ...(mediaResult.pagination && { pagination: mediaResult.pagination }), // Only include if pagination was used
          recommendations,
        };
      },
      300 // 5 minutes cache
    );

    response.status(200).json(result);
  } catch (error: any) {
    console.error("Fetch public all content error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve all content",
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
        const media = await mediaService.getMediaByIdentifier(id);
        
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
      "../service/fileUpload.service"
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

// Helper function to extract object key from URL
const extractObjectKeyFromUrl = (url: string): string | null => {
  try {
    if (url.includes("/")) {
      const parts = url.split("/");
      return parts.slice(3).join("/"); // Remove domain parts
    }
    return url;
  } catch (error) {
    return null;
  }
};

// Helper function to map content types
const mapContentType = (contentType: string): "video" | "audio" | "image" => {
  switch (contentType) {
    case "videos":
    case "sermon":
      return "video";
    case "audio":
    case "music":
    case "devotional":
      return "audio";
    case "ebook":
    case "books":
      return "image";
    default:
      return "video";
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
      featured: {
        title: "Featured Content",
        subtitle: "Popular gospel content",
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

// Get user's offline downloads
export const getOfflineDownloads = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 20;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const result = await mediaService.getUserOfflineDownloads(
      userId,
      page,
      limit
    );

    response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Get offline downloads error:", error);

    if (error.message.includes("not found")) {
      response.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    response.status(500).json({
      success: false,
      message: "Failed to get offline downloads",
    });
  }
};

// Remove media from offline downloads
export const removeFromOfflineDownloads = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { mediaId } = request.params;
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    await mediaService.removeFromOfflineDownloads(userId, mediaId);

    response.status(200).json({
      success: true,
      message: "Media removed from offline downloads",
    });
  } catch (error: any) {
    console.error("Remove from offline downloads error:", error);

    if (error.message.includes("not found")) {
      response.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    response.status(500).json({
      success: false,
      message: "Failed to remove from offline downloads",
    });
  }
};

/**
 * Extract text from PDF buffer for moderation
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import for pdf-parse (uses ES Module pdfjs-dist)
    const pdfParseModule = await new Function('return import("pdf-parse")')();
    const { PDFParse } = pdfParseModule;

    // Create PDFParse instance
    const pdfParser = new PDFParse({ data: pdfBuffer });

    // Get text result
    const textResult = await pdfParser.getText();

    // Clean up
    await pdfParser.destroy();

    // Extract all text from pages
    let fullText = "";
    if (textResult.pages && textResult.pages.length > 0) {
      // Use per-page text if available
      fullText = textResult.pages
        .map((pageData: any) => pageData.text || "")
        .join("\n");
    } else if (textResult.text) {
      // Fallback: use full text
      fullText = textResult.text;
    }

    // Clean up text (remove excessive whitespace)
    fullText = fullText.replace(/\s+/g, " ").trim();

    // Limit text length for moderation (first 10000 characters should be enough)
    return fullText.substring(0, 10000);
  } catch (error: any) {
    logger.error("Failed to extract text from PDF", { error: error.message });
    throw new Error("Failed to extract text from PDF");
  }
}

/**
 * Extract text from EPUB buffer for moderation
 * EPUB is a ZIP archive containing HTML/XHTML files
 * Note: For now, EPUB extraction is limited - we'll use basic moderation
 * TODO: Add proper EPUB parsing library (e.g., epub2 or jszip)
 */
async function extractTextFromEPUB(epubBuffer: Buffer): Promise<string> {
  try {
    // Try to use jszip if available, otherwise fall back to basic extraction
    let JSZip: any;
    try {
      // Dynamic import with type assertion to handle optional dependency
      JSZip = await import("jszip" as any).catch(() => null);
      if (!JSZip) {
        throw new Error("JSZip not available");
      }
    } catch (importError) {
      logger.warn("JSZip not available, EPUB text extraction will be limited");
      // Return empty string - will fall back to title/description moderation
      return "";
    }

    const zip = new JSZip.default();
    const zipData = await zip.loadAsync(epubBuffer);

    let fullText = "";

    // EPUB structure: content is usually in OEBPS/ or OPS/ folder
    // Look for .html, .xhtml, or .htm files
    const contentFiles: string[] = [];
    
    zipData.forEach((relativePath: string, file: any) => {
      if (
        !file.dir &&
        (relativePath.endsWith(".html") ||
          relativePath.endsWith(".xhtml") ||
          relativePath.endsWith(".htm")) &&
        !relativePath.includes("META-INF") &&
        !relativePath.includes("mimetype")
      ) {
        contentFiles.push(relativePath);
      }
    });

    // Extract text from content files (limit to first 10 files)
    for (const filePath of contentFiles.slice(0, 10)) {
      try {
        const fileContent = await zipData.file(filePath)?.async("string");
        if (fileContent) {
          // Remove HTML tags and extract text
          const textContent = fileContent
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove scripts
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove styles
            .replace(/<[^>]+>/g, " ") // Remove HTML tags
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();
          
          if (textContent) {
            fullText += textContent + "\n";
          }
        }
      } catch (error) {
        logger.warn(`Failed to extract text from EPUB file: ${filePath}`, error);
      }
    }

    // Clean up text
    fullText = fullText.trim();

    if (!fullText) {
      logger.warn("No text extracted from EPUB, will use basic moderation");
      return "";
    }

    // Limit text length for moderation (first 10000 characters should be enough)
    return fullText.substring(0, 10000);
  } catch (error: any) {
    logger.error("Failed to extract text from EPUB", { error: error.message });
    // Return empty string - will fall back to title/description moderation
    return "";
  }
}

/**
 * Pre-upload content verification
 * Processes files in memory, extracts audio/frames, transcribes, and runs moderation
 * Returns moderation result before upload to storage
 */
async function verifyContentBeforeUpload(
  file: Buffer,
  fileMimeType: string,
  contentType: string,
  title: string,
  description?: string
): Promise<{
  isApproved: boolean;
  moderationResult: any;
  transcript?: string;
  videoFrames?: string[];
}> {
  logger.info("Starting pre-upload content verification", {
    contentType,
    fileSize: file.length,
    fileMimeType,
  });

  let transcript = "";
  let videoFrames: string[] = [];

  // For video content, extract audio and frames
  if (contentType === "videos" && fileMimeType.startsWith("video")) {
    try {
      logger.info("Processing video: extracting audio and frames");
      
      // Extract audio for transcription
      const audioResult = await mediaProcessingService.extractAudio(
        file,
        fileMimeType
      );

      // Transcribe audio
      const transcriptionResult = await transcriptionService.transcribeAudio(
        audioResult.audioBuffer,
        "audio/mp3"
      );
      transcript = transcriptionResult.transcript;
      logger.info("Video transcription completed", {
        transcriptLength: transcript.length,
      });

      // Extract video frames
      const framesResult = await mediaProcessingService.extractVideoFrames(
        file,
        fileMimeType,
        3 // Extract 3 key frames
      );
      videoFrames = framesResult.frames;
      logger.info("Video frames extracted", { frameCount: videoFrames.length });
    } catch (error: any) {
      logger.warn("Media processing failed, continuing with basic moderation:", error);
      // Continue with basic moderation (title/description only)
    }
  }

  // For audio/music content, transcribe
  if (
    (contentType === "music" || contentType === "audio") &&
    fileMimeType.startsWith("audio")
  ) {
    try {
      logger.info("Processing audio: transcribing");
      const transcriptionResult = await transcriptionService.transcribeAudio(
        file,
        fileMimeType
      );
      transcript = transcriptionResult.transcript;
      logger.info("Audio transcription completed", {
        transcriptLength: transcript.length,
      });
    } catch (error: any) {
      logger.warn("Transcription failed, continuing with basic moderation:", error);
      // Continue with basic moderation (title/description only)
    }
  }

  // For books/ebooks, extract text from PDF or EPUB
  if (contentType === "books") {
    try {
      logger.info("Processing book: extracting text");
      
      if (fileMimeType === "application/pdf") {
        // Extract text from PDF
        const pdfText = await extractTextFromPDF(file);
        transcript = pdfText;
        logger.info("PDF text extraction completed", {
          textLength: transcript.length,
        });
      } else if (fileMimeType === "application/epub+zip") {
        // Extract text from EPUB
        const epubText = await extractTextFromEPUB(file);
        transcript = epubText;
        logger.info("EPUB text extraction completed", {
          textLength: transcript.length,
        });
      } else {
        logger.warn("Unsupported book file type, continuing with basic moderation");
      }
    } catch (error: any) {
      logger.warn("Book text extraction failed, continuing with basic moderation:", error);
      // Continue with basic moderation (title/description only)
    }
  }

  // Run moderation
  logger.info("Running AI moderation");
  const moderationResult = await contentModerationService.moderateContent({
    transcript: transcript || undefined,
    videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
    title,
    description,
    contentType,
  });

  logger.info("Pre-upload verification completed", {
    isApproved: moderationResult.isApproved,
    requiresReview: moderationResult.requiresReview,
    confidence: moderationResult.confidence,
  });

  return {
    isApproved: moderationResult.isApproved,
    moderationResult,
    transcript: transcript || undefined,
    videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
  };
}

/**
 * Generate AI-powered description for media creation
 * This endpoint helps users generate engaging descriptions for their media content
 */
/**
 * Async function to moderate content after upload
 * This runs in the background and updates the media's moderation status
 * NOTE: This is kept for backward compatibility but is no longer used for new uploads
 */
async function moderateContentAsync(
  mediaId: string,
  mediaData: {
    file: Buffer;
    fileMimeType: string;
    contentType: string;
    title: string;
    description?: string;
  }
): Promise<void> {
  try {
    logger.info("Starting content moderation", { mediaId });

    let transcript = "";
    let videoFrames: string[] = [];

    // For video content, extract audio and frames
    if (mediaData.contentType === "videos" && mediaData.fileMimeType.startsWith("video")) {
      try {
        // Extract audio for transcription
        const audioResult = await mediaProcessingService.extractAudio(
          mediaData.file,
          mediaData.fileMimeType
        );

        // Transcribe audio
        const transcriptionResult = await transcriptionService.transcribeAudio(
          audioResult.audioBuffer,
          "audio/mp3"
        );
        transcript = transcriptionResult.transcript;

        // Extract video frames
        const framesResult = await mediaProcessingService.extractVideoFrames(
          mediaData.file,
          mediaData.fileMimeType,
          3 // Extract 3 key frames
        );
        videoFrames = framesResult.frames;
      } catch (error: any) {
        logger.warn("Media processing failed, continuing with basic moderation:", error);
      }
    }

    // For audio/music content, transcribe
    if (
      (mediaData.contentType === "music" || mediaData.contentType === "audio") &&
      mediaData.fileMimeType.startsWith("audio")
    ) {
      try {
        const transcriptionResult = await transcriptionService.transcribeAudio(
          mediaData.file,
          mediaData.fileMimeType
        );
        transcript = transcriptionResult.transcript;
      } catch (error: any) {
        logger.warn("Transcription failed, continuing with basic moderation:", error);
      }
    }

    // Run moderation
    const moderationResult = await contentModerationService.moderateContent({
      transcript: transcript || undefined,
      videoFrames: videoFrames.length > 0 ? videoFrames : undefined,
      title: mediaData.title,
      description: mediaData.description,
      contentType: mediaData.contentType,
    });

    // Update media with moderation result
    const updateData: any = {
      moderationStatus: moderationResult.isApproved
        ? "approved"
        : moderationResult.requiresReview
        ? "under_review"
        : "rejected",
      moderationResult: {
        ...moderationResult,
        moderatedAt: new Date(),
      },
      isHidden: !moderationResult.isApproved && !moderationResult.requiresReview,
    };

    const media = await Media.findByIdAndUpdate(mediaId, updateData).populate(
      "uploadedBy",
      "firstName lastName email"
    );

    if (!media) {
      logger.error("Media not found after moderation", { mediaId });
      return;
    }

    // Get report count
    const reportCount = await MediaReport.countDocuments({
      mediaId: new Types.ObjectId(mediaId),
      status: "pending",
    });

    // Send notifications
    try {
      // Notify admins if content is rejected or needs review
      if (!moderationResult.isApproved || moderationResult.requiresReview || reportCount > 0) {
        const admins = await User.find({ role: "admin" }).select("email");
        const adminEmails = admins.map(admin => admin.email).filter(Boolean);

        if (adminEmails.length > 0) {
          await resendEmailService.sendAdminModerationAlert(
            adminEmails,
            media.title,
            media.contentType,
            (media.uploadedBy as any)?.email || "Unknown",
            moderationResult,
            reportCount
          );
        }

        // Also send in-app notification to admins
        for (const admin of admins) {
          await NotificationService.createNotification({
            userId: admin._id.toString(),
            type: "moderation_alert",
            title: "Content Moderation Alert",
            message: `Content "${media.title}" requires review`,
            metadata: {
              mediaId: mediaId,
              contentType: media.contentType,
              moderationStatus: updateData.moderationStatus,
              reportCount,
            },
            priority: "high",
            relatedId: mediaId,
          });
        }
      }

      // Notify user if content is rejected
      if (!moderationResult.isApproved && !moderationResult.requiresReview) {
        const uploader = media.uploadedBy as any;
        if (uploader && uploader.email) {
          await resendEmailService.sendContentRemovedEmail(
            uploader.email,
            uploader.firstName || "User",
            media.title,
            moderationResult.reason || "Content violates community guidelines",
            moderationResult.flags || []
          );

          // Send in-app notification
          await NotificationService.createNotification({
            userId: uploader._id.toString(),
            type: "content_removed",
            title: "Content Removed",
            message: `Your content "${media.title}" has been removed`,
            metadata: {
              mediaId: mediaId,
              reason: moderationResult.reason,
              flags: moderationResult.flags,
            },
            priority: "high",
            relatedId: mediaId,
          });
        }
      }
    } catch (emailError: any) {
      logger.error("Failed to send moderation notifications:", emailError);
      // Don't fail moderation if email fails
    }

    logger.info("Content moderation completed", {
      mediaId,
      isApproved: moderationResult.isApproved,
      requiresReview: moderationResult.requiresReview,
    });
  } catch (error: any) {
    logger.error("Content moderation error:", error);
    // On error, set to under_review for manual review
    await Media.findByIdAndUpdate(mediaId, {
      moderationStatus: "under_review",
      isHidden: false,
    });
  }
}

export const generateMediaDescription = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, contentType, category, topics } = request.body;

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      response.status(400).json({
        success: false,
        message: "Title is required",
      });
      return;
    }

    if (
      !contentType ||
      !["music", "videos", "books", "live", "audio", "sermon", "devotional", "ebook", "podcast"].includes(
        contentType
      )
    ) {
      response.status(400).json({
        success: false,
        message:
          "Valid contentType is required (music, videos, books, live, audio, sermon, devotional, ebook, podcast)",
      });
      return;
    }

    // Get user info if authenticated (optional for this endpoint)
    let authorInfo = undefined;
    if (request.userId) {
      try {
        const user = await User.findById(request.userId).select(
          "firstName lastName username avatar"
        );
        if (user) {
          authorInfo = {
            _id: user._id.toString(),
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown Author",
            avatar: user.avatar || undefined,
          };
        }
      } catch (userError) {
        // Non-blocking - continue without author info
        console.log("Could not fetch user info for AI description:", userError);
      }
    }

    // Prepare media content object for AI service
    const mediaContent = {
      _id: "temp-id", // Not needed for generation
      title: title.trim(),
      description: undefined, // No existing description
      contentType: contentType,
      category: category || undefined,
      topics: Array.isArray(topics) ? topics : typeof topics === "string" ? [topics] : undefined,
      authorInfo: authorInfo,
    };

    // Generate description using AI service
    const aiResponse = await aiContentDescriptionService.generateContentDescription(
      mediaContent
    );

    if (!aiResponse.success) {
      // Return fallback description if AI fails
      response.status(200).json({
        success: true,
        description: aiResponse.description || aiContentDescriptionService.getFallbackDescription(mediaContent),
        bibleVerses: aiResponse.bibleVerses || [],
        message: "Description generated (using fallback)",
      });
      return;
    }

    // Return successful AI-generated description
    response.status(200).json({
      success: true,
      description: aiResponse.description,
      bibleVerses: aiResponse.bibleVerses || [],
      enhancedDescription: aiResponse.enhancedDescription,
      message: "Description generated successfully",
    });
  } catch (error: any) {
    console.error("Generate media description error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to generate description",
      error: error.message,
    });
  }
};
