import { Request, Response } from "express";
import { Types } from "mongoose";
import commentService from "./comment.service";
import { getCommentsVersion } from "./comment.version";
import logger from "../../../utils/logger";
import { assertCommentableContentType } from "../shared/contentType.resolver";

export const getContentComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const page = parseInt(String(req.query.page || 1), 10) || 1;
    const limit = Math.min(parseInt(String(req.query.limit || 20), 10) || 20, 50);
    const sortBy = String(req.query.sortBy || "newest");
    const userId = req.userId;

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: "Invalid content ID format. Content ID must be a valid ObjectId.",
      });
      return;
    }

    let resolved: string;
    try {
      resolved = assertCommentableContentType(contentType || "media");
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err?.message || "Comments not supported for this content type",
      });
      return;
    }

    const sort = sortBy === "oldest" || sortBy === "top" ? sortBy : "newest";

    // Content-aware ETag: includes a Redis version bumped on every comment
    // mutation. Checked BEFORE the DB fetch so a 304 costs no Mongo queries.
    // When Redis is unavailable (version null), skip ETag/304 entirely rather
    // than risk serving stale 304s.
    const version = await getCommentsVersion(contentId);
    const etag =
      version !== null ? `"${contentId}-${page}-${limit}-${sort}-v${version}"` : null;
    if (etag) {
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
    }

    const result = await commentService.getContentComments(
      contentId,
      resolved,
      page,
      limit,
      sort as "newest" | "oldest" | "top",
      userId
    );

    res.setHeader(
      "Cache-Control",
      userId
        ? "private, max-age=10, stale-while-revalidate=30"
        : "public, max-age=15, stale-while-revalidate=60"
    );
    if (userId) res.setHeader("Vary", "Authorization");

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Get content comments error", { error: error.message, code: error.code });
    if (error?.code === "CONTENT_NOT_FOUND" || error.message?.includes("not found") || error.message === "Content not found") {
      res.status(404).json({ success: false, message: "Content not found", code: "CONTENT_NOT_FOUND" });
      return;
    }
    if (error.message?.includes("not supported") || error?.code === "COMMENT_NOT_SUPPORTED") {
      res.status(400).json({ success: false, message: error.message, code: error.code });
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
