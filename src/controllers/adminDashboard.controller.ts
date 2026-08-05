import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { MediaReport } from "../models/mediaReport.model";
import { AuditService } from "../service/audit.service";
import {
  resolveAdminMediaPreview,
  shapeAdminMediaCard,
} from "../service/admin/mediaPreview.service";
import {
  applyModerationStatus,
  MODERATION_STATUSES,
  normalizeBulkIds,
  normalizeModerationStatusInput,
  type ModerationStatus,
} from "../service/admin/moderationActions.service";
import { isMasterAdminUser } from "../config/superAdmin";
import logger from "../utils/logger";
import { countArtistsNeedingOnboardEmail } from "../service/artistOnboardEmail.service";

/**
 * Get platform-wide analytics and statistics
 */
export const getPlatformAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers24h,
      newUsers7d,
      newUsers30d,
      totalMedia,
      newMedia24h,
      newMedia7d,
      newMedia30d,
      pendingModeration,
      underReviewModeration,
      rejectedContent,
      approvedToday,
      totalReports,
      pendingReports,
      bannedUsers,
      activeUsers30d,
      reportedComments,
      unverifiedArtists,
      artistOnboardCounts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: last24Hours } }),
      User.countDocuments({ createdAt: { $gte: last7Days } }),
      User.countDocuments({ createdAt: { $gte: last30Days } }),
      Media.countDocuments(),
      Media.countDocuments({ createdAt: { $gte: last24Hours } }),
      Media.countDocuments({ createdAt: { $gte: last7Days } }),
      Media.countDocuments({ createdAt: { $gte: last30Days } }),
      Media.countDocuments({ moderationStatus: "pending" }),
      Media.countDocuments({ moderationStatus: "under_review" }),
      Media.countDocuments({ moderationStatus: "rejected" }),
      Media.countDocuments({
        moderationStatus: "approved",
        updatedAt: { $gte: last24Hours },
      }),
      MediaReport.countDocuments(),
      MediaReport.countDocuments({ status: "pending" }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({
        lastLoginAt: { $gte: last30Days },
      }),
      (async () => {
        const { Interaction } = await import("../models/interaction.model");
        return Interaction.countDocuments({
          interactionType: "comment",
          isRemoved: { $ne: true },
          reportCount: { $gte: 1 },
        });
      })(),
      User.countDocuments({
        role: "artist",
        isVerifiedArtist: { $ne: true },
      }),
      countArtistsNeedingOnboardEmail(),
    ]);

    // Get user role distribution
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get content type distribution
    const contentTypeDistribution = await Media.aggregate([
      {
        $group: {
          _id: "$contentType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get moderation status distribution
    const moderationDistribution = await Media.aggregate([
      {
        $group: {
          _id: "$moderationStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const flagAgg = await Media.aggregate([
      { $match: { "moderationResult.flags.0": { $exists: true } } },
      { $unwind: "$moderationResult.flags" },
      { $group: { _id: "$moderationResult.flags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);
    const byFlag = flagAgg.reduce(
      (acc: Record<string, number>, item: any) => {
        if (item._id) acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );

    const reminders: Array<{
      id: string;
      severity: "high" | "medium" | "info";
      title: string;
      message: string;
      count: number;
      action: {
        method: string;
        path: string;
        bodyHint?: Record<string, unknown>;
        hrefHint?: string;
      };
    }> = [];

    if (artistOnboardCounts.pendingApplications > 0) {
      reminders.push({
        id: "pending_artist_applications",
        severity: "high",
        title: "Review pending creator applications",
        message:
          "Activate approved creators, then send them an onboard email so they know how to upload.",
        count: artistOnboardCounts.pendingApplications,
        action: {
          method: "GET",
          path: "/api/admin/artists?status=pending",
          hrefHint: "/admin/artists?status=pending",
        },
      });
    }

    if (artistOnboardCounts.activeMissingOnboardEmail > 0) {
      reminders.push({
        id: "artist_onboard_email",
        severity: "high",
        title: "Send artist onboard emails",
        message:
          "Active artists have never received an onboard invite. Email them creator studio steps (Music → Artists uploads).",
        count: artistOnboardCounts.activeMissingOnboardEmail,
        action: {
          method: "POST",
          path: "/api/admin/email/artist-onboard",
          bodyHint: {
            segment: "active_missing_onboard",
            dryRun: true,
          },
          hrefHint: "/admin/email?kind=artist-onboard",
        },
      });
    } else {
      reminders.push({
        id: "artist_onboard_email_capability",
        severity: "info",
        title: "Artist onboard email available",
        message:
          "When you activate a creator, remember to send POST /api/admin/email/artist-onboard (or use Compose → Artist onboard).",
        count: 0,
        action: {
          method: "POST",
          path: "/api/admin/email/artist-onboard",
          bodyHint: { segment: "artistIds", artistIds: [], dryRun: true },
          hrefHint: "/admin/email?kind=artist-onboard",
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          new24h: newUsers24h,
          new7d: newUsers7d,
          new30d: newUsers30d,
          active30d: activeUsers30d,
          banned: bannedUsers,
          roleDistribution: roleDistribution.reduce(
            (acc, item) => {
              acc[item._id || "none"] = item.count;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
        content: {
          total: totalMedia,
          new24h: newMedia24h,
          new7d: newMedia7d,
          new30d: newMedia30d,
          contentTypeDistribution: contentTypeDistribution.reduce(
            (acc, item) => {
              acc[item._id || "none"] = item.count;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
        moderation: {
          pending: pendingModeration,
          under_review: underReviewModeration,
          rejected: rejectedContent,
          approvedToday,
          avgReviewMinutes: null,
          byFlag,
          statusDistribution: moderationDistribution.reduce(
            (acc, item) => {
              acc[item._id || "none"] = item.count;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
        reports: {
          total: totalReports,
          pending: pendingReports,
          comments: reportedComments,
        },
        verification: {
          unverifiedArtists,
          pendingCreatorApplications:
            artistOnboardCounts.pendingApplications,
          activeArtistsMissingOnboardEmail:
            artistOnboardCounts.activeMissingOnboardEmail,
        },
        reminders,
      },
    });
  } catch (error: any) {
    logger.error("Get platform analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch platform analytics",
    });
  }
};

/**
 * Get moderation queue (shaped cards + preview URLs for admin UI)
 */
export const getModerationQueue = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const query: any = {
      moderationStatus: status
        ? status
        : { $in: ["pending", "under_review"] },
    };

    const [docs, total] = await Promise.all([
      Media.find(query)
        .select(
          "title description contentType category thumbnailUrl fileUrl playbackUrl hlsUrl fileObjectKey thumbnailObjectKey uploadIntent moderationStatus moderationResult adminModerationNotes moderationAssignee isHidden reportCount likeCount viewCount publicationState processing uploadedBy createdAt updatedAt"
        )
        .populate("uploadedBy", "firstName lastName email username")
        .populate("moderationAssignee", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Media.countDocuments(query),
    ]);

    const media = await Promise.all(
      docs.map(async (doc) => {
        const preview = await resolveAdminMediaPreview(doc as any);
        return shapeAdminMediaCard(doc, preview);
      })
    );

    res.status(200).json({
      success: true,
      data: {
        media,
        /** Alias for clients that expect `items` */
        items: media,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("Get moderation queue error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch moderation queue",
    });
  }
};

/**
 * Update moderation status (admin override)
 */
export const updateModerationStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status: rawStatus, adminNotes } = req.body;
    const adminId = req.userId;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    const status = normalizeModerationStatusInput(rawStatus);
    if (!status) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${MODERATION_STATUSES.join(", ")}, or alias "flagged"`,
      });
      return;
    }

    try {
      await applyModerationStatus({
        mediaId: id,
        status: status as ModerationStatus,
        adminNotes,
        adminId: adminId!,
        ip: req.ip,
        userAgent: req.get("User-Agent") || undefined,
      });
    } catch (err: any) {
      if (err?.code === "NOT_FOUND") {
        res.status(404).json({ success: false, message: "Media not found" });
        return;
      }
      throw err;
    }

    logger.info("Moderation status updated", { mediaId: id, adminId, status });

    const refreshed = await Media.findById(id)
      .select(
        "title description contentType category thumbnailUrl fileUrl playbackUrl hlsUrl fileObjectKey thumbnailObjectKey uploadIntent moderationStatus moderationResult adminModerationNotes isHidden reportCount likeCount viewCount publicationState processing uploadedBy createdAt updatedAt"
      )
      .populate("uploadedBy", "firstName lastName email username")
      .lean();

    const preview = refreshed
      ? await resolveAdminMediaPreview(refreshed as any)
      : null;

    res.status(200).json({
      success: true,
      message: "Moderation status updated successfully",
      data:
        refreshed && preview
          ? shapeAdminMediaCard(refreshed, preview)
          : { id, moderationStatus: status },
    });
  } catch (error: any) {
    logger.error("Update moderation status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update moderation status",
    });
  }
};

/**
 * POST /api/admin/moderation/bulk
 * Bulk approve / reject / hold. Max 50 IDs. Partial success.
 */
export const bulkUpdateModerationStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.userId!;
    const { mediaIds, status: rawStatus, adminNotes } = req.body || {};
    const ids = normalizeBulkIds(mediaIds, 50);

    if (ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "mediaIds must be a non-empty array (max 50)",
      });
      return;
    }

    const status = normalizeModerationStatusInput(rawStatus);
    if (!status) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${MODERATION_STATUSES.join(", ")}, or alias "flagged"`,
      });
      return;
    }

    const updated: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];

    for (const id of ids) {
      try {
        await applyModerationStatus({
          mediaId: id,
          status: status as ModerationStatus,
          adminNotes,
          adminId,
          ip: req.ip,
          userAgent: req.get("User-Agent") || undefined,
          skipAudit: true,
        });
        updated.push(id);
      } catch (err: any) {
        failed.push({
          id,
          message: err?.message || "Failed to update",
        });
      }
    }

    await AuditService.logAdminAction(
      adminId,
      "bulk_update_moderation_status",
      undefined,
      {
        status,
        adminNotes,
        updatedCount: updated.length,
        failedCount: failed.length,
        updated,
        failed,
      },
      req.ip,
      req.get("User-Agent")
    );

    logger.info("Bulk moderation status updated", {
      adminId,
      status,
      updated: updated.length,
      failed: failed.length,
    });

    res.status(200).json({
      success: true,
      data: { updated, failed },
    });
  } catch (error: any) {
    logger.error("Bulk moderation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk update moderation",
    });
  }
};

/**
 * Get admin activity log
 * Default: current admin's actions.
 * ?scope=all — master only, org-wide feed (+ actorId, action, from, to filters)
 */
export const getAdminActivityLog = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const scope = ((req.query.scope as string) || "self").toLowerCase();
    const actorId = (req.query.actorId || req.query.adminId) as string | undefined;
    const action = req.query.action as string | undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    if (scope === "all") {
      const actor = await User.findById(req.userId).select("email role");
      if (!isMasterAdminUser(actor)) {
        res.status(403).json({
          success: false,
          message: "Only the master admin can view org-wide activity",
          code: "MASTER_ADMIN_REQUIRED",
        });
        return;
      }

      const activityLog = await AuditService.getOrgAdminActivityLog({
        page,
        limit,
        actorId,
        action,
        from: from && !Number.isNaN(from.getTime()) ? from : null,
        to: to && !Number.isNaN(to.getTime()) ? to : null,
      });

      res.status(200).json({ success: true, data: activityLog });
      return;
    }

    const activityLog = await AuditService.getUserActivityHistory(
      actorId && Types.ObjectId.isValid(actorId) ? actorId : req.userId!,
      page,
      limit,
      "admin_action"
    );

    res.status(200).json({
      success: true,
      data: activityLog,
    });
  } catch (error: any) {
    logger.error("Get admin activity log error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin activity log",
    });
  }
};
