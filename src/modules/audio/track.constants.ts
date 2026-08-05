/** Curated library buckets (admin + mobile filters) */
export const TRACK_CATEGORIES = [
  "worship",
  "praise",
  "prayer",
  "background",
  "kids",
  "instrumental",
  "sermon_bed",
  "seasonal",
] as const;

export type TrackCategory = (typeof TRACK_CATEGORIES)[number];

/** Cross-lane genres */
export const TRACK_GENRES = [
  "gospel",
  "contemporary_christian",
  "afro_gospel",
  "hymn",
  "choir",
  "rap_gospel",
  "highlife_gospel",
  "other",
] as const;

export type TrackGenre = (typeof TRACK_GENRES)[number];

export const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

export const ALLOWED_COVER_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const TRACK_AUDIO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB (single PUT)
/** Masters above this use R2 multipart (or pass multipart:true). */
export const TRACK_MULTIPART_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB
export const TRACK_AUDIO_MULTIPART_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
/** Suggested FE part size for multipart PUTs. */
export const TRACK_MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
export const TRACK_COVER_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const TRACK_PRESIGN_EXPIRES_SEC = 900;

export function extFromMime(mime: string, fallback = "bin"): string {
  const m = mime.toLowerCase();
  if (m.includes("mpeg") || m === "audio/mp3") return "mp3";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("wav")) return "wav";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m.includes("jpeg") || m === "image/jpg") return "jpg";
  const fromName = fallback.includes(".")
    ? fallback.split(".").pop()
    : fallback;
  return (fromName || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

export function normalizeCategory(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return v;
}

export function normalizeGenre(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}
