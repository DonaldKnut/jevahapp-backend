import { Notification } from "../models/notification.model";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { Devotional } from "../models/devotional.model";
import PushNotificationService from "./pushNotification.service";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";

export interface CreateNotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  priority?: "low" | "medium" | "high";
  relatedId?: string;
  /** When set, duplicate inserts (retries) are ignored via unique index */
  dedupeKey?: string;
}

export class NotificationService {
  /**
   * Create and send a notification (in-app + push)
   */
  static async createNotification(data: CreateNotificationData): Promise<any> {
    try {
      // Create in-app notification
      const notification = new Notification({
        user: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
        priority: data.priority || "medium",
        relatedId: data.relatedId,
        dedupeKey: data.dedupeKey,
      });

      await notification.save();

      // Durable push via BullMQ worker (survives API crash after Mongo commit)
      const { enqueueNotificationPush } = await import("../queues/enqueue");
      try {
        await enqueueNotificationPush({
          userId: data.userId,
          notificationId: notification._id.toString(),
          title: data.title,
          body: data.message,
          data: {
            notificationId: notification._id.toString(),
            type: data.type,
            ...data.metadata,
          },
          priority: data.priority === "high" ? "high" : "normal",
          notificationType: data.type,
          dedupeKey: data.dedupeKey,
        });
      } catch (enqueueErr: any) {
        logger.error("Push enqueue failed after inbox insert", {
          userId: data.userId,
          notificationId: notification._id,
          error: enqueueErr?.message,
        });
        // Keep inbox record; outbox reconciler (Phase 1) will retry.
      }

      logger.info("Notification created and push enqueued", {
        userId: data.userId,
        type: data.type,
        notificationId: notification._id,
        dedupeKey: data.dedupeKey,
      });

      return notification;
    } catch (error: any) {
      // Duplicate dedupeKey — treat as success (idempotent notification)
      if (error?.code === 11000 && data.dedupeKey) {
        logger.info("Notification dedupe hit — skipping duplicate", {
          userId: data.userId,
          type: data.type,
          dedupeKey: data.dedupeKey,
        });
        return null;
      }
      logger.error("Failed to create notification:", error);
      throw error;
    }
  }

  /**
   * Send notification for user follow
   */
  static async notifyUserFollow(
    followerId: string,
    followingId: string
  ): Promise<void> {
    try {
      const follower = await User.findById(followerId);
      const following = await User.findById(followingId);

      if (!follower || !following) return;

      // No permanent follow dedupeKey — unlike/refollow should notify again.
      // Concurrent duplicate delivery is rare; mutation path is idempotent.
      await this.createNotification({
        userId: followingId,
        type: "follow",
        title: "New Follower",
        message: `${follower.firstName || follower.email} started following you`,
        metadata: {
          actorName: follower.firstName || follower.email,
          actorAvatar: follower.avatar,
          followerCount: following.followers?.length || 0,
        },
        priority: "medium",
      });
    } catch (error) {
      logger.error("Failed to send follow notification:", error);
    }
  }

