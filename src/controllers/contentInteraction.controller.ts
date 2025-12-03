import { Request, Response } from "express";
import { Types } from "mongoose";
import contentInteractionService from "../service/contentInteraction.service";
import logger from "../utils/logger";
import { Bookmark } from "../models/bookmark.model";
import { MediaInteraction } from "../models/mediaInteraction.model";

// Toggle like on any content type
export const toggleContentLike = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const userId = req.userId;

    // Enhanced logging for debugging
    logger.info("Toggle content like request", {
      userId,
      contentId,
      contentType,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    if (!userId) {
      logger.warn("Unauthorized like request - no user ID", {
        contentId,
        contentType,
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      logger.warn("Invalid content ID in like request", {
        userId,
        contentId,
        contentType,
        ip: req.ip,
      });
      res.status(400).json({
        success: false,
        message: "Invalid content ID format",
      });
      return;
    }

    const validContentTypes = [
      "media",
      "devotional",
      "artist",
      "merch",
      "ebook",
      "podcast",
    ];
    if (!contentType || !validContentTypes.includes(contentType)) {
      logger.warn("Invalid content type in like request", {
        userId,
        contentId,
        contentType,
        validTypes: validContentTypes,
        ip: req.ip,
      });
      res.status(400).json({
        success: false,
        message: `Invalid content type. Must be one of: ${validContentTypes.join(", ")}`,
      });
      return;
    }

    const result = await contentInteractionService.toggleLike(
      userId,
      contentId,
      contentType
    );

    logger.info("Toggle content like successful", {
      userId,
      contentId,
      contentType,
      liked: result.liked,
      likeCount: result.likeCount,
    });

    res.status(200).json({
      success: true,
      message: result.liked
        ? "Content liked successfully"
        : "Content unliked successfully",
      data: result,
    });
  } catch (error: any) {
    logger.error("Toggle content like error", {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types with appropriate status codes
    if (
      error.message.includes("not found") ||
      error.message.includes("Content not found")
    ) {
      res.status(404).json({
        success: false,
        message: "Content not found",
      });
      return;
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("Unsupported")
    ) {
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

// Add comment to content
export const addContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
      return;
    }

    if (!contentType || !["media", "devotional"].includes(contentType)) {
      res.status(400).json({
        success: false,
        message: "Comments not supported for this content type",
      });
      return;
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
      return;
    }

    const comment = await contentInteractionService.addComment(
      userId,
      contentId,
      contentType,
      content,
      parentCommentId
    );

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: comment,
    });
  } catch (error: any) {
    logger.error("Add content comment error", {
      error: error.message,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (error.message.includes("not supported")) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to add comment",
    });
  }
};

// Get content metadata for frontend UI
export const getContentMetadata = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const userId = req.userId; // Optional, for user-specific interactions

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
      return;
    }

    if (
      !contentType ||
      !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(
        contentType
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid content type",
      });
      return;
    }

    const metadata = await contentInteractionService.getContentMetadata(
      userId || "",
      contentId,
      contentType
    );

    // Fetch bookmark count if content type supports it
    let bookmarkCount = 0;
    if (["media", "ebook", "podcast", "merch"].includes(contentType)) {
      try {
        bookmarkCount = await Bookmark.countDocuments({
          media: new Types.ObjectId(contentId),
        });
      } catch (error) {
        // Ignore bookmark count errors
      }
    }

    // Check hasViewed status if user is authenticated
    let hasViewed = false;
    if (userId && Types.ObjectId.isValid(userId) && Types.ObjectId.isValid(contentId)) {
      try {
        const view = await MediaInteraction.findOne({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "view",
          isRemoved: { $ne: true },
        })
          .select("_id")
          .lean();
        hasViewed = !!view;
      } catch (error) {
        // Ignore view check errors
      }
    }

    // Transform nested structure to flat structure matching frontend spec
    const flatMetadata = {
      id: metadata.id,
      likeCount: metadata.stats?.likes || 0,
      bookmarkCount: bookmarkCount,
      shareCount: metadata.stats?.shares || 0,
      viewCount: metadata.stats?.views || 0,
      commentCount: metadata.stats?.comments || 0,
      hasLiked: metadata.userInteraction?.hasLiked || false,
      hasBookmarked: metadata.userInteraction?.hasBookmarked || false,
      hasShared: metadata.userInteraction?.hasShared || false,
      hasViewed: hasViewed,
    };

    res.status(200).json({
      success: true,
      data: flatMetadata,
    });
  } catch (error: any) {
    logger.error("Get content metadata error", {
      error: error.message,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to get content metadata",
    });
  }
};

