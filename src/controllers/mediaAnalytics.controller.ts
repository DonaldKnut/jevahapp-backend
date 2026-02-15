import { Request, Response } from "express";
import MediaAnalyticsService, {
  PerMediaAnalytics,
  CreatorMediaAnalytics,
} from "../service/mediaAnalytics.service";
import logger from "../utils/logger";

/**
 * Get detailed analytics for a specific media item
 * Similar to Twitter/X post analytics - shows views, likes, shares, engagement rate, etc.
 */
export const getMediaAnalytics = async (
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

    if (!mediaId) {
      response.status(400).json({
        success: false,
        message: "Media ID is required",
      });
      return;
    }

    // Parse optional time range from query params
    const startDate = request.query.startDate
      ? new Date(request.query.startDate as string)
      : undefined;
    const endDate = request.query.endDate
      ? new Date(request.query.endDate as string)
      : undefined;

    const timeRange =
      startDate && endDate
        ? { startDate, endDate }
        : undefined;

    const analytics = await MediaAnalyticsService.getMediaAnalytics(
      mediaId,
      userId,
      timeRange
    );

    response.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error("Get media analytics error:", error);
    
    if (error.message === "Media not found") {
      response.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    if (error.message.includes("Unauthorized")) {
      response.status(403).json({
        success: false,
        message: error.message,
      });
      return;
    }

    response.status(500).json({
      success: false,
      message: "Failed to retrieve media analytics",
      error: error.message,
    });
  }
};

/**
 * Get comprehensive analytics for all media by a creator
 * Similar to Twitter/X creator analytics dashboard
 */
export const getCreatorAnalytics = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    // Parse optional time range from query params
    const startDate = request.query.startDate
      ? new Date(request.query.startDate as string)
      : undefined;
    const endDate = request.query.endDate
      ? new Date(request.query.endDate as string)
      : undefined;

    const timeRange =
      startDate && endDate
        ? { startDate, endDate }
        : undefined;

    const analytics = await MediaAnalyticsService.getCreatorAnalytics(
      userId,
      timeRange
    );

    response.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    logger.error("Get creator analytics error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve creator analytics",
      error: error.message,
    });
  }
};


