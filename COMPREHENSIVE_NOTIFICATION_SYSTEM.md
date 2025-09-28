# 🔔 Comprehensive Real-Time Notification System

## 🎯 **Current Assessment**

### **✅ What You Have:**

- Basic notification model with `title`, `message`, `type`, `isRead`
- Simple notification controller (get, mark as read)
- Socket.IO service for real-time communication
- User model with notification preferences
- Activity tracking in user model

### **❌ What's Missing:**

- **Real-time notification triggers** for user activities
- **Comprehensive notification types** (follow, like, comment, download, etc.)
- **Socket.IO notification broadcasting**
- **Notification service** for creating and managing notifications
- **Frontend notification integration**

---

## 🚀 **Complete Implementation Plan**

### **1. Enhanced Notification Model**

```typescript
// src/models/notification.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  type: NotificationType;
  action: NotificationAction;
  actor?: mongoose.Types.ObjectId; // User who performed the action
  target?: mongoose.Types.ObjectId; // Target content/user
  metadata?: {
    contentTitle?: string;
    contentType?: string;
    actorName?: string;
    actorAvatar?: string;
    thumbnailUrl?: string;
    [key: string]: any;
  };
  priority: "low" | "medium" | "high";
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType =
  | "follow" // User followed you
  | "unfollow" // User unfollowed you
  | "like" // User liked your content
  | "comment" // User commented on your content
  | "reply" // User replied to your comment
  | "share" // User shared your content
  | "download" // User downloaded your content
  | "bookmark" // User saved your content
  | "message" // New direct message
  | "merch_purchase" // Merch purchase notification
  | "inventory_update" // Inventory/stock update
  | "system" // System notifications
  | "security" // Security alerts
  | "subscription" // Subscription updates
  | "live_stream" // Live stream notifications
  | "recording" // Recording notifications
  | "view" // High view count milestone
  | "milestone"; // Follower/view milestones

export type NotificationAction =
  | "created"
  | "updated"
  | "deleted"
  | "completed"
  | "failed"
  | "expired";

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "follow",
        "unfollow",
        "like",
        "comment",
        "reply",
        "share",
        "download",
        "bookmark",
        "message",
        "merch_purchase",
        "inventory_update",
        "system",
        "security",
        "subscription",
        "live_stream",
        "recording",
        "view",
        "milestone",
      ],
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["created", "updated", "deleted", "completed", "failed", "expired"],
      default: "created",
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    target: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
    },
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
    indexes: [
      { user: 1, isRead: 1, createdAt: -1 },
      { user: 1, type: 1, createdAt: -1 },
      { actor: 1, createdAt: -1 },
      { target: 1, createdAt: -1 },
    ],
  }
);

// Export model
export const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", notificationSchema);
```

### **2. Comprehensive Notification Service**

