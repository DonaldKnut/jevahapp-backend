import { Media } from "../models/media.model";
import fileUploadService from "../service/fileUpload.service";
import {
  livePrefix,
  sourceKey,
  posterKey,
} from "../service/media/delivery/mediaKeys";
import {
  reserveNextAssetVersion,
  markMediaLive,
} from "../service/media/delivery/publishLive";
import logger from "../utils/logger";

const EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
};

export async function discardStagedObjects(mediaId: string): Promise<void> {
  const media = await Media.findById(mediaId)
    .select("uploadIntent.stagingKey uploadIntent.thumbnailStagingKey")
    .lean();
  const keys = [
    (media as any)?.uploadIntent?.stagingKey,
    (media as any)?.uploadIntent?.thumbnailStagingKey,
  ].filter((key): key is string => Boolean(key?.startsWith("staging/")));
  await Promise.all(
    keys.map(key =>
      fileUploadService.deleteMedia(key).catch((err: any) => {
        logger.warn("Failed to discard staged object", {
          mediaId,
          key,
          error: err?.message,
        });
      })
    )
  );
}

/**
 * Server-side promotion for non-video uploads. The source stays in a private
 * staging prefix until moderation approves it; no API memory buffering.
 * Writes under media/{id}/v{N}/source.ext (immutable versioned prefix).
 */
export async function publishApprovedStagedOriginal(
  mediaId: string
): Promise<{ url: string; objectKey: string } | null> {
  const media = await Media.findById(mediaId).select(
    "uploadIntent fileMimeType contentType moderationStatus uploadedBy storagePrefix derivativeKeys"
  );
  if (!media || media.moderationStatus !== "approved") return null;

  const sourceStagingKey = media.uploadIntent?.stagingKey;
  if (!sourceStagingKey?.startsWith("staging/")) return null;

  const mimeType =
    media.fileMimeType ||
    media.uploadIntent?.declaredMime ||
    "application/octet-stream";
  const extension = EXTENSIONS[mimeType];
  if (!extension) {
    throw new Error(`Cannot publish unsupported staged MIME type: ${mimeType}`);
  }

  const priorStoragePrefix = (media as any).storagePrefix as string | undefined;
  const priorDerivativeKeys = ((media as any).derivativeKeys ||
    []) as string[];

  const assetVersion = await reserveNextAssetVersion(mediaId);
  const storagePrefix = livePrefix(mediaId, assetVersion);
  const destinationKey = sourceKey(mediaId, assetVersion, extension);
  const published = await fileUploadService.copyObject(
    sourceStagingKey,
    destinationKey,
    mimeType
  );

  const derivativeKeys: string[] = [published.objectKey];
  const urls: Record<string, string> = {
    fileUrl: published.secure_url,
    fileObjectKey: published.objectKey,
  };
  if (media.contentType !== "books" && media.contentType !== "ebook") {
    urls.playbackUrl = published.secure_url;
  }

  const thumbSource = media.uploadIntent?.thumbnailStagingKey;
  if (thumbSource?.startsWith("staging/")) {
    const thumbExt = thumbSource.split(".").pop()?.toLowerCase() || "jpg";
    const thumbMime =
      thumbExt === "png"
        ? "image/png"
        : thumbExt === "webp"
          ? "image/webp"
          : "image/jpeg";
    // Prefer versioned poster.jpg for jpeg; otherwise keep extension under prefix
    const thumbKey =
      thumbMime === "image/jpeg"
        ? posterKey(mediaId, assetVersion)
        : `${storagePrefix}/cover.${thumbExt}`;
    const thumb = await fileUploadService.copyObject(
      thumbSource,
      thumbKey,
      thumbMime
    );
    urls.thumbnailUrl = thumb.secure_url;
    urls.thumbnailObjectKey = thumb.objectKey;
    derivativeKeys.push(thumb.objectKey);
  }

  await markMediaLive({
    mediaId,
    userId: String(media.uploadedBy),
    urls,
    storagePrefix,
    derivativeKeys,
    assetVersion,
    extra: {
      processing: {
        status: "ready",
        progress: 100,
        updatedAt: new Date(),
      },
    },
  });

  await fileUploadService.deleteMedia(sourceStagingKey).catch((err: any) => {
    logger.warn("Failed to delete promoted staging object", {
      mediaId,
      sourceKey: sourceStagingKey,
      error: err?.message,
    });
  });
  if (thumbSource?.startsWith("staging/")) {
    await fileUploadService.deleteMedia(thumbSource).catch(() => {});
  }

  if (
    priorStoragePrefix &&
    priorStoragePrefix !== storagePrefix &&
    priorDerivativeKeys.length
  ) {
    await Promise.all(
      priorDerivativeKeys.map(key =>
        fileUploadService.deleteMedia(key).catch((err: any) => {
          logger.warn("Failed to delete previous storagePrefix derivative", {
            mediaId,
            key,
            error: err?.message,
          });
        })
      )
    );
  }

  return { url: published.secure_url, objectKey: published.objectKey };
}
