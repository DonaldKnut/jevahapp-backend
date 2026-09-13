import { normalizeUrl } from "../../controllers/copyrightFreeSong/shared";
import { publicCatalogFilter } from "../../lib/publicMediaVisibility";
import { resolveProcessingStatus } from "../../service/media/playbackFields";

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
  moderationStatus: string;
  contentType: "sermon";
};

function asIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function inferMediaType(doc: any): "audio" | "video" {
  if (doc.mediaType === "audio" || doc.mediaType === "video") return doc.mediaType;
  const mime = String(doc.fileMimeType || doc.uploadIntent?.declaredMime || "").toLowerCase();
  if (mime.startsWith("audio/")) return "audio";
  const url = String(doc.fileUrl || doc.playbackUrl || "");
  if (/\.(mp3|m4a|wav|aac|ogg)(\?|$)/i.test(url)) return "audio";
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
  const rawMod = doc.moderationStatus;
  const moderationStatus =
    typeof rawMod === "string" && rawMod.trim()
      ? rawMod.trim().toLowerCase()
      : "approved";

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
    processingStatus: resolveProcessingStatus(doc),
    moderationStatus,
    contentType: "sermon",
  };
}

/** Public sermons: Media contentType=sermon, catalog-visible, playable */
export function publicSermonFilter(extra: Record<string, unknown> = {}) {
  const extraAnd = Array.isArray(extra.$and)
    ? extra.$and
    : extra.$and
      ? [extra.$and]
      : [];
  const rest = { ...extra };
  delete rest.$and;
  return publicCatalogFilter({
    contentType: "sermon",
    $and: [
      {
        $or: [
          { "processing.status": { $in: ["ready", "completed"] } },
          { processing: { $exists: false } },
          { "processing.status": { $exists: false } },
          { playbackUrl: { $exists: true, $nin: [null, ""] } },
          { fileUrl: { $exists: true, $nin: [null, ""] } },
          { hlsUrl: { $exists: true, $nin: [null, ""] } },
        ],
      },
      {
        fileUrl: { $not: /^staging:\/\// },
      },
      ...extraAnd,
    ],
    ...rest,
  });
}
