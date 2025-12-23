import { Request, Response } from "express";
import { Types } from "mongoose";
import { MediaReport, ReportReason } from "../models/mediaReport.model";
import { Media } from "../models/media.model";
import { User } from "../models/user.model";
import resendEmailService from "../service/resendEmail.service";
import { NotificationService } from "../service/notification.service";
import logger from "../utils/logger";

interface ReportMediaRequestBody {
  reason: ReportReason;
  description?: string;
}

/**
 * Report inappropriate media content
 */
export const reportMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const { reason, description } = request.body as ReportMediaRequestBody;
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    // Check if media exists
    const media = await Media.findById(id);
    if (!media) {
      response.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    // Check if user is trying to report their own media
    const mediaUploaderId = media.uploadedBy?.toString();
    if (mediaUploaderId === userId) {
      response.status(400).json({
        success: false,
        message: "You cannot report your own content",
      });
      return;
    }

    // Check if user already reported this media
    const existingReport = await MediaReport.findOne({
      mediaId: new Types.ObjectId(id),
      reportedBy: new Types.ObjectId(userId),
    });

    if (existingReport) {
      response.status(400).json({
        success: false,
        message: "You have already reported this media",
      });
      return;
    }

    // Create report
    const report = await MediaReport.create({
      mediaId: new Types.ObjectId(id),
      reportedBy: new Types.ObjectId(userId),
      reason,
      description: description?.trim(),
      status: "pending",
    });

    // Get reporter information
    const reporter = await User.findById(userId).select("firstName lastName email username");
    const reporterName = reporter 
      ? `${reporter.firstName || ""} ${reporter.lastName || ""}`.trim() || reporter.username || reporter.email
      : "Unknown User";

    // Get media uploader information
    const uploader = await User.findById(media.uploadedBy).select("email");
    const uploaderEmail = uploader?.email || "Unknown";

    // Increment report count on media
    const newReportCount = (media.reportCount || 0) + 1;
    await Media.findByIdAndUpdate(id, {
      $inc: { reportCount: 1 },
      // If report count reaches threshold, set to under_review
      $set: {
        moderationStatus:
          newReportCount >= 3
            ? "under_review"
            : media.moderationStatus || "pending",
      },
    });

    // Send email notification to admins on EVERY report
    try {
      const admins = await User.find({ role: "admin" }).select("email _id");
      const adminEmails = admins.map(admin => admin.email).filter(Boolean);
      
      // Always include support@jevahapp.com in the recipient list
      const supportEmail = "support@jevahapp.com";
      const allRecipientEmails = [...new Set([...adminEmails, supportEmail])];

      if (allRecipientEmails.length > 0) {
        // Send email notification
        await resendEmailService.sendAdminReportNotification(
          allRecipientEmails,
          media.title,
          media.contentType,
          uploaderEmail,
          reporterName,
          reason,
          description,
          id,
          newReportCount
        );

        // Send in-app notification to all admins
        for (const admin of admins) {
          try {
            await NotificationService.createNotification({
              userId: admin._id.toString(),
              type: "content_report",
              title: "New Content Report",
              message: `${reporterName} reported "${media.title}" - Reason: ${reason}`,
              metadata: {
                mediaId: id,
                contentType: media.contentType,
                reportId: report._id.toString(),
                reportReason: reason,
                reportCount: newReportCount,
                reporterName,
              },
              priority: newReportCount >= 3 ? "high" : "medium",
              relatedId: id,
            });
          } catch (notifError) {
            logger.error("Failed to send in-app notification to admin:", notifError);
          }
        }

        logger.info("Admin notifications sent for report", {
          mediaId: id,
          reportId: report._id,
          adminCount: admins.length,
          totalRecipientCount: allRecipientEmails.length,
          recipientEmails: allRecipientEmails,
          reportCount: newReportCount,
        });
      }
    } catch (emailError) {
      logger.error("Failed to send admin notifications for report:", emailError);
      // Don't fail the report submission if email fails
    }

    // If report count reaches threshold (3+), also send moderation alert
    if (newReportCount >= 3) {
      try {
        const admins = await User.find({ role: "admin" }).select("email");
        const adminEmails = admins.map(admin => admin.email).filter(Boolean);
        
        // Always include support@jevahapp.com in the recipient list
        const supportEmail = "support@jevahapp.com";
        const allRecipientEmails = [...new Set([...adminEmails, supportEmail])];

        if (allRecipientEmails.length > 0) {
          await resendEmailService.sendAdminModerationAlert(
            allRecipientEmails,
            media.title,
            media.contentType,
            uploaderEmail,
            {
              isApproved: false,
              confidence: 0.7,
              reason: `Content has been reported ${newReportCount} times`,
              flags: ["multiple_reports"],
              requiresReview: true,
            },
            newReportCount
          );
        }
      } catch (thresholdEmailError) {
        logger.error("Failed to send threshold alert:", thresholdEmailError);
      }
    }

    logger.info("Media reported", {
      mediaId: id,
      userId,
      reason,
    });

    response.status(201).json({
      success: true,
      message: "Media reported successfully",
      report: {
        _id: report._id,
        mediaId: report.mediaId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error: any) {
    logger.error("Report media error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to report media",
    });
  }
};

/**
 * Get reports for a specific media (admin only)
 */
export const getMediaReports = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const userRole = request.userRole;

    if (userRole !== "admin") {
      response.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
      });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    const reports = await MediaReport.find({
      mediaId: new Types.ObjectId(id),
    })
      .populate("reportedBy", "firstName lastName username email")
      .populate("reviewedBy", "firstName lastName username")
      .sort({ createdAt: -1 });

    response.status(200).json({
      success: true,
      reports,
      count: reports.length,
    });
  } catch (error: any) {
    logger.error("Get media reports error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve reports",
    });
  }
};

