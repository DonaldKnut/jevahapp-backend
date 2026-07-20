import { Request, Response } from "express";
import { Types } from "mongoose";
import { mediaService } from "../../service/media.service";
import { Bookmark } from "../../models/bookmark.model";
import { incrPostCounter } from "../../lib/redisCounters";
import { enqueueAnalyticsEvent } from "../../queues/enqueue";
import logger from "../../utils/logger";
import {
  InteractionRequestBody,
  ShareRequestBody,
  UserActionRequestBody,
} from "./shared";

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
    logger.error("Bookmark media error", { error: error?.message });
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
      incrPostCounter({ postId: id, field: "views", delta: 1 }).catch(() => { });
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
    logger.error("Record media interaction error", { error: error?.message });
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

/**
 * @deprecated Prefer POST /api/content/media/:contentId/view
 * Redirects Redis-first view tracking to Mongo-authoritative contentView.service.
 */
export const trackViewWithDuration = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const { mediaId, duration, isComplete, progressPct } = request.body;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
      return;
    }

    if (!mediaId || typeof duration !== "number") {
      response.status(400).json({
        success: false,
        message: "Missing required fields: mediaId, duration",
      });
      return;
    }

    const viewService = (await import("../../modules/engagement/view/view.service")).default;
    // Legacy clients often send seconds; contentView thresholds are in ms
    const durationMs = duration < 1000 ? duration * 1000 : duration;
    const result = await viewService.recordView({
      userId,
      contentId: mediaId,
      contentType: "media",
      durationMs,
      progressPct,
      isComplete: !!isComplete,
      source: "legacy:trackViewWithDuration",
      ip: request.ip,
      userAgent: request.get("User-Agent"),
    });

    enqueueAnalyticsEvent({
      name: "media_view_duration",
      payload: {
        userId,
        mediaId,
        duration,
        isComplete: !!isComplete,
        counted: result.counted,
        createdAt: new Date().toISOString(),
      },
      requestId: (request as any).requestId,
    });

    response.status(200).json({
      success: true,
      deprecated: true,
      successor: "POST /api/content/media/:contentId/view",
      data: {
        countedAsView: result.counted,
        viewCount: result.viewCount,
        hasViewed: result.hasViewed,
        duration,
        isComplete: !!isComplete,
      },
    });
  } catch (error: any) {
    logger.error("Track view error", {
      error: error.message,
      userId: request.userId,
      mediaId: request.body?.mediaId,
    });
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
