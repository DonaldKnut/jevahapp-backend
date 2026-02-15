import { Request, Response } from "express";
import { Types } from "mongoose";
import { UnifiedBookmarkService } from "../service/unifiedBookmark.service";
import logger from "../utils/logger";

/**
 * Toggle bookmark status (save/unsave)
 */
export const toggleBookmark = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const userId = req.userId;

    // Enhanced logging for debugging
    logger.info("Toggle bookmark request", {
      userId,
      mediaId,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    if (!userId) {
      logger.warn("Unauthorized bookmark request - no user ID", {
        mediaId,
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      logger.warn("Invalid media ID in bookmark request", {
        userId,
        mediaId,
        ip: req.ip,
      });
      res.status(400).json({
        success: false,
        message: "Invalid media ID format",
      });
      return;
    }

    const result = await UnifiedBookmarkService.toggleBookmark(userId, mediaId);

    // Send real-time notification via Socket.IO
    try {
      const io = require("../socket/socketManager").getIO();
      if (io) {
        io.emit("content-bookmark-update", {
          mediaId,
          bookmarkCount: result.bookmarkCount,
          userBookmarked: result.bookmarked,
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (socketError) {
      logger.warn("Failed to send real-time bookmark update", {
        error: socketError,
        mediaId,
      });
    }

    logger.info("Toggle bookmark successful", {
      userId,
      mediaId,
      bookmarked: result.bookmarked,
      bookmarkCount: result.bookmarkCount,
    });

    res.status(200).json({
      success: true,
      message: result.bookmarked
        ? "Media saved to library successfully"
        : "Media removed from library successfully",
      data: result,
    });
  } catch (error: any) {
    logger.error("Toggle bookmark error", {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      mediaId: req.params.mediaId,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types with appropriate status codes
    if (
      error.message.includes("not found") ||
      error.message.includes("Media not found")
    ) {
      res.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    if (error.message.includes("Invalid")) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // Default to 500 for unexpected errors
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred while processing your request",
    });
  }
};

/**
 * Get bookmark status for media
 */
export const getBookmarkStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const userId = req.userId;

    logger.info("Get bookmark status request", {
      userId,
      mediaId,
      ip: req.ip,
    });

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      res.status(400).json({
        success: false,
        message: "Invalid media ID format",
      });
      return;
    }

    const isBookmarked = await UnifiedBookmarkService.isBookmarked(
      userId,
      mediaId
    );
    const bookmarkCount =
      await UnifiedBookmarkService.getBookmarkCount(mediaId);

    res.status(200).json({
      success: true,
      data: {
        isBookmarked,
        bookmarkCount,
      },
    });
  } catch (error: any) {
    logger.error("Get bookmark status error", {
      error: error.message,
      userId: req.userId,
      mediaId: req.params.mediaId,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get bookmark status",
    });
  }
};

/**
 * Get user's bookmarked media
 */
export const getUserBookmarks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    logger.info("Get user bookmarks request", {
      userId,
      page,
      limit,
      ip: req.ip,
    });

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
      return;
    }

    const result = await UnifiedBookmarkService.getUserBookmarks(
      userId,
      page,
      limit
    );

    res.status(200).json({
      success: true,
      data: {
        bookmarks: result.bookmarks,
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error: any) {
    logger.error("Get user bookmarks error", {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });

    // Provide more specific error messages
    if (error.message.includes("Invalid user ID")) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
      return;
    }

    if (
      error.message.includes("database") ||
      error.message.includes("connection")
    ) {
      res.status(503).json({
        success: false,
        message: "Database temporarily unavailable. Please try again later.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to get user bookmarks",
    });
  }
};

/**
 * Get bookmark statistics for media
 */
export const getBookmarkStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { mediaId } = req.params;

    logger.info("Get bookmark stats request", {
      mediaId,
      ip: req.ip,
    });

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      res.status(400).json({
        success: false,
        message: "Invalid media ID format",
      });
      return;
    }

    const stats = await UnifiedBookmarkService.getBookmarkStats(mediaId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error("Get bookmark stats error", {
      error: error.message,
      mediaId: req.params.mediaId,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get bookmark statistics",
    });
  }
};

/**
 * Bulk bookmark operations
 */
export const bulkBookmark = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const { mediaIds, action } = req.body;

    logger.info("Bulk bookmark request", {
      userId,
      mediaIds,
      action,
      ip: req.ip,
    });

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "mediaIds must be a non-empty array",
      });
      return;
    }

    if (!action || !["add", "remove"].includes(action)) {
      res.status(400).json({
        success: false,
        message: "action must be 'add' or 'remove'",
      });
      return;
    }

    if (mediaIds.length > 50) {
      res.status(400).json({
        success: false,
        message: "Cannot process more than 50 media items at once",
      });
      return;
    }

    const result = await UnifiedBookmarkService.bulkBookmark(
      userId,
      mediaIds,
      action
    );

    res.status(200).json({
      success: true,
      message: `Bulk ${action} operation completed`,
      data: result,
    });
  } catch (error: any) {
    logger.error("Bulk bookmark error", {
      error: error.message,
      userId: req.userId,
    });

    res.status(500).json({
      success: false,
      message: "Failed to perform bulk bookmark operation",
    });
  }
};
