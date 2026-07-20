import logger from "../utils/logger";
import { analyticsQueue, mediaProcessingQueue, notificationsQueue } from "./queues";
import type { AnalyticsJob, MediaProcessingJob, NotificationJob } from "./queues";
import { toSafeBullJobId } from "../modules/notifications/domain/eventCatalog";

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
  jobIdSuffix?: string;
  skipModeration?: boolean;
}) {
  const {
    mediaId,
    userId,
    contentType,
    fileUrl,
    requestId,
    jobIdSuffix,
    skipModeration,
  } = params;

  // Only enqueue when we have something to work on
  if (!fileUrl) return;

  const jobs: Array<{ name: string; data: MediaProcessingJob }> = [];

  // Always moderate first for staged/legacy enqueue paths that include a file URL.
  // Transcode/waveform/book run after moderation succeeds (same job pipeline in worker).
  if (contentType === "videos" || contentType === "sermon") {
    jobs.push({
      name: "transcode",
      data: {
        type: "transcode",
        mediaId,
        userId,
        inputUrl: fileUrl,
        skipModeration,
      },
    });
  } else if (contentType === "music" || contentType === "audio") {
    jobs.push({
      name: "waveform",
      data: {
        type: "waveform",
        mediaId,
        userId,
        inputUrl: fileUrl,
        skipModeration,
      },
    });
  } else if (contentType === "books" || contentType === "ebook") {
    jobs.push({
      name: "book",
      data: {
        type: "book",
        mediaId,
        userId,
        inputUrl: fileUrl,
        skipModeration,
      },
    });
  } else {
    jobs.push({
      name: "moderate",
      data: {
        type: "moderate",
        mediaId,
        userId,
        inputUrl: fileUrl,
        skipModeration,
      },
    });
  }

  for (const j of jobs) {
    const safeSuffix = jobIdSuffix?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const jobId = toSafeBullJobId(
      `${mediaId}-${j.name}${safeSuffix ? `-${safeSuffix}` : ""}`,
      "media"
    );
    mediaProcessingQueue
      .add(j.name, j.data, {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      })
      .then(() =>
        MediaProcessingMarkQueued(mediaId, j.name, jobId).catch(() => {})
      )
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

async function MediaProcessingMarkQueued(
  mediaId: string,
  jobType: string,
  jobId: string
) {
  try {
    const { Media } = await import("../models/media.model");
    await Media.findByIdAndUpdate(mediaId, {
      processing: {
        status: "queued",
        jobType,
        jobId,
        updatedAt: new Date(),
        progress: 5,
      },
    });
  } catch {
    // non-fatal
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

/**
 * After Mongo notification insert — enqueue durable push delivery.
 * jobId is deterministic and colon-free (BullMQ v5 requirement).
 * Returns a promise so callers can await durability.
 */
export async function enqueueNotificationPush(params: {
  userId: string;
  notificationId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: "normal" | "high";
  notificationType?: string;
  dedupeKey?: string;
}): Promise<{ enqueued: boolean; jobId: string }> {
  const {
    userId,
    notificationId,
    title,
    body,
    data,
    priority,
    notificationType,
    dedupeKey,
  } = params;

  const job: NotificationJob = {
    type: "push",
    userId,
    notificationId,
    title,
    body,
    data,
    priority,
    notificationType,
  };

  const jobId = toSafeBullJobId(dedupeKey || notificationId, "notify");

  try {
    await notificationsQueue.add("push", job, {
      jobId,
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 2000,
      removeOnFail: 5000,
    });
    return { enqueued: true, jobId };
  } catch (err: any) {
    // BullMQ rejects duplicate jobId while active — that is expected
    if (String(err?.message || "").includes("already exists")) {
      return { enqueued: true, jobId };
    }
    logger.warn("Failed to enqueue notification push job", {
      userId,
      notificationId,
      error: err?.message,
    });
    throw err;
  }
}

