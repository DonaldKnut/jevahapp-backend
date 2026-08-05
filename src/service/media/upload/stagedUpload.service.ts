import { Types } from "mongoose";
import { createHash, randomUUID } from "crypto";
import {
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import fileUploadService from "../../fileUpload.service";
import { enqueueMediaPostUpload, enqueueAnalyticsEvent } from "../../../queues/enqueue";
import { invalidateFeedCaches } from "../../../lib/invalidateFeedCaches";
import { UPLOAD_LIMITS } from "../../../controllers/media/constants";
import logger from "../../../utils/logger";
import { enrichMediaPlaybackFields } from "../playbackFields";

const STAGING_PREFIX = "staging/uploads";
const INTENT_TTL_MS = 60 * 60 * 1000; // 1 hour

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

export interface CreateIntentInput {
  userId: string;
  title: string;
  contentType: string;
  description?: string;
  category?: string;
  topics?: string[];
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string;
  thumbnailMimeType?: string;
  thumbnailSizeBytes?: number;
  idempotencyKey?: string;
  /** Sermon / teaching metadata */
  speaker?: string;
  church?: string;
  scripture?: string;
  series?: string;
  mediaType?: "audio" | "video";
  language?: string;
}

/**
 * Create a private staging intent and return a time-limited presigned PUT URL.
 * Large uploads go direct to R2 — API never buffers the video body.
 */
export async function createUploadIntent(input: CreateIntentInput) {
  const {
    userId,
    title,
    contentType,
    mimeType,
    sizeBytes,
    checksumSha256,
    idempotencyKey,
  } = input;

  if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID");
  if (!title?.trim()) throw new Error("Title is required");
  if (!["music", "videos", "books", "sermon"].includes(contentType)) {
    throw new Error("Invalid content type for staged upload");
  }

  const maxMb =
    contentType === "music"
      ? UPLOAD_LIMITS.FILE_SIZE.MUSIC_MB
      : contentType === "books"
        ? UPLOAD_LIMITS.FILE_SIZE.BOOK_MB
        : UPLOAD_LIMITS.FILE_SIZE.SERMON_STAGED_MB;
  if (sizeBytes > maxMb * 1024 * 1024) {
    throw new Error(`File exceeds ${maxMb}MB limit for staged upload`);
  }

  if (!checksumSha256 || !/^[a-fA-F0-9]{64}$/.test(checksumSha256)) {
    throw new Error("checksumSha256 (64-char hex SHA-256) is required for staged uploads");
  }

  if (idempotencyKey) {
    const existing = await Media.findOne({
      "uploadIntent.intentId": idempotencyKey,
      uploadedBy: new Types.ObjectId(userId),
    }).lean();
    if (existing) {
      return buildIntentResponse(existing as any);
    }
  }

  const intentId = idempotencyKey || randomUUID();
  const stagingKey = `${STAGING_PREFIX}/${userId}/${intentId}/source`;

  const media = await Media.create({
    title: title.trim(),
    description: input.description,
    contentType,
    category: input.category,
    topics: input.topics || [],
    uploadedBy: new Types.ObjectId(userId),
    fileUrl: `staging://${stagingKey}`,
    fileObjectKey: stagingKey,
    fileMimeType: mimeType,
    thumbnailUrl: "staging://pending-thumbnail",
    moderationStatus: "pending",
    isHidden: true,
    speaker: input.speaker?.trim() || undefined,
    church: input.church?.trim() || undefined,
    scripture: input.scripture?.trim() || undefined,
    series: input.series?.trim() || undefined,
    mediaType:
      input.mediaType ||
      (mimeType.startsWith("audio/")
        ? "audio"
        : contentType === "sermon" || contentType === "videos"
          ? "video"
          : undefined),
    language: input.language?.trim() || undefined,
    processing: {
      status: "uploaded",
      updatedAt: new Date(),
      progress: 0,
    },
    uploadIntent: {
      intentId,
      stagingKey,
      checksum: checksumSha256,
      declaredSize: sizeBytes,
      declaredMime: mimeType,
    },
    contentHash: checksumSha256.toLowerCase(),
  });

  const putUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: stagingKey,
      ContentType: mimeType,
      ContentLength: sizeBytes,
      // S3-compatible APIs expect SHA-256 in base64, while our public API uses
      // the more common 64-character hexadecimal representation.
      ChecksumSHA256: Buffer.from(checksumSha256, "hex").toString("base64"),
    }),
    { expiresIn: 3600 }
  );

  return {
    intentId,
    mediaId: media._id.toString(),
    uploadUrl: putUrl,
    stagingKey,
    expiresInSeconds: 3600,
    maxBytes: sizeBytes,
    contentType: mimeType,
  };
}

