/**
 * Low-end / "Jevah Lite" client profile helpers (2GB Android, slow networks).
 * Contabo-safe: pure response shaping — no extra services or RAM.
 */
import type { Request } from "express";

export type ClientProfile = "full" | "lite";

export function resolveClientProfile(req: Request): ClientProfile {
  const q = String(req.query.profile || req.query.client || "").toLowerCase();
  const h = String(
    req.headers["x-jevah-client"] || req.headers["x-client-profile"] || ""
  ).toLowerCase();
  if (q === "lite" || h === "lite" || h === "jevah-lite") return "lite";
  return "full";
}

/** Default page size for lite feeds (FE may still override within caps). */
export function liteDefaultLimit(requested?: number, max = 12): number {
  const n = requested != null ? Number(requested) : 8;
  if (!Number.isFinite(n)) return 8;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

/**
 * Strip heavy / unused fields from feed cards for low-RAM clients.
 * Keeps engagement paint + playback URLs. Prefer HLS; hint 360p ladder.
 */
export function compactFeedItem(item: any): any {
  if (!item || typeof item !== "object") return item;
  const id = item._id?.toString?.() || item.id;
  const hlsUrl = item.hlsUrl || null;
  const playbackUrl = item.playbackUrl || item.fileUrl || item.videoUrl || null;
  const audioUrl = item.audioUrl || item.fileUrl || playbackUrl || null;

  return {
    id,
    _id: id,
    contentType: item.contentType,
    engagementContentType: item.engagementContentType || "media",
    title: item.title,
    description: item.description
      ? String(item.description).slice(0, 280)
      : null,
    thumbnailUrl: item.thumbnailUrl || item.coverUrl || null,
    // Playback: prefer adaptive HLS (player picks 360p on weak devices)
    hlsUrl,
    playbackUrl,
    fileUrl: playbackUrl,
    videoUrl: playbackUrl,
    audioUrl,
    duration: item.duration ?? item.durationSec ?? null,
    durationSec: item.durationSec ?? item.duration ?? null,
    processingStatus: item.processingStatus || null,
    likeCount: Number(item.likeCount || 0),
    commentCount: Number(item.commentCount || 0),
    viewCount: Number(item.viewCount || 0),
    shareCount: Number(item.shareCount || 0),
    bookmarkCount: Number(
      item.bookmarkCount ?? item.saves ?? item.totalSaves ?? 0
    ),
    hasLiked: Boolean(item.hasLiked ?? item.userInteractions?.liked),
    hasBookmarked: Boolean(
      item.hasBookmarked ?? item.isBookmarked ?? item.userInteractions?.saved
    ),
    artistName: item.artistName || item.singer || null,
    // Lite playback hints for Expo AV / exoplayer
    lite: {
      preferHls: Boolean(hlsUrl),
      maxVideoHeight: 360,
      prefetchCount: 1,
      imageMaxEdge: 480,
    },
  };
}

export function compactFeedItems(items: any[]): any[] {
  return (items || []).map(compactFeedItem);
}

export function compactTrackCard(item: any): any {
  if (!item || typeof item !== "object") return item;
  const id = item.id || item._id?.toString?.();
  return {
    id,
    title: item.title,
    artistName: item.artistName || item.singer || null,
    audioUrl: item.audioUrl || item.fileUrl || item.playbackUrl || null,
    fileUrl: item.fileUrl || item.audioUrl || item.playbackUrl || null,
    thumbnailUrl: item.thumbnailUrl || null,
    duration: item.duration ?? item.durationSec ?? null,
    durationSec: item.durationSec ?? item.duration ?? null,
    likeCount: Number(item.likeCount || 0),
    viewCount: Number(item.viewCount || 0),
    playCount: Number(item.playCount || 0),
    saveCount: Number(item.saveCount || 0),
    isLiked: Boolean(item.isLiked),
    isSaved: Boolean(item.isSaved ?? item.isInLibrary),
    processingStatus: item.processingStatus || "ready",
    lite: {
      prefetchCount: 1,
      imageMaxEdge: 320,
    },
  };
}

export function compactTrackCards(items: any[]): any[] {
  return (items || []).map(compactTrackCard);
}
