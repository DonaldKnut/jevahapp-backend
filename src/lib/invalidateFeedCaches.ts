import cacheService from "../service/cache.service";
import {
  FEED_GLOBAL_GENERATION_KEY,
  FEED_GLOBAL_PATTERN,
  feedUserPattern,
} from "./cacheKeys";
import { bumpEngagementMetric, engagementRedisSafe } from "./engagementRedis";
import logger from "../utils/logger";

/**
 * Invalidate Contabo feed list caches.
 *
 * Prefers generation bump (no SCAN) so in-flight loaders writing old keys
 * cannot resurrect stale content. Falls back to SCAN-delete for legacy keys
 * and per-user recommendation caches.
 *
 * Only call for STRUCTURAL feed changes: new upload ready, moderation approval,
 * delete. Likes/comments/views/bookmarks must NOT invalidate feed caches.
 */
export async function invalidateFeedCaches(
  contentId: string,
  userId: string
): Promise<void> {
  try {
    const ops: Promise<unknown>[] = [bumpFeedGeneration()];
    // Clean any pre-generation legacy keys during rollout
    ops.push(cacheService.delPattern(FEED_GLOBAL_PATTERN));
    if (userId) {
      ops.push(cacheService.delPattern(feedUserPattern(userId)));
    }
    await Promise.all(ops);
  } catch (error: any) {
    bumpEngagementMetric("cacheFailures");
    logger.warn("Failed to invalidate feed caches", {
      contentId,
      userId,
      error: error?.message,
    });
  }
}

/** Current shared-feed generation. null when Redis is unavailable (caller must bypass cache). */
export async function getFeedGeneration(): Promise<number | null> {
  return engagementRedisSafe<number | null>(
    "feedGenerationGet",
    async r => {
      const raw = await r.get(FEED_GLOBAL_GENERATION_KEY);
      if (raw === null) return 0;
      const n = Number(raw);
      return Number.isNaN(n) ? 0 : n;
    },
    null
  );
}

async function bumpFeedGeneration(): Promise<number | null> {
  return engagementRedisSafe<number | null>(
    "feedGenerationBump",
    async r => {
      const next = await r.incr(FEED_GLOBAL_GENERATION_KEY);
      return typeof next === "number" ? next : Number(next);
    },
    null
  );
}
