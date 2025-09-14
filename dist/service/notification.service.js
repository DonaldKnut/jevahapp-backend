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
exports.NotificationService = void 0;
const notification_model_1 = require("../models/notification.model");
const user_model_1 = require("../models/user.model");
const media_model_1 = require("../models/media.model");
const devotional_model_1 = require("../models/devotional.model");
const pushNotification_service_1 = __importDefault(require("./pushNotification.service"));
const logger_1 = __importDefault(require("../utils/logger"));
class NotificationService {
    /**
     * Create and send a notification (in-app + push)
     */
    static createNotification(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create in-app notification
                const notification = new notification_model_1.Notification({
                    user: data.userId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    metadata: data.metadata || {},
                    priority: data.priority || "medium",
                    relatedId: data.relatedId,
                });
                yield notification.save();
                // Send push notification
                yield this.sendPushNotification(data.userId, {
                    title: data.title,
                    body: data.message,
                    data: Object.assign({ notificationId: notification._id.toString(), type: data.type }, data.metadata),
                    priority: data.priority === "high" ? "high" : "normal",
                }, data.type);
                logger_1.default.info("Notification created and sent", {
                    userId: data.userId,
                    type: data.type,
                    notificationId: notification._id,
                });
                return notification;
            }
            catch (error) {
                logger_1.default.error("Failed to create notification:", error);
                throw error;
            }
        });
    }
    /**
     * Send notification for user follow
     */
    static notifyUserFollow(followerId, followingId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const follower = yield user_model_1.User.findById(followerId);
                const following = yield user_model_1.User.findById(followingId);
                if (!follower || !following)
                    return;
                yield this.createNotification({
                    userId: followingId,
                    type: "follow",
                    title: "New Follower",
                    message: `${follower.firstName || follower.email} started following you`,
                    metadata: {
                        actorName: follower.firstName || follower.email,
                        actorAvatar: follower.avatar,
                        followerCount: ((_a = following.followers) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    },
                    priority: "medium",
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send follow notification:", error);
            }
        });
    }
    /**
     * Send notification for content like
     */
    static notifyContentLike(likerId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const liker = yield user_model_1.User.findById(likerId);
                let content, contentOwner;
                if (contentType === "media") {
                    content = yield media_model_1.Media.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.uploadedBy);
                }
                else if (contentType === "devotional") {
                    content = yield devotional_model_1.Devotional.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.uploadedBy);
                }
                if (!liker ||
                    !content ||
                    !contentOwner ||
                    likerId === contentOwner._id.toString())
                    return;
                yield this.createNotification({
                    userId: contentOwner._id.toString(),
                    type: "like",
                    title: "New Like",
                    message: `${liker.firstName || liker.email} liked your ${contentType}`,
                    metadata: {
                        actorName: liker.firstName || liker.email,
                        actorAvatar: liker.avatar,
                        contentTitle: content.title,
                        contentType,
                        thumbnailUrl: content.thumbnailUrl,
                        likeCount: content.likeCount || 0,
                    },
                    priority: "low",
                    relatedId: contentId,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send like notification:", error);
            }
        });
    }
    /**
     * Send notification for content comment
     */
    static notifyContentComment(commenterId, contentId, contentType, commentText) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const commenter = yield user_model_1.User.findById(commenterId);
                let content, contentOwner;
                if (contentType === "media") {
                    content = yield media_model_1.Media.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.uploadedBy);
                }
                else if (contentType === "devotional") {
                    content = yield devotional_model_1.Devotional.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.uploadedBy);
                }
                if (!commenter ||
                    !content ||
                    !contentOwner ||
                    commenterId === contentOwner._id.toString())
                    return;
                yield this.createNotification({
                    userId: contentOwner._id.toString(),
                    type: "comment",
                    title: "New Comment",
                    message: `${commenter.firstName || commenter.email} commented on your ${contentType}`,
                    metadata: {
                        actorName: commenter.firstName || commenter.email,
                        actorAvatar: commenter.avatar,
                        contentTitle: content.title,
                        contentType,
                        thumbnailUrl: content.thumbnailUrl,
                        commentText: commentText.substring(0, 100),
                        commentCount: content.commentCount || 0,
                    },
                    priority: "medium",
                    relatedId: contentId,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send comment notification:", error);
            }
        });
    }
    /**
     * Send notification for content download
     */
    static notifyContentDownload(downloaderId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const downloader = yield user_model_1.User.findById(downloaderId);
                let content, contentOwner;
                if (contentType === "media") {
                    content = yield media_model_1.Media.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.uploadedBy);
                }
                if (!downloader ||
                    !content ||
                    !contentOwner ||
                    downloaderId === contentOwner._id.toString())
                    return;
                yield this.createNotification({
                    userId: contentOwner._id.toString(),
                    type: "download",
                    title: "Content Downloaded",
                    message: `${downloader.firstName || downloader.email} downloaded your ${contentType}`,
                    metadata: {
                        actorName: downloader.firstName || downloader.email,
                        actorAvatar: downloader.avatar,
                        contentTitle: content.title,
                        contentType,
                        thumbnailUrl: content.thumbnailUrl,
                        downloadCount: content.downloadCount || 0,
                    },
                    priority: "medium",
                    relatedId: contentId,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send download notification:", error);
            }
        });
    }
    /**
     * Send notification for content bookmark/save
     */
    static notifyContentBookmark(bookmarkerId, contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bookmarker = yield user_model_1.User.findById(bookmarkerId);
                let content, contentOwner;
                if (contentType === "media") {
                    content = yield media_model_1.Media.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.uploadedBy);
                }
                if (!bookmarker ||
                    !content ||
                    !contentOwner ||
                    bookmarkerId === contentOwner._id.toString())
                    return;
                yield this.createNotification({
                    userId: contentOwner._id.toString(),
                    type: "bookmark",
                    title: "Content Saved",
                    message: `${bookmarker.firstName || bookmarker.email} saved your ${contentType} to their library`,
                    metadata: {
                        actorName: bookmarker.firstName || bookmarker.email,
                        actorAvatar: bookmarker.avatar,
                        contentTitle: content.title,
                        contentType,
                        thumbnailUrl: content.thumbnailUrl,
                        bookmarkCount: content.bookmarkCount || 0,
                    },
                    priority: "low",
                    relatedId: contentId,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send bookmark notification:", error);
            }
        });
    }
    /**
     * Send notification for merch purchase
     */
    static notifyMerchPurchase(buyerId, sellerId, merchItem) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const buyer = yield user_model_1.User.findById(buyerId);
                const seller = yield user_model_1.User.findById(sellerId);
                if (!buyer || !seller || buyerId === sellerId)
                    return;
                yield this.createNotification({
                    userId: sellerId,
                    type: "merch_purchase",
                    title: "Merch Purchase",
                    message: `${buyer.firstName || buyer.email} purchased ${merchItem.name}`,
                    metadata: {
                        actorName: buyer.firstName || buyer.email,
                        actorAvatar: buyer.avatar,
                        merchName: merchItem.name,
                        merchPrice: merchItem.price,
                        merchImage: merchItem.imageUrl,
                    },
                    priority: "high",
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send merch purchase notification:", error);
            }
        });
    }
    /**
     * Send notification for milestone achievement
     */
    static notifyMilestone(userId, milestone, count) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createNotification({
                    userId,
                    type: "milestone",
                    title: "Milestone Achieved! 🎉",
                    message: `Congratulations! You've reached ${count} ${milestone}`,
                    metadata: {
                        milestone,
                        count,
                        achievementType: milestone,
                    },
                    priority: "high",
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send milestone notification:", error);
            }
        });
    }
    /**
     * Send push notification
     */
    static sendPushNotification(userId, notification, notificationType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield pushNotification_service_1.default.sendToUser(userId, {
                    title: notification.title,
                    body: notification.body,
                    data: notification.data,
                    priority: notification.priority || "normal",
                    sound: "default",
                }, notificationType);
            }
            catch (error) {
                logger_1.default.error("Failed to send push notification:", error);
            }
        });
    }
    /**
     * Mark notification as read
     */
    static markAsRead(notificationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const notification = yield notification_model_1.Notification.findOneAndUpdate({ _id: notificationId, user: userId }, { isRead: true }, { new: true });
                if (!notification) {
                    throw new Error("Notification not found");
                }
                return notification;
            }
            catch (error) {
                logger_1.default.error("Failed to mark notification as read:", error);
                throw error;
            }
        });
    }
    /**
     * Mark all notifications as read
     */
    static markAllAsRead(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield notification_model_1.Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
            }
            catch (error) {
                logger_1.default.error("Failed to mark all notifications as read:", error);
                throw error;
            }
        });
    }
    /**
     * Get user's notifications with pagination
     */
    static getUserNotifications(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20, type) {
            try {
                const query = { user: userId };
                if (type)
                    query.type = type;
                const [notifications, total, unreadCount] = yield Promise.all([
                    notification_model_1.Notification.find(query)
                        .populate("user", "firstName lastName avatar email")
                        .sort({ createdAt: -1 })
                        .skip((page - 1) * limit)
                        .limit(limit),
                    notification_model_1.Notification.countDocuments(query),
                    notification_model_1.Notification.countDocuments({ user: userId, isRead: false }),
                ]);
                return { notifications, total, unreadCount };
            }
            catch (error) {
                logger_1.default.error("Failed to get user notifications:", error);
                throw error;
            }
        });
    }
}
exports.NotificationService = NotificationService;
exports.default = NotificationService;
