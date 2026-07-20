import dotenv from "dotenv";
dotenv.config();

import { Worker } from "bullmq";
import { execFile } from "child_process";
import { promisify } from "util";
import logger from "../utils/logger";
import { createBullConnection } from "../queues/queueConnection";
import {
  QUEUE_NAMES,
  type AnalyticsJob,
  type MediaProcessingJob,
  type NotificationJob,
} from "../queues/queues";
import { connectWorkerMongo } from "./bootstrap";
import { processEngagementEvent } from "../lib/processEngagementEvent";
import { startEngagementKafkaConsumer } from "../lib/kafkaConsumer";
import { Media } from "../models/media.model";
import { processMediaJob } from "./mediaPipeline";
import { cleanupExpiredUploadIntents } from "../service/media/upload/stagedUpload.service";
import PushNotificationService from "../service/pushNotification.service";
import { validateGeminiStartupConfig } from "../service/moderation/geminiConfig";

/**
 * BullMQ workers run in a separate process from the API server.
 * This prevents CPU-heavy or slow tasks from blocking request handling.
 *
 * Start locally:
 * - API:    npm run dev
 * - Worker: npm run worker:dev
 */

const connection = createBullConnection();

const execFileAsync = promisify(execFile);

async function hasBinary(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(cmd, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  // Workers need DB access for analytics aggregation / media status updates
  await connectWorkerMongo();
  validateGeminiStartupConfig();

  const ffprobeAvailable = await hasBinary("ffprobe");

  const mediaWorker = new Worker<MediaProcessingJob>(
    QUEUE_NAMES.MEDIA_PROCESSING,
    async job => processMediaJob(job, { ffprobeAvailable }),
    {
      connection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "4", 10),
    }
  );

  const analyticsWorker = new Worker<AnalyticsJob>(
    QUEUE_NAMES.ANALYTICS,
    async job => {
      logger.info("analytics job started", {
        jobId: job.id,
        name: job.name,
        data: job.data,
      });

      if (job.data.type === "event") {
        await processEngagementEvent(job.data.name, job.data.payload || {});
      }

      logger.info("analytics job completed", {
        jobId: job.id,
        name: job.name,
      });
      return { ok: true };
    },
    {
      connection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "4", 10),
    }
  );

  const notificationsWorker = new Worker<NotificationJob>(
    QUEUE_NAMES.NOTIFICATIONS,
    async job => {
      logger.info("notifications job started", {
        jobId: job.id,
        name: job.name,
        type: job.data.type,
        notificationId: job.data.notificationId,
      });

      if (job.data.type === "push") {
        try {
          const result = await PushNotificationService.sendToUser(
            job.data.userId,
            {
              title: job.data.title,
              body: job.data.body,
              data: job.data.data,
              priority: job.data.priority || "normal",
              sound: "default",
            },
            job.data.notificationType
          );
          logger.info("notifications job delivered", {
            jobId: job.id,
            notificationId: job.data.notificationId,
            ticketCount: result.ticketIds.length,
          });
          // Persist tickets for Expo receipt reconciliation
          if (result.ticketIds.length) {
            try {
              const { persistPushTickets } = await import(
                "../modules/notifications/infrastructure/expoTicket.processor"
              );
              await persistPushTickets({
                userId: job.data.userId,
                notificationId: job.data.notificationId,
                ticketIds: result.ticketIds,
                tokens: result.tokens,
              });
            } catch (err: any) {
              // Processor may not be loaded yet during partial deploy — non-fatal
              logger.debug("Ticket persistence skipped", {
                error: err?.message,
              });
            }
          }
        } catch (err: any) {
          if (err?.name === "PushDeliverySkippedError") {
            logger.info("Push skipped (terminal)", {
              jobId: job.id,
              notificationId: job.data.notificationId,
              reason: err.message,
            });
            return { ok: true, skipped: true };
          }
          // Retryable — rethrow for BullMQ
          throw err;
        }
      }

      logger.info("notifications job completed", {
        jobId: job.id,
        notificationId: job.data.notificationId,
      });
      return { ok: true };
    },
    {
      connection,
      concurrency: parseInt(process.env.NOTIFY_WORKER_CONCURRENCY || "8", 10),
    }
  );

  for (const w of [mediaWorker, analyticsWorker, notificationsWorker]) {
    w.on("failed", (job, err) => {
      logger.error("worker job failed", {
        queue: w.name,
        jobId: job?.id,
        error: err.message,
        stack: err.stack,
      });
    });
  }

  logger.info("✅ BullMQ workers started", {
    queues: [
      QUEUE_NAMES.MEDIA_PROCESSING,
      QUEUE_NAMES.ANALYTICS,
      QUEUE_NAMES.NOTIFICATIONS,
    ],
    ffprobeAvailable,
    ffmpegAvailable: await hasBinary("ffmpeg"),
  });

  // Periodic ops: staging TTL cleanup + stuck publishing sweeper
  const cleanupMs = parseInt(process.env.STAGING_CLEANUP_INTERVAL_MS || "300000", 10);
  setInterval(() => {
    void cleanupExpiredUploadIntents(50).catch(err => {
      logger.warn("Scheduled staging cleanup failed", { error: err?.message });
    });
    void (async () => {
      try {
        const stuckCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const stuck = await Media.updateMany(
          {
            publicationState: "publishing",
            "processing.updatedAt": { $lt: stuckCutoff },
          },
          {
            $set: {
              "processing.status": "failed",
              "processing.error": "Stuck publishing > 6h",
              "processing.updatedAt": new Date(),
            },
          }
        );
        if ((stuck as any).modifiedCount) {
          logger.warn("Marked stuck publishing media as failed", {
            count: (stuck as any).modifiedCount,
          });
        }
      } catch (err: any) {
        logger.warn("Stuck media sweeper failed", { error: err?.message });
      }
    })();
  }, cleanupMs).unref?.();

  // Expo receipt reconciliation (DeviceNotRegistered → deactivate tokens)
  try {
    const { startExpoReceiptPoller } = await import(
      "../modules/notifications/infrastructure/expoReceipt.processor"
    );
    const receiptIntervalMs = parseInt(
      process.env.EXPO_RECEIPT_POLL_MS || "60000",
      10
    );
    startExpoReceiptPoller(receiptIntervalMs);
    logger.info("Expo receipt poller started", { intervalMs: receiptIntervalMs });
  } catch (err: any) {
    logger.warn("Expo receipt poller not started", { error: err?.message });
  }

  await startEngagementKafkaConsumer();
})().catch((err: any) => {
  logger.error("Worker bootstrap failed", { error: err?.message, stack: err?.stack });
  process.exit(1);
});
