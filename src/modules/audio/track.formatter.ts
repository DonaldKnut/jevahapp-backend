import { normalizeUrl } from "../../controllers/copyrightFreeSong/shared";

export type TrackCard = {
  id: string;
  title: string;
  artistName: string;
  singer: string;
  category: string | null;
  genre: string | null;
  language: string | null;
  durationSec: number | null;
  duration: number | null;
  lane: "curated" | "artist";
  visibility: "draft" | "published" | "archived";
  copyrightStatus: string;
  licenseNote: string | null;
  playbackUrl: string | null;
  fileUrl: string | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  coverUrl: string | null;
  processingStatus: "pending" | "processing" | "ready" | "failed";
  playCount: number;
  likeCount: number;
  viewCount: number;
  artistId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

function asIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Admin + mobile TrackCard with legacy aliases */
export function shapeTrackCard(doc: any): TrackCard {
  const artistName = String(doc.artistName || doc.singer || "").trim();
  const playbackRaw =
    doc.audio?.playbackUrl || doc.fileUrl || doc.audioUrl || null;
  const playbackUrl = playbackRaw ? normalizeUrl(playbackRaw) : null;
  const thumbRaw =
    doc.thumbnailUrl || doc.artwork?.url || doc.coverUrl || null;
  const thumbnailUrl = thumbRaw ? normalizeUrl(thumbRaw) : null;
  const durationSec =
    doc.durationSec ?? doc.duration ?? null;
  const processingStatus =
    doc.processing?.status ||
    (playbackUrl && !String(playbackRaw).startsWith("pending://")
      ? "ready"
      : "pending");

  return {
    id: doc._id?.toString?.() || doc.id,
    title: doc.title || "",
    artistName,
    singer: artistName,
    category: doc.category ?? null,
    genre: doc.genre ?? null,
    language: doc.language ?? null,
    durationSec: durationSec != null ? Number(durationSec) : null,
    duration: durationSec != null ? Number(durationSec) : null,
    lane: doc.lane || "curated",
    visibility: doc.visibility || "published",
    copyrightStatus: doc.copyrightStatus || "copyright_free",
    licenseNote: doc.licenseNote ?? null,
    playbackUrl,
    fileUrl: playbackUrl,
    audioUrl: playbackUrl,
    thumbnailUrl,
    coverUrl: thumbnailUrl,
    processingStatus,
    playCount: doc.playCount ?? 0,
    likeCount: doc.likeCount ?? 0,
    viewCount: doc.viewCount ?? 0,
    artistId: doc.artistId?.toString?.() || doc.artistId || null,
    createdAt: asIso(doc.createdAt) || new Date(0).toISOString(),
    updatedAt: asIso(doc.updatedAt) || new Date(0).toISOString(),
    publishedAt: asIso(doc.publishedAt),
  };
}

/** Enrich public list items (mobile) */
export function shapePublicSong(doc: any, extras: Record<string, unknown> = {}) {
  const card = shapeTrackCard(doc);
  return {
    ...doc,
    id: card.id,
    title: card.title,
    singer: card.singer,
    artistName: card.artistName,
    artist: card.artistName,
    fileUrl: card.fileUrl,
    playbackUrl: card.playbackUrl,
    audioUrl: card.audioUrl,
    thumbnailUrl: card.thumbnailUrl,
    coverUrl: card.coverUrl,
    duration: card.duration,
    durationSec: card.durationSec,
    category: card.category,
    genre: card.genre,
    lane: card.lane,
    visibility: card.visibility,
    likeCount: card.likeCount,
    viewCount: card.viewCount,
    views: card.viewCount,
    likes: card.likeCount,
    playCount: card.playCount,
    ...extras,
  };
}

/** Query for mobile/public curated library */
export function publicCuratedReadyFilter(extra: Record<string, unknown> = {}) {
  return {
    $and: [
      {
        $or: [{ lane: "curated" }, { lane: { $exists: false } }],
      },
      {
        $or: [
          { visibility: "published" },
          { visibility: { $exists: false } }, // legacy rows
        ],
      },
      {
        $or: [
          { "processing.status": "ready" },
          { processing: { $exists: false } },
          { "processing.status": { $exists: false } },
        ],
      },
      {
        fileUrl: { $not: /^pending:\/\// },
      },
    ],
    ...extra,
  };
}
