import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { Job } from "bullmq";
import logger from "../utils/logger";
import type { MediaProcessingJob } from "../queues/queues";
import { Media } from "../models/media.model";
import { processVideoTranscode } from "./mediaTranscode";
import { processMediaModeration, createWorkDir } from "./mediaModerate";
import {
  discardStagedObjects,
  publishApprovedStagedOriginal,
} from "./publishStagedOriginal";
import { cleanupExpiredUploadIntents } from "../service/media/upload/stagedUpload.service";
import { probeMediaFile } from "../utils/mediaTools";

async function markMediaProcessing(
  mediaId: string,
  data: {
    status:
      | "queued"
      | "processing"
      | "moderating"
      | "awaiting_review"
      | "transcoding"
      | "ready"
      | "completed"
      | "rejected"
      | "failed";
    jobType?: string;
    error?: string;
    progress?: number;
  }
) {
  try {
    await Media.findByIdAndUpdate(mediaId, {
      processing: {
        status: data.status,
        jobType: data.jobType,
        updatedAt: new Date(),
        error: data.error,
        progress: data.progress,
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

async function downloadToWorkDir(mediaId: string, inputUrl: string): Promise<string> {
  const workDir = createWorkDir(mediaId);
  const inputPath = path.join(workDir, "source");
  if (inputUrl.startsWith("http")) {
    const res = await fetch(inputUrl);
    if (!res.ok) throw new Error(`Failed to download source: ${res.status}`);
    if (!res.body) throw new Error("Source response had no body");
    await pipeline(
      Readable.fromWeb(res.body as any),
      fs.createWriteStream(inputPath, { flags: "wx" })
    );
  } else {
    fs.copyFileSync(inputUrl, inputPath);
  }
  return inputPath;
}

export type ProcessMediaJobResult = {
  ok: true;
  moderationStatus: string;
  reused?: boolean | string;
};

/**
 * Media processing pipeline: moderate → encode/publish → ready.
 * Extracted from workers/index.ts so the bootstrap stays thin.
 */
export async function processMediaJob(
  job: Job<MediaProcessingJob> | { id?: string; name?: string; data: MediaProcessingJob },
  options: { ffprobeAvailable: boolean }
): Promise<ProcessMediaJobResult> {
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

  const userId = (job.data as any).userId || "";
  let localPath: string | undefined;
  let workDir: string | undefined;

  try {
    localPath = await downloadToWorkDir(job.data.mediaId, job.data.inputUrl);
    workDir = path.dirname(localPath);

    const mod = job.data.skipModeration
      ? {
          moderationStatus: "approved",
          contentHash: "",
          reused: true,
        }
      : await processMediaModeration({
          mediaId: job.data.mediaId,
          userId,
          localFilePath: localPath,
        });

    if (mod.moderationStatus === "rejected") {
      await discardStagedObjects(job.data.mediaId);
      await markMediaProcessing(job.data.mediaId, {
        status: "rejected",
        jobType,
        progress: 100,
        error: "Moderation rejected",
      });
      return { ok: true, moderationStatus: mod.moderationStatus, reused: mod.reused };
    }

    // This bucket is served by a public CDN domain, so generating a public
    // derivative for held content would defeat isHidden. Admin approval
    // re-enqueues processing with a fresh signed staging URL.
    if (mod.moderationStatus === "under_review") {
      await markMediaProcessing(job.data.mediaId, {
        status: "awaiting_review",
        jobType,
        progress: 100,
      });
      return {
        ok: true,
        moderationStatus: mod.moderationStatus,
        reused: mod.reused,
      };
    }

    if (job.data.type === "transcode") {
      await processVideoTranscode({
        mediaId: job.data.mediaId,
        inputUrl: localPath,
      });
      await markMediaProcessing(job.data.mediaId, {
        status: "ready",
        jobType,
        progress: 100,
      });
    } else if (job.data.type === "waveform") {
      if (options.ffprobeAvailable) {
        try {
          const probed = await probeMediaFile(localPath);
          const durationSeconds = probed.durationSeconds;
          if (durationSeconds != null) {
            await Media.findByIdAndUpdate(job.data.mediaId, {
              $set: {
                duration: durationSeconds,
                "processingMetadata.durationSeconds": durationSeconds,
              },
            });
          }
        } catch (err: any) {
          logger.warn("ffprobe duration extraction failed", {
            mediaId: job.data.mediaId,
            error: err?.message,
          });
        }
      }
      await publishApprovedStagedOriginal(job.data.mediaId);
      await markMediaProcessing(job.data.mediaId, {
        status: "ready",
        jobType,
        progress: 100,
      });
    } else {
      // book / moderate-only
      if (job.data.type === "book") {
        await publishApprovedStagedOriginal(job.data.mediaId);
      }
      await markMediaProcessing(job.data.mediaId, {
        status: "ready",
        jobType,
        progress: 100,
      });
    }

    void cleanupExpiredUploadIntents(20).catch(() => {});

    logger.info("media-processing job completed", {
      jobId: job.id,
      name: job.name,
      moderationStatus: mod.moderationStatus,
      reused: mod.reused,
    });
    return { ok: true, moderationStatus: mod.moderationStatus, reused: mod.reused };
  } catch (err: any) {
    await markMediaProcessing(job.data.mediaId, {
      status: "failed",
      jobType,
      error: err?.message || "media processing failed",
    });
    throw err;
  } finally {
    if (workDir) {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
