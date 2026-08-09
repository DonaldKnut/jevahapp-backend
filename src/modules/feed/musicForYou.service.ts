/**
 * Algorithmic For You for artist-lane + gospel music (CopyrightFreeSong).
 * Contabo-safe local ranker; optional FEED_RANKER_URL soft-fail.
 */
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import {
  publicArtistReadyFilter,
  publicCuratedReadyFilter,
  shapeTrackCardsWithRelease,
} from "../audio/track.formatter";
import { getRecentFeedContentIds } from "./feedEvents.service";
import { loadUserAffinity } from "./ranker/userAffinity";
import { diversifyByField, rankItemsLocally } from "./ranker/score";
import {
  isFeedRankerConfigured,
  rankWithSidecar,
} from "./ranker/feedRankerClient";
import logger from "../../utils/logger";

export type MusicForYouOptions = {
  userId: string;
  limit?: number;
  cursor?: string | null;
  lane?: "artist" | "curated" | "all";
};

export type MusicForYouResult = {
  tracks: any[];
  items: any[];
  cursor: string | null;
  hasMore: boolean;
};

export async function getMusicForYouFeed(
  options: MusicForYouOptions
): Promise<MusicForYouResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const page = Math.max(1, parseInt(String(options.cursor || "1"), 10) || 1);
  const poolLimit = Math.min(limit * 4, 80);
  const skip = (page - 1) * poolLimit;

  // Artist shelf by default (gospel Artists). curated optional.
  const filter =
    options.lane === "curated"
      ? publicCuratedReadyFilter()
      : publicArtistReadyFilter();

  const [rows, impressed, affinity, total] = await Promise.all([
    CopyrightFreeSong.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(poolLimit)
      .lean(),
    getRecentFeedContentIds(options.userId, { sinceHours: 48, limit: 400 }),
    loadUserAffinity(options.userId, { sinceDays: 45 }),
    CopyrightFreeSong.countDocuments(filter),
  ]);

  const candidates = (rows as any[]).map(r => ({
    ...r,
    contentType: "music",
    bookmarkCount: r.saveCount || 0,
  }));

  const fresh = candidates.filter(m => {
    const id = m._id?.toString?.();
    return id && !impressed.has(id);
  });
  const working =
    fresh.length >= limit
      ? fresh
      : [
          ...fresh,
          ...candidates.filter(m => {
            const id = m._id?.toString?.();
            return id && impressed.has(id);
          }),
        ];

  let ordered = rankItemsLocally(working, { impressed, affinity });

  // Stringify artistId for diversification (ObjectId !== string otherwise)
  ordered = ordered.map(m => ({
    ...m,
    artistIdKey: m.artistId?.toString?.() || m.artistSlug || m.artistName || "",
  }));

  if (isFeedRankerConfigured() && ordered.length) {
    const remote = await rankWithSidecar({
      userId: options.userId,
      surface: "music_for_you",
      candidates: ordered.map(m => ({
        id: m._id.toString(),
        contentType: "music",
        likeCount: m.likeCount,
        viewCount: m.viewCount,
        shareCount: m.shareCount,
        bookmarkCount: m.saveCount,
        playCount: m.playCount,
        genre: m.genre,
        artistId: m.artistId?.toString?.(),
        topics: m.topics,
        category: m.category,
        title: m.title,
        publishedAt: m.publishedAt
          ? new Date(m.publishedAt).toISOString()
          : undefined,
        createdAt: m.createdAt
          ? new Date(m.createdAt).toISOString()
          : undefined,
      })),
      affinity: {
        preferredGenres: [...affinity.preferredGenres.keys()].slice(0, 20),
        preferredArtistIds: [...affinity.preferredArtistIds].slice(0, 40),
        skippedIds: [...affinity.skippedContentIds].slice(0, 80),
        likedIds: [...affinity.likedContentIds].slice(0, 80),
      },
    });
    if (remote?.orderedIds?.length) {
      const byId = new Map(ordered.map(m => [m._id.toString(), m]));
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

  const diversified = diversifyByField(ordered, "artistIdKey", limit);
  const sliced = diversified.slice(0, limit);
  const cards = await shapeTrackCardsWithRelease(sliced);

  const hasMore = skip + poolLimit < total;
  const nextCursor = hasMore ? String(page + 1) : null;

  logger.info("music_for_you_served", {
    userId: options.userId,
    page,
    limit,
    poolSize: candidates.length,
    returned: cards.length,
    lane: options.lane || "artist",
  });

  return {
    tracks: cards,
    items: cards,
    cursor: nextCursor,
    hasMore,
  };
}
