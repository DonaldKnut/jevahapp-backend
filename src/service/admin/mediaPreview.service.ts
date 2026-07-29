import fileUploadService from "../fileUpload.service";
import logger from "../../utils/logger";

const PREVIEW_TTL_SECONDS = 3600;

function isHttpUrl(value?: string | null): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

async function safePresign(
  objectKey?: string | null,
  ttl = PREVIEW_TTL_SECONDS
): Promise<string | null> {
  if (!objectKey || typeof objectKey !== "string") return null;
  try {
    return await fileUploadService.getPresignedGetUrl(objectKey, ttl);
  } catch (error: any) {
    logger.warn("Admin media preview presign failed", {
      objectKey,
      error: error?.message,
    });
    return null;
  }
}

export type AdminMediaPreview = {
  /** Best URL for inline player / open-in-tab (may be temporary signed). */
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  playbackUrl: string | null;
  hlsUrl: string | null;
  /** True when mediaUrl/thumbnailUrl are short-lived signed links. */
  signed: boolean;
  expiresInSeconds: number | null;
};

/**
 * Resolve playable/viewable URLs for admin review UI.
 * Prefer public playback URLs; fall back to R2 object keys / staging keys.
 */
export async function resolveAdminMediaPreview(media: {
  fileUrl?: string | null;
  playbackUrl?: string | null;
  hlsUrl?: string | null;
  thumbnailUrl?: string | null;
  fileObjectKey?: string | null;
  thumbnailObjectKey?: string | null;
  uploadIntent?: {
    stagingKey?: string | null;
    thumbnailStagingKey?: string | null;
  } | null;
}): Promise<AdminMediaPreview> {
  const hlsUrl = isHttpUrl(media.hlsUrl) ? media.hlsUrl! : null;
  const playbackUrl = isHttpUrl(media.playbackUrl) ? media.playbackUrl! : null;
  const publicFile = isHttpUrl(media.fileUrl) ? media.fileUrl! : null;

  let mediaUrl = hlsUrl || playbackUrl || publicFile;
  let thumbnail =
    isHttpUrl(media.thumbnailUrl) ? media.thumbnailUrl! : null;
  let signed = false;

  if (!mediaUrl) {
    mediaUrl =
      (await safePresign(media.fileObjectKey)) ||
      (await safePresign(media.uploadIntent?.stagingKey));
    if (mediaUrl) signed = true;
  }

  if (!thumbnail) {
    thumbnail =
      (await safePresign(media.thumbnailObjectKey)) ||
      (await safePresign(media.uploadIntent?.thumbnailStagingKey));
    if (thumbnail) signed = true;
  }

  return {
    mediaUrl,
    thumbnailUrl: thumbnail,
    playbackUrl,
    hlsUrl,
    signed,
    expiresInSeconds: signed ? PREVIEW_TTL_SECONDS : null,
  };
}

/** Shape a Media lean/doc into a stable admin list/detail card. */
export function shapeAdminMediaCard(
  media: any,
  preview: AdminMediaPreview,
  extras: Record<string, unknown> = {}
) {
  const uploader = media.uploadedBy;
  return {
    id: media._id?.toString?.() || String(media.id || media._id),
    title: media.title,
    description: media.description || null,
    contentType: media.contentType,
    category: media.category || null,
    moderationStatus: media.moderationStatus || "pending",
    publicationState: media.publicationState || null,
    isHidden: Boolean(media.isHidden),
    reportCount: media.reportCount || 0,
    likeCount: media.likeCount || 0,
    viewCount: media.viewCount || 0,
    adminModerationNotes: media.adminModerationNotes || null,
    assignee: (() => {
      const a = media.moderationAssignee;
      if (!a) return null;
      if (typeof a === "object" && a._id) {
        return {
          id: a._id.toString(),
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
        };
      }
      return { id: String(a) };
    })(),
    moderationResult: media.moderationResult
      ? {
          isApproved: Boolean(media.moderationResult.isApproved),
          confidence: media.moderationResult.confidence ?? null,
          reason: media.moderationResult.reason || null,
          flags: media.moderationResult.flags || [],
          requiresReview: Boolean(media.moderationResult.requiresReview),
          moderatedAt: media.moderationResult.moderatedAt || null,
        }
      : null,
    processing: media.processing
      ? {
          status: media.processing.status || null,
          error: media.processing.error || null,
          progress: media.processing.progress ?? null,
          updatedAt: media.processing.updatedAt || null,
        }
      : null,
    preview,
    uploader: uploader
      ? {
          id: uploader._id?.toString?.() || String(uploader),
          firstName: uploader.firstName,
          lastName: uploader.lastName,
          email: uploader.email,
          username: uploader.username,
        }
      : null,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
    ...extras,
  };
}
