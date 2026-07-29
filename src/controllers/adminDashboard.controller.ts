import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { MediaReport } from "../models/mediaReport.model";
import { Interaction } from "../models/interaction.model";
import { AuditService } from "../service/audit.service";
import cacheService from "../service/cache.service";
import {
  resolveAdminMediaPreview,
  shapeAdminMediaCard,
} from "../service/admin/mediaPreview.service";
import {
  applyModerationStatus,
  MODERATION_STATUSES,
  normalizeBulkIds,
  type ModerationStatus,
} from "../service/admin/moderationActions.service";
import { isMasterAdminUser } from "../config/superAdmin";
import logger from "../utils/logger";
import { NotificationService } from "../service/notification.service";
import resendEmailService from "../service/resendEmail.service";

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
      rejectedContent,
      totalReports,
      pendingReports,
      bannedUsers,
      activeUsers30d,
      reportedComments,
      unverifiedArtists,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: last24Hours } }),
      User.countDocuments({ createdAt: { $gte: last7Days } }),
      User.countDocuments({ createdAt: { $gte: last30Days } }),
      Media.countDocuments(),
      Media.countDocuments({ createdAt: { $gte: last24Hours } }),
      Media.countDocuments({ createdAt: { $gte: last7Days } }),
      Media.countDocuments({ createdAt: { $gte: last30Days } }),
      Media.countDocuments({
        moderationStatus: { $in: ["pending", "under_review"] },
      }),
      Media.countDocuments({ moderationStatus: "rejected" }),
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
          rejected: rejectedContent,
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
        },
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
 * Get all users with advanced filtering and pagination
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const query: any = {};

    // Filters
    if (req.query.search) {
      query.$or = [
        { email: { $regex: req.query.search, $options: "i" } },
        { firstName: { $regex: req.query.search, $options: "i" } },
        { lastName: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.role) {
      query.role = req.query.role;
    }

    if (req.query.isBanned !== undefined) {
      query.isBanned = req.query.isBanned === "true";
    }

    if (req.query.isEmailVerified !== undefined) {
      query.isEmailVerified = req.query.isEmailVerified === "true";
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -verificationCode -resetPasswordToken")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    let onlineIds = new Set<string>();
    try {
      const { socketService } = require("../app");
      onlineIds = new Set(socketService?.getConnectedUserIds?.() ?? []);
    } catch {
      /* socket not ready */
    }

    const usersWithPresence = (users as any[]).map(u => {
      const id = u._id.toString();
      return {
        ...u,
        id,
        isOnline: onlineIds.has(id),
        lastSeenAt: u.lastSeenAt || u.lastLoginAt || null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        users: usersWithPresence,
        onlineCount: onlineIds.size,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    logger.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

/**
 * Get single user details (admin trust & safety page)
 */
export const getUserDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    const userDoc = await User.findById(id)
      .select("-password -verificationCode -resetPasswordToken")
      .lean();

    if (!userDoc) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const uploaderMediaIds = await Media.find({ uploadedBy: id }).distinct("_id");

    const [
      activityStats,
      uploads,
      reportsFiled,
      reportsAgainst,
      comments,
      recentMediaDocs,
      recentReports,
      moderationHistory,
    ] = await Promise.all([
      AuditService.getUserDashboardStats(id),
      Media.countDocuments({ uploadedBy: id }),
      MediaReport.countDocuments({ reportedBy: id }),
      uploaderMediaIds.length === 0
        ? Promise.resolve(0)
        : MediaReport.countDocuments({ mediaId: { $in: uploaderMediaIds } }),
      Interaction.countDocuments({
        user: id,
        interactionType: "comment",
        isRemoved: { $ne: true },
      }),
      Media.find({ uploadedBy: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select(
          "title description contentType category thumbnailUrl fileUrl playbackUrl hlsUrl fileObjectKey thumbnailObjectKey uploadIntent moderationStatus moderationResult adminModerationNotes isHidden reportCount likeCount viewCount publicationState processing uploadedBy createdAt updatedAt"
        )
        .populate("uploadedBy", "firstName lastName email username")
        .lean(),
      MediaReport.find({ reportedBy: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("reason status mediaId createdAt adminNotes")
        .lean(),
      AuditService.getAdminActionsForTarget(id, 30),
    ]);

    let isOnline = false;
    try {
      const socketService = require("../app").socketService;
      isOnline = Boolean(socketService?.isUserConnected?.(id));
    } catch {
      isOnline = false;
    }

    const recentMedia = await Promise.all(
      recentMediaDocs.map(async (doc: any) => {
        const preview = await resolveAdminMediaPreview(doc);
        return shapeAdminMediaCard(doc, preview);
      })
    );

    const u: any = userDoc;
    res.status(200).json({
      success: true,
      data: {
        user: {
          ...u,
          id: u._id?.toString?.() || id,
          isMasterAdmin: isMasterAdminUser(u),
        },
        stats: {
          ...activityStats,
          uploads,
          mediaCount: uploads,
          reportsFiled,
          reportsCount: reportsFiled,
          reportsAgainst,
          comments,
          lastLoginAt: u.lastLoginAt || null,
          lastSeenAt: u.lastSeenAt || null,
          isOnline,
          isBanned: !!u.isBanned,
        },
        recentMedia,
        recentReports: (recentReports || []).map((r: any) => ({
          id: r._id.toString(),
          reason: r.reason,
          status: r.status,
          mediaId: r.mediaId?.toString?.() || r.mediaId,
          createdAt: r.createdAt,
          adminNotes: r.adminNotes || null,
        })),
        moderationHistory,
      },
    });
  } catch (error: any) {
    logger.error("Get user details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
    });
  }
};

/**
 * Ban a user
 */
export const banUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, duration, revokeSessions } = req.body;
    const adminId = req.userId;
    // Default true: kick sessions unless FE explicitly sends false
    const shouldRevokeSessions = revokeSessions !== false && revokeSessions !== "false";

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Security: Prevent self-ban
    if (id === adminId) {
      res.status(400).json({
        success: false,
        message: "Cannot ban yourself",
      });
      return;
    }

    // Security: Never ban the master / super-admin account
    if (isMasterAdminUser(user)) {
      res.status(403).json({
        success: false,
        message: "Cannot ban the master admin account",
        code: "MASTER_ADMIN_PROTECTED",
      });
      return;
    }

    // Security: Only master admin may ban other admins
    if (user.role === "admin") {
      const actor = await User.findById(adminId).select("email role");
      if (!isMasterAdminUser(actor)) {
        res.status(403).json({
          success: false,
          message: "Only the master admin can ban other admin users",
          code: "MASTER_ADMIN_REQUIRED",
        });
        return;
      }
    }

    const banUntil = duration
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
      : null;

    await User.findByIdAndUpdate(id, {
      isBanned: true,
      banReason: reason || "Violation of community guidelines",
      bannedAt: new Date(),
      banUntil,
      bannedBy: new Types.ObjectId(adminId),
    });

    const { invalidateAuthUserCache } = await import("../lib/invalidateAuthUserCache");
    await invalidateAuthUserCache(id);

    let sessionsRevoked = false;
    if (shouldRevokeSessions) {
      try {
        const { revokeAllUserRefreshTokens } = await import(
          "../service/auth/token.service"
        );
        await revokeAllUserRefreshTokens(id);
        sessionsRevoked = true;
      } catch (err: any) {
        logger.warn("Ban: failed to revoke refresh tokens", {
          userId: id,
          error: err?.message,
        });
      }

      try {
        const { getIO } = await import("../socket/socketManager");
        const io = getIO();
        if (io) {
          const sockets = await io.in(`user:${id}`).fetchSockets();
          for (const sock of sockets) {
            sock.emit("force-logout", {
              reason: "banned",
              banReason: reason || "Violation of community guidelines",
              banUntil,
            });
            sock.disconnect(true);
          }
        }
      } catch (err: any) {
        logger.warn("Ban: failed to disconnect sockets", {
          userId: id,
          error: err?.message,
        });
      }
    }

    // Log admin action
    await AuditService.logAdminAction(
      adminId!,
      "ban_user",
      id,
      { reason, duration, banUntil, revokeSessions: shouldRevokeSessions, sessionsRevoked },
      req.ip,
      req.get("User-Agent")
    );

    logger.info("User banned", {
      userId: id,
      adminId,
      reason,
      revokeSessions: shouldRevokeSessions,
      sessionsRevoked,
    });

    res.status(200).json({
      success: true,
      message: "User banned successfully",
      data: {
        userId: id,
        banUntil,
        revokeSessions: shouldRevokeSessions,
        sessionsRevoked,
      },
    });
  } catch (error: any) {
    logger.error("Ban user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to ban user",
    });
  }
};

/**
 * Unban a user
 */
export const unbanUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.userId;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Security: Only master admin may unban other admins
    if (user.role === "admin") {
      const actor = await User.findById(adminId).select("email role");
      if (!isMasterAdminUser(actor)) {
        res.status(403).json({
          success: false,
          message: "Only the master admin can unban other admin users",
          code: "MASTER_ADMIN_REQUIRED",
        });
        return;
      }
    }

    await User.findByIdAndUpdate(id, {
      isBanned: false,
      banReason: undefined,
      bannedAt: undefined,
      banUntil: undefined,
      bannedBy: undefined,
    });

    const { invalidateAuthUserCache } = await import("../lib/invalidateAuthUserCache");
    await invalidateAuthUserCache(id);

    // Log admin action
    await AuditService.logAdminAction(
      adminId!,
      "unban_user",
      id,
      {},
      req.ip,
      req.get("User-Agent")
    );

    logger.info("User unbanned", { userId: id, adminId });

    res.status(200).json({
      success: true,
      message: "User unbanned successfully",
    });
  } catch (error: any) {
    logger.error("Unban user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unban user",
    });
  }
};