```typescript
// src/service/notification.service.ts
import {
  Notification,
  INotification,
  NotificationType,
  NotificationAction,
} from "../models/notification.model";
import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { Devotional } from "../models/devotional.model";
import { SocketService } from "./socket.service";
import { EmailService } from "./email.service";

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  action?: NotificationAction;
  actorId?: string;
  targetId?: string;
  title: string;
  message: string;
  metadata?: any;
  priority?: "low" | "medium" | "high";
  expiresAt?: Date;
}

export interface NotificationPreferences {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

export class NotificationService {
  private static socketService: SocketService;

  static setSocketService(socketService: SocketService) {
    this.socketService = socketService;
  }

  /**
   * Create and send a notification
   */
  static async createNotification(
    data: CreateNotificationData
  ): Promise<INotification> {
    try {
      // Check user's notification preferences
      const user = await User.findById(data.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Check if user has disabled this type of notification
      if (!this.shouldSendNotification(user, data.type)) {
        return null;
      }

      // Create notification
      const notification = new Notification({
        user: data.userId,
        type: data.type,
        action: data.action || "created",
        actor: data.actorId,
        target: data.targetId,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
        priority: data.priority || "medium",
        expiresAt: data.expiresAt,
      });

      await notification.save();

      // Send real-time notification
      await this.sendRealTimeNotification(notification);

      // Send email notification if enabled
      if (user.emailNotifications && this.shouldSendEmail(user, data.type)) {
        await this.sendEmailNotification(user, notification);
      }

      return notification;
    } catch (error) {
      console.error("Failed to create notification:", error);
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
    const follower = await User.findById(followerId);
    const following = await User.findById(followingId);

    if (!follower || !following) return;

    await this.createNotification({
      userId: followingId,
      type: "follow",
      actorId: followerId,
      title: "New Follower",
      message: `${follower.firstName || follower.email} started following you`,
      metadata: {
        actorName: follower.firstName || follower.email,
        actorAvatar: follower.avatar,
        followerCount: following.followers?.length || 0,
      },
      priority: "medium",
    });
  }

  /**
   * Send notification for content like
   */
  static async notifyContentLike(
    likerId: string,
    contentId: string,
    contentType: string
  ): Promise<void> {
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
      actorId: likerId,
      targetId: contentId,
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
    });
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
      actorId: commenterId,
      targetId: contentId,
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
    });
  }

  /**
   * Send notification for content download
   */
  static async notifyContentDownload(
    downloaderId: string,
    contentId: string,
    contentType: string
  ): Promise<void> {
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
      actorId: downloaderId,
      targetId: contentId,
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
    });
  }

  /**
   * Send notification for content bookmark/save
   */
  static async notifyContentBookmark(
    bookmarkerId: string,
    contentId: string,
    contentType: string
  ): Promise<void> {
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
      actorId: bookmarkerId,
      targetId: contentId,
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
    });
  }

  /**
   * Send notification for merch purchase
   */
  static async notifyMerchPurchase(
    buyerId: string,
    sellerId: string,
    merchItem: any
  ): Promise<void> {
    const buyer = await User.findById(buyerId);
    const seller = await User.findById(sellerId);

    if (!buyer || !seller || buyerId === sellerId) return;

    await this.createNotification({
      userId: sellerId,
      type: "merch_purchase",
      actorId: buyerId,
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

  /**
   * Send notification for inventory update
   */
  static async notifyInventoryUpdate(
    userId: string,
    merchItem: any,
    action: "stock_low" | "out_of_stock" | "restocked"
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

    const messages = {
      stock_low: `Low stock alert: ${merchItem.name} has ${merchItem.stockCount} items remaining`,
      out_of_stock: `Out of stock: ${merchItem.name} is no longer available`,
      restocked: `Restocked: ${merchItem.name} is back in stock with ${merchItem.stockCount} items`,
    };

    await this.createNotification({
      userId,
      type: "inventory_update",
      title: "Inventory Update",
      message: messages[action],
      metadata: {
        merchName: merchItem.name,
        merchImage: merchItem.imageUrl,
        stockCount: merchItem.stockCount,
        action,
      },
      priority: "medium",
    });
  }

  /**
   * Send notification for milestone achievement
   */
  static async notifyMilestone(
    userId: string,
    milestone: string,
    count: number
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) return;

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
  }

  /**
   * Send real-time notification via Socket.IO
   */
  private static async sendRealTimeNotification(
    notification: INotification
  ): Promise<void> {
    if (!this.socketService) return;

    try {
      // Send to user's personal room
      this.socketService.io
        .to(`user:${notification.user}`)
        .emit("new-notification", {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata,
          priority: notification.priority,
          createdAt: notification.createdAt,
          isRead: notification.isRead,
        });

      // Send notification count update
      const unreadCount = await Notification.countDocuments({
        user: notification.user,
        isRead: false,
      });

      this.socketService.io
        .to(`user:${notification.user}`)
        .emit("notification-count-update", {
          unreadCount,
        });
    } catch (error) {
      console.error("Failed to send real-time notification:", error);
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(
    user: any,
    notification: INotification
  ): Promise<void> {
    try {
      // Only send email for high priority notifications
      if (notification.priority === "high") {
        await EmailService.sendNotificationEmail(
          user.email,
          notification.title,
          notification.message,
          notification.metadata
        );
      }
    } catch (error) {
      console.error("Failed to send email notification:", error);
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private static shouldSendNotification(
    user: any,
    type: NotificationType
  ): boolean {
    if (!user.emailNotifications) return true;

    const preferences = user.emailNotifications;

    switch (type) {
      case "follow":
        return preferences.newFollowers !== false;
      case "like":
        return preferences.mediaLikes !== false;
      case "comment":
        return preferences.mediaComments !== false;
      case "download":
        return preferences.songDownloads !== false;
      case "merch_purchase":
        return preferences.merchPurchases !== false;
      case "security":
        return preferences.securityAlerts !== false;
      case "subscription":
        return preferences.subscriptionUpdates !== false;
      default:
        return true;
    }
  }

  /**
   * Check if email notification should be sent
   */
  private static shouldSendEmail(user: any, type: NotificationType): boolean {
    return this.shouldSendNotification(user, type);
  }

  /**
   * Get user's notification preferences
   */
  static async getNotificationPreferences(
    userId: string
  ): Promise<NotificationPreferences> {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    return {
      push: true, // Default to true for push notifications
      email: user.emailNotifications
        ? Object.values(user.emailNotifications).some(Boolean)
        : true,
      inApp: true, // Default to true for in-app notifications
    };
  }

  /**
   * Update user's notification preferences
   */
  static async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: {
        "emailNotifications.newFollowers": preferences.email,
        "emailNotifications.mediaLikes": preferences.email,
        "emailNotifications.mediaComments": preferences.email,
        "emailNotifications.songDownloads": preferences.email,
        "emailNotifications.merchPurchases": preferences.email,
        "emailNotifications.securityAlerts": preferences.email,
        "emailNotifications.subscriptionUpdates": preferences.email,
      },
    });
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<INotification> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error("Notification not found");
    }

    // Send real-time update
    if (this.socketService) {
      const unreadCount = await Notification.countDocuments({
        user: userId,
        isRead: false,
      });

      this.socketService.io
        .to(`user:${userId}`)
        .emit("notification-count-update", {
          unreadCount,
        });
    }

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );

    // Send real-time update
    if (this.socketService) {
      this.socketService.io
        .to(`user:${userId}`)
        .emit("notification-count-update", {
          unreadCount: 0,
        });
    }
  }

  /**
   * Get user's notifications with pagination
   */
  static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: NotificationType
  ): Promise<{
    notifications: INotification[];
    total: number;
    unreadCount: number;
  }> {
    const query: any = { user: userId };
    if (type) query.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate("actor", "firstName lastName avatar email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications(): Promise<void> {
    await Notification.deleteMany({
      expiresAt: { $lt: new Date() },
    });
  }
}
```

