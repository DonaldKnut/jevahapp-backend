import { redisSafe } from "./redis";

/**
 * Fast-changing counters for posts/media.
 * Keys:
 * - post:{postId}:likes
 * - post:{postId}:views
 * - post:{postId}:comments
 * - user:{userId}:like:{contentId} - User like state (1 = liked, 0 = not liked)
 *
 * Redis is the primary read source for hot paths. DB is source of truth for writes.
 */

export async function incrPostCounter(params: {
  postId: string;
  field: "likes" | "views" | "comments";
  delta: number;
}): Promise<number | null> {
  const { postId, field, delta } = params;
  const key = `post:${postId}:${field}`;

  return await redisSafe<number | null>(
    "counterIncr",
    async (r) => {
      const next = await r.incrby(key, delta);
      // Set TTL on first increment (24 hours)
      if (delta > 0) {
        await r.expire(key, 86400).catch(() => {});
      }
      return typeof next === "number" ? next : Number(next);
    },
    null
  );
}

export async function getPostCounter(params: {
  postId: string;
  field: "likes" | "views" | "comments";
}): Promise<number | null> {
  const { postId, field } = params;
  const key = `post:${postId}:${field}`;

  return await redisSafe<number | null>(
    "counterGet",
    async (r) => {
      const val = await r.get<number>(key);
      if (val === null || val === undefined) return null;
      return typeof val === "number" ? val : Number(val);
    },
    null
  );
}

/**
 * Check if user has liked content (Redis-first)
 */
export async function getUserLikeState(params: {
  userId: string;
  contentId: string;
}): Promise<boolean | null> {
  const { userId, contentId } = params;
  const key = `user:${userId}:like:${contentId}`;

  return await redisSafe<boolean | null>(
    "userLikeGet",
    async (r) => {
      const val = await r.get<number>(key);
      if (val === null || val === undefined) return null;
      return val === 1;
    },
    null
  );
}

/**
 * Set user like state in Redis (optimistic update)
 */
export async function setUserLikeState(params: {
  userId: string;
  contentId: string;
  liked: boolean;
}): Promise<void> {
  const { userId, contentId, liked } = params;
  const key = `user:${userId}:like:${contentId}`;

  await redisSafe(
    "userLikeSet",
    async (r) => {
      if (liked) {
        await r.set(key, 1, { ex: 86400 }); // 24 hours TTL
      } else {
        await r.del(key);
      }
    },
    undefined
  ).catch(() => {}); // Never block on Redis write
}