/**
 * POST /api/admin/users/:id/warn
 * Soft warning — in-app notification + optional email. Audited as warn_user.
 */
export const warnUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.userId!;
    const {
      subject = "Community guidelines",
      message,
      sendEmail = true,
    } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({
        success: false,
        message: "message is required",
      });
      return;
    }

    const user = await User.findById(id).select(
      "email firstName lastName role isBanned"
    );
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    if (isMasterAdminUser(user)) {
      res.status(403).json({
        success: false,
        message: "Cannot warn the master admin account",
        code: "MASTER_ADMIN_PROTECTED",
      });
      return;
    }

    const title = String(subject).trim().slice(0, 120) || "Community guidelines";
    const body = message.trim().slice(0, 4000);

    await NotificationService.createNotification({
      userId: id,
      type: "admin_warning",
      title,
      message: body,
      metadata: { warnedBy: adminId },
      priority: "high",
      relatedId: id,
    });

    let emailSent = false;
    if (sendEmail !== false && sendEmail !== "false" && user.email) {
      try {
        await resendEmailService.sendEmail({
          to: user.email,
          subject: `[Jevah] ${title}`,
          html: `<div style="font-family:sans-serif;line-height:1.5">
            <p>Hi ${user.firstName || "there"},</p>
            <p>${body.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>
            <hr/><p style="color:#888;font-size:12px">Jevah Trust &amp; Safety</p>
          </div>`,
        });
        emailSent = true;
      } catch (err: any) {
        logger.warn("Warn user email failed", { userId: id, error: err?.message });
      }
    }

    await AuditService.logAdminAction(
      adminId,
      "warn_user",
      id,
      { subject: title, message: body.slice(0, 500), emailSent },
      req.ip,
      req.get("User-Agent")
    );

    res.status(200).json({
      success: true,
      message: "User warned",
      data: { userId: id, emailSent },
    });
  } catch (error: any) {
    logger.error("Warn user error:", error);
    res.status(500).json({ success: false, message: "Failed to warn user" });
  }
};

