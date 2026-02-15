import logger from "../utils/logger";
import { analyticsQueue, mediaProcessingQueue } from "./queues";
import type { AnalyticsJob, MediaProcessingJob } from "./queues";

/**
 * Enqueue helpers (never throw).
 * These are intentionally "fire-and-forget" so API requests don't block.
 */

export function enqueueMediaPostUpload(params: {
  mediaId: string;
  userId: string;
  contentType: string;
  fileUrl?: string;
  requestId?: string;
}) {
  const { mediaId, userId, contentType, fileUrl, requestId } = params;

  // Only enqueue when we have something to work on
  if (!fileUrl) return;

  const jobs: Array<{ name: string; data: MediaProcessingJob }> = [];

  if (contentType === "videos") {
    jobs.push({
      name: "transcode",
      data: { type: "transcode", mediaId, inputUrl: fileUrl },
    });
  }

  if (contentType === "music") {
    jobs.push({
      name: "waveform",
      data: { type: "waveform", mediaId, inputUrl: fileUrl },
    });
  }

  for (const j of jobs) {
    mediaProcessingQueue
      .add(j.name, j.data, {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      })
      .catch(err => {
        logger.warn("Failed to enqueue media-processing job", {
          requestId,
          mediaId,
          userId,
          job: j.name,
          error: err?.message,
        });
      });
  }
}

export function enqueueAnalyticsEvent(params: {
  name: string;
  payload: Record<string, any>;
  requestId?: string;
}) {
  const { name, payload, requestId } = params;

  const job: AnalyticsJob = {
    type: "event",
    name,
    payload,
  };

  analyticsQueue
    .add("event", job, {
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 5000,
      removeOnFail: 5000,
    })
    .catch(err => {
      logger.warn("Failed to enqueue analytics job", {
        requestId,
        name,
        error: err?.message,
      });
    });
}

