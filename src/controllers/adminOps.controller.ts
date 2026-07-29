import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { MediaReport } from "../models/mediaReport.model";
import { AuditService } from "../service/audit.service";
import resendEmailService from "../service/resendEmail.service";
import {
  resolveAdminMediaPreview,
  shapeAdminMediaCard,
} from "../service/admin/mediaPreview.service";
import logger from "../utils/logger";

function getSocketService(): any | null {
  try {
    // Lazy require avoids circular import with app.ts
    return require("../app").socketService || null;
  } catch {
    return null;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /api/admin/users/presence
 * Live socket online users + recent/offline from Mongo lastSeenAt / lastLoginAt
 * Query: status=online|offline|all, page, limit, search
 */
export const getUsersPresence = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = (page - 1) * limit;
    const status = ((req.query.status as string) || "all").toLowerCase();
    const search = (req.query.search as string) || "";

    const socketService = getSocketService();
    const onlineIds = new Set<string>(
      socketService?.getConnectedUserIds?.() ?? []
    );
    const onlineCount = onlineIds.size;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "online") {
      if (onlineIds.size === 0) {
        res.status(200).json({
          success: true,
          data: {
            users: [],
            onlineCount: 0,
            offlineCount: await User.countDocuments(filter),
            pagination: { page, limit, total: 0, pages: 0 },
          },
        });
        return;
      }
      filter._id = { $in: Array.from(onlineIds).map(id => new Types.ObjectId(id)) };
    } else if (status === "offline") {
      if (onlineIds.size > 0) {
        filter._id = {
          $nin: Array.from(onlineIds).map(id => new Types.ObjectId(id)),
        };
      }
    }

    const [users, total, totalUsers] = await Promise.all([
      User.find(filter)
        .select(
          "firstName lastName email username avatar role lastLoginAt lastSeenAt isBanned"
        )
        .sort({ lastLoginAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      User.countDocuments(search ? filter : {}),
    ]);

    const mapped = (users as any[]).map(u => {
      const id = u._id.toString();
      const isOnline = onlineIds.has(id);
      return {
        id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        username: u.username,
        avatar: u.avatar,
        role: u.role,
        isBanned: !!u.isBanned,
        isOnline,
        lastLoginAt: u.lastLoginAt || null,
        lastSeenAt: u.lastSeenAt || u.lastLoginAt || null,
        status: isOnline ? "online" : "offline",
      };
    });

    res.status(200).json({
      success: true,
      data: {
        users: mapped,
        onlineCount,
        offlineCount: Math.max(0, totalUsers - onlineCount),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("Get users presence error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to fetch presence" });
  }
};

/**
 * POST /api/admin/email
 * Send email to users and/or church contacts (Resend)
 * Body: {
 *   userIds?: string[],
 *   emails?: string[],
 *   churchIds?: string[],   // uses Church.contactEmail
 *   subject: string,
 *   message?: string,
 *   html?: string
 * }
 */
export const sendAdminEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { userIds, emails, churchIds, subject, message, html, dryRun } =
      req.body || {};

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      res.status(400).json({ success: false, message: "subject is required" });
      return;
    }
    if ((!message || typeof message !== "string") && (!html || typeof html !== "string")) {
      res.status(400).json({
        success: false,
        message: "message or html body is required",
      });
      return;
    }

    const recipientSet = new Set<string>();
    const churchRecipientMeta: Array<{ churchId: string; email: string; name: string }> = [];

    if (Array.isArray(emails)) {
      for (const e of emails) {
        if (typeof e === "string" && e.includes("@")) {
          recipientSet.add(e.trim().toLowerCase());
        }
      }
    }

    if (Array.isArray(userIds) && userIds.length > 0) {
      const validIds = userIds.filter((id: string) => Types.ObjectId.isValid(id));
      const users = await User.find({ _id: { $in: validIds } })
        .select("email")
        .lean();
      for (const u of users as any[]) {
        if (u.email) recipientSet.add(u.email.toLowerCase());
      }
    }

    if (Array.isArray(churchIds) && churchIds.length > 0) {
      const { Church } = await import("../models/church.model");
      const validIds = churchIds.filter((id: string) => Types.ObjectId.isValid(id));
      const churches = await Church.find({ _id: { $in: validIds } })
        .select("name contactEmail")
        .lean();
      for (const c of churches as any[]) {
        if (c.contactEmail && String(c.contactEmail).includes("@")) {
          const email = String(c.contactEmail).trim().toLowerCase();
          recipientSet.add(email);
          churchRecipientMeta.push({
            churchId: c._id.toString(),
            email,
            name: c.name,
          });
        }
      }
    }

    const recipients = Array.from(recipientSet);
    if (recipients.length === 0) {
      res.status(400).json({
        success: false,
        message:
          "Provide userIds, emails, and/or churchIds (churches need contactEmail)",
      });
      return;
    }
    if (recipients.length > 100) {
      res.status(400).json({
        success: false,
        message: "Maximum 100 recipients per request",
      });
      return;
    }

    const bodyHtml =
      typeof html === "string" && html.trim()
        ? html
        : `<div style="font-family:sans-serif;line-height:1.5">
            <p>${escapeHtml(String(message)).replace(/\n/g, "<br/>")}</p>
            <hr/>
            <p style="color:#888;font-size:12px">Sent by Jevah Admin</p>
          </div>`;

    if (dryRun === true) {
      const { AdminEmailLog } = await import("../models/adminEmailLog.model");
      await AdminEmailLog.create({
        adminId,
        subject: subject.trim(),
        recipientCount: recipients.length,
        recipientsSample: recipients.slice(0, 20),
        dryRun: true,
        sent: 0,
        failed: 0,
        meta: { churchRecipientMeta: churchRecipientMeta.slice(0, 20) },
      });
      await AuditService.logAdminAction(adminId, "send_email_dry_run", undefined, {
        subject: subject.trim(),
        recipientCount: recipients.length,
      });
      res.status(200).json({
        success: true,
        message: `Dry run: would send to ${recipients.length} recipients`,
        data: {
          dryRun: true,
          sent: 0,
          failed: 0,
          recipientCount: recipients.length,
          recipients: recipients.slice(0, 50),
          churchesEmailed: churchRecipientMeta,
        },
      });
      return;
    }

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];
    for (const to of recipients) {
      try {
        await resendEmailService.sendEmail({
          to,
          subject: subject.trim(),
          html: bodyHtml,
        });
        results.push({ email: to, ok: true });
      } catch (err: any) {
        results.push({ email: to, ok: false, error: err.message });
      }
    }

    const sent = results.filter(r => r.ok).length;
    const failed = recipients.length - sent;
    const { AdminEmailLog } = await import("../models/adminEmailLog.model");
    await AdminEmailLog.create({
      adminId,
      subject: subject.trim(),
      recipientCount: recipients.length,
      recipientsSample: recipients.slice(0, 20),
      dryRun: false,
      sent,
      failed,
      meta: { churchRecipientMeta: churchRecipientMeta.slice(0, 20) },
    });

    await AuditService.logAdminAction(adminId, "send_email", undefined, {
      subject: subject.trim(),
      recipientCount: recipients.length,
      sent,
      recipients: recipients.slice(0, 20),
      churchIds: Array.isArray(churchIds) ? churchIds.slice(0, 20) : undefined,
      churchRecipientMeta: churchRecipientMeta.slice(0, 20),
    });

    res.status(200).json({
      success: true,
      message: `Sent ${sent} of ${recipients.length} emails`,
      data: {
        sent,
        failed,
        results,
        churchesEmailed: churchRecipientMeta,
        churchesSkippedNoEmail: Array.isArray(churchIds)
          ? churchIds.length - churchRecipientMeta.length
          : 0,
      },
    });
  } catch (error: any) {
    logger.error("Admin send email error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
};

/**
 * GET /api/admin/email/log
 */
export const listAdminEmailLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const { AdminEmailLog } = await import("../models/adminEmailLog.model");
    const [rows, total] = await Promise.all([
      AdminEmailLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("adminId", "firstName lastName email")
        .lean(),
      AdminEmailLog.countDocuments(),
    ]);
    res.status(200).json({
      success: true,
      data: {
        items: rows.map((r: any) => ({
          id: r._id.toString(),
          subject: r.subject,
          recipientCount: r.recipientCount,
          recipientsSample: r.recipientsSample,
          dryRun: r.dryRun,
          sent: r.sent,
          failed: r.failed,
          admin: r.adminId,
          createdAt: r.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("List email log error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list email log" });
  }
};

/**
 * GET /api/admin/media/recent
 * Recent uploads for dashboard feed
 * Query: page, limit, moderationStatus?, uploadedBy?
 */
export const getRecentUploads = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.moderationStatus) {
      filter.moderationStatus = req.query.moderationStatus;
    }
    if (req.query.uploadedBy && Types.ObjectId.isValid(req.query.uploadedBy as string)) {
      filter.uploadedBy = new Types.ObjectId(req.query.uploadedBy as string);
    }

    const [docs, total] = await Promise.all([
      Media.find(filter)
        .select(
          "title description contentType category thumbnailUrl fileUrl playbackUrl hlsUrl fileObjectKey thumbnailObjectKey uploadIntent moderationStatus moderationResult adminModerationNotes moderationAssignee isHidden reportCount likeCount viewCount publicationState processing uploadedBy createdAt updatedAt"
        )
        .populate("uploadedBy", "firstName lastName email username avatar role")
        .populate("moderationAssignee", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Media.countDocuments(filter),
    ]);

    const media = await Promise.all(
      docs.map(async (doc: any) => {
        const preview = await resolveAdminMediaPreview(doc);
        return shapeAdminMediaCard(doc, preview);
      })
    );

    res.status(200).json({
      success: true,
      data: {
        media,
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
    logger.error("Get recent uploads error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to fetch recent uploads" });
  }
};

/**
 * GET /api/admin/dashboard/feed
 * Combined “what happened” cards for the landing dashboard
 */
export const getDashboardFeed = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 15, 50);

    const [recentUploads, pendingModeration, pendingReports, recentAdminActions, onlineIds] =
      await Promise.all([
        Media.find()
          .select("title contentType thumbnailUrl moderationStatus createdAt uploadedBy")
          .populate("uploadedBy", "firstName lastName email")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean(),
        Media.find({ moderationStatus: { $in: ["pending", "under_review"] } })
          .select("title contentType moderationStatus createdAt uploadedBy")
          .populate("uploadedBy", "firstName lastName email")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        MediaReport.find({ status: "pending" })
          .populate("mediaId", "title contentType thumbnailUrl")
          .populate("reportedBy", "firstName lastName email")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        AuditService.getUserActivityHistory(req.userId!, 1, 20, "admin_action"),
        Promise.resolve(getSocketService()?.getConnectedUserIds?.() ?? []),
      ]);

    const events: Array<{
      type: string;
      at: Date | string;
      title: string;
      meta?: Record<string, unknown>;
    }> = [];

    for (const m of recentUploads as any[]) {
      events.push({
        type: "upload",
        at: m.createdAt,
        title: `Upload: ${m.title}`,
        meta: {
          mediaId: m._id.toString(),
          contentType: m.contentType,
          moderationStatus: m.moderationStatus,
          uploader: m.uploadedBy
            ? {
                id: m.uploadedBy._id?.toString?.(),
                name: `${m.uploadedBy.firstName || ""} ${m.uploadedBy.lastName || ""}`.trim(),
                email: m.uploadedBy.email,
              }
            : null,
        },
      });
    }

    for (const m of pendingModeration as any[]) {
      events.push({
        type: "review",
        at: m.createdAt,
        title: `Needs review: ${m.title}`,
        meta: {
          mediaId: m._id.toString(),
          moderationStatus: m.moderationStatus,
        },
      });
    }

    for (const r of pendingReports as any[]) {
      events.push({
        type: "report",
        at: r.createdAt,
        title: `Report: ${(r.mediaId as any)?.title || "content"} (${r.reason})`,
        meta: {
          reportId: r._id.toString(),
          mediaId: r.mediaId?._id?.toString?.() || r.mediaId?.toString?.(),
          reason: r.reason,
        },
      });
    }

    for (const a of recentAdminActions.activities || []) {
      const action = (a as any).metadata?.adminAction || "admin_action";
      events.push({
        type: action === "delete_media" || action === "send_email" ? action : "admin_action",
        at: (a as any).timestamp || (a as any).createdAt,
        title: `Admin: ${action}`,
        meta: (a as any).metadata || {},
      });
    }

    events.sort(
      (a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()
    );

    res.status(200).json({
      success: true,
      data: {
        events: events.slice(0, limit),
        onlineCount: onlineIds.length,
        pendingReviewCount: pendingModeration.length,
        pendingReportsCount: pendingReports.length,
      },
    });
  } catch (error: any) {
    logger.error("Get dashboard feed error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to fetch dashboard feed" });
  }
};

/**
 * GET /api/admin/notifications?unread=true
 * Admin bell: content_report + moderation_alert for the current admin user.
 */
export const listAdminNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const unreadOnly = req.query.unread === "true";

    const { Notification } = await import("../models/notification.model");
    const query: Record<string, unknown> = {
      user: adminId,
      type: { $in: ["content_report", "moderation_alert", "admin_warning"] },
    };
    if (unreadOnly) query.isRead = false;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({
        user: adminId,
        type: { $in: ["content_report", "moderation_alert"] },
        isRead: false,
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: (items as any[]).map(n => ({
          id: n._id.toString(),
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: !!n.isRead,
          priority: n.priority,
          metadata: n.metadata || {},
          relatedId: n.relatedId?.toString?.() || null,
          createdAt: n.createdAt,
        })),
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("List admin notifications error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to list notifications",
    });
  }
};

