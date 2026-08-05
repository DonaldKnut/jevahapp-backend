/**
 * Feed module — chronological façades + TikTok For You MVP.
 *
 * - /api/media/all-content — unchanged chronological feed (media module)
 * - /api/feed/for-you — ranked MVP (same card shape)
 * - /api/feed/events — impression / watch_time / skip ingest for ranking
 */
export { mediaQueryService as feedQueryService } from "../../service/media/query.service";
export {
  attachFeedUserInteractionFlags,
  setFeedUserLikeFlag,
  setFeedUserBookmarkFlag,
} from "../../service/media/feedUserFlags";
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

import feedRouter from "./routes";

export const mounts: Array<{ path: string; router: any }> = [
  { path: "/api/feed", router: feedRouter },
];

export default { mounts };
