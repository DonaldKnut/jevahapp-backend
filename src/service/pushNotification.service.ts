import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { User } from "../models/user.model";
import logger from "../utils/logger";
import { isPushAllowedByPreferences } from "../modules/notifications/domain/eventCatalog";
import {
  registerDevice,
  unregisterDevice,
} from "../modules/notifications/application/device.service";

export class PushDeliverySkippedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushDeliverySkippedError";
  }
}

export class PushDeliveryRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushDeliveryRetryableError";
  }
}

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
      // Upserts PushDevice + syncs User.pushNotifications.deviceTokens
      return await registerDevice({ userId, expoToken: deviceToken });
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
      return await unregisterDevice(userId, deviceToken);
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
   * Send push notification to a single user.
   * - Terminal skip (no tokens / disabled / preference off) → PushDeliverySkippedError
   * - Transient Expo/network failure → PushDeliveryRetryableError (BullMQ retries)
   * Returns ticket IDs for receipt reconciliation when delivery was attempted.
   */
  async sendToUser(
    userId: string,
    notification: PushNotificationData,
    notificationType?: string
  ): Promise<{ delivered: boolean; ticketIds: string[]; tokens: string[] }> {
    const user = await User.findById(userId);
    if (
      !user ||
      !user.pushNotifications?.enabled ||
      !user.pushNotifications.deviceTokens?.length
    ) {
      throw new PushDeliverySkippedError(
        "Push disabled or no device tokens for user"
      );
    }

    if (
      !isPushAllowedByPreferences(
        notificationType,
        user.pushNotifications.preferences as Record<string, boolean | undefined>
      )
    ) {
      throw new PushDeliverySkippedError(
        `User disabled preference for ${notificationType}`
      );
    }

    const validTokens = user.pushNotifications.deviceTokens.filter((token: any) =>
      Expo.isExpoPushToken(token)
    );

    if (validTokens.length === 0) {
      throw new PushDeliverySkippedError("No valid Expo push tokens for user");
    }

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

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    const ticketIds: string[] = [];
    let chunkFailures = 0;

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        for (const t of ticketChunk) {
          if ((t as any).id) ticketIds.push(String((t as any).id));
        }
      } catch (error) {
        chunkFailures++;
        logger.error("Error sending push notification chunk", {
          error: (error as Error).message,
          chunkSize: chunk.length,
        });
      }
    }

    const successCount = tickets.filter(ticket => ticket.status === "ok").length;
    const errorTickets = tickets.filter(ticket => ticket.status === "error");

    logger.info("Push notifications sent", {
      userId,
      totalTokens: validTokens.length,
      successCount,
      errorCount: errorTickets.length,
      chunkFailures,
      notificationType,
    });

    if (chunkFailures > 0 && successCount === 0) {
      throw new PushDeliveryRetryableError(
        `Expo push chunk failures (${chunkFailures}) with no accepted tickets`
      );
    }

    // DeviceNotRegistered etc. are permanent for those tokens; strip them.
    const deadTokens: string[] = [];
    errorTickets.forEach((ticket, idx) => {
      const details = (ticket as any).details?.error || (ticket as any).message;
      if (
        String(details || "").includes("DeviceNotRegistered") ||
        String(details || "").includes("InvalidCredentials")
      ) {
        // Best-effort: map by index within all tickets is imperfect for multi-chunk;
        // receipt reconciler is authoritative. Still try to drop obvious bad tokens.
        const token = validTokens[idx];
        if (token) deadTokens.push(token);
      }
    });
    if (deadTokens.length) {
      user.pushNotifications.deviceTokens =
        user.pushNotifications.deviceTokens.filter(
          (t: string) => !deadTokens.includes(t)
        );
      await user.save().catch(() => {});
    }

    if (successCount === 0 && errorTickets.length > 0) {
      const retryable = errorTickets.some(t =>
        /rate.?limit|timeout|unavailable|5\d\d/i.test(
          String((t as any).message || (t as any).details?.error || "")
        )
      );
      if (retryable) {
        throw new PushDeliveryRetryableError("Expo accepted no tickets (retryable)");
      }
      throw new PushDeliverySkippedError("Expo rejected all tickets (terminal)");
    }

    return {
      delivered: successCount > 0,
      ticketIds,
      tokens: validTokens,
    };
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    notification: PushNotificationData,
    notificationType?: string
  ): Promise<{ successCount: number; errorCount: number }> {
    let successCount = 0;
    let errorCount = 0;

    for (const userId of userIds) {
      try {
        await this.sendToUser(userId, notification, notificationType);
        successCount++;
      } catch (err: any) {
        if (err?.name === "PushDeliverySkippedError") {
          // not an error for bulk accounting of delivery attempts
          continue;
        }
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
    notificationType?: string
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
    notificationType?: string
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
