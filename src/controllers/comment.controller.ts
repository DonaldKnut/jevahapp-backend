import { Request, Response } from "express";
import { Types } from "mongoose";
import CommentService from "../service/comment.service";
import logger from "../utils/logger";

/**
 * Create a comment
 * POST /api/comments
 */
export const createComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { contentId, contentType, content, parentCommentId } = req.body;

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID",
      });
      return;
    }

    // Accept ebook and podcast for backwards compatibility (they're normalized to "media" internally)
    if (!contentType || !["media", "devotional", "ebook", "podcast"].includes(contentType)) {
      res.status(400).json({
        success: false,
        message: "Invalid content type. Supported: media, devotional, ebook, podcast",
      });
      return;
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
      return;
    }

    if (content.trim().length > 1000) {
      res.status(400).json({
        success: false,
        message: "Comment must be less than 1000 characters",
      });
      return;
    }

    const comment = await CommentService.createComment({
      userId,
      contentId,
      contentType,
      content,
      parentCommentId,
    });

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: comment,
    });
  } catch (error: any) {
    // Enhanced error logging for debugging 500 errors
    logger.error("Create comment error", {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      contentId: req.body.contentId,
      contentType: req.body.contentType,
      parentCommentId: req.body.parentCommentId,
      contentLength: req.body.content?.length,
      timestamp: new Date().toISOString(),
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("required") ||
      error.message.includes("must be less than")
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // More descriptive 500 error message
    res.status(500).json({
      success: false,
      message: "Failed to create comment. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update a comment (owner only)
 * PUT /api/comments/:commentId
 */
export const updateComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { commentId } = req.params;
    const { content } = req.body;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
      return;
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
      return;
    }

    if (content.trim().length > 1000) {
      res.status(400).json({
        success: false,
        message: "Comment must be less than 1000 characters",
      });
      return;
    }

    const comment = await CommentService.updateComment({
      commentId,
      userId,
      content,
    });

    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: comment,
    });
  } catch (error: any) {
    logger.error("Update comment error", {
      error: error.message,
      userId: req.userId,
      commentId: req.params.commentId,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (error.message.includes("only edit your own")) {
      res.status(403).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (
      error.message.includes("Invalid") ||
      error.message.includes("required") ||
      error.message.includes("must be less than")
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to update comment",
    });
  }
};

/**
 * Delete a comment (owner only)
 * DELETE /api/comments/:commentId
 */
export const deleteComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { commentId } = req.params;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
      return;
    }

    await CommentService.deleteComment(commentId, userId);

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error: any) {
    logger.error("Delete comment error", {
      error: error.message,
      userId: req.userId,
      commentId: req.params.commentId,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (error.message.includes("only delete your own")) {
      res.status(403).json({
        success: false,
        message: error.message,
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

    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
    });
  }
};

/**
 * Like/Unlike a comment
 * POST /api/comments/:commentId/like
 */
export const toggleCommentLike = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { commentId } = req.params;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid comment ID",
      });
      return;
    }

    const result = await CommentService.toggleLike(commentId, userId);

    res.status(200).json({
      success: true,
      message: result.liked ? "Comment liked" : "Comment unliked",
      data: {
        liked: result.liked,
        likesCount: result.totalLikes,
      },
    });
  } catch (error: any) {
    logger.error("Toggle comment like error", {
      error: error.message,
      userId: req.userId,
      commentId: req.params.commentId,
    });

    if (error.message.includes("not found")) {
      res.status(404).json({
        success: false,
        message: error.message,
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

    res.status(500).json({
      success: false,
      message: "Failed to toggle comment like",
    });
  }
};

