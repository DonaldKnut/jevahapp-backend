import { Request, Response } from "express";
import PushNotificationService, {
  PushNotificationData,
  PushNotificationPreferences,
} from "../service/pushNotification.service";
import logger from "../utils/logger";

/**
 * Register a device token for push notifications
 */
export const registerDeviceToken = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "User ID not found",
      });
      return;
    }

    const { deviceToken } = request.body;

    if (!deviceToken) {
      response.status(400).json({
        success: false,
        message: "Device token is required",
      });
      return;
    }

    const success = await PushNotificationService.registerDeviceToken(
      userId,
      deviceToken
    );

    if (success) {
      response.status(200).json({
        success: true,
        message: "Device token registered successfully",
      });
    } else {
      response.status(400).json({
        success: false,
        message: "Failed to register device token",
      });
    }
  } catch (error) {
    logger.error("Register device token error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Unregister a device token
 */
export const unregisterDeviceToken = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "User ID not found",
      });
      return;
    }

    const { deviceToken } = request.body;

    if (!deviceToken) {
      response.status(400).json({
        success: false,
        message: "Device token is required",
      });
      return;
    }

    const success = await PushNotificationService.unregisterDeviceToken(
      userId,
      deviceToken
    );

    if (success) {
      response.status(200).json({
        success: true,
        message: "Device token unregistered successfully",
      });
    } else {
      response.status(400).json({
        success: false,
        message: "Failed to unregister device token",
      });
    }
  } catch (error) {
    logger.error("Unregister device token error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Update push notification preferences
 */
export const updatePreferences = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "User ID not found",
      });
      return;
    }

    const preferences: Partial<PushNotificationPreferences> = request.body;

    const success = await PushNotificationService.updatePreferences(
      userId,
      preferences
    );

    if (success) {
      response.status(200).json({
        success: true,
        message: "Push notification preferences updated successfully",
      });
    } else {
      response.status(400).json({
        success: false,
        message: "Failed to update preferences",
      });
    }
  } catch (error) {
    logger.error("Update preferences error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Enable/disable push notifications
 */
export const setEnabled = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "User ID not found",
      });
      return;
    }

    const { enabled } = request.body;

    if (typeof enabled !== "boolean") {
      response.status(400).json({
        success: false,
        message: "Enabled status must be a boolean",
      });
      return;
    }

    const success = await PushNotificationService.setEnabled(userId, enabled);

    if (success) {
      response.status(200).json({
        success: true,
        message: `Push notifications ${enabled ? "enabled" : "disabled"} successfully`,
      });
    } else {
      response.status(400).json({
        success: false,
        message: "Failed to update push notification status",
      });
    }
  } catch (error) {
    logger.error("Set enabled error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Send test push notification to current user
 */
export const sendTestNotification = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "User ID not found",
      });
      return;
    }

    const { title, body, data } = request.body;

    const notification: PushNotificationData = {
      title: title || "Test Notification",
      body: body || "This is a test push notification from Jevah App",
      data: data || { test: true },
      sound: "default",
      priority: "high",
    };

    const success = await PushNotificationService.sendToUser(
      userId,
      notification
    );

    if (success) {
      response.status(200).json({
        success: true,
        message: "Test notification sent successfully",
      });
    } else {
      response.status(400).json({
        success: false,
        message: "Failed to send test notification",
      });
    }
  } catch (error) {
    logger.error("Send test notification error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get push notification statistics (Admin only)
 */
export const getStats = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const stats = await PushNotificationService.getStats();

    response.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Get stats error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Clean up invalid device tokens (Admin only)
 */
export const cleanupInvalidTokens = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    await PushNotificationService.cleanupInvalidTokens();

    response.status(200).json({
      success: true,
      message: "Invalid device tokens cleaned up successfully",
    });
  } catch (error) {
    logger.error("Cleanup invalid tokens error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Send push notification to specific users (Admin only)
 */
export const sendToUsers = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { userIds, notification } = request.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      response.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
      return;
    }

    if (!notification || !notification.title || !notification.body) {
      response.status(400).json({
        success: false,
        message: "Notification title and body are required",
      });
      return;
    }

    const result = await PushNotificationService.sendToUsers(
      userIds,
      notification,
      notification.type
    );

    response.status(200).json({
      success: true,
      message: "Push notifications sent",
      data: result,
    });
  } catch (error) {
    logger.error("Send to users error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Send push notification to all users (Admin only)
 */
export const sendToAll = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { notification } = request.body;

    if (!notification || !notification.title || !notification.body) {
      response.status(400).json({
        success: false,
        message: "Notification title and body are required",
      });
      return;
    }

    const result = await PushNotificationService.sendToAll(
      notification,
      notification.type
    );

    response.status(200).json({
      success: true,
      message: "Push notifications sent to all users",
      data: result,
    });
  } catch (error) {
    logger.error("Send to all error:", error);
    response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
