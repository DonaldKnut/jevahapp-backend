/**
 * Canonical Redis key helpers and TTLs for Contabo (REDIS_URL) CacheService.
 * Mongo remains authoritative for durable social writes.
 */
import { createHash } from "crypto";

export const CACHE_TTL = {
  /** Shared feed list payloads (counts overlaid fresh at read time) */
  feed: 600,
  /** Soft-stale window after feed freshness expires (SWR) */
  feedStale: 300,
  /** Per-user personalized recommendation rails */
  recommendations: 300,
  /** JWT user auth snapshot (ban/role/verification) */
  authUser: 120,
  /** Public profile / user cards */
  profile: 300,
  /** Single media metadata */
  mediaMeta: 60,
  /** Search result pages */
  search: 45,
  /** Default generic JSON cache */
  default: 3600,
  /** Engagement counters (likes/views/comments/shares) */
  counters: 7 * 24 * 3600,
  /** Per-user liked/saved flag cache */
  userFlags: 24 * 3600,
} as const;

export const FEED_CACHE_SCHEMA = "v2";

export const FEED_GLOBAL_GENERATION_KEY = "feed:global:generation";

/** Canonically serialize query parts so key order never affects the digest. */
export function canonicalizeCacheParts(parts: Record<string, unknown>): string {
  const keys = Object.keys(parts).sort();
  const normalized: Record<string, unknown> = {};
  for (const k of keys) {
    const v = parts[k];
    if (v === undefined || v === null || v === "") continue;
    normalized[k] = v;
  }
  return JSON.stringify(normalized);
}

/** Collision-safe digest (full SHA-256, base64url). */
export function feedCacheHash(parts: Record<string, unknown>): string {
  return createHash("sha256")
    .update(canonicalizeCacheParts(parts))
    .digest("base64url");
}

export function feedUserKey(userId: string, hash: string): string {
  return `feed:recommendations:${FEED_CACHE_SCHEMA}:${userId}:${hash}`;
}

/** Shared list key — generation-scoped so invalidation cannot resurrect stale loaders. */
export function feedGlobalKey(hash: string, generation = 0): string {
  return `feed:global:${FEED_CACHE_SCHEMA}:${generation}:${hash}`;
}

export function feedUserPattern(userId: string): string {
  return `feed:recommendations:${FEED_CACHE_SCHEMA}:${userId}:*`;
}

/** Legacy pattern kept for cleanup of pre-v2 keys during rollout. */
export const FEED_GLOBAL_PATTERN = "feed:global:*";

export function authUserKey(userId: string): string {
  return `auth:user:${userId}`;
}

/** Tri-state per-user feed flags (liked + bookmarked bits). */
export function feedUserFlagsKey(userId: string, mediaId: string): string {
  return `feed-user-flags:v1:${userId}:${mediaId}`;
}

export function cacheLockKey(cacheKey: string): string {
  return `cache-lock:${cacheKey}`;
}
