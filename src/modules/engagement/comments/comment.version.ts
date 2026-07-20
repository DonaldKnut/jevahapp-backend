import { engagementRedisSafe } from "../../../lib/engagementRedis";

/**
 * Per-content comment version counter used for content-aware ETags.
 * Bumped on every comment mutation (create, edit, delete, reaction,
 * hide/unhide) so clients only get 304 when nothing actually changed.
 */

const VERSION_TTL_SECONDS = 7 * 24 * 3600;

function versionKey(contentId: string): string {
  return `comments:ver:${contentId}`;
}

/** Current version, or null when Redis is unavailable (caller skips 304 handling). */
export async function getCommentsVersion(contentId: string): Promise<number | null> {
  return engagementRedisSafe<number | null>(
    "commentsVersionGet",
    async r => {
      const raw = await r.get(versionKey(contentId));
      if (raw === null) return 0;
      const n = Number(raw);
      return Number.isNaN(n) ? 0 : n;
    },
    null
  );
}

/** Fire-and-forget version bump after a committed comment mutation. */
export function bumpCommentsVersion(contentId?: string | null): void {
  if (!contentId) return;
  void engagementRedisSafe(
    "commentsVersionBump",
    async r => {
      const key = versionKey(contentId);
      await r.incr(key);
      await r.expire(key, VERSION_TTL_SECONDS);
      return true;
    },
    false
  );
}
