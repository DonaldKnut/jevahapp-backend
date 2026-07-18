import { Request, Response } from "express";
import { Types } from "mongoose";
import likeService from "./like/like.service";
import engagementShareService from "./share/share.service";
import viewService from "./view/view.service";
import metadataService from "./metadata/metadata.service";
import logger from "../../utils/logger";
import { publishEngagementEvent } from "../../lib/engagementEvents";
import { clampCount } from "../../lib/redisCounters";
import { parseBatchMetadataBody } from "./metadata/metadata.batchRequest";
import { BatchMetadataItem } from "./shared/engagement.types";
import { UNIVERSAL_LIKE_CONTENT_TYPES } from "./shared/engagement.types";
import {
  isUniversalLikeContentType,
  normalizeContentType,
} from "./shared/contentType.resolver";
import { isLikeOperationError } from "./like/like.errors";

export const toggleContentLike = async (req: Request, res: Response): Promise<void> => {
  const startedAt = Date.now();
  const { contentId, contentType: rawContentType } = req.params;
  const userId = req.userId;
  const requestId = (req as any).requestId as string | undefined;

  try {
    if (!userId) {
      res.status(401).json({
        success: false,
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
        data: {},
      });
      return;
    }

    if (!contentId || !Types.ObjectId.isValid(contentId)) {
      res.status(400).json({
        success: false,
        code: "INVALID_CONTENT_ID",
        message: `Invalid content ID: ${contentId}`,
        data: { contentId },
      });
      return;
    }

    if (!rawContentType || !isUniversalLikeContentType(rawContentType)) {
      res.status(400).json({
        success: false,
        code: "INVALID_CONTENT_TYPE",
        message: `Invalid content type: ${rawContentType}`,
        data: { contentType: rawContentType, validTypes: UNIVERSAL_LIKE_CONTENT_TYPES },
      });
      return;
    }

    const contentType = normalizeContentType(rawContentType);
    // Exact "devotional" keeps Devotional collection semantics
    const serviceType =
      (rawContentType || "").trim().toLowerCase() === "devotional" ? "devotional" : contentType;

    // Durable Mongo toggle — no Redis-first optimistic 200
    const result = await likeService.toggleLike(userId, contentId, serviceType);
    const liked = result.liked;
    const likeCount = clampCount(result.likeCount);
    const updatedAt = result.updatedAt || new Date().toISOString();
    const responseContentType = result.contentType || serviceType;

    publishEngagementEvent("content.like_toggled", {
      userId,
      contentId,
      contentType: responseContentType,
      liked,
      likeCount,
      requestId,
    });

    logger.info("like_toggle_completed", {
      event: "like_toggle_completed",
      requestId,
      userId,
      contentType: responseContentType,
      contentId,
      liked,
      likeCount,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    res.status(200).json({
      success: true,
      message: liked ? "Content liked" : "Content unliked",
      data: {
        contentId,
        contentType: responseContentType,
        liked,
        likeCount,
        updatedAt,
      },
    });
  } catch (error: any) {
    logger.error("Toggle content like error", {
      error: error.message,
      requestId,
      userId,
      contentId,
      contentType: rawContentType,
      durationMs: Date.now() - startedAt,
    });

    if (isLikeOperationError(error)) {
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
        data: error.data,
      });
      return;
    }

    if (typeof error.message === "string" && error.message.toLowerCase().includes("not found")) {
      res.status(404).json({
        success: false,
        code: "CONTENT_NOT_FOUND",
        message: error.message,
        data: { contentId },
      });
      return;
    }

    if (typeof error.message === "string" && error.message.includes("Too many")) {
      res.status(429).json({
        success: false,
        code: "LIKE_RATE_LIMITED",
        message: error.message,
        data: {},
      });
      return;
    }

    res.status(500).json({
      success: false,
      code: "LIKE_OPERATION_FAILED",
      message: "Failed to toggle like",
      data: {},
    });
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

    const resolvedType = normalizeContentType(contentType);
    const serviceType =
      (contentType || "").trim().toLowerCase() === "devotional" ? "devotional" : resolvedType;
    const metadata = await metadataService.getContentMetadata(userId, contentId, serviceType);

    const userInteraction = {
      liked: metadata.userInteraction.hasLiked,
      saved: metadata.userInteraction.hasBookmarked,
      shared: metadata.userInteraction.hasShared,
      viewed: metadata.userInteraction.hasViewed ?? false,
    };

    res.status(200).json({
      success: true,
      data: {
        ...metadata,
        contentId: metadata.id,
        contentType: serviceType === "devotional" ? "devotional" : resolvedType,
        stats: {
          likes: metadata.stats.likes,
          saves: metadata.stats.saves,
          shares: metadata.stats.shares,
          views: metadata.stats.views,
          comments: metadata.stats.comments,
        },
        // Singular (legacy) + plural (frontend contract)
        userInteraction,
        userInteractions: userInteraction,
      },
    });
  } catch (error: any) {
    logger.error("Get content metadata error", { error: error.message });
    if (error.message.includes("not found") || error.message.includes("Unsupported")) {
      res.status(error.message.includes("Unsupported") ? 400 : 404).json({
        success: false,
        code: error.message.includes("Unsupported")
          ? "INVALID_CONTENT_TYPE"
          : "CONTENT_NOT_FOUND",
        message: error.message,
        data: {},
      });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to get metadata" });
  }
};

export const getBatchContentMetadata = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const parsed = parseBatchMetadataBody(req.body);

    if (!parsed) {
      res.status(400).json({
        success: false,
        message: "items array or contentIds array is required",
      });
      return;
    }

    const byType = new Map<string, string[]>();
    for (const { contentId, contentType } of parsed) {
      const raw = (contentType || "").trim().toLowerCase();
      const serviceType = raw === "devotional" ? "devotional" : normalizeContentType(contentType);
      const ids = byType.get(serviceType) ?? [];
      ids.push(contentId);
      byType.set(serviceType, ids);
    }

    const resultById = new Map<string, BatchMetadataItem>();
    for (const [contentType, contentIds] of byType) {
      const batch = await metadataService.getBatchContentMetadata(
        userId,
        contentIds,
        contentType
      );
      batch.forEach(item => resultById.set(item.id, item));
    }

    const formatItem = (item: BatchMetadataItem) => {
      const userInteraction = {
        liked: item.hasLiked,
        saved: item.hasBookmarked,
        shared: item.hasShared,
        viewed: item.hasViewed,
      };
      return {
        id: item.id,
        contentId: item.id,
        likes: item.likeCount,
        saves: item.bookmarkCount,
        shares: item.shareCount,
        views: item.viewCount,
        comments: item.commentCount,
        userInteraction,
        userInteractions: userInteraction,
      };
    };

    const data = parsed
      .map(({ contentId }) => resultById.get(contentId))
      .filter((item): item is BatchMetadataItem => item != null)
      .map(formatItem);

    const dataById = Object.fromEntries(data.map(item => [item.id, item]));

    res.status(200).json({ success: true, data, dataById });
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
