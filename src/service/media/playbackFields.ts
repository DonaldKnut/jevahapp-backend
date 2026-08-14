import { parseDurationSeconds } from "../../utils/mediaTools";
import { attachPublicAuthor } from "../../modules/clientProfile/publicAuthor";

/**
 * Resolve playable duration (seconds) for feed / detail / status payloads.
 * Prefers top-level `duration`, then processingMetadata.durationSeconds.
 */
export function resolveDurationSeconds(doc: any): number | null {
  const primary = parseDurationSeconds(doc?.duration);
  if (primary != null) return primary;
  return parseDurationSeconds(doc?.processingMetadata?.durationSeconds);
}

/**
 * Normalize processing.status for mobile scrubber gating.
 * Ready videos should expose duration; processing means wait / poll.
 */
export function resolveProcessingStatus(doc: any): string {
  const s = String(doc?.processing?.status || "").toLowerCase();
  if (s === "ready" || s === "completed") return "ready";
  if (s === "failed" || s === "rejected") return "failed";
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
  // Live approved media without a processing blob → treat as ready
  if (
    doc?.moderationStatus === "approved" &&
    (doc?.playbackUrl || doc?.fileUrl || doc?.hlsUrl)
  ) {
    return "ready";
  }
  return s || "ready";
}

/** Attach duration + processingStatus without dropping existing fields. */
export function enrichMediaPlaybackFields<T extends Record<string, any>>(
  doc: T
): T & { duration: number | null; processingStatus: string } {
  const duration = resolveDurationSeconds(doc);
  const processingStatus = resolveProcessingStatus(doc);
  return attachPublicAuthor({
    ...doc,
    duration,
    processingStatus,
  });
}