### **3. Updated Notification Controller**

```typescript
// src/controllers/notification.controller.ts
import { Request, Response } from "express";
import { NotificationService } from "../service/notification.service";

/**
 * Get all notifications for the current user with pagination
 */
export const getNotifications = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 20;
    const type = request.query.type as string;

    const { notifications, total, unreadCount } =
      await NotificationService.getUserNotifications(userId, page, limit, type);

    response.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const notificationId = request.params.id;
    const userId = request.userId;

    const notification = await NotificationService.markAsRead(
      notificationId,
      userId
    );

    response.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Mark notification error:", error);
    response.status(500).json({
      success: false,
      message: error.message || "Failed to mark notification",
    });
  }
};

/**
 * Mark all notifications for the current user as read
 */
export const markAllNotificationsAsRead = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;

    await NotificationService.markAllAsRead(userId);

    response.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all notifications error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to mark all notifications",
    });
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const preferences =
      await NotificationService.getNotificationPreferences(userId);

    response.status(200).json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("Get notification preferences error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get notification preferences",
    });
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const preferences = request.body;

    await NotificationService.updateNotificationPreferences(
      userId,
      preferences
    );

    response.status(200).json({
      success: true,
      message: "Notification preferences updated",
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to update notification preferences",
    });
  }
};

/**
 * Get notification count
 */
export const getNotificationCount = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const { unreadCount } = await NotificationService.getUserNotifications(
      userId,
      1,
      1
    );

    response.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Get notification count error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get notification count",
    });
  }
};
```

### **4. Updated Notification Routes**

```typescript
// src/routes/notifications.routes.ts
import { Router } from "express";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationCount,
} from "../controllers/notification.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// GET /api/notifications - Fetch user-specific notifications with pagination
router.get("/", verifyToken, apiRateLimiter, getNotifications);

// GET /api/notifications/count - Get unread notification count
router.get("/count", verifyToken, apiRateLimiter, getNotificationCount);

// PATCH /api/notifications/:id - Mark a specific notification as read
router.patch("/:id", verifyToken, apiRateLimiter, markNotificationAsRead);

// PATCH /api/notifications - Mark all notifications as read
router.patch("/", verifyToken, apiRateLimiter, markAllNotificationsAsRead);

// GET /api/notifications/preferences - Get notification preferences
router.get(
  "/preferences",
  verifyToken,
  apiRateLimiter,
  getNotificationPreferences
);

// PUT /api/notifications/preferences - Update notification preferences
router.put(
  "/preferences",
  verifyToken,
  apiRateLimiter,
  updateNotificationPreferences
);

export default router;
```

