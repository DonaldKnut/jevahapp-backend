import { mediaQueryService } from "../../service/media/query.service";
import { attachFreshEngagementCounts } from "../../service/media/feedCountOverlay";
import { attachFeedUserInteractionFlags } from "../../service/media/feedUserFlags";
import { getRecentFeedContentIds } from "./feedEvents.service";
import { loadUserAffinity } from "./ranker/userAffinity";
import { diversifyByField, rankItemsLocally } from "./ranker/score";
import {
  isFeedRankerConfigured,
  rankWithSidecar,
} from "./ranker/feedRankerClient";
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

function toCandidate(item: any) {
  return {
    id: (item._id || item.id)?.toString?.() || "",
    contentType: item.contentType,
    likeCount: item.likeCount,
    viewCount: item.viewCount,
    commentCount: item.commentCount,
    shareCount: item.shareCount,
    bookmarkCount: item.bookmarkCount || item.saves,
    playCount: item.playCount,
    genre: item.genre,
    artistId: item.artistId?.toString?.(),
    topics: item.topics,
    category: item.category,
    title: item.title,
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
    publishedAt: item.publishedAt
      ? new Date(item.publishedAt).toISOString()
      : undefined,
  };
}

/**
 * Algorithmic For You: affinity + engagement + recency + fatigue.
 * Optional FEED_RANKER_URL sidecar (soft-fail). Zero RAM cost when unset.
 */
export async function getForYouFeed(options: ForYouOptions): Promise<ForYouResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const page = Math.max(1, parseInt(String(options.cursor || "1"), 10) || 1);
  const poolLimit = Math.min(limit * 3, 60);

  const [pool, impressed, affinity] = await Promise.all([
    mediaQueryService.getAllContentForAllTab({
      page,
      limit: poolLimit,
      contentType: "ALL",
      sort: "createdAt",
      order: "desc",
    }),
    getRecentFeedContentIds(options.userId, { sinceHours: 24, limit: 400 }),
    loadUserAffinity(options.userId, { sinceDays: 30 }),
  ]);

  let candidates = Array.isArray(pool.media) ? [...pool.media] : [];
  const fresh = candidates.filter(m => {
    const id = (m._id || m.id)?.toString?.();
    return id && !impressed.has(id);
  });

  const working =
    fresh.length >= limit
      ? fresh
      : [
          ...fresh,
          ...candidates.filter(m => {
            const id = (m._id || m.id)?.toString?.();
            return id && impressed.has(id);
          }),
        ];

  let ordered = rankItemsLocally(working, { impressed, affinity });

  if (isFeedRankerConfigured() && ordered.length) {
    const remote = await rankWithSidecar({
      userId: options.userId,
      surface: "for_you",
      candidates: ordered.map(toCandidate).filter(c => c.id),
      affinity: {
        preferredGenres: [...affinity.preferredGenres.keys()].slice(0, 20),
        preferredContentTypes: [...affinity.preferredContentTypes.keys()].slice(
          0,
          12
        ),
        preferredArtistIds: [...affinity.preferredArtistIds].slice(0, 40),
        skippedIds: [...affinity.skippedContentIds].slice(0, 80),
        likedIds: [...affinity.likedContentIds].slice(0, 80),
      },
    });
    if (remote?.orderedIds?.length) {
      const byId = new Map(
        ordered.map(m => [(m._id || m.id)?.toString?.() || "", m])
      );
      const remapped: any[] = [];
      for (const id of remote.orderedIds) {
        const hit = byId.get(id);
        if (hit) {
          remapped.push(hit);
          byId.delete(id);
        }
      }
      for (const leftover of byId.values()) remapped.push(leftover);
      ordered = remapped;
    }
  }

  const diversified = diversifyByField(ordered, "contentType", limit);
  const withCounts = await attachFreshEngagementCounts(diversified, {
    fromMongoMiss: true,
  });
  const items = await attachFeedUserInteractionFlags(
    withCounts,
    options.userId
  );

  const totalPages = pool.pagination?.totalPages ?? 1;
  const hasMore = page < totalPages || candidates.length >= poolLimit;
  const nextCursor = hasMore ? String(page + 1) : null;

  logger.info("for_you_served", {
    userId: options.userId,
    page,
    limit,
    poolSize: candidates.length,
    impressed: impressed.size,
    affinityLikes: affinity.likedContentIds.size,
    ranker: isFeedRankerConfigured() ? "sidecar_or_local" : "local",
    returned: items.length,
  });

  return { items, cursor: nextCursor, hasMore };
}
