import { Types } from "mongoose";
import { Like } from "../../models/like.model";
import { Bookmark } from "../../models/bookmark.model";
import { engagementRedisSafe } from "../../lib/engagementRedis";
import { feedUserFlagsKey, CACHE_TTL } from "../../lib/cacheKeys";

/**
 * Overlay per-user like/save flags onto feed media cards.
 *
 * Redis encoding (single key per user/media):
 *   bit0 liked value
 *   bit1 bookmarked value
 *   bit2 like-known
 *   bit3 bookmark-known
 *
 * Explicit false is distinguishable from miss. Redis down → Mongo fallback.
 */

const FLAG_TTL = CACHE_TTL.userFlags;

const LIKED = 1 << 0;
const BOOKMARKED = 1 << 1;
const LIKE_KNOWN = 1 << 2;
const BOOKMARK_KNOWN = 1 << 3;

function decodeFlags(raw: string | null): {
  liked?: boolean;
  bookmarked?: boolean;
  likeKnown: boolean;
  bookmarkKnown: boolean;
} {
  if (raw === null || raw === undefined) {
    return { likeKnown: false, bookmarkKnown: false };
  }
  const n = Number(raw);
  if (Number.isNaN(n)) return { likeKnown: false, bookmarkKnown: false };
  return {
    liked: (n & LIKE_KNOWN) !== 0 ? (n & LIKED) !== 0 : undefined,
    bookmarked: (n & BOOKMARK_KNOWN) !== 0 ? (n & BOOKMARKED) !== 0 : undefined,
    likeKnown: (n & LIKE_KNOWN) !== 0,
    bookmarkKnown: (n & BOOKMARK_KNOWN) !== 0,
  };
}

function encodeFlags(liked: boolean | undefined, bookmarked: boolean | undefined, prev = 0): number {
  let n = prev;
  if (liked !== undefined) {
    n |= LIKE_KNOWN;
    if (liked) n |= LIKED;
    else n &= ~LIKED;
  }
  if (bookmarked !== undefined) {
    n |= BOOKMARK_KNOWN;
    if (bookmarked) n |= BOOKMARKED;
    else n &= ~BOOKMARKED;
  }
  return n;
}

export async function attachFeedUserInteractionFlags(
  mediaItems: any[],
  userId?: string | null
): Promise<any[]> {
  if (!userId || !Types.ObjectId.isValid(userId) || !Array.isArray(mediaItems) || mediaItems.length === 0) {
    return mediaItems.map(item => ({
      ...item,
      hasLiked: item.hasLiked ?? false,
      hasBookmarked: item.hasBookmarked ?? false,
      userInteractions: item.userInteractions ?? {
        liked: item.hasLiked ?? false,
        saved: item.hasBookmarked ?? false,
      },
    }));
  }

  const ids = [
    ...new Set(
      mediaItems
        .map(m => (m._id || m.id)?.toString?.())
        .filter((id): id is string => !!id && Types.ObjectId.isValid(id))
    ),
  ];
  if (ids.length === 0) return mediaItems;

  const keys = ids.map(id => feedUserFlagsKey(userId, id));
  const cached = await engagementRedisSafe<(string | null)[] | null>(
    "feedUserFlagsMget",
    async r => r.mget(...keys),
    null
  );

  const likedMap = new Map<string, boolean>();
  const savedMap = new Map<string, boolean>();
  const needLike: string[] = [];
  const needBookmark: string[] = [];

  if (cached) {
    ids.forEach((id, i) => {
      const decoded = decodeFlags(cached[i]);
      if (decoded.likeKnown && decoded.liked !== undefined) {
        likedMap.set(id, decoded.liked);
      } else {
        needLike.push(id);
      }
      if (decoded.bookmarkKnown && decoded.bookmarked !== undefined) {
        savedMap.set(id, decoded.bookmarked);
      } else {
        needBookmark.push(id);
      }
    });
  } else {
    needLike.push(...ids);
    needBookmark.push(...ids);
  }

  if (needLike.length > 0 || needBookmark.length > 0) {
    const userObj = new Types.ObjectId(userId);
    const [likes, bookmarks] = await Promise.all([
      needLike.length > 0
        ? Like.find({
            userId: userObj,
            contentId: { $in: needLike.map(id => new Types.ObjectId(id)) },
            contentType: "media",
          })
            .select("contentId")
            .lean()
        : Promise.resolve([] as any[]),
      needBookmark.length > 0
        ? Bookmark.find({
            user: userObj,
            media: { $in: needBookmark.map(id => new Types.ObjectId(id)) },
          })
            .select("media")
            .lean()
        : Promise.resolve([] as any[]),
    ]);

    const likedSet = new Set(likes.map((l: any) => l.contentId.toString()));
    const savedSet = new Set(bookmarks.map((b: any) => b.media.toString()));

    for (const id of needLike) likedMap.set(id, likedSet.has(id));
    for (const id of needBookmark) savedMap.set(id, savedSet.has(id));

    // Fill only unknown bits in Redis (Lua merge)
    void seedFeedUserFlags(userId, ids, likedMap, savedMap, cached);
  }

  return mediaItems.map(item => {
    const id = (item._id || item.id)?.toString?.() || "";
    const hasLiked = likedMap.get(id) ?? false;
    const hasBookmarked = savedMap.get(id) ?? false;
    return {
      ...item,
      hasLiked,
      hasBookmarked,
      userInteractions: {
        liked: hasLiked,
        saved: hasBookmarked,
      },
    };
  });
}

async function seedFeedUserFlags(
  userId: string,
  ids: string[],
  likedMap: Map<string, boolean>,
  savedMap: Map<string, boolean>,
  prevValues: (string | null)[] | null
): Promise<void> {
  await engagementRedisSafe(
    "feedUserFlagsSeed",
    async r => {
      const pipeline = r.pipeline();
      ids.forEach((id, i) => {
        const prev = prevValues ? Number(prevValues[i] || 0) || 0 : 0;
        const encoded = encodeFlags(likedMap.get(id), savedMap.get(id), prev);
        pipeline.set(feedUserFlagsKey(userId, id), String(encoded), "EX", FLAG_TTL);
      });
      await pipeline.exec();
    },
    undefined
  ).catch(() => {});
}

/** Call after a committed like toggle so the next feed hit skips Mongo. */
export async function setFeedUserLikeFlag(
  userId: string,
  mediaId: string,
  liked: boolean
): Promise<void> {
  if (!userId || !mediaId) return;
  await engagementRedisSafe(
    "feedUserLikeFlagSet",
    async r => {
      const key = feedUserFlagsKey(userId, mediaId);
      const raw = await r.get(key);
      const prev = Number(raw || 0) || 0;
      const next = encodeFlags(liked, undefined, prev);
      await r.set(key, String(next), "EX", FLAG_TTL);
    },
    undefined
  ).catch(() => {});
}

/** Call after a committed bookmark toggle. */
export async function setFeedUserBookmarkFlag(
  userId: string,
  mediaId: string,
  bookmarked: boolean
): Promise<void> {
  if (!userId || !mediaId) return;
  await engagementRedisSafe(
    "feedUserBookmarkFlagSet",
    async r => {
      const key = feedUserFlagsKey(userId, mediaId);
      const raw = await r.get(key);
      const prev = Number(raw || 0) || 0;
      const next = encodeFlags(undefined, bookmarked, prev);
      await r.set(key, String(next), "EX", FLAG_TTL);
    },
    undefined
  ).catch(() => {});
}
