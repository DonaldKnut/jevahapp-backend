import { Request, Response } from "express";
import { Types } from "mongoose";
import commentService from "./comment.service";
import logger from "../../../utils/logger";
import { publishEngagementEvent } from "../../../lib/engagementEvents";
import { ReportReason } from "../../../models/mediaReport.model";
import { notifyAdminsOfCommentReport } from "./comment.reportNotify";

const COMMENT_CONTENT_TYPES = ["media", "devotional", "ebook", "podcast"] as const;

function requireUser(req: Request, res: Response): string | null {
  if (!req.userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.userId;
}

export const addContentComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { contentId, contentType } = req.params;
    const { content, parentCommentId } = req.body;

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }
    if (!contentType || !COMMENT_CONTENT_TYPES.includes(contentType as any)) {
      res.status(400).json({ success: false, message: "Comments not supported for this content type" });
      return;
    }
    if (!content?.trim()) {
      res.status(400).json({ success: false, message: "Comment content is required" });
      return;
    }

    const comment = await commentService.addComment(
      userId,
      contentId,
      contentType,
      content,
      parentCommentId
    );

    res.status(201).json({ success: true, message: "Comment added successfully", data: comment });
  } catch (error: any) {
    logger.error("Add content comment error", { error: error.message });
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes("not supported") || error.message.includes("required")) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to add comment" });
  }
};

export const removeContentComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { commentId } = req.params;
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    await commentService.removeContentComment(commentId, userId);
    res.status(200).json({ success: true, message: "Comment removed successfully" });
  } catch (error: any) {
    logger.error("Remove content comment error", { error: error.message });
    if (error.message.includes("not found") || error.message.includes("permission")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to remove comment" });
  }
};

/** Legacy alias — /api/interactions/comments/:commentId */
export const removeComment = removeContentComment;

export const editContentComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { commentId } = req.params;
    const { content } = req.body;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }
    if (!content?.trim()) {
      res.status(400).json({ success: false, message: "Comment content is required" });
      return;
    }

    const updated = await commentService.editContentComment(commentId, userId, content);
    res.status(200).json({ success: true, message: "Comment updated", data: updated });
  } catch (error: any) {
    logger.error("Edit comment error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to edit comment" });
  }
};

export const toggleCommentReaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { commentId } = req.params;
    const { reactionType = "like" } = req.body;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    const result = await commentService.toggleCommentReaction(commentId, userId, reactionType);
    res.status(200).json({
      success: true,
      data: { liked: result.liked, totalLikes: result.totalLikes },
    });
  } catch (error: any) {
    logger.error("Toggle comment reaction error", { error: error.message });
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to toggle comment reaction" });
  }
};

/** Legacy alias — /api/interactions/comments/:commentId/reaction */
export const addCommentReaction = toggleCommentReaction;

const VALID_REPORT_REASONS: ReportReason[] = [
  "inappropriate_content",
  "non_gospel_content",
  "explicit_language",
  "violence",
  "sexual_content",
  "blasphemy",
  "spam",
  "copyright",
  "other",
];

export const reportContentComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { commentId } = req.params;
    const { reason, description } = req.body as { reason?: ReportReason; description?: string };

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    const reportReason = reason || "other";
    if (!VALID_REPORT_REASONS.includes(reportReason)) {
      res.status(400).json({ success: false, message: "Invalid report reason" });
      return;
    }

    const result = await commentService.reportContentComment(commentId, userId, reportReason);

    publishEngagementEvent("comment.reported", {
      userId,
      commentId,
      reason: reportReason,
      reportCount: result.reportCount,
    });

    notifyAdminsOfCommentReport({
      commentId,
      reporterUserId: userId,
      reportReason,
      description,
      result,
    });

    res.status(200).json({
      success: true,
      message: "Comment reported successfully",
      data: { reportCount: result.reportCount, commentId },
    });
  } catch (error: any) {
    logger.error("Report comment error", { error: error.message });
    if (error.message === "You cannot report your own comment") {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (error.message === "You have already reported this comment") {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (error.message === "Comment not found" || error.message === "Invalid comment ID") {
      res.status(404).json({ success: false, message: "Comment not found" });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to report comment" });
  }
};

export const hideContentComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { commentId } = req.params;
    const { reason } = req.body || {};
    const role = req.user?.role;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }
    if (!role || !["admin", "moderator"].includes(role as string)) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    await commentService.moderateHideComment(commentId, userId, reason);
    res.status(200).json({ success: true, message: "Comment hidden" });
  } catch (error: any) {
    logger.error("Hide comment error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to hide comment" });
  }
};