### **5. Integration with Existing Services**

Now we need to integrate notification triggers into your existing services:

```typescript
// Add to src/service/artist.service.ts - followArtist method
// After line 168, add:
await NotificationService.notifyUserFollow(followerId, artistId);

// Add to src/service/contentInteraction.service.ts - toggleLike method
// After successful like, add:
await NotificationService.notifyContentLike(userId, contentId, contentType);

// Add to src/service/media.controller.ts - downloadMedia method
// After successful download, add:
await NotificationService.notifyContentDownload(userId, mediaId, "media");

// Add to src/controllers/bookmarks.controller.ts - addBookmark method
// After successful bookmark, add:
await NotificationService.notifyContentBookmark(userId, mediaId, "media");
```

### **6. Socket.IO Integration**

```typescript
// Add to src/service/socket.service.ts
import { NotificationService } from "./notification.service";

// In constructor, add:
NotificationService.setSocketService(this);

// Add new event handlers:
socket.on("mark-notification-read", async (notificationId: string) => {
  try {
    await NotificationService.markAsRead(notificationId, user.userId);
    socket.emit("notification-marked-read", { notificationId });
  } catch (error) {
    socket.emit("error", { message: "Failed to mark notification as read" });
  }
});

socket.on("get-notification-count", async () => {
  try {
    const { unreadCount } = await NotificationService.getUserNotifications(
      user.userId,
      1,
      1
    );
    socket.emit("notification-count", { unreadCount });
  } catch (error) {
    socket.emit("error", { message: "Failed to get notification count" });
  }
});
```

---

## 📱 **Frontend Integration Guide**

### **1. React Native Notification Service**

