import { normalizeUrl } from "../../controllers/copyrightFreeSong/shared";

/** FE-facing visibility (maps DB published → public) */
export type TrackVisibilityFe = "draft" | "public" | "archived";

export type TrackCard = {
  id: string;
  title: string;
  artistName: string;
  artist: string;
  singer: string;
  artistSlug: string | null;
  category: string | null;
  genre: string | null;
  language: string | null;
  durationSec: number | null;
  duration: number | null;
  lane: "curated" | "artist";
  /** FE contract: public | draft | archived (DB uses published) */
  visibility: TrackVisibilityFe;
  /** Raw DB value for admin/studio */
  visibilityDb: "draft" | "published" | "archived";
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

export function toFeVisibility(
  v: string | undefined | null
): TrackVisibilityFe {
  if (v === "draft") return "draft";
  if (v === "archived") return "archived";
  return "public"; // published or missing legacy
}

export function fromFeVisibility(
  v: string | undefined | null
): "draft" | "published" | "archived" | null {
  if (!v) return null;
  if (v === "public" || v === "published") return "published";
  if (v === "draft") return "draft";
  if (v === "archived") return "archived";
  return null;
}

/** Admin + mobile TrackCard with legacy aliases */
export function shapeTrackCard(doc: any): TrackCard {
  const artistName = String(doc.artistName || doc.singer || "").trim();
  const playbackRaw =
    doc.audio?.playbackUrl || doc.fileUrl || doc.audioUrl || null;
  const processingStatus =
    (doc.processing?.status as TrackCard["processingStatus"]) ||
    (playbackRaw && !String(playbackRaw).startsWith("pending://")
      ? "ready"
      : "pending");

  const ready =
    processingStatus === "ready" &&
    playbackRaw &&
    !String(playbackRaw).startsWith("pending://");

  const playbackUrl = ready ? normalizeUrl(playbackRaw) : null;
  const thumbRaw =
    doc.thumbnailUrl || doc.artwork?.url || doc.coverUrl || null;
  const thumbnailUrl = thumbRaw ? normalizeUrl(thumbRaw) : null;
  const durationSec = doc.durationSec ?? doc.duration ?? null;
  const visibilityDb = (doc.visibility || "published") as
    | "draft"
    | "published"
    | "archived";

  const artistSlug =
    doc.artistSlug ||
    doc.artist?.slug ||
    (typeof doc.artistId === "object" && doc.artistId?.slug) ||
    null;

  return {
    id: doc._id?.toString?.() || doc.id,
    title: doc.title || "",
    artistName,
    artist: artistName,
    singer: artistName,
    artistSlug: artistSlug ? String(artistSlug) : null,
    category: doc.category ?? null,
    genre: doc.genre ?? null,
    language: doc.language ?? null,
    durationSec: durationSec != null ? Number(durationSec) : null,
    duration: durationSec != null ? Number(durationSec) : null,
    lane: doc.lane === "artist" ? "artist" : "curated",
    visibility: toFeVisibility(visibilityDb),
    visibilityDb,
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
    artistId: doc.artistId?._id?.toString?.() || doc.artistId?.toString?.() || doc.artistId || null,
    createdAt: asIso(doc.createdAt) || new Date(0).toISOString(),
    updatedAt: asIso(doc.updatedAt) || new Date(0).toISOString(),
    publishedAt: asIso(doc.publishedAt),
  };
}

/** Enrich public list items (mobile CF) */
export function shapePublicSong(doc: any, extras: Record<string, unknown> = {}) {
  const card = shapeTrackCard(doc);
  return {
    ...doc,
    id: card.id,
    title: card.title,
    singer: card.singer,
    artistName: card.artistName,
    artist: card.artistName,
    artistSlug: card.artistSlug,
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
    processingStatus: card.processingStatus,
    ...extras,
  };
}

/**
 * Hard filter: Copyright-free shelf — curated only, never artist-lane.
 * Legacy rows without `lane` count as curated.
 */
export function publicCuratedReadyFilter(extra: Record<string, unknown> = {}) {
  return {
    $and: [
      {
        $or: [{ lane: "curated" }, { lane: { $exists: false } }],
      },
      { lane: { $ne: "artist" } },
      {
        $or: [
          { visibility: "published" },
          { visibility: { $exists: false } },
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

/**
 * Hard filter: Artists shelf — lane=artist only, never curated beds.
 */
export function publicArtistReadyFilter(extra: Record<string, unknown> = {}) {
  return {
    lane: "artist",
    visibility: "published",
    $and: [
      {
        $or: [
          { "processing.status": "ready" },
          { processing: { $exists: false } },
        ],
      },
      { fileUrl: { $not: /^pending:\/\// } },
    ],
    ...extra,
  };
}

/** Shape upload-intent for mobile FE aliases */
export function shapeUploadIntentResponse(raw: {
  trackId: string;
  audio: {
    putUrl: string;
    key: string;
    headers: Record<string, string>;
    expiresInSeconds: number;
  };
  cover: {
    putUrl: string | null;
    key: string;
    headers: Record<string, string>;
    expiresInSeconds: number;
  } | null;
}) {
  const base: Record<string, unknown> = {
    trackId: raw.trackId,
    id: raw.trackId,
    _id: raw.trackId,
    uploadUrl: raw.audio.putUrl,
    audioUploadUrl: raw.audio.putUrl,
    putUrl: raw.audio.putUrl,
    uploadHeaders: raw.audio.headers,
    requiredHeaders: raw.audio.headers,
    expiresInSec: raw.audio.expiresInSeconds,
    expiresInSeconds: raw.audio.expiresInSeconds,
    audio: raw.audio,
    cover: raw.cover,
  };
  if (raw.cover?.putUrl) {
    base.coverUploadUrl = raw.cover.putUrl;
    base.coverUploadHeaders = raw.cover.headers;
  }
  return base;
}
