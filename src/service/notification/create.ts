import { Notification } from "../../models/notification.model";
import PushNotificationService from "../pushNotification.service";
import logger from "../../utils/logger";
import type { CreateNotificationData } from "./types";

export async function createNotification(data: CreateNotificationData): Promise<any> {
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
    const { enqueueNotificationPush } = await import("../../queues/enqueue");
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

export async function sendPushNotification(
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
