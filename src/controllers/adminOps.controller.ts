import { Request, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { MediaReport } from "../models/mediaReport.model";
import { AuditService } from "../service/audit.service";
import resendEmailService from "../service/resendEmail.service";
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

    const { userIds, emails, churchIds, subject, message, html } = req.body || {};

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
        failed: recipients.length - sent,
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

    const [media, total] = await Promise.all([
      Media.find(filter)
        .select(
          "title contentType thumbnailUrl moderationStatus isHidden reportCount likeCount viewCount createdAt uploadedBy"
        )
        .populate("uploadedBy", "firstName lastName email username avatar role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Media.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        media: (media as any[]).map(m => ({
          id: m._id.toString(),
          title: m.title,
          contentType: m.contentType,
          thumbnailUrl: m.thumbnailUrl,
          moderationStatus: m.moderationStatus,
          isHidden: m.isHidden,
          reportCount: m.reportCount || 0,
          likeCount: m.likeCount || 0,
          viewCount: m.viewCount || 0,
          createdAt: m.createdAt,
          uploader: m.uploadedBy
            ? {
                id: m.uploadedBy._id?.toString?.() || m.uploadedBy.toString(),
                firstName: m.uploadedBy.firstName,
                lastName: m.uploadedBy.lastName,
                email: m.uploadedBy.email,
                username: m.uploadedBy.username,
                avatar: m.uploadedBy.avatar,
                role: m.uploadedBy.role,
              }
            : null,
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