// Record a view/listen/read event with dedupe and thresholding
export const recordContentView = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const { durationMs, progressPct, isComplete } = req.body || {};
    const userId = req.userId; // optional

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }
    const validTypes = [
      "media",
      "devotional",
      "artist",
      "merch",
      "ebook",
      "podcast",
    ];
    if (!contentType || !validTypes.includes(contentType)) {
      res.status(400).json({ success: false, message: "Invalid content type" });
      return;
    }

    // Delegate to service method (reuse contentInteractionService responsibilities)
    const { default: contentService } = await import(
      "../service/contentView.service"
    );
    const result = await contentService.recordView({
      userId: userId || undefined,
      contentId,
      contentType: contentType as any,
      durationMs: typeof durationMs === "number" ? durationMs : undefined,
      progressPct: typeof progressPct === "number" ? progressPct : undefined,
      isComplete: !!isComplete,
      ip: req.ip,
      userAgent: req.get("User-Agent") || "",
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Record content view error", {
      error: error.message,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });
    res.status(500).json({ success: false, message: "Failed to record view" });
  }
};

// Batch metadata for multiple content IDs
export const getBatchContentMetadata = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    const { contentIds, contentType } = req.body || {};

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "contentIds must be a non-empty array",
      });
      return;
    }

    if (
      contentType &&
      !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(
        contentType
      )
    ) {
      res.status(400).json({ success: false, message: "Invalid content type" });
      return;
    }

    const data = await contentInteractionService.getBatchContentMetadata(
      userId,
      contentIds,
      contentType || "media"
    );

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error("Batch content metadata error", {
      error: error.message,
      userId: req.userId,
    });
    res
      .status(500)
      .json({ success: false, message: "Failed to get batch metadata" });
  }
};

// Remove comment
export const removeContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
      return;
    }

    await contentInteractionService.removeContentComment(commentId, userId);

    res.status(200).json({
      success: true,
      message: "Comment removed successfully",
    });
  } catch (error: any) {
    logger.error("Remove content comment error", {
      error: error.message,
      userId: req.userId,
      commentId: req.params.commentId,
    });

    if (
      error.message.includes("not found") ||
      error.message.includes("permission")
    ) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to remove comment",
    });
  }
};

// Get comments for content
export const getContentComments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = req.query.sortBy as string as any;

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
      return;
    }

    if (!contentType || !["media", "devotional"].includes(contentType)) {
      res.status(400).json({
        success: false,
        message: "Comments not supported for this content type",
      });
      return;
    }

    const result = await contentInteractionService.getContentComments(
      contentId,
      contentType,
      page,
      limit,
      sortBy === "oldest" || sortBy === "top" ? sortBy : "newest"
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Get content comments error", {
      error: error.message,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get comments",
    });
  }
};

// Get replies for a comment
export const getCommentReplies = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    const data = await contentInteractionService.getCommentReplies(
      commentId,
      page,
      limit
    );

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error("Get comment replies error", { error: error.message });
    res
      .status(500)
      .json({ success: false, message: "Failed to get comment replies" });
  }
};

// Edit comment
export const editContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }
    if (!content || content.trim().length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Comment content is required" });
      return;
    }

    const updated = await contentInteractionService.editContentComment(
      commentId,
      userId,
      content
    );
    res
      .status(200)
      .json({ success: true, message: "Comment updated", data: updated });
  } catch (error: any) {
    logger.error("Edit comment error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to edit comment" });
  }
};

// Report comment
export const reportContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body || {};
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    const result = await contentInteractionService.reportContentComment(
      commentId,
      userId,
      reason
    );
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Report comment error", { error: error.message });
    res
      .status(500)
      .json({ success: false, message: "Failed to report comment" });
  }
};

// Hide comment (moderator/admin)
export const hideContentComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body || {};
    const userId = req.userId;
    const role = req.user?.role;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }
    if (!role || !["admin", "moderator"].includes(role as any)) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    await contentInteractionService.moderateHideComment(
      commentId,
      userId,
      reason
    );
    res.status(200).json({ success: true, message: "Comment hidden" });
  } catch (error: any) {
    logger.error("Hide comment error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to hide comment" });
  }
};

// Share content
export const shareContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const { platform, message } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
      return;
    }

    if (
      !contentType ||
      !["media", "devotional", "artist", "merch", "ebook", "podcast"].includes(
        contentType
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid content type",
      });
      return;
    }

    // For now, we'll use the existing share service
    // TODO: Extend this to support all content types
    const { default: shareService } = await import("../service/share.service");

    const shareUrls = await shareService.generateSocialShareUrls(
      contentId,
      message
    );

    res.status(200).json({
      success: true,
      message: "Content shared successfully",
      data: {
        shareUrls,
        platform,
        contentType,
      },
    });
  } catch (error: any) {
    logger.error("Share content error", {
      error: error.message,
      userId: req.userId,
      contentId: req.params.contentId,
      contentType: req.params.contentType,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to share content",
    });
  }
};
