import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { User } from "../models/user.model";
import logger from "../utils/logger";

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

export interface PushNotificationPreferences {
  newFollowers?: boolean;
  mediaLikes?: boolean;
  mediaComments?: boolean;
  mediaShares?: boolean;
  merchPurchases?: boolean;
  songDownloads?: boolean;
  subscriptionUpdates?: boolean;
  securityAlerts?: boolean;
  liveStreams?: boolean;
  newMessages?: boolean;
}

export class PushNotificationService {
  private expo: Expo;

  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true, // Use FCM v1 API for better reliability
    });
  }

  /**
   * Register a device token for a user
   */
  async registerDeviceToken(
    userId: string,
    deviceToken: string
  ): Promise<boolean> {
    try {
      // Validate token format
      if (!Expo.isExpoPushToken(deviceToken)) {
        logger.error("Invalid Expo push token format", { deviceToken });
        return false;
      }

      const user = await User.findById(userId);
      if (!user) {
        logger.error("User not found for device token registration", {
          userId,
        });
        return false;
      }

      // Initialize push notifications if not exists
      if (!user.pushNotifications) {
        user.pushNotifications = {
          enabled: true,
          deviceTokens: [],
          preferences: {
            newFollowers: true,
            mediaLikes: true,
            mediaComments: true,
            mediaShares: true,
            merchPurchases: true,
            songDownloads: true,
            subscriptionUpdates: true,
            securityAlerts: true,
            liveStreams: true,
            newMessages: true,
          },
        };
      }

      // Add token if not already present
      if (!user.pushNotifications.deviceTokens?.includes(deviceToken)) {
        user.pushNotifications.deviceTokens =
          user.pushNotifications.deviceTokens || [];
        user.pushNotifications.deviceTokens.push(deviceToken);

        await user.save();

        logger.info("Device token registered successfully", {
          userId,
          deviceToken: deviceToken.substring(0, 20) + "...",
        });
      }

      return true;
    } catch (error) {
      logger.error("Failed to register device token", {
        userId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Unregister a device token for a user
   */
  async unregisterDeviceToken(
    userId: string,
    deviceToken: string
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.pushNotifications?.deviceTokens) {
        return false;
      }

      // Remove token from array
      user.pushNotifications.deviceTokens =
        user.pushNotifications.deviceTokens.filter(
          (token: any) => token !== deviceToken
        );

      await user.save();

      logger.info("Device token unregistered successfully", {
        userId,
        deviceToken: deviceToken.substring(0, 20) + "...",
      });

      return true;
    } catch (error) {
      logger.error("Failed to unregister device token", {
        userId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Update push notification preferences for a user
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<PushNotificationPreferences>
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      // Initialize push notifications if not exists
      if (!user.pushNotifications) {
        user.pushNotifications = {
          enabled: true,
          deviceTokens: [],
          preferences: {},
        };
      }

      // Update preferences
      user.pushNotifications.preferences = {
        ...user.pushNotifications.preferences,
        ...preferences,
      };

      await user.save();

      logger.info("Push notification preferences updated", {
        userId,
        preferences,
      });

      return true;
    } catch (error) {
      logger.error("Failed to update push notification preferences", {
        userId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Enable/disable push notifications for a user
   */
  async setEnabled(userId: string, enabled: boolean): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      // Initialize push notifications if not exists
      if (!user.pushNotifications) {
        user.pushNotifications = {
          enabled,
          deviceTokens: [],
          preferences: {},
        };
      } else {
        user.pushNotifications.enabled = enabled;
      }

      await user.save();

      logger.info("Push notifications enabled/disabled", {
        userId,
        enabled,
      });

      return true;
    } catch (error) {
      logger.error("Failed to set push notification enabled status", {
        userId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Send push notification to a single user
   */
  async sendToUser(
    userId: string,
    notification: PushNotificationData,
    notificationType?: keyof PushNotificationPreferences
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (
        !user ||
        !user.pushNotifications?.enabled ||
        !user.pushNotifications.deviceTokens?.length
      ) {
        return false;
      }

      // Check if user has enabled this type of notification
      if (
        notificationType &&
        user.pushNotifications.preferences?.[notificationType] === false
      ) {
        logger.debug("User has disabled this notification type", {
          userId,
          notificationType,
        });
        return false;
      }

      // Filter valid tokens
      const validTokens = user.pushNotifications.deviceTokens.filter(
        (token: any) => Expo.isExpoPushToken(token)
      );

      if (validTokens.length === 0) {
        logger.warn("No valid push tokens found for user", { userId });
        return false;
      }

      // Create push messages
      const messages: ExpoPushMessage[] = validTokens.map((token: any) => ({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: notification.sound || "default",
        badge: notification.badge,
        priority: notification.priority || "high",
        channelId: notification.channelId,
      }));

      // Send notifications
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          logger.error("Error sending push notification chunk", {
            error: (error as Error).message,
            chunkSize: chunk.length,
          });
        }
      }

      // Log results
      const successCount = tickets.filter(
        ticket => ticket.status === "ok"
      ).length;
      const errorCount = tickets.filter(
        ticket => ticket.status === "error"
      ).length;

      logger.info("Push notifications sent", {
        userId,
        totalTokens: validTokens.length,
        successCount,
        errorCount,
        notificationType,
      });

      return successCount > 0;
    } catch (error) {
      logger.error("Failed to send push notification to user", {
        userId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    notification: PushNotificationData,
    notificationType?: keyof PushNotificationPreferences
  ): Promise<{ successCount: number; errorCount: number }> {
    let successCount = 0;
    let errorCount = 0;

    for (const userId of userIds) {
      const success = await this.sendToUser(
        userId,
        notification,
        notificationType
      );
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    logger.info("Bulk push notifications sent", {
      totalUsers: userIds.length,
      successCount,
      errorCount,
      notificationType,
    });

    return { successCount, errorCount };
  }

  /**
   * Send push notification to all users with a specific role
   */
  async sendToRole(
    role: string,
    notification: PushNotificationData,
    notificationType?: keyof PushNotificationPreferences
  ): Promise<{ successCount: number; errorCount: number }> {
    try {
      const users = await User.find({
        role,
        "pushNotifications.enabled": true,
        "pushNotifications.deviceTokens": { $exists: true, $not: { $size: 0 } },
      }).select("_id");

      const userIds = users.map(user => user._id.toString());

      return await this.sendToUsers(userIds, notification, notificationType);
    } catch (error) {
      logger.error("Failed to send push notification to role", {
        role,
        error: (error as Error).message,
      });
      return { successCount: 0, errorCount: 0 };
    }
  }

  /**
   * Send push notification to all users
   */
  async sendToAll(
    notification: PushNotificationData,
    notificationType?: keyof PushNotificationPreferences
  ): Promise<{ successCount: number; errorCount: number }> {
    try {
      const users = await User.find({
        "pushNotifications.enabled": true,
        "pushNotifications.deviceTokens": { $exists: true, $not: { $size: 0 } },
      }).select("_id");

      const userIds = users.map(user => user._id.toString());

      return await this.sendToUsers(userIds, notification, notificationType);
    } catch (error) {
      logger.error("Failed to send push notification to all users", {
        error: (error as Error).message,
      });
      return { successCount: 0, errorCount: 0 };
    }
  }

  /**
   * Clean up invalid device tokens
   */
  async cleanupInvalidTokens(): Promise<void> {
    try {
      const users = await User.find({
        "pushNotifications.deviceTokens": { $exists: true, $not: { $size: 0 } },
      });

      for (const user of users) {
        if (user.pushNotifications?.deviceTokens) {
          const validTokens = user.pushNotifications.deviceTokens.filter(
            (token: any) => Expo.isExpoPushToken(token)
          );

          if (
            validTokens.length !== user.pushNotifications.deviceTokens.length
          ) {
            user.pushNotifications.deviceTokens = validTokens;
            await user.save();

            logger.info("Cleaned up invalid device tokens", {
              userId: user._id,
              removedCount:
                user.pushNotifications.deviceTokens.length - validTokens.length,
            });
          }
        }
      }
    } catch (error) {
      logger.error("Failed to cleanup invalid device tokens", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get push notification statistics
   */
  async getStats(): Promise<{
    totalUsers: number;
    usersWithPushEnabled: number;
    totalDeviceTokens: number;
    usersWithTokens: number;
  }> {
    try {
      const [totalUsers, usersWithPushEnabled, usersWithTokens] =
        await Promise.all([
          User.countDocuments(),
          User.countDocuments({ "pushNotifications.enabled": true }),
          User.countDocuments({
            "pushNotifications.deviceTokens": {
              $exists: true,
              $not: { $size: 0 },
            },
          }),
        ]);

      const usersWithTokensData = await User.find({
        "pushNotifications.deviceTokens": { $exists: true, $not: { $size: 0 } },
      }).select("pushNotifications.deviceTokens");

      const totalDeviceTokens = usersWithTokensData.reduce(
        (total, user) =>
          total + (user.pushNotifications?.deviceTokens?.length || 0),
        0
      );

      return {
        totalUsers,
        usersWithPushEnabled,
        totalDeviceTokens,
        usersWithTokens,
      };
    } catch (error) {
      logger.error("Failed to get push notification stats", {
        error: (error as Error).message,
      });
      return {
        totalUsers: 0,
        usersWithPushEnabled: 0,
        totalDeviceTokens: 0,
        usersWithTokens: 0,
      };
    }
  }
}

export default new PushNotificationService();
