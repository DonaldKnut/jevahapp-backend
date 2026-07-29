import { Request, Response } from "express";
import { Types } from "mongoose";
import commentService from "./comment.service";
import logger from "../../../utils/logger";
import { publishEngagementEvent } from "../../../lib/engagementEvents";
import { ReportReason } from "../../../models/mediaReport.model";
import { notifyAdminsOfCommentReport } from "./comment.reportNotify";
import { assertCommentableContentType } from "../shared/contentType.resolver";
import { parseMentionsInput } from "./comment.mentions";
import {
  uploadCommentImageBuffer,
  ensureJevahCommentImageUrl,
} from "./comment.upload";
import { isCommentError } from "./comment.errors";

function requireUser(req: Request, res: Response): string | null {
  if (!req.userId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.userId;
}

function sendCommentError(res: Response, error: unknown): boolean {
  if (!isCommentError(error)) return false;
  res.status(error.status).json({
    success: false,
    message: error.message,
    code: error.code,
  });
  return true;
}

export const addContentComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { contentId, contentType } = req.params;
    const body = req.body || {};
    const content = typeof body.content === "string" ? body.content : body.content ?? "";
    const parentCommentId = body.parentCommentId;
    const mentions = parseMentionsInput(body.mentions);
    let imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    const file = req.file as Express.Multer.File | undefined;
    if (file) {
      imageUrl = await uploadCommentImageBuffer(file);
    } else if (imageUrl) {
      imageUrl = ensureJevahCommentImageUrl(imageUrl);
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }
    let resolved: string;
    try {
      resolved = assertCommentableContentType(contentType);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err?.message || "Comments not supported for this content type",
      });
      return;
    }

    const text = typeof content === "string" ? content : String(content || "");
    if (!text.trim() && !imageUrl) {
      res.status(400).json({
        success: false,
        message: "Comment content is required (or attach an image)",
      });
      return;
    }

    const parent =
      parentCommentId && Types.ObjectId.isValid(String(parentCommentId))
        ? String(parentCommentId)
        : undefined;

    const comment = await commentService.addComment(
      userId,
      contentId,
      resolved,
      text,
      parent,
      { imageUrl: imageUrl || undefined, mentions }
    );

    res.status(201).json({ success: true, message: "Comment added successfully", data: comment });
  } catch (error: any) {
    logger.error("Add content comment error", { error: error.message, code: error.code });
    if (sendCommentError(res, error)) return;
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
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
    logger.error("Remove content comment error", { error: error.message, code: error.code });
    if (sendCommentError(res, error)) return;
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
    const body = req.body || {};

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    let imageUrl =
      typeof body.imageUrl === "string" ? body.imageUrl.trim() : undefined;
    const clearImage =
      body.clearImage === true ||
      String(body.clearImage || "").toLowerCase() === "true";

    const file = req.file as Express.Multer.File | undefined;
    if (file) {
      imageUrl = await uploadCommentImageBuffer(file);
    }

    const contentProvided = Object.prototype.hasOwnProperty.call(body, "content");
    const mentionsProvided = Object.prototype.hasOwnProperty.call(body, "mentions");
    const options: {
      content?: string;
      imageUrl?: string;
      clearImage?: boolean;
      mentions?: ReturnType<typeof parseMentionsInput>;
    } = {};
    if (contentProvided) {
      options.content = typeof body.content === "string" ? body.content : "";
    }
    if (clearImage) options.clearImage = true;
    else if (imageUrl !== undefined) options.imageUrl = imageUrl;
    if (mentionsProvided) {
      options.mentions = parseMentionsInput(body.mentions);
    }

    if (
      !contentProvided &&
      !clearImage &&
      imageUrl === undefined &&
      !mentionsProvided
    ) {
      res.status(400).json({
        success: false,
        message: "Provide content, image, imageUrl, mentions, and/or clearImage",
      });
      return;
    }

    const updated = await commentService.editContentComment(
      commentId,
      userId,
      options
    );
    res.status(200).json({ success: true, message: "Comment updated", data: updated });
  } catch (error: any) {
    logger.error("Edit comment error", { error: error.message, code: error.code });
    if (sendCommentError(res, error)) return;
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
    logger.error("Toggle comment reaction error", { error: error.message, code: error.code });
    if (sendCommentError(res, error)) return;
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
    logger.error("Report comment error", { error: error.message, code: error.code });
    if (sendCommentError(res, error)) return;
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
