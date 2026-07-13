import { Request, Response } from "express";
import { Types } from "mongoose";
import likeService from "./like/like.service";
import engagementShareService from "./share/share.service";
import viewService from "./view/view.service";
import metadataService from "./metadata/metadata.service";
import logger from "../../utils/logger";
import { publishEngagementEvent } from "../../lib/engagementEvents";
import { clampCount } from "../../lib/redisCounters";
import { UNIVERSAL_LIKE_CONTENT_TYPES } from "./shared/engagement.types";

export const toggleContentLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required", data: null });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        message: `Invalid content ID: ${contentId}`,
        data: { contentId },
      });
      return;
    }

    if (!contentType || !(UNIVERSAL_LIKE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      res.status(400).json({
        success: false,
        message: `Invalid content type: ${contentType}`,
        data: { contentType, validTypes: UNIVERSAL_LIKE_CONTENT_TYPES },
      });
      return;
    }

    const result = await likeService.toggleLikeFast(userId, contentId, contentType);

    publishEngagementEvent("content.like_toggled", {
      userId,
      contentId,
      contentType,
      liked: result.liked,
      likeCount: clampCount(result.likeCount),
    });

    likeService.toggleLike(userId, contentId, contentType).catch((err: Error) => {
      logger.error("Background like sync failed", {
        error: err.message,
        userId,
        contentId,
        contentType,
      });
    });

    res.status(200).json({
      success: true,
      message: result.liked ? "Content liked" : "Content unliked",
      data: { liked: result.liked, likeCount: result.likeCount },
    });
  } catch (error: any) {
    logger.error("Toggle content like error", { error: error.message });
    if (error.message.includes("Too many")) {
      res.status(429).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to toggle like" });
  }
};

export const shareContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const userId = req.userId;
    const { platform } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }

    const result = await engagementShareService.shareContent(
      userId,
      contentId,
      contentType,
      platform
    );

    res.status(200).json({
      success: true,
      message: "Content shared successfully",
      data: { shared: result.shared, shareCount: result.shareCount, platform: platform || "web" },
    });
  } catch (error: any) {
    logger.error("Share content error", { error: error.message });
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to share content" });
  }
};

export const recordContentView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const userId = req.userId;
    const { durationMs, progressPct, isComplete, source, sessionId, deviceId } = req.body;

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }

    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: contentType as any,
      durationMs,
      progressPct,
      isComplete,
      source,
      sessionId,
      deviceId,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    if (result.counted) {
      publishEngagementEvent("content.viewed", {
        userId,
        contentId,
        contentType,
        viewCount: result.viewCount,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        viewCount: result.viewCount,
        hasViewed: result.hasViewed,
        counted: result.counted,
      },
    });
  } catch (error: any) {
    logger.error("Record content view error", { error: error.message });
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to record view" });
  }
};

export const getContentMetadata = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const userId = req.userId || "";

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }

    const metadata = await metadataService.getContentMetadata(userId, contentId, contentType);

    res.status(200).json({
      success: true,
      data: {
        ...metadata,
        stats: {
          likes: metadata.stats.likes,
          saves: metadata.stats.saves,
          shares: metadata.stats.shares,
          views: metadata.stats.views,
          comments: metadata.stats.comments,
        },
        userInteraction: {
          liked: metadata.userInteraction.hasLiked,
          saved: metadata.userInteraction.hasBookmarked,
          shared: metadata.userInteraction.hasShared,
          viewed: metadata.userInteraction.hasViewed ?? false,
        },
      },
    });
  } catch (error: any) {
    logger.error("Get content metadata error", { error: error.message });
    if (error.message.includes("not found")) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to get metadata" });
  }
};

export const getBatchContentMetadata = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentIds, contentType = "media" } = req.body;
    const userId = req.userId;

    if (!Array.isArray(contentIds) || contentIds.length === 0) {
      res.status(400).json({ success: false, message: "contentIds array is required" });
      return;
    }

    const data = await metadataService.getBatchContentMetadata(userId, contentIds, contentType);

    res.status(200).json({
      success: true,
      data: data.map((item: { id: string; likeCount: number; bookmarkCount: number; shareCount: number; viewCount: number; commentCount: number; hasLiked: boolean; hasBookmarked: boolean; hasShared: boolean; hasViewed: boolean }) => ({
        id: item.id,
        likes: item.likeCount,
        saves: item.bookmarkCount,
        shares: item.shareCount,
        views: item.viewCount,
        comments: item.commentCount,
        userInteraction: {
          liked: item.hasLiked,
          saved: item.hasBookmarked,
          shared: item.hasShared,
          viewed: item.hasViewed,
        },
      })),
    });
  } catch (error: any) {
    logger.error("Batch metadata error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to get batch metadata" });
  }
};

export const getContentLikers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId, contentType } = req.params;
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({ success: false, message: "Invalid content ID" });
      return;
    }

    const result = await likeService.getContentLikers(contentId, contentType, page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("Get content likers error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to get likers" });
  }
};
