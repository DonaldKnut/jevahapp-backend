import { Request, Response } from "express";
import { mediaService } from "../../service/media.service";
import { Bookmark } from "../../models/bookmark.model";
import logger from "../../utils/logger";

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
    logger.error("Analytics error", { error: error?.message });
    response.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
    });
  }
};
