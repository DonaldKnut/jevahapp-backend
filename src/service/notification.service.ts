import { Notification } from "../models/notification.model";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { Devotional } from "../models/devotional.model";
import PushNotificationService from "./pushNotification.service";
import logger from "../utils/logger";

export interface CreateNotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  priority?: "low" | "medium" | "high";
  relatedId?: string;
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
      });

      await notification.save();

      // Send push notification
      await this.sendPushNotification(
        data.userId,
        {
          title: data.title,
          body: data.message,
          data: {
            notificationId: notification._id.toString(),
            type: data.type,
            ...data.metadata,
          },
          priority: data.priority === "high" ? "high" : "normal",
        },
        data.type as any
      );

      logger.info("Notification created and sent", {
        userId: data.userId,
        type: data.type,
        notificationId: notification._id,
      });

      return notification;
    } catch (error) {
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
    contentType: string
  ): Promise<void> {
    try {
      const liker = await User.findById(likerId);
      let content, contentOwner;

      if (contentType === "media") {
        content = await Media.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      } else if (contentType === "devotional") {
        content = await Devotional.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      }

      if (
        !liker ||
        !content ||
        !contentOwner ||
        likerId === contentOwner._id.toString()
      )
        return;

      await this.createNotification({
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
    commentText: string
  ): Promise<void> {
    try {
      const commenter = await User.findById(commenterId);
      let content, contentOwner;

      if (contentType === "media") {
        content = await Media.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      } else if (contentType === "devotional") {
        content = await Devotional.findById(contentId);
        contentOwner = await User.findById(content.uploadedBy);
      }

      if (
        !commenter ||
        !content ||
        !contentOwner ||
        commenterId === contentOwner._id.toString()
      )
        return;

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
        },
        priority: "medium",
        relatedId: contentId,
      });
    } catch (error) {
      logger.error("Failed to send comment notification:", error);
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
    contentType: string
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
        },
        priority: "low",
        relatedId: contentId,
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
          .populate("user", "firstName lastName avatar email")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
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
