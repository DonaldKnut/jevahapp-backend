import { Request, Response } from "express";
import { Bookmark } from "../models/bookmark.model";
import { Types } from "mongoose";
import { UnifiedBookmarkService } from "../service/unifiedBookmark.service";

/**
 * Get all bookmarked media for the current user
 */
export const getBookmarkedMedia = async (
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

    const { page = 1, limit = 20 } = request.query;
    const skip = (Number(page) - 1) * Number(limit);

    const bookmarks = await Bookmark.find({ user: userId })
      .populate("media")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const bookmarkedMedia = bookmarks.map(bookmark => ({
      ...bookmark.media.toObject(),
      isInLibrary: true,
      bookmarkedBy: userId,
      bookmarkedAt: bookmark.createdAt,
      isDefaultContent: false,
      isOnboardingContent: false,
    }));

    const total = await Bookmark.countDocuments({ user: userId });

    response.status(200).json({
      success: true,
      data: {
        media: bookmarkedMedia,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Fetch bookmarks error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to fetch bookmarked media",
    });
  }
};

/**
 * Add a media item to the user's bookmarks
 */
export const addBookmark = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const mediaId = request.params.mediaId; // Fixed: route uses :mediaId

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

    // Delegate to unified bookmark toggle for idempotent behavior
    const already = await UnifiedBookmarkService.isBookmarked(userId, mediaId);
    const result = already
      ? {
          bookmarked: true,
          bookmarkCount: await UnifiedBookmarkService.getBookmarkCount(mediaId),
        }
      : await UnifiedBookmarkService.toggleBookmark(userId, mediaId);

    response.status(200).json({
      success: true,
      message: "Media saved to library",
      data: result,
    });
  } catch (error: any) {
    console.error("Add bookmark error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to save media",
    });
  }
};

/**
 * Remove a media item from the user's bookmarks
 */
export const removeBookmark = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const mediaId = request.params.mediaId; // Fixed: route uses :mediaId

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

    // Delegate to unified bookmark toggle for idempotent behavior
    const isBookmarked = await UnifiedBookmarkService.isBookmarked(
      userId,
      mediaId
    );

    const result = isBookmarked
      ? await UnifiedBookmarkService.toggleBookmark(userId, mediaId)
      : {
          bookmarked: false,
          bookmarkCount: await UnifiedBookmarkService.getBookmarkCount(mediaId),
        };

    response.status(200).json({
      success: true,
      message: "Media removed from library",
      data: result,
    });
  } catch (error) {
    console.error("Remove bookmark error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to remove bookmark",
    });
  }
};
