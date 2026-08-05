import { normalizeUrl } from "../../controllers/copyrightFreeSong/shared";
import { Types } from "mongoose";
import { Release } from "../../models/release.model";
import {
  resolveReleaseCoverUrl,
  toNestedReleaseRef,
  type NestedReleaseRef,
} from "./release.cover";

export type { NestedReleaseRef };

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
  shareCount: number;
  saveCount: number;
  artistId: string | null;
  releaseId: string | null;
  albumId: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  /** Mini release for player “Playing from …” (artist lane) */
  release: NestedReleaseRef | null;
  moderationStatus: string;
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

function releaseIdFromDoc(doc: any): string | null {
  return (
    doc.releaseId?._id?.toString?.() ||
    doc.releaseId?.toString?.() ||
    doc.albumId?._id?.toString?.() ||
    doc.albumId?.toString?.() ||
    null
  );
}

/** Admin + mobile TrackCard with legacy aliases */
export function shapeTrackCard(
  doc: any,
  opts: {
    release?: NestedReleaseRef | null;
    inheritCoverUrl?: string | null;
  } = {}
): TrackCard {
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
  let thumbnailUrl = thumbRaw ? normalizeUrl(thumbRaw) : null;
  if (!thumbnailUrl && opts.inheritCoverUrl) {
    thumbnailUrl = opts.inheritCoverUrl;
  } else if (!thumbnailUrl && opts.release?.coverUrl) {
    thumbnailUrl = opts.release.coverUrl;
  }
  const durationRaw = doc.durationSec ?? doc.duration ?? null;
  const durationSec =
    durationRaw != null && Number.isFinite(Number(durationRaw)) && Number(durationRaw) > 0
      ? Number(durationRaw)
      : null;
  const visibilityDb = (doc.visibility || "published") as
    | "draft"
    | "published"
    | "archived";

  const artistSlug =
    doc.artistSlug ||
    doc.artist?.slug ||
    (typeof doc.artistId === "object" && doc.artistId?.slug) ||
    null;

  const likeCount = doc.likeCount ?? 0;
  const viewCount = Math.max(doc.viewCount ?? 0, likeCount);

  let releaseNest: NestedReleaseRef | null =
    opts.release !== undefined ? opts.release : null;
  if (
    releaseNest == null &&
    doc.release &&
    typeof doc.release === "object" &&
    (doc.release.title || doc.release.slug)
  ) {
    const { coverUrl } = resolveReleaseCoverUrl(doc.release, [doc]);
    releaseNest = toNestedReleaseRef(doc.release, coverUrl);
  }

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
    durationSec,
    duration: durationSec,
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
    likeCount,
    viewCount,
    shareCount: Math.max(0, doc.shareCount ?? 0),
    saveCount: Math.max(0, doc.saveCount ?? 0),
    artistId: doc.artistId?._id?.toString?.() || doc.artistId?.toString?.() || doc.artistId || null,
    releaseId: releaseIdFromDoc(doc),
    albumId:
      doc.albumId?._id?.toString?.() ||
      doc.albumId?.toString?.() ||
      doc.releaseId?._id?.toString?.() ||
      doc.releaseId?.toString?.() ||
      null,
    trackNumber:
      doc.trackNumber != null && Number.isFinite(Number(doc.trackNumber))
        ? Number(doc.trackNumber)
        : null,
    discNumber:
      doc.discNumber != null && Number.isFinite(Number(doc.discNumber))
        ? Number(doc.discNumber)
        : releaseIdFromDoc(doc)
          ? 1
          : null,
    release: doc.lane === "artist" || releaseNest ? releaseNest : null,
    moderationStatus: doc.moderationStatus || "approved",
    createdAt: asIso(doc.createdAt) || new Date(0).toISOString(),
    updatedAt: asIso(doc.updatedAt) || new Date(0).toISOString(),
    publishedAt: asIso(doc.publishedAt),
  };
}

/**
 * Batch-attach nested `release` for artist-lane track docs (list/detail/finalize).
 */
