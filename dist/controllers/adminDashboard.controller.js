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
exports.getAdminActivityLog = exports.updateModerationStatus = exports.getModerationQueue = exports.updateUserRole = exports.unbanUser = exports.banUser = exports.getUserDetails = exports.getUsers = exports.getPlatformAnalytics = void 0;
const mongoose_1 = require("mongoose");
const user_model_1 = require("../models/user.model");
const media_model_1 = require("../models/media.model");
const mediaReport_model_1 = require("../models/mediaReport.model");
const audit_service_1 = require("../service/audit.service");
const resendEmail_service_1 = __importDefault(require("../service/resendEmail.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Get platform-wide analytics and statistics
 */
const getPlatformAnalytics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const [totalUsers, newUsers24h, newUsers7d, newUsers30d, totalMedia, newMedia24h, newMedia7d, newMedia30d, pendingModeration, rejectedContent, totalReports, pendingReports, bannedUsers, activeUsers30d,] = yield Promise.all([
            user_model_1.User.countDocuments(),
            user_model_1.User.countDocuments({ createdAt: { $gte: last24Hours } }),
            user_model_1.User.countDocuments({ createdAt: { $gte: last7Days } }),
            user_model_1.User.countDocuments({ createdAt: { $gte: last30Days } }),
            media_model_1.Media.countDocuments(),
            media_model_1.Media.countDocuments({ createdAt: { $gte: last24Hours } }),
            media_model_1.Media.countDocuments({ createdAt: { $gte: last7Days } }),
            media_model_1.Media.countDocuments({ createdAt: { $gte: last30Days } }),
            media_model_1.Media.countDocuments({
                moderationStatus: { $in: ["pending", "under_review"] },
            }),
            media_model_1.Media.countDocuments({ moderationStatus: "rejected" }),
            mediaReport_model_1.MediaReport.countDocuments(),
            mediaReport_model_1.MediaReport.countDocuments({ status: "pending" }),
            user_model_1.User.countDocuments({ isBanned: true }),
            user_model_1.User.countDocuments({
                lastLoginAt: { $gte: last30Days },
            }),
        ]);
        // Get user role distribution
        const roleDistribution = yield user_model_1.User.aggregate([
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 },
                },
            },
        ]);
        // Get content type distribution
        const contentTypeDistribution = yield media_model_1.Media.aggregate([
            {
                $group: {
                    _id: "$contentType",
                    count: { $sum: 1 },
                },
            },
        ]);
        // Get moderation status distribution
        const moderationDistribution = yield media_model_1.Media.aggregate([
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
                    roleDistribution: roleDistribution.reduce((acc, item) => {
                        acc[item._id || "none"] = item.count;
                        return acc;
                    }, {}),
                },
                content: {
                    total: totalMedia,
                    new24h: newMedia24h,
                    new7d: newMedia7d,
                    new30d: newMedia30d,
                    contentTypeDistribution: contentTypeDistribution.reduce((acc, item) => {
                        acc[item._id || "none"] = item.count;
                        return acc;
                    }, {}),
                },
                moderation: {
                    pending: pendingModeration,
                    rejected: rejectedContent,
                    statusDistribution: moderationDistribution.reduce((acc, item) => {
                        acc[item._id || "none"] = item.count;
                        return acc;
                    }, {}),
                },
                reports: {
                    total: totalReports,
                    pending: pendingReports,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Get platform analytics error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch platform analytics",
        });
    }
});
exports.getPlatformAnalytics = getPlatformAnalytics;
/**
 * Get all users with advanced filtering and pagination
 */
const getUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const query = {};
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
        const [users, total] = yield Promise.all([
            user_model_1.User.find(query)
                .select("-password -verificationCode -resetPasswordToken")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            user_model_1.User.countDocuments(query),
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
    }
    catch (error) {
        logger_1.default.error("Get users error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch users",
        });
    }
});
exports.getUsers = getUsers;
/**
 * Get single user details
 */
const getUserDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid user ID",
            });
            return;
        }
        const user = yield user_model_1.User.findById(id).select("-password -verificationCode -resetPasswordToken");
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        // Get user activity stats
        const activityStats = yield audit_service_1.AuditService.getUserDashboardStats(id);
        // Get user's media count
        const mediaCount = yield media_model_1.Media.countDocuments({ uploadedBy: id });
        // Get user's reports count
        const reportsCount = yield mediaReport_model_1.MediaReport.countDocuments({ reportedBy: id });
        res.status(200).json({
            success: true,
            data: {
                user,
                stats: Object.assign(Object.assign({}, activityStats), { mediaCount,
                    reportsCount }),
            },
        });
    }
    catch (error) {
        logger_1.default.error("Get user details error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user details",
        });
    }
});
exports.getUserDetails = getUserDetails;
/**
 * Ban a user
 */
const banUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { reason, duration } = req.body;
        const adminId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid user ID",
            });
            return;
        }
        const user = yield user_model_1.User.findById(id);
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
        yield user_model_1.User.findByIdAndUpdate(id, {
            isBanned: true,
            banReason: reason || "Violation of community guidelines",
            bannedAt: new Date(),
            banUntil,
            bannedBy: new mongoose_1.Types.ObjectId(adminId),
        });
        // Log admin action
        yield audit_service_1.AuditService.logAdminAction(adminId, "ban_user", id, { reason, duration, banUntil }, req.ip, req.get("User-Agent"));
        logger_1.default.info("User banned", { userId: id, adminId, reason });
        res.status(200).json({
            success: true,
            message: "User banned successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Ban user error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to ban user",
        });
    }
});
exports.banUser = banUser;
/**
 * Unban a user
 */
const unbanUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const adminId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid user ID",
            });
            return;
        }
        const user = yield user_model_1.User.findById(id);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        yield user_model_1.User.findByIdAndUpdate(id, {
            isBanned: false,
            banReason: undefined,
            bannedAt: undefined,
            banUntil: undefined,
            bannedBy: undefined,
        });
        // Log admin action
        yield audit_service_1.AuditService.logAdminAction(adminId, "unban_user", id, {}, req.ip, req.get("User-Agent"));
        logger_1.default.info("User unbanned", { userId: id, adminId });
        res.status(200).json({
            success: true,
            message: "User unbanned successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Unban user error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to unban user",
        });
    }
});
exports.unbanUser = unbanUser;
/**
 * Update user role
 */
const updateUserRole = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const adminId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
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
        const user = yield user_model_1.User.findById(id);
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
        yield user_model_1.User.findByIdAndUpdate(id, { role });
        // Log admin action
        yield audit_service_1.AuditService.logAdminAction(adminId, "update_user_role", id, { oldRole, newRole: role }, req.ip, req.get("User-Agent"));
        logger_1.default.info("User role updated", { userId: id, adminId, oldRole, newRole: role });
        res.status(200).json({
            success: true,
            message: "User role updated successfully",
            data: { userId: id, oldRole, newRole: role },
        });
    }
    catch (error) {
        logger_1.default.error("Update user role error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update user role",
        });
    }
});
exports.updateUserRole = updateUserRole;
/**
 * Get moderation queue
 */
const getModerationQueue = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const query = {
            moderationStatus: status
                ? status
                : { $in: ["pending", "under_review"] },
        };
        const [media, total] = yield Promise.all([
            media_model_1.Media.find(query)
                .populate("uploadedBy", "firstName lastName email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            media_model_1.Media.countDocuments(query),
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
    }
    catch (error) {
        logger_1.default.error("Get moderation queue error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch moderation queue",
        });
    }
});
exports.getModerationQueue = getModerationQueue;
/**
 * Update moderation status (admin override)
 */
const updateModerationStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const { status, adminNotes } = req.body;
        const adminId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
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
        const media = yield media_model_1.Media.findById(id);
        if (!media) {
            res.status(404).json({
                success: false,
                message: "Media not found",
            });
            return;
        }
        const updateData = {
            moderationStatus: status,
            isHidden: status === "rejected",
        };
        if (adminNotes) {
            updateData.adminModerationNotes = adminNotes;
        }
        yield media_model_1.Media.findByIdAndUpdate(id, updateData);
        // Log admin action
        yield audit_service_1.AuditService.logAdminAction(adminId, "update_moderation_status", id, { status, adminNotes }, req.ip, req.get("User-Agent"));
        // If rejected, notify user
        if (status === "rejected" && media.uploadedBy) {
            const uploader = yield user_model_1.User.findById(media.uploadedBy);
            if (uploader && uploader.email) {
                try {
                    yield resendEmail_service_1.default.sendContentRemovedEmail(uploader.email, uploader.firstName || "User", media.title, adminNotes || ((_a = media.moderationResult) === null || _a === void 0 ? void 0 : _a.reason) || "Content violates community guidelines", ((_b = media.moderationResult) === null || _b === void 0 ? void 0 : _b.flags) || []);
                }
                catch (emailError) {
                    logger_1.default.error("Failed to send content removed email:", emailError);
                }
            }
        }
        logger_1.default.info("Moderation status updated", { mediaId: id, adminId, status });
        res.status(200).json({
            success: true,
            message: "Moderation status updated successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Update moderation status error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update moderation status",
        });
    }
});
exports.updateModerationStatus = updateModerationStatus;
/**
 * Get admin activity log
 */
const getAdminActivityLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const adminId = req.query.adminId;
        const query = { action: "admin_action" };
        if (adminId) {
            query.userId = adminId;
        }
        const activityLog = yield audit_service_1.AuditService.getUserActivityHistory(adminId || req.userId, page, limit, "admin_action");
        res.status(200).json({
            success: true,
            data: activityLog,
        });
    }
    catch (error) {
        logger_1.default.error("Get admin activity log error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin activity log",
        });
    }
});
exports.getAdminActivityLog = getAdminActivityLog;
