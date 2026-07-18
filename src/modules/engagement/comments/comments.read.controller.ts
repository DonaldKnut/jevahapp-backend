import { Request, Response } from "express";
import { Types } from "mongoose";
import commentService from "./comment.service";
import logger from "../../../utils/logger";
import { resolveCommentContentType } from "../shared/contentType.resolver";

export const getContentComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const page = parseInt(String(req.query.page || 1), 10) || 1;
    const limit = parseInt(String(req.query.limit || 20), 10) || 20;
    const sortBy = String(req.query.sortBy || "newest");
    const userId = req.userId;

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID format. Content ID must be a valid ObjectId.",
      });
      return;
    }
    if (!contentType || !["media", "devotional", "ebook", "podcast"].includes(contentType)) {
      res.status(400).json({ success: false, message: "Comments not supported for this content type" });
      return;
    }

    const sort = sortBy === "oldest" || sortBy === "top" ? sortBy : "newest";
    const result = await commentService.getContentComments(
      contentId,
      resolveCommentContentType(contentType),
      page,
      limit,
      sort,
      userId
    );

    const etag = `"${contentId}-${page}-${limit}-${sort}"`;
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader(
      "Cache-Control",
      userId ? "private, max-age=10, stale-while-revalidate=30" : "public, max-age=15, stale-while-revalidate=60"
    );
    if (userId) res.setHeader("Vary", "Authorization");

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Get content comments error", { error: error.message });
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to get comments" });
  }
};

export const getCommentReplies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const page = parseInt(String(req.query.page || 1), 10) || 1;
    const limit = parseInt(String(req.query.limit || 20), 10) || 20;

    if (!commentId || !Types.ObjectId.isValid(commentId)) {
      res.status(400).json({ success: false, message: "Invalid comment ID" });
      return;
    }

    const result = await commentService.getCommentReplies(commentId, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Get comment replies error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to get replies" });
  }
};
