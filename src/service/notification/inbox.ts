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
    const userOid = new Types.ObjectId(userId);
    const [total, unread, byType] = await Promise.all([
      Notification.countDocuments({ user: userOid }),
      Notification.countDocuments({ user: userOid, isRead: false }),
      Notification.aggregate([
        { $match: { user: userOid } },
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
): Promise<{ notification: any; unreadCount: number } | null> {
  try {
    const userOid = new Types.ObjectId(userId);
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userOid },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return null;
    }

    const unreadCount = await Notification.countDocuments({
      user: userOid,
      isRead: false,
    });

    return { notification, unreadCount };
  } catch (error) {
    logger.error("Failed to mark notification as read:", error);
    throw error;
  }
}

export async function markAllAsRead(
  userId: string
): Promise<{ count: number; unreadCount: number }> {
  try {
    const userOid = new Types.ObjectId(userId);
    const result = await Notification.updateMany(
      { user: userOid, isRead: false },
      { isRead: true }
    );
    return {
      count: result.modifiedCount || 0,
      unreadCount: 0,
    };
  } catch (error) {
    logger.error("Failed to mark all notifications as read:", error);
    throw error;
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({
    user: new Types.ObjectId(userId),
    isRead: false,
  });
}

export async function getUserNotifications(
  userId: string,
  page: number = 1,
  limit: number = 20,
  type?: string,
  unreadOnly?: boolean
): Promise<{
  notifications: any[];
  total: number;
  unreadCount: number;
}> {
  try {
    const userOid = new Types.ObjectId(userId);
    const query: any = { user: userOid };
    if (type) query.type = type;
    if (unreadOnly) query.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      // Always global unread for badge consistency with /stats and /unread-count
      Notification.countDocuments({ user: userOid, isRead: false }),
    ]);

    return { notifications, total, unreadCount };
  } catch (error) {
    logger.error("Failed to get user notifications:", error);
    throw error;
  }
}
