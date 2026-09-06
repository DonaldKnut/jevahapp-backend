/**
 * Usable HTTP thumbnail when upload omits one and FFmpeg poster extraction fails.
 * Prefer CDN/static asset via env in production.
 */
export function getDefaultMediaThumbnailUrl(): string {
  const fromEnv =
    process.env.DEFAULT_MEDIA_THUMBNAIL_URL ||
    process.env.MEDIA_PLACEHOLDER_THUMBNAIL_URL ||
    "";
  if (fromEnv.trim()) return fromEnv.trim();

  const frontend = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  if (frontend) return `${frontend}/assets/default-media-thumb.jpg`;

  // Last-resort public placeholder (HTTPS, always fetchable)
  return "https://placehold.co/640x360/0f172a/e2e8f0?text=Jevah";
}

export function isPendingOrStagingThumbnail(url?: string | null): boolean {
  const u = String(url || "");
  return (
    !u ||
    u.startsWith("pending://") ||
    u.startsWith("staging://") ||
    u === "pending://auto-thumbnail" ||
    u === "staging://pending-thumbnail"
  );
}
