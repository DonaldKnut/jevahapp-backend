/**
 * Contabo-safe algorithmic scorer — no TensorFlow, no embeddings process.
 * Blends engagement, recency, exploration, fatigue, and user affinity.
 */
import type { UserAffinity } from "./userAffinity";

export type RankableItem = {
  _id?: any;
  id?: any;
  contentType?: string;
  likeCount?: number;
  viewCount?: number;
  commentCount?: number;
  bookmarkCount?: number;
  saves?: number;
  shareCount?: number;
  playCount?: number;
  createdAt?: Date | string;
  publishedAt?: Date | string;
  genre?: string;
  artistId?: any;
  topics?: string[];
  category?: string;
  title?: string;
  description?: string;
};

function idOf(item: RankableItem): string {
  return (item._id || item.id)?.toString?.() || "";
}

/**
 * Score in [roughly 0..~3]. Higher = better for feed position.
 */
export function scoreRankableItem(
  item: RankableItem,
  opts: {
    impressed: Set<string>;
    affinity: UserAffinity;
    exploreNoise?: number;
  }
): number {
  const id = idOf(item);
  const likes = Number(item.likeCount || 0);
  const views = Number(item.viewCount || 0);
  const comments = Number(item.commentCount || 0);
  const saves = Number(item.bookmarkCount || item.saves || 0);
  const shares = Number(item.shareCount || 0);
  const plays = Number(item.playCount || 0);

  const createdRaw = item.publishedAt || item.createdAt;
  const created = createdRaw ? new Date(createdRaw).getTime() : 0;
  const ageHours = Math.max(0, (Date.now() - created) / (1000 * 60 * 60));
  const recency = Math.exp(-ageHours / 72);

  const engagement =
    0.3 * Math.log1p(likes) +
    0.2 * Math.log1p(views) +
    0.15 * Math.log1p(comments) +
    0.15 * Math.log1p(saves) +
    0.1 * Math.log1p(shares) +
    0.1 * Math.log1p(plays);

  let affinityBoost = 0;
  const ct = String(item.contentType || "").toLowerCase();
  if (ct && opts.affinity.preferredContentTypes.has(ct)) {
    affinityBoost += 0.08 * Math.min(3, opts.affinity.preferredContentTypes.get(ct)!);
  }
  const genre = String(item.genre || "").toLowerCase();
  if (genre && opts.affinity.preferredGenres.has(genre)) {
    affinityBoost += 0.12 * Math.min(3, opts.affinity.preferredGenres.get(genre)!);
  }
  const artistId = item.artistId?.toString?.();
  if (artistId && opts.affinity.preferredArtistIds.has(artistId)) {
    affinityBoost += 0.25;
  }
  if (Array.isArray(item.topics)) {
    for (const t of item.topics) {
      const key = String(t).toLowerCase();
      if (opts.affinity.preferredTopics.has(key)) {
        affinityBoost += 0.05 * Math.min(2, opts.affinity.preferredTopics.get(key)!);
      }
    }
  }
  if (item.category) {
    const key = String(item.category).toLowerCase();
    if (opts.affinity.preferredTopics.has(key)) affinityBoost += 0.08;
  }
  if (opts.affinity.likedContentIds.has(id)) affinityBoost -= 0.4; // already liked — less urgent
  if (opts.affinity.watchedContentIds.has(id)) affinityBoost -= 0.15;
  if (opts.affinity.skippedContentIds.has(id)) affinityBoost -= 0.5;

  const noise = (opts.exploreNoise ?? 0.08) * Math.random();
  let score = 0.45 * engagement + 0.3 * recency + 0.17 * Math.max(0, affinityBoost) + noise;

  if (opts.impressed.has(id)) score *= 0.15;
  if (opts.affinity.skippedContentIds.has(id)) score *= 0.35;

  return score;
}

/** Reorder items by score descending. Stable for equal scores. */
export function rankItemsLocally<T extends RankableItem>(
  items: T[],
  opts: {
    impressed: Set<string>;
    affinity: UserAffinity;
    exploreNoise?: number;
  }
): T[] {
  const scored = items.map((item, index) => ({
    item,
    index,
    score: scoreRankableItem(item, opts),
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map(s => s.item);
}

export function diversifyByField<T extends Record<string, any>>(
  items: T[],
  field: string,
  limit: number
): T[] {
  const diversified: T[] = [];
  const deferred: T[] = [];
  for (const item of items) {
    const lastTwo = diversified.slice(-2);
    const kind = item[field];
    if (
      kind &&
      lastTwo.length === 2 &&
      lastTwo.every((x: any) => x[field] === kind)
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
  return diversified.slice(0, limit);
}
