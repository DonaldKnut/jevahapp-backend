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
const mongoose_1 = require("mongoose");
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
                    contentOwner = yield user_model_1.User.findById(content.submittedBy);
                }
                // Prevent self-notifications
                if (!liker ||
                    !content ||
                    !contentOwner ||
                    likerId === contentOwner._id.toString()) {
                    logger_1.default.info("Skipping self-notification for content like", {
                        likerId,
                        contentOwnerId: contentOwner === null || contentOwner === void 0 ? void 0 : contentOwner._id.toString(),
                        contentId,
                        contentType,
                    });
                    return;
                }
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
                    contentOwner = yield user_model_1.User.findById(content.submittedBy);
                }
                // Prevent self-notifications
                if (!commenter ||
                    !content ||
                    !contentOwner ||
                    commenterId === contentOwner._id.toString()) {
                    logger_1.default.info("Skipping self-notification for content comment", {
                        commenterId,
                        contentOwnerId: contentOwner === null || contentOwner === void 0 ? void 0 : contentOwner._id.toString(),
                        contentId,
                        contentType,
                    });
                    return;
                }
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
     * Send notification for content share
     */
    static notifyContentShare(sharerId, contentId, contentType, sharePlatform) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sharer = yield user_model_1.User.findById(sharerId);
                let content, contentOwner;
                if (contentType === "media") {
                    content = yield media_model_1.Media.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.uploadedBy);
                }
                else if (contentType === "devotional") {
                    content = yield devotional_model_1.Devotional.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.submittedBy);
                }
                // Prevent self-notifications
                if (!sharer ||
                    !content ||
                    !contentOwner ||
                    sharerId === contentOwner._id.toString()) {
                    logger_1.default.info("Skipping self-notification for content share", {
                        sharerId,
                        contentOwnerId: contentOwner === null || contentOwner === void 0 ? void 0 : contentOwner._id.toString(),
                        contentId,
                        contentType,
                    });
                    return;
                }
                const platformText = sharePlatform ? ` on ${sharePlatform}` : "";
                yield this.createNotification({
                    userId: contentOwner._id.toString(),
                    type: "share",
                    title: "Content Shared",
                    message: `${sharer.firstName || sharer.email} shared your ${contentType}${platformText}`,
                    metadata: {
                        actorName: sharer.firstName || sharer.email,
                        actorAvatar: sharer.avatar,
                        contentTitle: content.title,
                        contentType,
                        thumbnailUrl: content.thumbnailUrl,
                        sharePlatform,
                        shareCount: content.shareCount || 0,
                    },
                    priority: "medium",
                    relatedId: contentId,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send share notification:", error);
            }
        });
    }
    /**
     * Send notification for content mention in comment
     */
    static notifyContentMention(mentionerId, mentionedUserId, contentId, contentType, commentText) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const mentioner = yield user_model_1.User.findById(mentionerId);
                const mentionedUser = yield user_model_1.User.findById(mentionedUserId);
                let content;
                if (contentType === "media") {
                    content = yield media_model_1.Media.findById(contentId);
                }
                else if (contentType === "devotional") {
                    content = yield devotional_model_1.Devotional.findById(contentId);
                }
                // Prevent self-mentions
                if (!mentioner ||
                    !mentionedUser ||
                    !content ||
                    mentionerId === mentionedUserId) {
                    logger_1.default.info("Skipping self-mention notification", {
                        mentionerId,
                        mentionedUserId,
                        contentId,
                        contentType,
                    });
                    return;
                }
                yield this.createNotification({
                    userId: mentionedUserId,
                    type: "mention",
                    title: "You were mentioned",
                    message: `${mentioner.firstName || mentioner.email} mentioned you in a comment`,
                    metadata: {
                        actorName: mentioner.firstName || mentioner.email,
                        actorAvatar: mentioner.avatar,
                        contentTitle: content.title,
                        contentType,
                        thumbnailUrl: content.thumbnailUrl,
                        commentText: commentText.substring(0, 100),
                    },
                    priority: "high",
                    relatedId: contentId,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send mention notification:", error);
            }
        });
    }
    /**
     * Send notification for viral/trending content
     */
    static notifyViralContent(contentId, contentType, milestone, count) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let content, contentOwner;
                if (contentType === "media") {
                    content = yield media_model_1.Media.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.uploadedBy);
                }
                else if (contentType === "devotional") {
                    content = yield devotional_model_1.Devotional.findById(contentId);
                    contentOwner = yield user_model_1.User.findById(content.submittedBy);
                }
                if (!content || !contentOwner)
                    return;
                const milestoneMessages = {
                    views: `${count.toLocaleString()} views`,
                    likes: `${count.toLocaleString()} likes`,
                    shares: `${count.toLocaleString()} shares`,
                    comments: `${count.toLocaleString()} comments`,
                };
                yield this.createNotification({
                    userId: contentOwner._id.toString(),
                    type: "milestone",
                    title: "🎉 Content Milestone!",
                    message: `Your ${contentType} "${content.title}" reached ${milestoneMessages[milestone]}`,
                    metadata: {
                        contentTitle: content.title,
                        contentType,
                        thumbnailUrl: content.thumbnailUrl,
                        milestone,
                        count,
                    },
                    priority: "high",
                    relatedId: contentId,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send viral content notification:", error);
            }
        });
    }
    /**
     * Send public activity notification to followers
     */
    static notifyPublicActivity(actorId, action, targetId, targetType, targetTitle) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const actor = yield user_model_1.User.findById(actorId);
                if (!actor)
                    return;
                // Get actor's followers
                const followers = yield user_model_1.User.find({
                    _id: { $in: actor.followers || [] },
                    "notificationPreferences.publicActivity": true,
                });
                if (followers.length === 0)
                    return;
                const actionMessages = {
                    like: "liked",
                    comment: "commented on",
                    share: "shared",
                    follow: "started following",
                };
                const actionText = actionMessages[action] || action;
                const targetText = targetTitle ? `"${targetTitle}"` : `a ${targetType}`;
                // Send to all followers
                const notifications = followers.map(follower => ({
                    userId: follower._id.toString(),
                    type: "public_activity",
                    title: "Activity Update",
                    message: `${actor.firstName || actor.email} ${actionText} ${targetText}`,
                    metadata: {
                        actorName: actor.firstName || actor.email,
                        actorAvatar: actor.avatar,
                        action,
                        targetType,
                        targetTitle,
                    },
                    priority: "low",
                    relatedId: targetId,
                }));
                // Create notifications in batch
                for (const notificationData of notifications) {
                    yield this.createNotification(notificationData);
                }
                logger_1.default.info("Public activity notifications sent", {
                    actorId,
                    action,
                    targetType,
                    followerCount: followers.length,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send public activity notifications:", error);
            }
        });
    }
    /**
     * Get notification preferences for user
     */
    static getNotificationPreferences(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findById(userId).select("pushNotifications");
                return (user === null || user === void 0 ? void 0 : user.pushNotifications) || {};
            }
            catch (error) {
                logger_1.default.error("Failed to get notification preferences:", error);
                return {};
            }
        });
    }
    /**
     * Update notification preferences for user
     */
    static updateNotificationPreferences(userId, preferences) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findByIdAndUpdate(userId, { $set: { pushNotifications: preferences } }, { new: true }).select("pushNotifications");
                return (user === null || user === void 0 ? void 0 : user.pushNotifications) || {};
            }
            catch (error) {
                logger_1.default.error("Failed to update notification preferences:", error);
                throw error;
            }
        });
    }
    /**
     * Get notification statistics for user
     */
    static getNotificationStats(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [total, unread, byType] = yield Promise.all([
                    notification_model_1.Notification.countDocuments({ user: userId }),
                    notification_model_1.Notification.countDocuments({ user: userId, isRead: false }),
                    notification_model_1.Notification.aggregate([
                        { $match: { user: new mongoose_1.Types.ObjectId(userId) } },
                        { $group: { _id: "$type", count: { $sum: 1 } } },
                    ]),
                ]);
                return {
                    total,
                    unread,
                    byType: byType.reduce((acc, item) => {
                        acc[item._id] = item.count;
                        return acc;
                    }, {}),
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get notification stats:", error);
                return { total: 0, unread: 0, byType: {} };
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
