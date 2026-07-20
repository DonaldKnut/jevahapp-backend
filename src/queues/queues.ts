import { Queue } from "bullmq";
import { createBullConnection } from "./queueConnection";

export const QUEUE_NAMES = {
  MEDIA_PROCESSING: "media-processing",
  ANALYTICS: "analytics",
  NOTIFICATIONS: "notifications",
} as const;

export type MediaProcessingJob =
  | {
      type: "transcode";
      mediaId: string;
      userId: string;
      inputUrl: string;
      skipModeration?: boolean;
    }
  | {
      type: "waveform";
      mediaId: string;
      userId: string;
      inputUrl: string;
      skipModeration?: boolean;
    }
  | {
      type: "book";
      mediaId: string;
      userId: string;
      inputUrl: string;
      skipModeration?: boolean;
    }
  | {
      type: "moderate";
      mediaId: string;
      userId: string;
      inputUrl: string;
      skipModeration?: boolean;
    };

export type AnalyticsJob =
  | {
      type: "feed-ranking";
      userId: string;
    }
  | {
      type: "event";
      name: string;
      payload: Record<string, any>;
    };

export type NotificationJob = {
  type: "push";
  userId: string;
  notificationId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: "normal" | "high";
  notificationType?: string;
};

const connection = createBullConnection();

export const mediaProcessingQueue = new Queue<MediaProcessingJob>(
  QUEUE_NAMES.MEDIA_PROCESSING,
  { connection }
);

export const analyticsQueue = new Queue<AnalyticsJob>(QUEUE_NAMES.ANALYTICS, {
  connection,
});

export const notificationsQueue = new Queue<NotificationJob>(
  QUEUE_NAMES.NOTIFICATIONS,
  { connection }
);

