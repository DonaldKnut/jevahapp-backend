import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { MediaReport } from "../models/mediaReport.model";
import { AuditService } from "../service/audit.service";
import resendEmailService from "../service/resendEmail.service";
import cacheService from "../service/cache.service";
import logger from "../utils/logger";

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
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
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
 * Get single user details
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

    const user = await User.findById(id).select(
      "-password -verificationCode -resetPasswordToken"
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Get user activity stats
    const activityStats = await AuditService.getUserDashboardStats(id);

    // Get user's media count
    const mediaCount = await Media.countDocuments({ uploadedBy: id });

    // Get user's reports count
    const reportsCount = await MediaReport.countDocuments({ reportedBy: id });

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: {
          ...activityStats,
          mediaCount,
          reportsCount,
        },
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
    const { reason, duration } = req.body;
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

    // Security: Prevent self-ban
    if (id === adminId) {
      res.status(400).json({
        success: false,
        message: "Cannot ban yourself",
      });
      return;
    }

    // Security: Prevent banning other admins
    if (user.role === "admin") {
      res.status(403).json({
        success: false,
        message: "Cannot ban admin users",
      });
      return;
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

    // Log admin action
    await AuditService.logAdminAction(
      adminId!,
      "ban_user",
      id,
      { reason, duration, banUntil },
      req.ip,
      req.get("User-Agent")
    );

    logger.info("User banned", { userId: id, adminId, reason });

    res.status(200).json({
      success: true,
      message: "User banned successfully",
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

    await User.findByIdAndUpdate(id, {
      isBanned: false,
      banReason: undefined,
      bannedAt: undefined,
      banUntil: undefined,
      bannedBy: undefined,
    });

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

    const oldRole = user.role;

    // Security: Prevent removing your own admin role
    if (id === adminId && role !== "admin") {
      res.status(400).json({
        success: false,
        message: "Cannot remove your own admin role",
      });
      return;
    }

    // Security: Prevent removing admin role from other admins
    if (user.role === "admin" && role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Cannot remove admin role from other admins",
      });
      return;
    }

    await User.findByIdAndUpdate(id, { role });

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
 * Get moderation queue
 */
export const getModerationQueue = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const query: any = {
      moderationStatus: status
        ? status
        : { $in: ["pending", "under_review"] },
    };

    const [media, total] = await Promise.all([
      Media.find(query)
        .populate("uploadedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Media.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        media,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
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

    const validStatuses = ["approved", "rejected", "under_review"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
      return;
    }

    const media = await Media.findById(id);

    if (!media) {
      res.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    const updateData: any = {
      moderationStatus: status,
      isHidden: status === "rejected",
    };

    if (adminNotes) {
      updateData.adminModerationNotes = adminNotes;
    }

    await Media.findByIdAndUpdate(id, updateData);

    // Invalidate cache when content becomes publicly visible (approved)
    if (status === "approved") {
      await cacheService.del("media:public:all-content");
    }

    // Log admin action
    await AuditService.logAdminAction(
      adminId!,
      "update_moderation_status",
      id,
      { status, adminNotes },
      req.ip,
      req.get("User-Agent")
    );

    // If rejected, notify user
    if (status === "rejected" && media.uploadedBy) {
      const uploader = await User.findById(media.uploadedBy);
      if (uploader && uploader.email) {
        try {
          await resendEmailService.sendContentRemovedEmail(
            uploader.email,
            uploader.firstName || "User",
            media.title,
            adminNotes || media.moderationResult?.reason || "Content violates community guidelines",
            media.moderationResult?.flags || []
          );
        } catch (emailError) {
          logger.error("Failed to send content removed email:", emailError);
        }
      }
    }

    logger.info("Moderation status updated", { mediaId: id, adminId, status });

    res.status(200).json({
      success: true,
      message: "Moderation status updated successfully",
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
 * Get admin activity log
 */
export const getAdminActivityLog = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const adminId = req.query.adminId as string;

    const query: any = { action: "admin_action" };
    if (adminId) {
      query.userId = adminId;
    }

    const activityLog = await AuditService.getUserActivityHistory(
      adminId || req.userId!,
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