  /**
   * Send notification for content like
   */
  static async notifyContentLike(
    likerId: string,
    contentId: string,
    contentType: string,
    /** Active Like document id — one notification per like cycle */
    likeId?: string
  ): Promise<void> {
    try {
      const liker = await User.findById(likerId);
      let content, contentOwner;

      if (contentType === "media") {
        content = await Media.findById(contentId);
        if (content?.uploadedBy) {
          contentOwner = await User.findById(content.uploadedBy);
        }
      } else if (contentType === "devotional") {
        content = await Devotional.findById(contentId);
        if (content?.submittedBy) {
          contentOwner = await User.findById(content.submittedBy);
        }
      }

      // Prevent self-notifications
      if (
        !liker ||
        !content ||
        !contentOwner ||
        likerId === contentOwner._id.toString()
      ) {
        logger.info("Skipping self-notification for content like", {
          likerId,
          contentOwnerId: contentOwner?._id.toString(),
          contentId,
          contentType,
        });
        return;
      }

      const ownerId = contentOwner._id.toString();
      // Per-cycle dedupe: same Like _id → suppress retry duplicates;
      // unlike + relike creates a new Like → new notification allowed.
      const dedupeKey = likeId
        ? `like:${likeId}`
        : undefined;

      await this.createNotification({
        userId: ownerId,
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
          likeId,
        },
        priority: "low",
        relatedId: contentId,
        dedupeKey,
      });
    } catch (error) {
      logger.error("Failed to send like notification:", error);
    }
  }

  /**
   * Send notification for content comment
   */
  static async notifyContentComment(
    commenterId: string,
    contentId: string,
    contentType: string,
    commentText: string,
    commentId?: string
  ): Promise<void> {
    try {
      const commenter = await User.findById(commenterId);
      let content, contentOwner;

      if (contentType === "media") {
        content = await Media.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      } else if (contentType === "devotional") {
        content = await Devotional.findById(contentId);
        contentOwner = await User.findById(content.submittedBy);
      }

      // Prevent self-notifications
      if (
        !commenter ||
        !content ||
        !contentOwner ||
        commenterId === contentOwner._id.toString()
      ) {
        logger.info("Skipping self-notification for content comment", {
          commenterId,
          contentOwnerId: contentOwner?._id.toString(),
          contentId,
          contentType,
        });
        return;
      }

      await this.createNotification({
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
          commentId,
        },
        priority: "medium",
        relatedId: contentId,
        dedupeKey: commentId ? `comment:${commentId}` : undefined,
      });
    } catch (error) {
      logger.error("Failed to send comment notification:", error);
    }
  }

  /**
   * Notify the parent comment author when someone replies.
   * Uses a distinct dedupeKey from the content-owner notification.
   */
  static async notifyCommentReply(
    replierId: string,
    parentCommentId: string,
    contentId: string,
    contentType: string,
    commentText: string,
    commentId?: string
  ): Promise<void> {
    try {
      const { Interaction } = await import("../models/interaction.model");
      const [replier, parent] = await Promise.all([
        User.findById(replierId),
        Interaction.findById(parentCommentId).select("user").lean(),
      ]);

      const parentAuthorId = (parent as any)?.user?.toString?.();
      if (!replier || !parentAuthorId || replierId === parentAuthorId) {
        return;
      }

      // Content owner already gets notifyContentComment — skip duplicate for same recipient
      let contentOwnerId: string | undefined;
      if (contentType === "media") {
        const content = await Media.findById(contentId).select("uploadedBy").lean();
        contentOwnerId = (content as any)?.uploadedBy?.toString?.();
      } else if (contentType === "devotional") {
        const content = await Devotional.findById(contentId).select("submittedBy").lean();
        contentOwnerId = (content as any)?.submittedBy?.toString?.();
      }
      if (contentOwnerId && contentOwnerId === parentAuthorId) {
        return;
      }

      await this.createNotification({
        userId: parentAuthorId,
        type: "comment",
        title: "New Reply",
        message: `${replier.firstName || replier.email} replied to your comment`,
        metadata: {
          actorName: replier.firstName || replier.email,
          actorAvatar: replier.avatar,
          contentType,
          commentText: commentText.substring(0, 100),
          commentId,
          parentCommentId,
        },
        priority: "medium",
        relatedId: contentId,
        dedupeKey: commentId ? `comment:${commentId}:reply` : undefined,
      });
    } catch (error) {
      logger.error("Failed to send reply notification:", error);
    }
  }

  /**
   * Send notification for content share
   */
  static async notifyContentShare(
    sharerId: string,
    contentId: string,
    contentType: string,
    sharePlatform?: string
  ): Promise<void> {
    try {
      const sharer = await User.findById(sharerId);
      let content, contentOwner;

      if (contentType === "media") {
        content = await Media.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      } else if (contentType === "devotional") {
        content = await Devotional.findById(contentId);
        contentOwner = await User.findById(content.submittedBy);
      }

      // Prevent self-notifications
      if (
        !sharer ||
        !content ||
        !contentOwner ||
        sharerId === contentOwner._id.toString()
      ) {
        logger.info("Skipping self-notification for content share", {
          sharerId,
          contentOwnerId: contentOwner?._id.toString(),
          contentId,
          contentType,
        });
        return;
      }

      const platformText = sharePlatform ? ` on ${sharePlatform}` : "";

      await this.createNotification({
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
    } catch (error) {
      logger.error("Failed to send share notification:", error);
    }
  }

  /**
   * Send notification for content mention in comment
   */
  static async notifyContentMention(
    mentionerId: string,
    mentionedUserId: string,
    contentId: string,
    contentType: string,
    commentText: string
  ): Promise<void> {
    try {
      const mentioner = await User.findById(mentionerId);
      const mentionedUser = await User.findById(mentionedUserId);
      let content;

      if (contentType === "media") {
        content = await Media.findById(contentId);
      } else if (contentType === "devotional") {
        content = await Devotional.findById(contentId);
      }

      // Prevent self-mentions
      if (
        !mentioner ||
        !mentionedUser ||
        !content ||
        mentionerId === mentionedUserId
      ) {
        logger.info("Skipping self-mention notification", {
          mentionerId,
          mentionedUserId,
          contentId,
          contentType,
        });
        return;
      }

      await this.createNotification({
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
    } catch (error) {
      logger.error("Failed to send mention notification:", error);
    }
  }

  /**
   * Send notification for viral/trending content
   */
  static async notifyViralContent(
    contentId: string,
    contentType: string,
    milestone: string,
    count: number
  ): Promise<void> {
    try {
      let content, contentOwner;

      if (contentType === "media") {
        content = await Media.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      } else if (contentType === "devotional") {
        content = await Devotional.findById(contentId);
        contentOwner = await User.findById(content.submittedBy);
      }

      if (!content || !contentOwner) return;

      const milestoneMessages = {
        views: `${count.toLocaleString()} views`,
        likes: `${count.toLocaleString()} likes`,
        shares: `${count.toLocaleString()} shares`,
        comments: `${count.toLocaleString()} comments`,
      };

      await this.createNotification({
        userId: contentOwner._id.toString(),
        type: "milestone",
        title: "🎉 Content Milestone!",
        message: `Your ${contentType} "${content.title}" reached ${milestoneMessages[milestone as keyof typeof milestoneMessages]}`,
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
    } catch (error) {
      logger.error("Failed to send viral content notification:", error);
    }
  }

  /**
   * Send public activity notification to followers
   */
  static async notifyPublicActivity(
    actorId: string,
    action: string,
    targetId: string,
    targetType: string,
    targetTitle?: string
  ): Promise<void> {
    try {
      const actor = await User.findById(actorId);
      if (!actor) return;

      // Get actor's followers who opted into public activity
      const followers = await User.find({
        _id: { $in: actor.followers || [] },
        "pushNotifications.preferences.publicActivity": { $ne: false },
      });

      if (followers.length === 0) return;

      const actionMessages = {
        like: "liked",
        comment: "commented on",
        share: "shared",
        follow: "started following",
      };

      const actionText =
        actionMessages[action as keyof typeof actionMessages] || action;
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
        priority: "low" as const,
        relatedId: targetId,
      }));

      // Create notifications in batch
      for (const notificationData of notifications) {
        await this.createNotification(notificationData);
      }

      logger.info("Public activity notifications sent", {
        actorId,
        action,
        targetType,
        followerCount: followers.length,
      });
    } catch (error) {
      logger.error("Failed to send public activity notifications:", error);
    }
  }

  /**
   * Get notification preferences for user
   */
  static async getNotificationPreferences(userId: string): Promise<any> {
    try {
      const user = await User.findById(userId).select("pushNotifications");
      return user?.pushNotifications || {};
    } catch (error) {
      logger.error("Failed to get notification preferences:", error);
      return {};
    }
  }

  /**
   * Update notification preferences for user
   */
  static async updateNotificationPreferences(
    userId: string,
    preferences: any
  ): Promise<any> {
    try {
      // Merge preferences only — never wipe deviceTokens / enabled.
      const prefs =
        preferences?.preferences && typeof preferences.preferences === "object"
          ? preferences.preferences
          : preferences;
      const update: Record<string, any> = {};
      if (prefs && typeof prefs === "object") {
        for (const [key, value] of Object.entries(prefs)) {
          if (typeof value === "boolean") {
            update[`pushNotifications.preferences.${key}`] = value;
          }
        }
      }
      if (typeof preferences?.enabled === "boolean") {
        update["pushNotifications.enabled"] = preferences.enabled;
      }
      if (Object.keys(update).length === 0) {
        return this.getNotificationPreferences(userId);
      }
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true }
      ).select("pushNotifications");

      return user?.pushNotifications || {};
    } catch (error) {
      logger.error("Failed to update notification preferences:", error);
      throw error;
    }
  }

  /**
   * Get notification statistics for user
   */
  static async getNotificationStats(userId: string): Promise<any> {
    try {
      const [total, unread, byType] = await Promise.all([
        Notification.countDocuments({ user: userId }),
        Notification.countDocuments({ user: userId, isRead: false }),
        Notification.aggregate([
          { $match: { user: new Types.ObjectId(userId) } },
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
    } catch (error) {
      logger.error("Failed to get notification stats:", error);
      return { total: 0, unread: 0, byType: {} };
    }
  }

  /**
   * Send notification for content download
   */
  static async notifyContentDownload(
    downloaderId: string,
    contentId: string,
    contentType: string
  ): Promise<void> {
    try {
      const downloader = await User.findById(downloaderId);
      let content, contentOwner;

      if (contentType === "media") {
        content = await Media.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      }

      if (
        !downloader ||
        !content ||
        !contentOwner ||
        downloaderId === contentOwner._id.toString()
      )
        return;

      await this.createNotification({
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
    } catch (error) {
      logger.error("Failed to send download notification:", error);
    }
  }

  /**
   * Send notification for content bookmark/save
   */
  static async notifyContentBookmark(
    bookmarkerId: string,
    contentId: string,
    contentType: string,
    bookmarkId?: string
  ): Promise<void> {
    try {
      const bookmarker = await User.findById(bookmarkerId);
      let content, contentOwner;

      if (contentType === "media") {
        content = await Media.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      }

      if (
        !bookmarker ||
        !content ||
        !contentOwner ||
        bookmarkerId === contentOwner._id.toString()
      )
        return;

      await this.createNotification({
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
          bookmarkId,
        },
        priority: "low",
        relatedId: contentId,
        dedupeKey: bookmarkId ? `bookmark:${bookmarkId}` : undefined,
      });
    } catch (error) {
      logger.error("Failed to send bookmark notification:", error);
    }
  }

  /**
   * Send notification for merch purchase
   */
  static async notifyMerchPurchase(
    buyerId: string,
    sellerId: string,
    merchItem: any
  ): Promise<void> {
    try {
      const buyer = await User.findById(buyerId);
      const seller = await User.findById(sellerId);

      if (!buyer || !seller || buyerId === sellerId) return;

      await this.createNotification({
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
    } catch (error) {
      logger.error("Failed to send merch purchase notification:", error);
    }
  }

  /**
   * Send notification for milestone achievement
   */
  static async notifyMilestone(
    userId: string,
    milestone: string,
    count: number
  ): Promise<void> {
    try {
      await this.createNotification({
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
    } catch (error) {
      logger.error("Failed to send milestone notification:", error);
    }
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: any;
      priority?: "normal" | "high";
    },
    notificationType?: string
  ): Promise<void> {
    try {
      await PushNotificationService.sendToUser(
        userId,
        {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          priority: notification.priority || "normal",
          sound: "default",
        },
        notificationType as any
      );
    } catch (error) {
      logger.error("Failed to send push notification:", error);
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<any> {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        throw new Error("Notification not found");
      }

      return notification;
    } catch (error) {
      logger.error("Failed to mark notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      await Notification.updateMany(
        { user: userId, isRead: false },
        { isRead: true }
      );
    } catch (error) {
      logger.error("Failed to mark all notifications as read:", error);
      throw error;
    }
  }

  /**
   * Get user's notifications with pagination
   */
  static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: string
  ): Promise<{
    notifications: any[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const query: any = { user: userId };
      if (type) query.type = type;

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Notification.countDocuments(query),
        Notification.countDocuments({ user: userId, isRead: false }),
      ]);

      return { notifications, total, unreadCount };
    } catch (error) {
      logger.error("Failed to get user notifications:", error);
      throw error;
    }
  }
}

export default NotificationService;
