/**
 * Feed query aliases so client tabs (ebook vs books, sermon vs sermons)
 * hit the same Media documents.
 */
export function mediaContentTypeQuery(
  contentType?: string | null
): Record<string, unknown> | null {
  if (!contentType) return null;
  const t = String(contentType).trim().toLowerCase();
  if (!t || t === "all") return null;
  if (t === "ebook" || t === "ebooks" || t === "e-books" || t === "book" || t === "books") {
    return { contentType: { $in: ["ebook", "books"] } };
  }
  if (t === "sermon" || t === "sermons" || t === "teachings") {
    return { contentType: "sermon" };
  }
  if (t === "music" || t === "audio") {
    return { contentType: { $in: ["music", "audio"] } };
  }
  if (t === "video" || t === "videos") {
    return { contentType: { $in: ["videos", "video"] } };
  }
  return { contentType: t };
}

export function isEbookContentType(contentType?: string | null): boolean {
  const t = String(contentType || "").toLowerCase();
  return t === "ebook" || t === "books";
}

export function isAudioContentType(
  contentType?: string | null,
  url?: string | null,
  mime?: string | null
): boolean {
  const t = String(contentType || "").toLowerCase();
  if (t === "music" || t === "audio" || t === "podcast") return true;
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("audio/")) return true;
  return /\.(mp3|m4a|wav|aac|ogg|flac)(\?|$)/i.test(String(url || ""));
}

export function isVideoContentType(
  contentType?: string | null,
  url?: string | null,
  mime?: string | null
): boolean {
  if (isEbookContentType(contentType)) return false;
  if (isAudioContentType(contentType, url, mime)) return false;
  const t = String(contentType || "").toLowerCase();
  const m = String(mime || "").toLowerCase();
  if (m.startsWith("video/")) return true;
  if (t === "videos" || t === "video" || t === "live" || t === "recording") {
    return true;
  }
  if (t === "sermon") {
    return /\.(mp4|mov|m3u8|webm|mkv)(\?|$)/i.test(String(url || "")) || !url;
  }
  return false;
}