/**
 * POST /api/admin/notifications/read
 * { ids: [] } | { all: true }
 */
export const markAdminNotificationsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = req.userId!;
    const { ids, all } = req.body || {};
    const { NotificationService } = await import(
      "../service/notification.service"
    );

    if (all === true) {
      await NotificationService.markAllAsRead(adminId);
      res.status(200).json({ success: true, data: { all: true } });
      return;
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide ids[] or { all: true }",
      });
      return;
    }

    let marked = 0;
    for (const id of ids.slice(0, 100)) {
      if (!Types.ObjectId.isValid(id)) continue;
      try {
        await NotificationService.markAsRead(id, adminId);
        marked += 1;
      } catch {
        // skip missing / not owned
      }
    }

    res.status(200).json({ success: true, data: { marked } });
  } catch (error: any) {
    logger.error("Mark admin notifications read error", {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications read",
    });
  }
};

/**
 * GET /api/admin/audio/copyright-free?search=&page=&limit=
 */
export const listAdminCopyrightFreeAudio = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const search = ((req.query.search as string) || "").trim();
    const { CopyrightFreeSong } = await import(
      "../models/copyrightFreeSong.model"
    );

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { singer: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const [songs, total] = await Promise.all([
      CopyrightFreeSong.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CopyrightFreeSong.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: (songs as any[]).map(s => ({
          id: s._id.toString(),
          title: s.title,
          singer: s.singer,
          category: s.category || null,
          fileUrl: s.fileUrl,
          thumbnailUrl: s.thumbnailUrl || null,
          duration: s.duration ?? null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("List admin copyright-free audio error", {
      error: error.message,
    });
    res.status(500).json({ success: false, message: "Failed to list audio" });
  }
};
