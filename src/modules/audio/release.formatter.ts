import {
  shapeTrackCard,
  type TrackCard,
} from "./track.formatter";
import {
  resolveReleaseCoverUrl,
  toNestedReleaseRef,
} from "./release.cover";
import type { ReleaseStatus, ReleaseType } from "../../models/release.model";

export type ReleaseCard = {
  id: string;
  title: string;
  slug: string;
  type: ReleaseType;
  description: string | null;
  label: string | null;
  upc: string | null;
  status: ReleaseStatus;
  artistId: string;
  artistSlug: string | null;
  /** May be resolved from first track cover for singles without release art */
  coverUrl: string | null;
  artworkUrl: string | null;
  coverResolved?: boolean;
  releaseDate: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  trackCount: number;
  tracks?: TrackCard[];
  createdAt: string | null;
  updatedAt: string | null;
};

function asIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export { resolveReleaseCoverUrl, toNestedReleaseRef } from "./release.cover";

export function shapeReleaseCard(
  doc: any,
  opts: { tracks?: any[]; trackCount?: number } = {}
): ReleaseCard {
  const trackDocs = opts.tracks || [];
  const { coverUrl, resolved } = resolveReleaseCoverUrl(doc, trackDocs);
  const nest = toNestedReleaseRef(doc, coverUrl);
  const tracks = trackDocs.map((t) =>
    shapeTrackCard(t, {
      release: nest,
      inheritCoverUrl: coverUrl,
    })
  );
  return {
    id: doc._id?.toString?.() || doc.id,
    title: doc.title,
    slug: doc.slug,
    type: doc.type || "single",
    description: doc.description || null,
    label: doc.label || null,
    upc: doc.upc || null,
    status: doc.status || "draft",
    artistId: doc.artistId?.toString?.() || String(doc.artistId || ""),
    artistSlug: doc.artistSlug || null,
    coverUrl,
    artworkUrl: coverUrl,
    coverResolved: resolved,
    releaseDate: asIso(doc.releaseDate),
    scheduledAt: asIso(doc.scheduledAt),
    publishedAt: asIso(doc.publishedAt),
    trackCount:
      opts.trackCount != null
        ? opts.trackCount
        : tracks.length || Number(doc.trackCount || 0),
    ...(tracks.length ? { tracks } : {}),
    createdAt: asIso(doc.createdAt),
    updatedAt: asIso(doc.updatedAt),
  };
}
