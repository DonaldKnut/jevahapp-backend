import { normalizeUrl } from "../../controllers/copyrightFreeSong/shared";
import { PUBLIC_MEDIA_FILTER } from "../../lib/publicMediaVisibility";

export type SermonCard = {
  id: string;
  title: string;
  speaker: string | null;
  church: string | null;
  description: string | null;
  scripture: string | null;
  series: string | null;
  /** Seconds — alias of durationSec for feed scrub / seek parity */
  duration: number | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  playbackUrl: string | null;
  hlsUrl: string | null;
  mediaType: "audio" | "video";
  category: string | null;
  language: string | null;
  topics: string[];
  publishedAt: string | null;
  playCount: number;
  likeCount: number;
  processingStatus: string;
  contentType: "sermon";
};

function asIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapProcessingStatus(doc: any): string {
  const s = String(doc?.processing?.status || "").toLowerCase();
  if (s === "ready" || s === "completed") return "ready";
  if (s === "failed" || s === "rejected") return "failed";
  if (s === "pending" || s === "uploaded" || s === "queued") return "pending";
  if (
    s === "processing" ||
    s === "transcoding" ||
    s === "moderating" ||
    s === "publishing"
  ) {
    return "processing";
  }
  // Live approved media without processing blob → treat as ready
  if (doc?.moderationStatus === "approved" && (doc?.playbackUrl || doc?.fileUrl || doc?.hlsUrl)) {
    return "ready";
  }
  return s || "ready";
}

function inferMediaType(doc: any): "audio" | "video" {
  if (doc.mediaType === "audio" || doc.mediaType === "video") return doc.mediaType;
  const mime = String(doc.fileMimeType || doc.uploadIntent?.declaredMime || "").toLowerCase();
  if (mime.startsWith("audio/")) return "audio";
  return "video";
}

/** Shape Media sermon → public SermonCard for web /sermons */
export function shapeSermonCard(doc: any): SermonCard {
  const playbackRaw =
    doc.playbackUrl || doc.hlsUrl || doc.fileUrl || null;
  const thumbRaw =
    doc.thumbnailUrl || doc.coverImageUrl || null;
  const durationSec =
    doc.duration != null
      ? Number(doc.duration)
      : doc.processingMetadata?.durationSeconds != null
        ? Number(doc.processingMetadata.durationSeconds)
        : doc.durationSec != null
          ? Number(doc.durationSec)
          : null;
  const resolvedDuration =
    Number.isFinite(durationSec as number) && (durationSec as number) > 0
      ? (durationSec as number)
      : null;

  return {
    id: doc._id?.toString?.() || doc.id,
    title: doc.title || "",
    speaker: doc.speaker || null,
    church: doc.church || null,
    description: doc.description || null,
    scripture: doc.scripture || null,
    series: doc.series || null,
    duration: resolvedDuration,
    durationSec: resolvedDuration,
    thumbnailUrl: thumbRaw ? normalizeUrl(thumbRaw) : null,
    playbackUrl: playbackRaw ? normalizeUrl(playbackRaw) : null,
    hlsUrl: doc.hlsUrl ? normalizeUrl(doc.hlsUrl) : null,
    mediaType: inferMediaType(doc),
    category: doc.category || "sermons",
    language: doc.language || "en",
    topics: Array.isArray(doc.topics) ? doc.topics : [],
    publishedAt: asIso(doc.publishedAt || doc.createdAt),
    playCount: doc.viewCount ?? doc.totalViews ?? 0,
    likeCount: doc.likeCount ?? doc.totalLikes ?? 0,
    processingStatus: mapProcessingStatus(doc),
    contentType: "sermon",
  };
}

/** Public sermons: Media contentType=sermon, approved, not hidden, playable */
export function publicSermonFilter(extra: Record<string, unknown> = {}) {
  return {
    contentType: "sermon",
    ...PUBLIC_MEDIA_FILTER,
    $and: [
      {
        $or: [
          { "processing.status": { $in: ["ready", "completed"] } },
          { processing: { $exists: false } },
          { "processing.status": { $exists: false } },
          // legacy approved live without processing field
          {
            moderationStatus: "approved",
            $or: [
              { playbackUrl: { $exists: true, $nin: [null, ""] } },
              { fileUrl: { $exists: true, $nin: [null, ""] } },
              { hlsUrl: { $exists: true, $nin: [null, ""] } },
            ],
          },
        ],
      },
      {
        fileUrl: { $not: /^staging:\/\// },
      },
    ],
    ...extra,
  };
}
