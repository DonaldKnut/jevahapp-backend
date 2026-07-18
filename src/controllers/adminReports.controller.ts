import { Request, Response } from "express";
import { Types } from "mongoose";
import { MediaReport } from "../models/mediaReport.model";
import { Interaction } from "../models/interaction.model";
import { AuditService } from "../service/audit.service";
import commentService from "../modules/engagement/comments/comment.service";
import {
  reviewReport,
  deleteReportedMedia,
} from "./mediaReport.controller";
import logger from "../utils/logger";

/**
 * Unified reports inbox — media + comments
 * GET /api/admin/reports?type=media|comment|all&status=&page=&limit=
 */
export const listAdminReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = ((req.query.type as string) || "all").toLowerCase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = (req.query.status as string) || "pending";

    if (!["media", "comment", "all"].includes(type)) {
      res.status(400).json({
        success: false,
        message: "type must be media, comment, or all",
      });
      return;
    }

    const items: Array<{
      kind: "media" | "comment";
      id: string;
      createdAt?: Date;
      [key: string]: unknown;
    }> = [];

    if (type === "media" || type === "all") {
      const mediaFilter: Record<string, unknown> = {};
      if (status !== "all") {
        mediaFilter.status = status;
      }
      const mediaReports = await MediaReport.find(mediaFilter)
        .populate(
          "mediaId",
          "title contentType thumbnailUrl uploadedBy moderationStatus isHidden reportCount"
        )
        .populate("reportedBy", "firstName lastName username email")
        .sort({ createdAt: -1 })
        .skip(type === "media" ? skip : 0)
        .limit(type === "media" ? limit : Math.min(limit, 50))
        .lean();

      for (const r of mediaReports as any[]) {
        items.push({
          kind: "media",
          id: r._id.toString(),
          status: r.status,
          reason: r.reason,
          description: r.description,
          media: r.mediaId
            ? {
                id: r.mediaId._id?.toString?.() || r.mediaId.toString(),
                title: r.mediaId.title,
                contentType: r.mediaId.contentType,
                thumbnailUrl: r.mediaId.thumbnailUrl,
                moderationStatus: r.mediaId.moderationStatus,
                isHidden: r.mediaId.isHidden,
                reportCount: r.mediaId.reportCount,
              }
            : null,
          reporter: r.reportedBy
            ? {
                id: r.reportedBy._id?.toString?.() || r.reportedBy.toString(),
                firstName: r.reportedBy.firstName,
                lastName: r.reportedBy.lastName,
                username: r.reportedBy.username,
                email: r.reportedBy.email,
              }
            : null,
          createdAt: r.createdAt,
        });
      }
    }

    if (type === "comment" || type === "all") {
      const hiddenParam = req.query.hidden as string | undefined;
      const hidden =
        hiddenParam === "true" ? true : hiddenParam === "false" ? false : undefined;
      const commentResult = await commentService.listReportedComments({
        page: type === "comment" ? page : 1,
        limit: type === "comment" ? limit : Math.min(limit, 50),
        hidden,
      });
      for (const c of commentResult.comments) {
        items.push({
          kind: "comment",
          id: c.id,
          status: c.isHidden ? "hidden" : "reported",
          reportCount: c.reportCount,
          content: c.content,
          author: c.author,
          media: c.media,
          isHidden: c.isHidden,
          createdAt: c.createdAt,
        });
      }
    }

    if (type === "all") {
      items.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      const paged = items.slice(skip, skip + limit);
      const [mediaTotal, commentTotal] = await Promise.all([
        status === "all"
          ? MediaReport.countDocuments()
          : MediaReport.countDocuments({ status }),
        Interaction.countDocuments({
          interactionType: "comment",
          isRemoved: { $ne: true },
          reportCount: { $gte: 1 },
        }),
      ]);
      res.status(200).json({
        success: true,
        data: {
          items: paged,
          pagination: {
            page,
            limit,
            total: mediaTotal + commentTotal,
            pages: Math.ceil((mediaTotal + commentTotal) / limit) || 1,
          },
          counts: { media: mediaTotal, comments: commentTotal },
        },
      });
      return;
    }

    if (type === "media") {
      const total =
        status === "all"
          ? await MediaReport.countDocuments()
          : await MediaReport.countDocuments({ status });
      res.status(200).json({
        success: true,
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit) || 1,
          },
        },
      });
      return;
    }

    const commentOnly = await commentService.listReportedComments({
      page,
      limit,
      hidden:
        req.query.hidden === "true"
          ? true
          : req.query.hidden === "false"
            ? false
            : undefined,
    });
    res.status(200).json({
      success: true,
      data: {
        items: commentOnly.comments.map(c => ({ kind: "comment" as const, ...c })),
        pagination: commentOnly.pagination,
      },
    });
  } catch (error: any) {
    logger.error("List admin reports error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list reports" });
  }
};

