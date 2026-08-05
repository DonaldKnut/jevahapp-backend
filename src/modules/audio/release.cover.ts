import { normalizeUrl } from "../../controllers/copyrightFreeSong/shared";

export type NestedReleaseRef = {
  id: string;
  title: string;
  coverUrl: string | null;
  type: string;
  slug: string;
};

function trackCoverRaw(t: any): string | null {
  return t?.thumbnailUrl || t?.artwork?.url || t?.coverUrl || null;
}

/** Release cover, or first track cover for singles when release art is missing. */
export function resolveReleaseCoverUrl(
  doc: any,
  tracks: any[] = []
): { coverUrl: string | null; resolved: boolean } {
  const own = doc?.artwork?.url || null;
  if (own) {
    return { coverUrl: normalizeUrl(own), resolved: false };
  }
  if ((doc?.type || "single") === "single" && tracks.length) {
    const sorted = [...tracks].sort((a: any, b: any) => {
      const d = (a.discNumber || 1) - (b.discNumber || 1);
      if (d !== 0) return d;
      return (a.trackNumber || 0) - (b.trackNumber || 0);
    });
    for (const t of sorted) {
      const raw = trackCoverRaw(t);
      if (raw) {
        return { coverUrl: normalizeUrl(raw), resolved: true };
      }
    }
  }
  return { coverUrl: null, resolved: false };
}

export function toNestedReleaseRef(
  doc: any,
  coverUrl: string | null
): NestedReleaseRef {
  return {
    id: doc._id?.toString?.() || doc.id,
    title: doc.title || "",
    coverUrl,
    type: doc.type || "single",
    slug: doc.slug || "",
  };
}
