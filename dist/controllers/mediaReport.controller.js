"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewReport = exports.getAllPendingReports = exports.getMediaReports = exports.reportMedia = void 0;
const mongoose_1 = require("mongoose");
const mediaReport_model_1 = require("../models/mediaReport.model");
const media_model_1 = require("../models/media.model");
const user_model_1 = require("../models/user.model");
const resendEmail_service_1 = __importDefault(require("../service/resendEmail.service"));
const notification_service_1 = require("../service/notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Report inappropriate media content
 */
const reportMedia = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = request.params;
        const { reason, description } = request.body;
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        // Check if media exists
        const media = yield media_model_1.Media.findById(id);
        if (!media) {
            response.status(404).json({
                success: false,
                message: "Media not found",
            });
            return;
        }
        // Check if user is trying to report their own media
        const mediaUploaderId = (_a = media.uploadedBy) === null || _a === void 0 ? void 0 : _a.toString();
        if (mediaUploaderId === userId) {
            response.status(400).json({
                success: false,
                message: "You cannot report your own content",
            });
            return;
        }
        // Check if user already reported this media
        const existingReport = yield mediaReport_model_1.MediaReport.findOne({
            mediaId: new mongoose_1.Types.ObjectId(id),
            reportedBy: new mongoose_1.Types.ObjectId(userId),
        });
        if (existingReport) {
            response.status(400).json({
                success: false,
                message: "You have already reported this media",
            });
            return;
        }
        // Create report
        const report = yield mediaReport_model_1.MediaReport.create({
            mediaId: new mongoose_1.Types.ObjectId(id),
            reportedBy: new mongoose_1.Types.ObjectId(userId),
            reason,
            description: description === null || description === void 0 ? void 0 : description.trim(),
            status: "pending",
        });
        // Get reporter information
        const reporter = yield user_model_1.User.findById(userId).select("firstName lastName email username");
        const reporterName = reporter
            ? `${reporter.firstName || ""} ${reporter.lastName || ""}`.trim() || reporter.username || reporter.email
            : "Unknown User";
        // Get media uploader information
        const uploader = yield user_model_1.User.findById(media.uploadedBy).select("email");
        const uploaderEmail = (uploader === null || uploader === void 0 ? void 0 : uploader.email) || "Unknown";
        // Increment report count on media
        const newReportCount = (media.reportCount || 0) + 1;
        yield media_model_1.Media.findByIdAndUpdate(id, {
            $inc: { reportCount: 1 },
            // If report count reaches threshold, set to under_review
            $set: {
                moderationStatus: newReportCount >= 3
                    ? "under_review"
                    : media.moderationStatus || "pending",
            },
        });
        // Send email notification to admins on EVERY report
        try {
            const admins = yield user_model_1.User.find({ role: "admin" }).select("email _id");
            const adminEmails = admins.map(admin => admin.email).filter(Boolean);
            // Always include support@jevahapp.com in the recipient list
            const supportEmail = "support@jevahapp.com";
            const allRecipientEmails = [...new Set([...adminEmails, supportEmail])];
            if (allRecipientEmails.length > 0) {
                // Send email notification
                yield resendEmail_service_1.default.sendAdminReportNotification(allRecipientEmails, media.title, media.contentType, uploaderEmail, reporterName, reason, description, id, newReportCount);
                // Send in-app notification to all admins
                for (const admin of admins) {
                    try {
                        yield notification_service_1.NotificationService.createNotification({
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
                    }
                    catch (notifError) {
                        logger_1.default.error("Failed to send in-app notification to admin:", notifError);
                    }
                }
                logger_1.default.info("Admin notifications sent for report", {
                    mediaId: id,
                    reportId: report._id,
                    adminCount: admins.length,
                    totalRecipientCount: allRecipientEmails.length,
                    recipientEmails: allRecipientEmails,
                    reportCount: newReportCount,
                });
            }
        }
        catch (emailError) {
            logger_1.default.error("Failed to send admin notifications for report:", emailError);
            // Don't fail the report submission if email fails
        }
        // If report count reaches threshold (3+), also send moderation alert
        if (newReportCount >= 3) {
            try {
                const admins = yield user_model_1.User.find({ role: "admin" }).select("email");
                const adminEmails = admins.map(admin => admin.email).filter(Boolean);
                // Always include support@jevahapp.com in the recipient list
                const supportEmail = "support@jevahapp.com";
                const allRecipientEmails = [...new Set([...adminEmails, supportEmail])];
                if (allRecipientEmails.length > 0) {
                    yield resendEmail_service_1.default.sendAdminModerationAlert(allRecipientEmails, media.title, media.contentType, uploaderEmail, {
                        isApproved: false,
                        confidence: 0.7,
                        reason: `Content has been reported ${newReportCount} times`,
                        flags: ["multiple_reports"],
                        requiresReview: true,
                    }, newReportCount);
                }
            }
            catch (thresholdEmailError) {
                logger_1.default.error("Failed to send threshold alert:", thresholdEmailError);
            }
        }
        logger_1.default.info("Media reported", {
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
    }
    catch (error) {
        logger_1.default.error("Report media error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to report media",
        });
    }
});
exports.reportMedia = reportMedia;
/**
 * Get reports for a specific media (admin only)
 */
const getMediaReports = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            response.status(400).json({
                success: false,
                message: "Invalid media ID",
            });
            return;
        }
        const reports = yield mediaReport_model_1.MediaReport.find({
            mediaId: new mongoose_1.Types.ObjectId(id),
        })
            .populate("reportedBy", "firstName lastName username email")
            .populate("reviewedBy", "firstName lastName username")
            .sort({ createdAt: -1 });
        response.status(200).json({
            success: true,
            reports,
            count: reports.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get media reports error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve reports",
        });
    }
});
exports.getMediaReports = getMediaReports;
/**
 * Get all pending reports (admin only)
 */
const getAllPendingReports = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userRole = request.userRole;
        if (userRole !== "admin") {
            response.status(403).json({
                success: false,
                message: "Forbidden: Admin access required",
            });
            return;
        }
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 20;
        const skip = (page - 1) * limit;
        const reports = yield mediaReport_model_1.MediaReport.find({ status: "pending" })
            .populate("mediaId", "title contentType thumbnailUrl")
            .populate("reportedBy", "firstName lastName username email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = yield mediaReport_model_1.MediaReport.countDocuments({ status: "pending" });
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
    }
    catch (error) {
        logger_1.default.error("Get all pending reports error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve reports",
        });
    }
});
exports.getAllPendingReports = getAllPendingReports;
/**
 * Review a report (admin only)
 */
const reviewReport = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(reportId)) {
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
        const report = yield mediaReport_model_1.MediaReport.findById(reportId);
        if (!report) {
            response.status(404).json({
                success: false,
                message: "Report not found",
            });
            return;
        }
        // Update report
        report.status = status;
        report.reviewedBy = new mongoose_1.Types.ObjectId(userId);
        report.reviewedAt = new Date();
        if (adminNotes) {
            report.adminNotes = adminNotes.trim();
        }
        yield report.save();
        // If resolved, update media moderation status
        if (status === "resolved") {
            yield media_model_1.Media.findByIdAndUpdate(report.mediaId, {
                moderationStatus: "rejected",
                isHidden: true,
            });
        }
        response.status(200).json({
            success: true,
            message: "Report reviewed successfully",
            report,
        });
    }
    catch (error) {
        logger_1.default.error("Review report error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to review report",
        });
    }
});
exports.reviewReport = reviewReport;
