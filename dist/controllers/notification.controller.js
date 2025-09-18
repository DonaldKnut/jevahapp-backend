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
exports.NotificationController = void 0;
const notification_service_1 = require("../service/notification.service");
const viralContent_service_1 = __importDefault(require("../service/viralContent.service"));
const mentionDetection_service_1 = __importDefault(require("../service/mentionDetection.service"));
const contentInteraction_service_1 = __importDefault(require("../service/contentInteraction.service"));
const logger_1 = __importDefault(require("../utils/logger"));
class NotificationController {
    /**
     * Get user notifications with pagination
     */
    getUserNotifications(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const { page = 1, limit = 20, type, unreadOnly } = req.query;
                if (!userId) {
                    res.status(401).json({ error: "User not authenticated" });
                    return;
                }
                const notifications = yield notification_service_1.NotificationService.getUserNotifications(userId, Number(page), Number(limit), type);
                res.json({
                    success: true,
                    data: notifications,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to get user notifications:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get notifications",
                });
            }
        });
    }
    /**
     * Mark notification as read
     */
    markAsRead(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const { notificationId } = req.params;
                if (!userId) {
                    res.status(401).json({ error: "User not authenticated" });
                    return;
                }
                const success = yield notification_service_1.NotificationService.markAsRead(notificationId, userId);
                if (success) {
                    res.json({ success: true, message: "Notification marked as read" });
                }
                else {
                    res.status(404).json({
                        success: false,
                        error: "Notification not found",
                    });
                }
            }
            catch (error) {
                logger_1.default.error("Failed to mark notification as read:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to mark notification as read",
                });
            }
        });
    }
    /**
     * Mark all notifications as read
     */
    markAllAsRead(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({ error: "User not authenticated" });
                    return;
                }
                const count = yield notification_service_1.NotificationService.markAllAsRead(userId);
                res.json({
                    success: true,
                    message: `Marked ${count} notifications as read`,
                    count,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to mark all notifications as read:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to mark all notifications as read",
                });
            }
        });
    }
    /**
     * Get notification preferences
     */
    getNotificationPreferences(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({ error: "User not authenticated" });
                    return;
                }
                const preferences = yield notification_service_1.NotificationService.getNotificationPreferences(userId);
                res.json({
                    success: true,
                    data: preferences,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to get notification preferences:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get notification preferences",
                });
            }
        });
    }
    /**
     * Update notification preferences
     */
    updateNotificationPreferences(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const preferences = req.body;
                if (!userId) {
                    res.status(401).json({ error: "User not authenticated" });
                    return;
                }
                const updatedPreferences = yield notification_service_1.NotificationService.updateNotificationPreferences(userId, preferences);
                res.json({
                    success: true,
                    data: updatedPreferences,
                    message: "Notification preferences updated",
                });
            }
            catch (error) {
                logger_1.default.error("Failed to update notification preferences:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to update notification preferences",
                });
            }
        });
    }
    /**
     * Share content
     */
    shareContent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                const { contentId, contentType, sharePlatform } = req.body;
                if (!userId) {
                    res.status(401).json({ error: "User not authenticated" });
                    return;
                }
                if (!contentId || !contentType) {
                    res.status(400).json({
                        error: "Content ID and type are required",
                    });
                    return;
                }
                const result = yield contentInteraction_service_1.default.shareContent(userId, contentId, contentType, sharePlatform);
                res.json({
                    success: true,
                    data: result,
                    message: "Content shared successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Failed to share content:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to share content",
                });
            }
        });
    }
    /**
     * Get trending content
     */
    getTrendingContent(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { contentType = "media", limit = 10, timeRange = "24h", } = req.query;
                const trending = yield viralContent_service_1.default.getTrendingContent(contentType, Number(limit), timeRange);
                res.json({
                    success: true,
                    data: trending,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to get trending content:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get trending content",
                });
            }
        });
    }
    /**
     * Get mention suggestions
     */
    getMentionSuggestions(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { q: query, limit = 10 } = req.query;
                if (!query || typeof query !== "string") {
                    res.status(400).json({
                        error: "Query parameter is required",
                    });
                    return;
                }
                const suggestions = yield mentionDetection_service_1.default.getMentionSuggestions(query, Number(limit));
                res.json({
                    success: true,
                    data: suggestions,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to get mention suggestions:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get mention suggestions",
                });
            }
        });
    }
    /**
     * Get viral content statistics
     */
    getViralStats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield viralContent_service_1.default.getViralStats();
                res.json({
                    success: true,
                    data: stats,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to get viral stats:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get viral statistics",
                });
            }
        });
    }
    /**
     * Get notification statistics
     */
    getNotificationStats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                if (!userId) {
                    res.status(401).json({ error: "User not authenticated" });
                    return;
                }
                const stats = yield notification_service_1.NotificationService.getNotificationStats(userId);
                res.json({
                    success: true,
                    data: stats,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to get notification stats:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get notification statistics",
                });
            }
        });
    }
}
exports.NotificationController = NotificationController;
exports.default = new NotificationController();
