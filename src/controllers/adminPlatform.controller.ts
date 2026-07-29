import { Request, Response } from "express";
import { Types } from "mongoose";
import { Media } from "../models/media.model";
import { MediaReport } from "../models/mediaReport.model";
import { User } from "../models/user.model";
import { AuditService } from "../service/audit.service";
import {
  getPlatformConfig,
  updatePlatformConfig,
} from "../service/admin/platformConfig.service";
import {
  resolveAdminMediaPreview,
  shapeAdminMediaCard,
} from "../service/admin/mediaPreview.service";
import logger from "../utils/logger";

/**
 * GET /api/admin/config
 * PATCH /api/admin/config
 */
export const getAdminConfig = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = await getPlatformConfig();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error("Get admin config error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to load config" });
  }
};

export const patchAdminConfig = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.userId!;
    const data = await updatePlatformConfig(req.body || {}, adminId);
    await AuditService.logAdminAction(
      adminId,
      "update_platform_config",
      undefined,
      { patch: req.body },
      req.ip,
      req.get("User-Agent")
    );
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error("Patch admin config error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to update config" });
  }
};

/** Public mobile/web kill-switch read (no auth) */
export const getPublicAppConfig = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = await getPlatformConfig();
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error("Get public app config error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to load config" });
  }
};

/**
 * GET /api/admin/media/search
 */
export const searchAdminMedia = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const q = ((req.query.q as string) || "").trim();
    const contentType = (req.query.contentType as string) || "";
    const moderationStatus = (req.query.moderationStatus as string) || "";
    const uploaderId = (req.query.uploaderId as string) || "";
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const filter: Record<string, unknown> = {};
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }
    if (contentType) filter.contentType = contentType;
    if (moderationStatus) filter.moderationStatus = moderationStatus;
    if (uploaderId && Types.ObjectId.isValid(uploaderId)) {
      filter.uploadedBy = new Types.ObjectId(uploaderId);
    }
    if (from || to) {
      filter.createdAt = {
        ...(from && !Number.isNaN(from.getTime()) ? { $gte: from } : {}),
        ...(to && !Number.isNaN(to.getTime()) ? { $lte: to } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      Media.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "title description contentType category thumbnailUrl fileUrl playbackUrl hlsUrl fileObjectKey thumbnailObjectKey uploadIntent moderationStatus moderationResult adminModerationNotes isHidden reportCount likeCount viewCount publicationState processing uploadedBy createdAt updatedAt"
        )
        .populate("uploadedBy", "firstName lastName email username")
        .lean(),
      Media.countDocuments(filter),
    ]);

    const items = await Promise.all(
      docs.map(async (doc: any) => {
        const preview = await resolveAdminMediaPreview(doc);
        return shapeAdminMediaCard(doc, preview);
      })
    );

    res.status(200).json({
      success: true,
      data: {
        items,
        media: items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("Admin media search error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to search media" });
  }
};

/**
 * GET /api/admin/dashboard/timeseries?metric=&range=
 */
export const getDashboardTimeseries = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const metric = ((req.query.metric as string) || "signups").toLowerCase();
    const range = ((req.query.range as string) || "7d").toLowerCase();
    const days = range === "30d" ? 30 : 7;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const valid = ["signups", "uploads", "reports", "activeUsers"];
    if (!valid.includes(metric)) {
      res.status(400).json({
        success: false,
        message: `metric must be one of: ${valid.join(", ")}`,
      });
      return;
    }

    let matchField = "createdAt";
    let Model: any = User;
    let extraFilter: Record<string, unknown> = {};

    if (metric === "signups") {
      Model = User;
      matchField = "createdAt";
    } else if (metric === "uploads") {
      Model = Media;
      matchField = "createdAt";
    } else if (metric === "reports") {
      Model = MediaReport;
      matchField = "createdAt";
    } else if (metric === "activeUsers") {
      Model = User;
      matchField = "lastLoginAt";
      extraFilter = { lastLoginAt: { $ne: null } };
    }

    const rows = await Model.aggregate([
      {
        $match: {
          ...extraFilter,
          [matchField]: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: `$${matchField}` },
          },
          v: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byDay = new Map<string, number>(
      rows.map((r: any) => [r._id, r.v] as [string, number])
    );
    const points: Array<{ t: string; v: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      points.push({ t: key, v: byDay.get(key) || 0 });
    }

    res.status(200).json({
      success: true,
      data: { metric, range: days === 30 ? "30d" : "7d", points },
    });
  } catch (error: any) {
    logger.error("Dashboard timeseries error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to load timeseries",
    });
  }
};

/**
 * GET /api/admin/system/health
 * Ops page: api / mongo / redis / storage / queues / version
 */
export const getAdminSystemHealth = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const mongoose = await import("mongoose");
    const { isRedisConnected } = await import("../lib/redisClient");
    const {
      analyticsQueue,
      mediaProcessingQueue,
      notificationsQueue,
    } = await import("../queues/queues");

    const mongoState = mongoose.default.connection.readyState;
    // 0=disconnected 1=connected 2=connecting 3=disconnecting
    const mongo =
      mongoState === 1 ? "ok" : mongoState === 2 ? "connecting" : "down";

    const redis = isRedisConnected() ? "ok" : "down";

    let storage: "ok" | "down" | "unknown" = "unknown";
    try {
      const hasR2 =
        Boolean(process.env.R2_BUCKET) &&
        Boolean(process.env.R2_ENDPOINT) &&
        Boolean(process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY);
      storage = hasR2 ? "ok" : "unknown";
    } catch {
      storage = "unknown";
    }

    let queues: Record<string, { waiting: number; failed: number }> = {};
    try {
      const [mod, email, analytics] = await Promise.all([
        mediaProcessingQueue.getJobCounts("waiting", "failed"),
        notificationsQueue.getJobCounts("waiting", "failed"),
        analyticsQueue.getJobCounts("waiting", "failed"),
      ]);
      queues = {
        moderation: {
          waiting: mod.waiting || 0,
          failed: mod.failed || 0,
        },
        email: {
          waiting: email.waiting || 0,
          failed: email.failed || 0,
        },
        analytics: {
          waiting: analytics.waiting || 0,
          failed: analytics.failed || 0,
        },
      };
    } catch {
      queues = {};
    }

    const version =
      process.env.GIT_SHA ||
      process.env.RENDER_GIT_COMMIT ||
      process.env.npm_package_version ||
      "unknown";

    const api = "ok";
    const overall =
      mongo === "ok" && redis === "ok" ? "ok" : "degraded";

    res.status(200).json({
      success: true,
      data: {
        status: overall,
        api,
        mongo,
        redis,
        storage,
        queues,
        version,
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  } catch (error: any) {
    logger.error("Admin system health error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to load system health",
    });
  }
};
