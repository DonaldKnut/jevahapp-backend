import { Request, Response } from "express";
import aiReengagementService from "../service/aiReengagement.service";
import logger from "../utils/logger";

/**
 * Get re-engagement analytics (Admin only)
 */
export const getReEngagementAnalytics = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const analytics = await aiReengagementService.getReEngagementAnalytics();

    response.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error("Get re-engagement analytics error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get re-engagement analytics",
    });
  }
};

/**
 * Manually trigger re-engagement for a user (Admin only)
 */
export const triggerReEngagement = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { userId } = request.params;

    if (!userId) {
      response.status(400).json({
        success: false,
        message: "User ID is required",
      });
      return;
    }

    await aiReengagementService.trackUserSignout(userId);

    response.status(200).json({
      success: true,
      message: "Re-engagement campaign triggered successfully",
    });
  } catch (error) {
    logger.error("Trigger re-engagement error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to trigger re-engagement",
    });
  }
};

/**
 * Track user return manually (for testing)
 */
export const trackUserReturn = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "User ID not found",
      });
      return;
    }

    await aiReengagementService.trackUserReturn(userId);

    response.status(200).json({
      success: true,
      message: "User return tracked successfully",
    });
  } catch (error) {
    logger.error("Track user return error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to track user return",
    });
  }
};

/**
 * Get user's re-engagement status
 */
export const getUserReEngagementStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;

    // This would typically come from a separate re-engagement campaigns collection
    // For now, we'll return basic info from user model
    const user = await import("../models/user.model").then(m =>
      m.User.findById(userId)
    );

    if (!user) {
      response.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const status = {
      lastSignOutAt: user.lastSignOutAt,
      lastReturnAt: user.lastReturnAt,
      totalSessions: user.totalSessions,
      returnCount: user.returnCount,
      hasActiveReEngagement:
        user.lastSignOutAt &&
        (!user.lastReturnAt || user.lastSignOutAt > user.lastReturnAt),
    };

    response.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error("Get user re-engagement status error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get re-engagement status",
    });
  }
};
