import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { MediaReport } from "../models/mediaReport.model";
import { Interaction } from "../models/interaction.model";
import { AuditService } from "../service/audit.service";
import {
  resolveAdminMediaPreview,
  shapeAdminMediaCard,
} from "../service/admin/mediaPreview.service";
import { isMasterAdminUser } from "../config/superAdmin";
import logger from "../utils/logger";
import { NotificationService } from "../service/notification.service";
import resendEmailService from "../service/resendEmail.service";

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
 * POST /api/admin/users/:id/reset-password
 * Body: { newPassword?: string, sendEmail?: boolean }
 * Works for creators, artists, learners — master-only when target is admin.
 */
export const adminResetUserPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.userId;
    const { newPassword, sendEmail } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid user ID" });
      return;
    }

    const user = await User.findById(id).select("email role firstName");
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (user.role === "admin") {
      const actor = await User.findById(adminId).select("email role");
      if (!isMasterAdminUser(actor)) {
        res.status(403).json({
          success: false,
          message: "Only the master admin can reset another admin's password",
          code: "MASTER_ADMIN_REQUIRED",
        });
        return;
      }
    }

    const authService = (await import("../service/auth.service")).default;

    if (newPassword) {
      if (String(newPassword).length < 6) {
        res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
        return;
      }
      await authService.adminSetUserPassword(id, String(newPassword));
      await AuditService.logAdminAction(
        adminId!,
        "admin_set_password",
        id,
        { role: user.role },
        req.ip,
        req.get("User-Agent")
      );
      res.status(200).json({
        success: true,
        message: "Password updated. User sessions were revoked.",
        data: { userId: id, mode: "set" },
      });
      return;
    }

    if (sendEmail === false) {
      res.status(400).json({
        success: false,
        message: "Provide newPassword or omit sendEmail (defaults to email reset)",
      });
      return;
    }

    await authService.adminSendPasswordReset(id);
    await AuditService.logAdminAction(
      adminId!,
      "admin_send_password_reset",
      id,
      { email: user.email, role: user.role },
      req.ip,
      req.get("User-Agent")
    );

    res.status(200).json({
      success: true,
      message: "Password reset email sent (if mail is configured).",
      data: { userId: id, mode: "email", email: user.email },
    });
  } catch (error: any) {
    logger.error("Admin reset user password error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to reset password",
    });
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
