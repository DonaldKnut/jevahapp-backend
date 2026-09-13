import { parseDurationSeconds } from "../../utils/mediaTools";
import { attachPublicAuthor } from "../../modules/clientProfile/publicAuthor";
import {
  isAudioContentType,
  isEbookContentType,
  isVideoContentType,
} from "../../lib/mediaContentTypeQuery";

/**
 * Resolve playable duration (seconds) for feed / detail / status payloads.
 * Prefers top-level `duration`, then processingMetadata.durationSeconds.
 */
export function resolveDurationSeconds(doc: any): number | null {
  const primary = parseDurationSeconds(doc?.duration);
  if (primary != null) return primary;
  return parseDurationSeconds(doc?.processingMetadata?.durationSeconds);
}

function isHttpUrl(value: unknown): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

/** Public CDN URL that is not a staging placeholder. */
export function hasPlayableHttpUrl(doc: any): boolean {
  return [doc?.playbackUrl, doc?.fileUrl, doc?.hlsUrl].some(
    (u) => isHttpUrl(u) && !String(u).startsWith("staging://")
  );
}

/**
 * Normalize processing.status for mobile scrubber gating.
 * Ready videos should expose duration; processing means wait / poll.
 *
 * HQ / already-hosted files often keep a stale processing.status of
 * "pending" or "processing". If a public HTTP URL exists, treat as ready
 * so sermons/ebooks/music are not hidden by the client.
 */
export function resolveProcessingStatus(doc: any): string {
  const s = String(doc?.processing?.status || doc?.processingStatus || "").toLowerCase();
  if (s === "failed" || s === "rejected") return "failed";
  if (s === "ready" || s === "completed") return "ready";

  if (hasPlayableHttpUrl(doc)) {
    return "ready";
  }

  if (
    s === "pending" ||
    s === "uploaded" ||
    s === "queued" ||
    s === "idle"
  ) {
    return "pending";
  }
  if (
    s === "processing" ||
    s === "transcoding" ||
    s === "moderating" ||
    s === "awaiting_review" ||
    s === "publishing"
  ) {
    return "processing";
  }
  if (
    (doc?.moderationStatus === "approved" || doc?.isDefaultContent) &&
    (doc?.playbackUrl || doc?.fileUrl || doc?.hlsUrl)
  ) {
    return "ready";
  }
  return s || "ready";
}

export function resolveModerationStatus(doc: any): string {
  const raw = doc?.moderationStatus;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().toLowerCase();
  }
  // Legacy HQ / default catalog rows were seeded without this key.
  // FE filterVisibleMedia treats a missing key as owner-only (hidden).
  if (doc?.isDefaultContent) return "approved";
  if (hasPlayableHttpUrl(doc) && doc?.isHidden !== true) return "approved";
  return "pending";
}

/** videoUrl is video-only so the app does not try to play PDFs/MP3s as video. */
export function typedPlaybackUrls(doc: any): {
  videoUrl: string | null;
  audioUrl: string | null;
} {
  const playable =
    (isHttpUrl(doc?.playbackUrl) && doc.playbackUrl) ||
    (isHttpUrl(doc?.fileUrl) && doc.fileUrl) ||
    (isHttpUrl(doc?.hlsUrl) && doc.hlsUrl) ||
    null;
  const mime = doc?.fileMimeType || doc?.uploadIntent?.declaredMime || null;
  const url = playable || doc?.fileUrl || null;
  const video = isVideoContentType(doc?.contentType, url, mime);
  const audio = isAudioContentType(doc?.contentType, url, mime);
  const ebook = isEbookContentType(doc?.contentType);
  return {
    videoUrl: video && !ebook ? playable : null,
    audioUrl: audio ? playable : doc?.audioUrl || null,
  };
}

/** Attach duration + processingStatus without dropping existing fields. */
export function enrichMediaPlaybackFields<T extends Record<string, any>>(
  doc: T
): T & {
  duration: number | null;
  processingStatus: string;
  moderationStatus: string;
  videoUrl: string | null;
  audioUrl: string | null;
} {
  const duration = resolveDurationSeconds(doc);
  const processingStatus = resolveProcessingStatus(doc);
  const moderationStatus = resolveModerationStatus(doc);
  const urls = typedPlaybackUrls({ ...doc, duration, processingStatus });
  return attachPublicAuthor({
    ...doc,
    duration,
    processingStatus,
    moderationStatus,
    videoUrl: urls.videoUrl,
    audioUrl: urls.audioUrl ?? doc.audioUrl ?? null,
  });
}