/**
 * Update user role
 */
export const updateUserRole = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.userId;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    const validRoles = [
      "learner",
      "parent",
      "educator",
      "moderator",
      "admin",
      "content_creator",
      "vendor",
      "church_admin",
      "artist",
    ];

    if (!role || !validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
      return;
    }

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const actor = await User.findById(adminId).select("email role");
    if (!isMasterAdminUser(actor)) {
      res.status(403).json({
        success: false,
        message: "Only the master admin can change user roles",
        code: "MASTER_ADMIN_REQUIRED",
      });
      return;
    }

    // Never demote / alter the master account away from admin
    if (isMasterAdminUser(user) && role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Cannot change the role of the master admin account",
        code: "MASTER_ADMIN_PROTECTED",
      });
      return;
    }

    const oldRole = user.role;

    // Security: Prevent removing your own admin role
    if (id === adminId && role !== "admin") {
      res.status(400).json({
        success: false,
        message: "Cannot remove your own admin role",
      });
      return;
    }

    await User.findByIdAndUpdate(id, { role });

    const { invalidateAuthUserCache } = await import("../lib/invalidateAuthUserCache");
    await invalidateAuthUserCache(id);

    // Log admin action
    await AuditService.logAdminAction(
      adminId!,
      "update_user_role",
      id,
      { oldRole, newRole: role },
      req.ip,
      req.get("User-Agent")
    );

    logger.info("User role updated", { userId: id, adminId, oldRole, newRole: role });

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: { userId: id, oldRole, newRole: role },
    });
  } catch (error: any) {
    logger.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
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
          "title description contentType category thumbnailUrl fileUrl playbackUrl hlsUrl fileObjectKey thumbnailObjectKey uploadIntent moderationStatus moderationResult adminModerationNotes isHidden reportCount likeCount viewCount publicationState processing uploadedBy createdAt updatedAt"
        )
        .populate("uploadedBy", "firstName lastName email username")
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
    const { status, adminNotes } = req.body;
    const adminId = req.userId;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    if (!status || !MODERATION_STATUSES.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${MODERATION_STATUSES.join(", ")}`,
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
    const { mediaIds, status, adminNotes } = req.body || {};
    const ids = normalizeBulkIds(mediaIds, 50);

    if (ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "mediaIds must be a non-empty array (max 50)",
      });
      return;
    }

    if (!status || !MODERATION_STATUSES.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${MODERATION_STATUSES.join(", ")}`,
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