/**
 * GET /api/admin/reports/media/:reportId
 */
export const getAdminMediaReportDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { reportId } = req.params;
    if (!Types.ObjectId.isValid(reportId)) {
      res.status(400).json({ success: false, message: "Invalid report ID" });
      return;
    }

    const report = await MediaReport.findById(reportId)
      .populate(
        "mediaId",
        "title description contentType thumbnailUrl fileUrl uploadedBy moderationStatus isHidden reportCount likeCount viewCount"
      )
      .populate("reportedBy", "firstName lastName username email avatar")
      .populate("reviewedBy", "firstName lastName username email")
      .lean();

    if (!report) {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    const media = (report as any).mediaId;
    let uploader = null;
    if (media?.uploadedBy) {
      const { User } = await import("../models/user.model");
      uploader = await User.findById(media.uploadedBy)
        .select("firstName lastName username email avatar role")
        .lean();
    }

    const siblingReports = await MediaReport.find({
      mediaId: media?._id || (report as any).mediaId,
    })
      .select("reason status createdAt reportedBy")
      .populate("reportedBy", "firstName lastName username")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        report,
        uploader,
        siblingReports,
      },
    });
  } catch (error: any) {
    logger.error("Get admin media report detail error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to get report detail" });
  }
};

export const reviewAdminMediaReport = reviewReport;
export const deleteAdminReportedMedia = deleteReportedMedia;

/** GET /api/admin/reports/comments */
export const listAdminCommentReports = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const hidden =
      req.query.hidden === "true"
        ? true
        : req.query.hidden === "false"
          ? false
          : undefined;

    const result = await commentService.listReportedComments({ page, limit, hidden });
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("List comment reports error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list comment reports" });
  }
};

/** POST /api/admin/reports/comments/:commentId/hide */
export const hideAdminComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { commentId } = req.params;
    const { reason } = req.body || {};
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    await commentService.moderateHideComment(commentId, userId, reason);
    await AuditService.logAdminAction(userId, "hide_comment", undefined, {
      commentId,
      reason,
    });
    res.status(200).json({ success: true, message: "Comment hidden" });
  } catch (error: any) {
    logger.error("Admin hide comment error", { error: error.message });
    if (error.message === "Comment not found") {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to hide comment" });
  }
};

/** POST /api/admin/reports/comments/:commentId/unhide */
export const unhideAdminComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { commentId } = req.params;
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    await commentService.moderateUnhideComment(commentId);
    await AuditService.logAdminAction(userId, "unhide_comment", undefined, { commentId });
    res.status(200).json({ success: true, message: "Comment unhidden" });
  } catch (error: any) {
    logger.error("Admin unhide comment error", { error: error.message });
    if (error.message === "Comment not found") {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to unhide comment" });
  }
};

/** POST /api/admin/reports/comments/:commentId/dismiss */
export const dismissAdminCommentReports = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { commentId } = req.params;
    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    const result = await commentService.dismissCommentReports(commentId);
    await AuditService.logAdminAction(userId, "dismiss_comment_reports", undefined, {
      commentId,
    });
    res.status(200).json({
      success: true,
      message: "Comment reports dismissed",
      data: result,
    });
  } catch (error: any) {
    logger.error("Admin dismiss comment reports error", { error: error.message });
    if (error.message === "Comment not found") {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to dismiss comment reports" });
  }
};