```typescript
// services/notificationService.ts
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: any;
  priority: "low" | "medium" | "high";
  createdAt: string;
  isRead: boolean;
}

export interface NotificationPreferences {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

class NotificationService {
  private socket: Socket | null = null;
  private baseURL = "https://jevahapp-backend.onrender.com";
  private token: string | null = null;

  async initialize(token: string) {
    this.token = token;
    await this.connectSocket();
  }

  private async connectSocket() {
    if (!this.token) return;

    this.socket = io(this.baseURL, {
      auth: { token: this.token },
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      console.log("✅ Connected to notification service");
    });

    this.socket.on("new-notification", (notification: Notification) => {
      this.handleNewNotification(notification);
    });

    this.socket.on(
      "notification-count-update",
      (data: { unreadCount: number }) => {
        this.handleNotificationCountUpdate(data.unreadCount);
      }
    );

    this.socket.on("disconnect", () => {
      console.log("❌ Disconnected from notification service");
    });
  }

  // Get notifications with pagination
  async getNotifications(page: number = 1, limit: number = 20, type?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (type) params.append("type", type);

    const response = await fetch(
      `${this.baseURL}/api/notifications?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    return response.json();
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const response = await fetch(
      `${this.baseURL}/api/notifications/${notificationId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    return response.json();
  }

  // Mark all notifications as read
  async markAllAsRead() {
    const response = await fetch(`${this.baseURL}/api/notifications`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return response.json();
  }

  // Get notification count
  async getNotificationCount() {
    const response = await fetch(`${this.baseURL}/api/notifications/count`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return response.json();
  }

  // Get notification preferences
  async getPreferences() {
    const response = await fetch(
      `${this.baseURL}/api/notifications/preferences`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    return response.json();
  }

  // Update notification preferences
  async updatePreferences(preferences: Partial<NotificationPreferences>) {
    const response = await fetch(
      `${this.baseURL}/api/notifications/preferences`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      }
    );

    return response.json();
  }

  // Socket.IO methods
  markNotificationRead(notificationId: string) {
    this.socket?.emit("mark-notification-read", notificationId);
  }

  getNotificationCount() {
    this.socket?.emit("get-notification-count");
  }

  // Event handlers
  private handleNewNotification(notification: Notification) {
    // Emit custom event for components to listen to
    const event = new CustomEvent("new-notification", { detail: notification });
    window.dispatchEvent(event);
  }

  private handleNotificationCountUpdate(unreadCount: number) {
    // Emit custom event for components to listen to
    const event = new CustomEvent("notification-count-update", {
      detail: { unreadCount },
    });
    window.dispatchEvent(event);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export default new NotificationService();
```

### **2. Notification Hook**

```typescript
// hooks/useNotifications.ts
import { useState, useEffect, useCallback } from "react";
import notificationService, {
  Notification,
  NotificationPreferences,
} from "../services/notificationService";

export const useNotifications = (token: string) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    push: true,
    email: true,
    inApp: true,
  });

  const loadNotifications = useCallback(
    async (page: number = 1, type?: string) => {
      try {
        setLoading(true);
        const response = await notificationService.getNotifications(
          page,
          20,
          type
        );
        if (response.success) {
          setNotifications(response.data.notifications);
          setUnreadCount(response.data.unreadCount);
        }
      } catch (error) {
        console.error("Failed to load notifications:", error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }, []);

  const updatePreferences = useCallback(
    async (newPreferences: Partial<NotificationPreferences>) => {
      try {
        await notificationService.updatePreferences(newPreferences);
        setPreferences(prev => ({ ...prev, ...newPreferences }));
      } catch (error) {
        console.error("Failed to update preferences:", error);
      }
    },
    []
  );

  useEffect(() => {
    if (token) {
      notificationService.initialize(token);
      loadNotifications();
      loadPreferences();
    }

    // Listen for real-time notifications
    const handleNewNotification = (event: CustomEvent) => {
      const notification = event.detail;
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    const handleCountUpdate = (event: CustomEvent) => {
      const { unreadCount } = event.detail;
      setUnreadCount(unreadCount);
    };

    window.addEventListener(
      "new-notification",
      handleNewNotification as EventListener
    );
    window.addEventListener(
      "notification-count-update",
      handleCountUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "new-notification",
        handleNewNotification as EventListener
      );
      window.removeEventListener(
        "notification-count-update",
        handleCountUpdate as EventListener
      );
      notificationService.disconnect();
    };
  }, [token, loadNotifications]);

  const loadPreferences = useCallback(async () => {
    try {
      const response = await notificationService.getPreferences();
      if (response.success) {
        setPreferences(response.preferences);
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    preferences,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    updatePreferences,
  };
};
```

### **3. Notification Components**

```typescript
// components/NotificationBadge.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface NotificationBadgeProps {
  count: number;
  onPress: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ count, onPress }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Icon name="notifications" size={24} color="#333" />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {count > 99 ? '99+' : count.toString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
```

```typescript
// components/NotificationItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
  onMarkAsRead: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onMarkAsRead,
}) => {
  const getIconName = () => {
    switch (notification.type) {
      case 'follow': return 'person-add';
      case 'like': return 'favorite';
      case 'comment': return 'comment';
      case 'download': return 'download';
      case 'bookmark': return 'bookmark';
      case 'merch_purchase': return 'shopping-cart';
      case 'milestone': return 'emoji-events';
      default: return 'notifications';
    }
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'high': return '#ff3b30';
      case 'medium': return '#ff9500';
      case 'low': return '#34c759';
      default: return '#007AFF';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !notification.isRead && styles.unreadContainer
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: getPriorityColor() }]}>
          <Icon name={getIconName()} size={20} color="#fff" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {notification.message}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(notification.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {!notification.isRead && (
          <TouchableOpacity
            style={styles.markAsReadButton}
            onPress={onMarkAsRead}
          >
            <Icon name="check" size={16} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unreadContainer: {
    backgroundColor: '#f8f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  markAsReadButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#f0f8ff',
  },
});
```

---

## 🎯 **Implementation Status**

### **✅ What You Need to Implement:**

1. **Update Notification Model** - Add comprehensive types and metadata
2. **Create Notification Service** - Complete service with all notification types
3. **Update Controllers** - Enhanced notification management
4. **Integrate Triggers** - Add notification calls to existing services
5. **Socket.IO Integration** - Real-time notification broadcasting
6. **Frontend Components** - Complete notification UI

### **🚀 Benefits:**

- **Real-time notifications** for all user activities
- **Comprehensive notification types** (follow, like, comment, download, etc.)
- **User preferences** for notification control
- **Priority-based notifications** (low, medium, high)
- **Socket.IO integration** for instant delivery
- **Beautiful UI components** for React Native
- **Pagination and filtering** for notification management

This implementation provides a **professional-grade notification system** that rivals major social media platforms! 🎉

Would you like me to help you implement any specific part of this system?













