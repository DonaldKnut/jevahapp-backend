import { Media } from "../../../models/media.model";
import { invalidateFeedCaches } from "../../../lib/invalidateFeedCaches";
import cacheService from "../../cache.service";

export interface MarkMediaLiveUrls {
  fileUrl?: string;
  playbackUrl?: string;
  hlsUrl?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  fileObjectKey?: string;
  thumbnailObjectKey?: string;
}

/**
 * Atomically bump assetVersion and mark the media as publishing.
 * Returns the new version number (never reuses a prior prefix).
 */
export async function reserveNextAssetVersion(
  mediaId: string
): Promise<number> {
  const updated = await Media.findByIdAndUpdate(
    mediaId,
    {
      $inc: { assetVersion: 1 },
      $set: { publicationState: "publishing" },
    },
    { new: true }
  )
    .select("assetVersion")
    .lean();

  if (!updated) {
    throw new Error(`Media not found while reserving asset version: ${mediaId}`);
  }

  const version = Number((updated as { assetVersion?: number }).assetVersion);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(
      `Invalid assetVersion after reserve for ${mediaId}: ${version}`
    );
  }
  return version;
}

/**
 * Flip media to publicly live under a specific versioned storage prefix.
 * Does not touch prior version prefixes — callers write only to the new prefix.
 */
export async function markMediaLive(params: {
  mediaId: string;
  userId: string;
  urls: MarkMediaLiveUrls;
  storagePrefix: string;
  derivativeKeys: string[];
  assetVersion: number;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const {
    mediaId,
    userId,
    urls,
    storagePrefix,
    derivativeKeys,
    assetVersion,
    extra,
  } = params;

  await Media.findByIdAndUpdate(mediaId, {
    $set: {
      ...urls,
      ...(extra || {}),
      isHidden: false,
      publicationState: "live",
      publishedAt: new Date(),
      storagePrefix,
      derivativeKeys,
      assetVersion,
    },
  });

  await invalidateFeedCaches(mediaId, userId || "");
  await cacheService.del(`media:public:${mediaId}`);
}
