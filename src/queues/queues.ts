import { Queue } from "bullmq";
import { createBullConnection } from "./queueConnection";

export const QUEUE_NAMES = {
  MEDIA_PROCESSING: "media-processing",
  ANALYTICS: "analytics",
} as const;

export type MediaProcessingJob =
  | {
      type: "transcode";
      mediaId: string;
      inputUrl: string;
    }
  | {
      type: "waveform";
      mediaId: string;
      inputUrl: string;
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

const connection = createBullConnection();

export const mediaProcessingQueue = new Queue<MediaProcessingJob>(
  QUEUE_NAMES.MEDIA_PROCESSING,
  { connection }
);

export const analyticsQueue = new Queue<AnalyticsJob>(QUEUE_NAMES.ANALYTICS, {
  connection,
});