export async function shapeTrackCardsWithRelease(
  docs: any[]
): Promise<TrackCard[]> {
  const ids = [
    ...new Set(
      docs
        .map((d) => releaseIdFromDoc(d))
        .filter(
          (id): id is string =>
            typeof id === "string" &&
            id.length > 0 &&
            Types.ObjectId.isValid(id)
        )
    ),
  ];
  if (!ids.length) {
    return docs.map((d) => shapeTrackCard(d, { release: null }));
  }

  const releases = await Release.find({
    _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
  }).lean();

  const byId = new Map(releases.map((r: any) => [String(r._id), r]));

  // For singles missing artwork, use any track cover from this batch
  const fallbackCover = new Map<string, string>();
  for (const d of docs) {
    const rid = releaseIdFromDoc(d);
    if (!rid || fallbackCover.has(rid)) continue;
    const rel = byId.get(rid);
    if (!rel || (rel as any).artwork?.url) continue;
    if ((rel as any).type !== "single") continue;
    const raw = d.thumbnailUrl || d.artwork?.url || d.coverUrl;
    if (!raw) continue;
    const normalized = normalizeUrl(raw);
    if (normalized) fallbackCover.set(rid, normalized);
  }

  return docs.map((d) => {
    const rid = releaseIdFromDoc(d);
    const rel = rid ? byId.get(rid) : null;
    if (!rel) return shapeTrackCard(d, { release: null });
    const { coverUrl } = resolveReleaseCoverUrl(rel, [d]);
    const nest = toNestedReleaseRef(
      rel,
      coverUrl || fallbackCover.get(rid!) || null
    );
    return shapeTrackCard(d, {
      release: nest,
      inheritCoverUrl: nest.coverUrl,
    });
  });
}

export async function shapeTrackCardWithRelease(doc: any): Promise<TrackCard> {
  const [card] = await shapeTrackCardsWithRelease([doc]);
  return card;
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
    shareCount: card.shareCount,
    shares: card.shareCount,
    saveCount: card.saveCount,
    playCount: card.playCount,
    processingStatus: card.processingStatus,
    ...extras,
  };
}

/**
 * Hard filter: Copyright-free shelf — curated only, never artist-lane.
 * Legacy rows without `lane` count as curated.
 * Never returns lane=artist creator uploads.
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
      // Artist under_review rows must never leak even if lane mis-set
      {
        $or: [
          { moderationStatus: { $exists: false } },
          { moderationStatus: "approved" },
          { lane: { $ne: "artist" } },
        ],
      },
    ],
    ...extra,
  };
}

/**
 * Hard filter: Artists shelf — lane=artist only, never curated beds.
 * Requires moderation approved (or legacy missing status treated carefully:
 * only approved appears for new pipeline; missing allowed for pre-gate rows).
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
      {
        $or: [
          { moderationStatus: "approved" },
          // Pre-review-field artist rows (back-compat)
          { moderationStatus: { $exists: false } },
        ],
      },
      // Explicitly exclude curated mis-tags
      { lane: { $eq: "artist" } },
    ],
    ...extra,
  };
}

/** Shape upload-intent for mobile FE aliases */
export function shapeUploadIntentResponse(raw: {
  trackId: string;
  releaseId?: string | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  mode?: "single" | "multipart";
  audio: {
    putUrl: string | null;
    key: string;
    headers: Record<string, string>;
    expiresInSeconds: number;
    mode?: "single" | "multipart";
    multipartUploadId?: string | null;
    partSizeHint?: number | null;
  };
  cover: {
    putUrl: string | null;
    key: string;
    headers: Record<string, string>;
    expiresInSeconds: number;
  } | null;
}) {
  const mode = raw.mode || raw.audio.mode || "single";
  const base: Record<string, unknown> = {
    trackId: raw.trackId,
    id: raw.trackId,
    _id: raw.trackId,
    releaseId: raw.releaseId || null,
    albumId: raw.releaseId || null,
    trackNumber: raw.trackNumber ?? null,
    discNumber: raw.discNumber ?? null,
    mode,
    uploadUrl: raw.audio.putUrl,
    audioUploadUrl: raw.audio.putUrl,
    putUrl: raw.audio.putUrl,
    uploadHeaders: raw.audio.headers,
    requiredHeaders: raw.audio.headers,
    expiresInSec: raw.audio.expiresInSeconds,
    expiresInSeconds: raw.audio.expiresInSeconds,
    multipartUploadId: raw.audio.multipartUploadId || null,
    partSizeHint: raw.audio.partSizeHint ?? null,
    audio: raw.audio,
    cover: raw.cover,
  };
  if (raw.cover?.putUrl) {
    base.coverUploadUrl = raw.cover.putUrl;
    base.coverUploadHeaders = raw.cover.headers;
  }
  return base;
}
