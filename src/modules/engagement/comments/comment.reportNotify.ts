/**
 * Fire-and-forget admin notifications for comment reports — off the request hot path.
 */
import { User } from "../../../models/user.model";
import { ReportReason } from "../../../models/mediaReport.model";
import resendEmailService from "../../../service/resendEmail.service";
import { NotificationService } from "../../../service/notification.service";
import logger from "../../../utils/logger";

export interface CommentReportNotifyPayload {
  commentId: string;
  reporterUserId: string;
  reportReason: ReportReason;
  description?: string;
  result: {
    reportCount: number;
    comment: {
      content: string;
      authorEmail: string;
      authorName?: string;
    };
    media: {
      id: string;
      title: string;
      contentType: string;
      uploaderEmail: string;
    };
  };
}

export function notifyAdminsOfCommentReport(payload: CommentReportNotifyPayload): void {
  const { commentId } = payload;
  void (async () => {
    const { reporterUserId, reportReason, description, result } = payload;

    const reporter = await User.findById(reporterUserId).select(
      "firstName lastName email username"
    );
    const reporterName = reporter
      ? `${reporter.firstName || ""} ${reporter.lastName || ""}`.trim() ||
        reporter.username ||
        reporter.email
      : "Unknown User";

    const admins = await User.find({ role: "admin" }).select("email _id");
    const adminEmails = admins.map(a => a.email).filter(Boolean);
    const allRecipientEmails = [...new Set([...adminEmails, "support@jevahapp.com"])];

    if (allRecipientEmails.length > 0) {
      await resendEmailService.sendAdminCommentReportNotification(
        allRecipientEmails,
        result.comment.content,
        result.media.title,
        result.media.contentType,
        result.comment.authorEmail,
        result.comment.authorName || "Unknown",
        reporterName,
        reportReason,
        description,
        commentId,
        result.media.id,
        result.reportCount
      );

      for (const admin of admins) {
        try {
          await NotificationService.createNotification({
            userId: admin._id.toString(),
            type: "content_report",
            title: "New Comment Report",
            message: `${reporterName} reported a comment on "${result.media.title}" - Reason: ${reportReason}`,
            metadata: {
              commentId,
              mediaId: result.media.id,
              contentType: result.media.contentType,
              reportReason,
              reportCount: result.reportCount,
              reporterName,
              commentAuthor: result.comment.authorName,
            },
            priority: result.reportCount >= 3 ? "high" : "medium",
            relatedId: commentId,
          });
        } catch (err) {
          logger.error("Failed to send in-app notification to admin", { err });
        }
      }
    }

    if (result.reportCount >= 3 && allRecipientEmails.length > 0) {
      await resendEmailService.sendAdminModerationAlert(
        allRecipientEmails,
        result.media.title,
        result.media.contentType,
        result.media.uploaderEmail,
        {
          isApproved: false,
          confidence: 0.7,
          reason: `Comment has been reported ${result.reportCount} times`,
          flags: ["multiple_reports", "comment_report"],
          requiresReview: true,
        },
        result.reportCount
      );
    }
  })().catch(err => {
    logger.error("Comment report notify failed", { error: (err as Error).message, commentId });
  });
}