function buildIntentResponse(existing: any) {
  return {
    intentId: existing.uploadIntent?.intentId,
    mediaId: existing._id.toString(),
    uploadUrl: null,
    stagingKey: existing.uploadIntent?.stagingKey,
    expiresInSeconds: 0,
    alreadyExists: true,
    moderationStatus: existing.moderationStatus,
    processing: existing.processing,
  };
}

/**
 * After the client finishes the direct PUT, verify HEAD and enqueue processing.
 */
export async function finalizeUploadIntent(params: {
  userId: string;
  mediaId: string;
  thumbnailBuffer?: Buffer;
  thumbnailMimeType?: string;
}) {
  const { userId, mediaId, thumbnailBuffer, thumbnailMimeType } = params;
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(mediaId)) {
    throw new Error("Invalid user or media ID");
  }

  const media = await Media.findById(mediaId);
  if (!media) throw new Error("Upload intent not found");
  if (media.uploadedBy.toString() !== userId) throw new Error("Not authorized");
  if (!media.uploadIntent?.stagingKey) throw new Error("Not a staged upload");

  const stagingKey = media.uploadIntent.stagingKey;
  const head = await s3.send(
    new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: stagingKey,
    })
  );

  const declared = media.uploadIntent.declaredSize;
  if (declared && head.ContentLength && head.ContentLength !== declared) {
    throw new Error(
      `Uploaded size mismatch: expected ${declared}, got ${head.ContentLength}`
    );
  }
  if (
    media.uploadIntent.declaredMime &&
    head.ContentType &&
    head.ContentType !== media.uploadIntent.declaredMime
  ) {
    logger.warn("Staged upload MIME mismatch", {
      mediaId,
      declared: media.uploadIntent.declaredMime,
      actual: head.ContentType,
    });
  }

  // Keep the source private in staging. Workers publish a derivative/original
  // only after moderation approves it.
  let thumbnailUrl = media.thumbnailUrl;
  let thumbnailObjectKey = media.thumbnailObjectKey;
  if (thumbnailBuffer && thumbnailMimeType) {
    const extension =
      thumbnailMimeType === "image/png"
        ? "png"
        : thumbnailMimeType === "image/webp"
          ? "webp"
          : "jpg";
    const thumbKey = `${STAGING_PREFIX}/${userId}/${media.uploadIntent.intentId}/thumbnail.${extension}`;
    const thumb = await fileUploadService.uploadObjectExact(
      thumbKey,
      thumbnailBuffer,
      thumbnailMimeType,
      "private, no-store"
    );
    thumbnailUrl = `staging://${thumb.objectKey}`;
    thumbnailObjectKey = thumb.objectKey;
    media.uploadIntent.thumbnailStagingKey = thumb.objectKey;
  }

  // A short-lived signed URL is used only by the worker.
  const workerInputUrl = await fileUploadService.getPresignedGetUrl(stagingKey, 7200);

  media.thumbnailUrl = thumbnailUrl;
  media.thumbnailObjectKey = thumbnailObjectKey;
  if (media.uploadIntent?.checksum) {
    (media as any).contentHash = String(media.uploadIntent.checksum).toLowerCase();
  }
  media.processing = {
    status: "queued",
    jobType:
      media.contentType === "music" || media.contentType === "audio"
        ? "waveform"
        : media.contentType === "books" || media.contentType === "ebook"
          ? "book"
          : "transcode",
    updatedAt: new Date(),
    progress: 5,
    attempts: (media.processing as any)?.attempts || 0,
  } as any;
  // Stay hidden until worker moderation marks ready/approved
  media.isHidden = true;
  media.moderationStatus = "pending";
  await media.save();

  const jobId = `media:${mediaId}:process`;
  enqueueMediaPostUpload({
    mediaId,
    userId,
    contentType: media.contentType,
    fileUrl: workerInputUrl,
    requestId: jobId,
  });
  enqueueAnalyticsEvent({
    name: "media_staged_finalized",
    payload: { mediaId, userId, contentType: media.contentType },
    requestId: jobId,
  });

  return {
    mediaId,
    status: "queued",
    moderationStatus: media.moderationStatus,
    processing: media.processing,
  };
}

