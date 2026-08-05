import { mediaQueryService } from "../../service/media/query.service";
import { attachFreshEngagementCounts } from "../../service/media/feedCountOverlay";
import { attachFeedUserInteractionFlags } from "../../service/media/feedUserFlags";
import { getRecentFeedContentIds } from "./feedEvents.service";
import logger from "../../utils/logger";

export type ForYouOptions = {
  userId: string;
  limit?: number;
  cursor?: string | null;
};

export type ForYouResult = {
  items: any[];
  cursor: string | null;
  hasMore: boolean;
};

function scoreCard(item: any, impressed: Set<string>): number {
  const id = (item._id || item.id)?.toString?.() || "";
  const likes = Number(item.likeCount || 0);
  const views = Number(item.viewCount || 0);
  const comments = Number(item.commentCount || 0);
  const saves = Number(item.bookmarkCount || item.saves || 0);
  const shares = Number(item.shareCount || 0);
  const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
  const ageHours = Math.max(0, (Date.now() - created) / (1000 * 60 * 60));
  const recency = Math.exp(-ageHours / 72); // ~3-day half-life feel

  const engagement =
    0.35 * Math.log1p(likes) +
    0.25 * Math.log1p(views) +
    0.2 * Math.log1p(comments) +
    0.15 * Math.log1p(saves) +
    0.05 * Math.log1p(shares);

  let score = 0.55 * engagement + 0.35 * recency + 0.1 * Math.random();
  if (impressed.has(id)) score *= 0.15; // hard demote if still in pool
  return score;
}

/**
 * MVP For You: same Media cards as all-content, re-ranked with fatigue + light scoring.
 * Client may keep rankFeedForYou until this is preferred; shape is identical to feed items.
 */
export async function getForYouFeed(options: ForYouOptions): Promise<ForYouResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const page = Math.max(1, parseInt(String(options.cursor || "1"), 10) || 1);
  // Pull a wider pool then cut — keeps Mongo path identical to chronological feed
  const poolLimit = Math.min(limit * 3, 60);

  const [pool, impressed] = await Promise.all([
    mediaQueryService.getAllContentForAllTab({
      page,
      limit: poolLimit,
      contentType: "ALL",
      sort: "createdAt",
      order: "desc",
    }),
    getRecentFeedContentIds(options.userId, { sinceHours: 24, limit: 400 }),
  ]);

  let candidates = Array.isArray(pool.media) ? [...pool.media] : [];
  const fresh = candidates.filter(m => {
    const id = (m._id || m.id)?.toString?.();
    return id && !impressed.has(id);
  });

  // Prefer unseen; backfill with demoted seen if pool too small
  const working =
    fresh.length >= limit
      ? fresh
      : [...fresh, ...candidates.filter(m => {
          const id = (m._id || m.id)?.toString?.();
          return id && impressed.has(id);
        })];

  working.sort((a, b) => scoreCard(b, impressed) - scoreCard(a, impressed));

  // Light diversification: avoid 3+ same media-kind contentType in a row
  const diversified: any[] = [];
  const deferred: any[] = [];
  for (const item of working) {
    const lastTwo = diversified.slice(-2);
    const kind = item.contentType;
    if (
      kind &&
      lastTwo.length === 2 &&
      lastTwo.every((x: any) => x.contentType === kind)
    ) {
      deferred.push(item);
      continue;
    }
    diversified.push(item);
    if (diversified.length >= limit) break;
  }
  for (const item of deferred) {
    if (diversified.length >= limit) break;
    diversified.push(item);
  }

  const sliced = diversified.slice(0, limit);
  const withCounts = await attachFreshEngagementCounts(sliced, { fromMongoMiss: true });
  const items = await attachFeedUserInteractionFlags(withCounts, options.userId);

  const totalPages = pool.pagination?.totalPages ?? 1;
  const hasMore = page < totalPages || candidates.length >= poolLimit;
  const nextCursor = hasMore ? String(page + 1) : null;

  logger.info("for_you_served", {
    userId: options.userId,
    page,
    limit,
    poolSize: candidates.length,
    impressed: impressed.size,
    returned: items.length,
  });

  return { items, cursor: nextCursor, hasMore };
}