/**
 * Get all pending reports (admin only)
 */
export const getAllPendingReports = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userRole = request.userRole;

    if (userRole !== "admin") {
      response.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
      });
      return;
    }

    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const reports = await MediaReport.find({ status: "pending" })
      .populate("mediaId", "title contentType thumbnailUrl")
      .populate("reportedBy", "firstName lastName username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await MediaReport.countDocuments({ status: "pending" });

    response.status(200).json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error("Get all pending reports error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve reports",
    });
  }
};

/**
 * Review a report (admin only)
 */
export const reviewReport = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { reportId } = request.params;
    const { status, adminNotes } = request.body;
    const userId = request.userId;
    const userRole = request.userRole;

    if (userRole !== "admin") {
      response.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
      });
      return;
    }

    if (!Types.ObjectId.isValid(reportId)) {
      response.status(400).json({
        success: false,
        message: "Invalid report ID",
      });
      return;
    }

    if (!["reviewed", "resolved", "dismissed"].includes(status)) {
      response.status(400).json({
        success: false,
        message: "Invalid status. Must be 'reviewed', 'resolved', or 'dismissed'",
      });
      return;
    }

    const report = await MediaReport.findById(reportId);
    if (!report) {
      response.status(404).json({
        success: false,
        message: "Report not found",
      });
      return;
    }

    // Update report
    report.status = status as any;
    report.reviewedBy = new Types.ObjectId(userId!);
    report.reviewedAt = new Date();
    if (adminNotes) {
      report.adminNotes = adminNotes.trim();
    }
    await report.save();

    // If resolved, update media moderation status
    if (status === "resolved") {
      await Media.findByIdAndUpdate(report.mediaId, {
        moderationStatus: "rejected",
        isHidden: true,
      });
    }

    response.status(200).json({
      success: true,
      message: "Report reviewed successfully",
      report,
    });
  } catch (error: any) {
    logger.error("Review report error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to review report",
    });
  }
};

