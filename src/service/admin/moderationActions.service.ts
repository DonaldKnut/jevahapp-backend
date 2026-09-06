import { Types } from "mongoose";
import { Media } from "../../models/media.model";
import { User } from "../../models/user.model";
import { MediaReport } from "../../models/mediaReport.model";
import { AuditService } from "../audit.service";
import resendEmailService from "../resendEmail.service";
import cacheService from "../cache.service";
import fileUploadService from "../fileUpload.service";
import { enqueueMediaPostUpload } from "../../queues/enqueue";
import { recordReviewerOutcome } from "./recordReviewerOutcome";
import { NotificationService } from "../notification.service";
import logger from "../../utils/logger";

export const MODERATION_STATUSES = [
  "approved",
  "rejected",
  "under_review",
  "pending",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

/** Map Next/UI aliases onto canonical moderation statuses. */
export function normalizeModerationStatusInput(
  raw: unknown
): ModerationStatus | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (s === "flagged") return "under_review";
  if ((MODERATION_STATUSES as readonly string[]).includes(s)) {
    return s as ModerationStatus;
  }
  return null;
}

export const REPORT_REVIEW_STATUSES = [
  "reviewed",
  "resolved",
  "dismissed",
] as const;
export type ReportReviewStatus = (typeof REPORT_REVIEW_STATUSES)[number];

/**
 * Same semantics as PATCH /api/admin/moderation/:id/status
 */
export async function applyModerationStatus(params: {
  mediaId: string;
  status: ModerationStatus;
  adminNotes?: string;
  adminId: string;
  ip?: string;
  userAgent?: string;
  /** When true, skip per-item audit (bulk logs once) */
  skipAudit?: boolean;
}): Promise<{ id: string; moderationStatus: ModerationStatus }> {
  const { mediaId, status, adminNotes, adminId, ip, userAgent, skipAudit } =
    params;

  if (!Types.ObjectId.isValid(mediaId)) {
    throw Object.assign(new Error("Invalid media ID"), { code: "INVALID_ID" });
  }

  const media = await Media.findById(mediaId);
  if (!media) {
    throw Object.assign(new Error("Media not found"), { code: "NOT_FOUND" });
  }

  const playableUrl = [media.playbackUrl, media.hlsUrl, media.fileUrl]
    .map(u => String(u || ""))
    .find(u => u.startsWith("http"));
  const processingDone = ["ready", "completed"].includes(
    String(media.processing?.status || "").toLowerCase()
  );
  // Admin approve must make feed-visible Media when a playable URL already exists.
  // Only keep isHidden + publishing when there is nothing HTTP to play yet.
  const needsProcessing =
    status === "approved" &&
    !playableUrl &&
    !processingDone &&
    !!media.uploadIntent?.stagingKey?.startsWith("staging/");

  const updateData: any = {
    moderationStatus: status,
  };

  if (status === "approved") {
    if (needsProcessing) {
      updateData.isHidden = true;
      updateData.publicationState = "publishing";
    } else {
      // Same fields mobile feed queries (PUBLIC_MEDIA_FILTER)
      updateData.isHidden = false;
      updateData.publicationState = "live";
      updateData.publishedAt = new Date();
    }
  } else if (status === "rejected") {
    updateData.isHidden = true;
    updateData.publicationState = "tombstoned";
  } else {
    // pending | under_review
    updateData.isHidden = true;
    updateData.publicationState = "staged";
  }

  if (adminNotes) {
    updateData.adminModerationNotes = adminNotes;
  }

  await Media.findByIdAndUpdate(mediaId, { $set: updateData });

  const reviewerStatus =
    status === "approved"
      ? "approved"
      : status === "rejected"
        ? "rejected"
        : "pending";
  await recordReviewerOutcome(
    mediaId,
    adminId,
    reviewerStatus,
    typeof adminNotes === "string" ? adminNotes : undefined
  );

  if (status === "approved") {
    const stagingKey = media.uploadIntent?.stagingKey;
    if (needsProcessing && stagingKey?.startsWith("staging/")) {
      const inputUrl = await fileUploadService.getPresignedGetUrl(
        stagingKey!,
        7200
      );
      enqueueMediaPostUpload({
        mediaId,
        userId: String(media.uploadedBy),
        contentType: media.contentType,
        fileUrl: inputUrl,
        requestId: `admin-approval:${mediaId}`,
        jobIdSuffix: `approval-${Date.now()}`,
        skipModeration: true,
      });
    } else {
      const { invalidateFeedCaches } = await import(
        "../../lib/invalidateFeedCaches"
      );
      await invalidateFeedCaches(mediaId, String(media.uploadedBy));
      await cacheService.del(`media:public:${mediaId}`);
    }
    await cacheService.delPattern("media:public:all-content*");
  }

  if (status === "rejected" || status === "pending" || status === "under_review") {
    const { invalidateFeedCaches } = await import(
      "../../lib/invalidateFeedCaches"
    );
    await invalidateFeedCaches(mediaId, String(media.uploadedBy));
    await cacheService.del(`media:public:${mediaId}`);
    await cacheService.delPattern("media:public:all-content*");
  }

  if (!skipAudit) {
    await AuditService.logAdminAction(
      adminId,
      "update_moderation_status",
      mediaId,
      { status, adminNotes },
      ip,
      userAgent
    );
  }

  if (status === "rejected" && media.uploadedBy) {
    const uploader = await User.findById(media.uploadedBy);
    if (uploader?.email) {
      try {
        await resendEmailService.sendContentRemovedEmail(
          uploader.email,
          uploader.firstName || "User",
          media.title,
          adminNotes ||
            media.moderationResult?.reason ||
            "Content violates community guidelines",
          media.moderationResult?.flags || []
        );
      } catch (emailError) {
        logger.error("Failed to send content removed email:", emailError);
      }
    }
  }

  return { id: mediaId, moderationStatus: status };
}