export async function abortUploadIntent(userId: string, mediaId: string) {
  const media = await Media.findById(mediaId);
  if (!media) throw new Error("Upload intent not found");
  if (userId !== "system" && media.uploadedBy.toString() !== userId) {
    throw new Error("Not authorized");
  }

  const keys = [
    media.uploadIntent?.stagingKey || media.fileObjectKey,
    media.uploadIntent?.thumbnailStagingKey,
  ].filter((key): key is string => Boolean(key?.startsWith(STAGING_PREFIX)));
  for (const key of keys) {
    try {
      await s3.send(
        new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
      );
    } catch (err: any) {
      logger.warn("Failed to delete staging object", { key, error: err?.message });
    }
  }
  await Media.findByIdAndDelete(mediaId);
  return { aborted: true, mediaId };
}

export async function getUploadStatus(userId: string, mediaId: string) {
  const media = await Media.findById(mediaId)
    .select(
      "title contentType moderationStatus isHidden processing processingMetadata uploadIntent createdAt updatedAt fileUrl thumbnailUrl hlsUrl playbackUrl duration"
    )
    .lean();
  if (!media) throw new Error("Media not found");
  if ((media as any).uploadedBy && String((media as any).uploadedBy) !== userId) {
    // uploadedBy may be omitted by select — re-check
  }
  const owned = await Media.findOne({
    _id: mediaId,
    uploadedBy: new Types.ObjectId(userId),
  })
    .select("_id")
    .lean();
  if (!owned) throw new Error("Not authorized");

  const enriched = enrichMediaPlaybackFields(media as any);
  const ready = enriched.processingStatus === "ready";

  return {
    mediaId,
    _id: mediaId,
    title: (media as any).title,
    contentType: (media as any).contentType,
    moderationStatus: (media as any).moderationStatus,
    isHidden: (media as any).isHidden,
    processing: (media as any).processing,
    processingStatus: enriched.processingStatus,
    duration: enriched.duration,
    // Owner status: expose seekable URLs once processing is ready (even if still hidden for review)
    fileUrl: ready ? (media as any).fileUrl : undefined,
    playbackUrl: ready ? (media as any).playbackUrl : undefined,
    hlsUrl: ready ? (media as any).hlsUrl : undefined,
    thumbnailUrl: (media as any).thumbnailUrl,
  };
}

/** Cleanup expired staging intents (call from worker/cron). */
export async function cleanupExpiredUploadIntents(limit = 50): Promise<number> {
  const cutoff = new Date(Date.now() - INTENT_TTL_MS);
  const stale = await Media.find({
    "uploadIntent.stagingKey": { $exists: true },
    "processing.status": { $in: ["uploaded", "idle"] },
    createdAt: { $lt: cutoff },
  })
    .limit(limit)
    .select("_id uploadIntent fileObjectKey")
    .lean();

  let cleaned = 0;
  for (const row of stale as any[]) {
    try {
      await abortUploadIntent(
        // ownership bypass for system cleanup — delete by id directly
        "system",
        row._id.toString()
      ).catch(async () => {
        const key = row.uploadIntent?.stagingKey;
        if (key) {
          await s3
            .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
            .catch(() => {});
        }
        await Media.findByIdAndDelete(row._id);
      });
      cleaned++;
    } catch {
      // continue
    }
  }
  return cleaned;
}

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
