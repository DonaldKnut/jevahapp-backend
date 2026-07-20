/**
 * Feed module — thin façade over media query + user-flag overlay.
 * Existing media routes continue to own HTTP; import from here for feed use-cases.
 */
export { mediaQueryService as feedQueryService } from "../../service/media/query.service";
export { attachFeedUserInteractionFlags, setFeedUserLikeFlag, setFeedUserBookmarkFlag } from "../../service/media/feedUserFlags";
export { attachFreshEngagementCounts } from "../../service/media/feedCountOverlay";
export { invalidateFeedCaches, getFeedGeneration } from "../../lib/invalidateFeedCaches";
export {
  CACHE_TTL,
  feedUserKey,
  feedGlobalKey,
  feedCacheHash,
  FEED_GLOBAL_PATTERN,
  feedUserPattern,
  FEED_GLOBAL_GENERATION_KEY,
} from "../../lib/cacheKeys";

/**
 * No dedicated mount yet — media module keeps /api/media/* URLs stable.
 * For You (`GET /api/feed/for-you`) is deferred — see docs/FOR_YOU_DEFERRED.md.
 */
export const mounts: Array<{ path: string; router: any }> = [];
