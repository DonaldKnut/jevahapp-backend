import { Notification } from "../../models/notification.model";
import { User } from "../../models/user.model";
import { Types } from "mongoose";
import logger from "../../utils/logger";

export async function getNotificationPreferences(userId: string): Promise<any> {
  try {
    const user = await User.findById(userId).select("pushNotifications");
    return user?.pushNotifications || {};
  } catch (error) {
    logger.error("Failed to get notification preferences:", error);
    return {};
  }
}

export async function updateNotificationPreferences(
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
      return getNotificationPreferences(userId);
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

export async function getNotificationStats(userId: string): Promise<any> {
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

export async function markAsRead(
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

export async function markAllAsRead(userId: string): Promise<void> {
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

export async function getUserNotifications(
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
