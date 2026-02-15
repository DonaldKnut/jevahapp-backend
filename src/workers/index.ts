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
} from "../queues/queues";
import { connectWorkerMongo } from "./bootstrap";
import { AnalyticsEvent } from "../models/analyticsEvent.model";
import { Media } from "../models/media.model";

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

async function markMediaProcessing(
  mediaId: string,
  data: { status: "queued" | "processing" | "completed" | "failed"; jobType?: string; error?: string }
) {
  try {
    await Media.findByIdAndUpdate(mediaId, {
      processing: {
        status: data.status,
        jobType: data.jobType,
        updatedAt: new Date(),
        error: data.error,
      },
    });
  } catch (err: any) {
    logger.warn("Failed to update media processing state", {
      mediaId,
      status: data.status,
      error: err?.message,
    });
  }
}

(async () => {
  // Workers need DB access for analytics aggregation / media status updates
  await connectWorkerMongo();

  const ffprobeAvailable = await hasBinary("ffprobe");

  const mediaWorker = new Worker<MediaProcessingJob>(
    QUEUE_NAMES.MEDIA_PROCESSING,
    async job => {
      const jobType = job.data.type;
      logger.info("media-processing job started", {
        jobId: job.id,
        name: job.name,
        data: job.data,
      });

      await markMediaProcessing(job.data.mediaId, {
        status: "processing",
        jobType,
      });

      if (job.data.type === "waveform") {
        // "Real" work: extract duration via ffprobe if available.
        // Waveform generation itself is typically done by ffmpeg and stored to CDN/S3;
        // this project doesn't yet have a destination for waveform assets, so we
        // start with metadata extraction (still CPU/IO) and keep a TODO.
        if (!ffprobeAvailable) {
          logger.warn("ffprobe not available; skipping duration extraction", {
            mediaId: job.data.mediaId,
          });
        } else {
          try {
            // Note: ffprobe can read HTTP URLs, but some signed URLs may block.
            const { stdout } = await execFileAsync("ffprobe", [
              "-v",
              "error",
              "-show_entries",
              "format=duration",
              "-of",
              "default=noprint_wrappers=1:nokey=1",
              job.data.inputUrl,
            ]);
            const durationSeconds = Math.round(parseFloat(String(stdout).trim()));
            if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
              await Media.findByIdAndUpdate(job.data.mediaId, {
                $set: { duration: durationSeconds },
              });
            }
          } catch (err: any) {
            logger.warn("ffprobe duration extraction failed", {
              mediaId: job.data.mediaId,
              error: err?.message,
            });
          }
        }

        // TODO: waveform generation + store (Cloudinary/R2) and save waveform URL.
      }

      if (job.data.type === "transcode") {
        // TODO: hook into Mux/FFmpeg pipeline for transcoding.
        // For now, we only track processing state so ops can see it's queued/processed.
      }

      await markMediaProcessing(job.data.mediaId, {
        status: "completed",
        jobType,
      });

      logger.info("media-processing job completed", {
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

  const analyticsWorker = new Worker<AnalyticsJob>(
    QUEUE_NAMES.ANALYTICS,
    async job => {
      logger.info("analytics job started", {
        jobId: job.id,
        name: job.name,
        data: job.data,
      });

      if (job.data.type === "event") {
        // Persist event (TTL prevents unbounded growth)
        await AnalyticsEvent.create({
          name: job.data.name,
          payload: job.data.payload,
          requestId: (job.data.payload as any)?.requestId,
          createdAt: new Date(),
        });

        // Lightweight aggregation updates to keep "total*" fields in sync for trending pipelines
        const p: any = job.data.payload || {};

        if (job.data.name === "media_interaction" && p.mediaId) {
          if (p.interactionType === "view") {
            await Media.findByIdAndUpdate(p.mediaId, { $inc: { totalViews: 1 } });
          }
          if (p.interactionType === "download") {
            await Media.findByIdAndUpdate(p.mediaId, { $inc: { totalDownloads: 1 } });
          }
        }

        if (job.data.name === "content_like_toggled" && p.contentType === "media" && p.contentId) {
          // Store canonical likeCount
          if (typeof p.likeCount === "number") {
            await Media.findByIdAndUpdate(p.contentId, { $set: { totalLikes: p.likeCount } });
          }
        }

        if (job.data.name === "content_shared" && p.contentType === "media" && p.contentId) {
          if (typeof p.shareCount === "number") {
            await Media.findByIdAndUpdate(p.contentId, { $set: { totalShares: p.shareCount } });
          }
        }
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

  for (const w of [mediaWorker, analyticsWorker]) {
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
    queues: [QUEUE_NAMES.MEDIA_PROCESSING, QUEUE_NAMES.ANALYTICS],
    ffprobeAvailable,
  });
})().catch((err: any) => {
  logger.error("Worker bootstrap failed", { error: err?.message, stack: err?.stack });
  process.exit(1);
});