/**
 * Same semantics as POST /api/admin/reports/media/:reportId/review
 */
export async function applyReportReview(params: {
  reportId: string;
  status: ReportReviewStatus;
  adminNotes?: string;
  adminId: string;
  ip?: string;
  userAgent?: string;
  skipAudit?: boolean;
}): Promise<{ reportId: string; status: ReportReviewStatus; mediaId: string }> {
  const { reportId, status, adminNotes, adminId, ip, userAgent, skipAudit } =
    params;

  if (!Types.ObjectId.isValid(reportId)) {
    throw Object.assign(new Error("Invalid report ID"), { code: "INVALID_ID" });
  }

  const report = await MediaReport.findById(reportId);
  if (!report) {
    throw Object.assign(new Error("Report not found"), { code: "NOT_FOUND" });
  }

  report.status = status as any;
  report.reviewedBy = new Types.ObjectId(adminId);
  report.reviewedAt = new Date();
  if (adminNotes) {
    report.adminNotes = adminNotes.trim();
  }
  await report.save();

  const mediaId = report.mediaId?.toString?.() || String(report.mediaId);

  if (status === "resolved") {
    const media = await Media.findByIdAndUpdate(
      report.mediaId,
      {
        $set: {
          moderationStatus: "rejected",
          isHidden: true,
          publicationState: "tombstoned",
        },
      },
      { new: true }
    );

    if (media) {
      try {
        const { invalidateFeedCaches } = await import(
          "../../lib/invalidateFeedCaches"
        );
        await invalidateFeedCaches(
          String(media._id),
          String(media.uploadedBy || "")
        );
        await cacheService.del(`media:public:${media._id}`);
      } catch {
        /* non-fatal */
      }
    }

    if (media?.uploadedBy) {
      try {
        await NotificationService.createNotification({
          userId: media.uploadedBy.toString(),
          type: "content_moderation",
          title: "Content Removed",
          message: `Your content "${media.title}" was removed after policy review.`,
          metadata: {
            mediaId: media._id.toString(),
            contentType: media.contentType,
            reason: adminNotes || "Report resolved",
          },
          priority: "high",
          relatedId: media._id.toString(),
        });
      } catch (notifError) {
        logger.error(
          "Failed to notify uploader after report resolve:",
          notifError
        );
      }
    }
  }

  if (!skipAudit) {
    try {
      await AuditService.logAdminAction(
        adminId,
        "review_media_report",
        mediaId,
        {
          reportId,
          status,
          adminNotes: adminNotes || undefined,
        },
        ip,
        userAgent
      );
    } catch (auditError) {
      logger.warn("Failed to audit report review", {
        reportId,
        error: (auditError as Error)?.message,
      });
    }
  }

  return { reportId, status, mediaId };
}

export function normalizeBulkIds(raw: unknown, max = 50): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .map((v) => (typeof v === "string" ? v.trim() : String(v || "").trim()))
    .filter(Boolean);
  return [...new Set(ids)].slice(0, max);
}
