import { engagementRedisSafe } from "./engagementRedis";

/**
 * Fast-changing counters for posts/media.
 * Keys:
 * - content:{contentType}:{contentId}:likeCount (preferred)
 * - post:{postId}:likes (legacy)
 * - user:{userId}:like:{contentType}:{contentId} (preferred)
 * - user:{userId}:like:{contentId} (legacy)
 *
 * Authoritative store: Contabo / local Redis (REDIS_URL / ioredis).
 * Redis is a post-commit cache. DB is source of truth for writes.
 */

function likeCountKeys(
  postId: string,
  contentType?: string
): { preferred?: string; legacy: string } {
  return {
    preferred: contentType ? `content:${contentType}:${postId}:likeCount` : undefined,
    legacy: `post:${postId}:likes`,
  };
}

function userLikeKeys(
  userId: string,
  contentId: string,
  contentType?: string
): { preferred?: string; legacy: string } {
  return {
    preferred: contentType ? `user:${userId}:like:${contentType}:${contentId}` : undefined,
    legacy: `user:${userId}:like:${contentId}`,
  };
}

function parseIntOrNull(val: string | null): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

export async function incrPostCounter(params: {
  postId: string;
  field: "likes" | "views" | "comments";
  delta: number;
  contentType?: string;
}): Promise<number | null> {
  const { postId, field, delta, contentType } = params;
  const keys =
    field === "likes"
      ? likeCountKeys(postId, contentType)
      : { preferred: undefined, legacy: `post:${postId}:${field}` };

  return await engagementRedisSafe<number | null>(
    "counterIncr",
    async r => {
      const key = keys.preferred || keys.legacy;
      const raw = await r.incrby(key, delta);
      let next = typeof raw === "number" ? raw : Number(raw);
      if (next < 0) {
        await r.set(key, "0");
        next = 0;
      }
      if (delta > 0) {
        await r.expire(key, 86400).catch(() => {});
      }
      if (keys.preferred && keys.preferred !== keys.legacy) {
        await r.set(keys.legacy, String(next), "EX", 86400).catch(() => {});
      }
      return next;
    },
    null
  );
}

/** Clamp engagement counts for API responses and analytics payloads */
export function clampCount(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export async function getPostCounter(params: {
  postId: string;
  field: "likes" | "views" | "comments";
  contentType?: string;
}): Promise<number | null> {
  const { postId, field, contentType } = params;
  const keys =
    field === "likes"
      ? likeCountKeys(postId, contentType)
      : { preferred: undefined, legacy: `post:${postId}:${field}` };

  return await engagementRedisSafe<number | null>(
    "counterGet",
    async r => {
      if (keys.preferred) {
        const preferred = parseIntOrNull(await r.get(keys.preferred));
        if (preferred !== null) return preferred;
      }
      return parseIntOrNull(await r.get(keys.legacy));
    },
    null
  );
}

export async function setPostCounter(params: {
  postId: string;
  field: "likes" | "views" | "comments";
  count: number;
  contentType?: string;
}): Promise<void> {
  const { postId, field, count, contentType } = params;
  const keys =
    field === "likes"
      ? likeCountKeys(postId, contentType)
      : { preferred: undefined, legacy: `post:${postId}:${field}` };

  await engagementRedisSafe(
    "counterSet",
    async r => {
      if (keys.preferred) {
        await r.set(keys.preferred, String(count), "EX", 86400);
      }
      await r.set(keys.legacy, String(count), "EX", 86400);
    },
    undefined
  ).catch(() => {});
}

/**
 * Check if user has liked content (cache read; null = miss)
 */
export async function getUserLikeState(params: {
  userId: string;
  contentId: string;
  contentType?: string;
}): Promise<boolean | null> {
  const { userId, contentId, contentType } = params;
  const keys = userLikeKeys(userId, contentId, contentType);

  return await engagementRedisSafe<boolean | null>(
    "userLikeGet",
    async r => {
      if (keys.preferred) {
        const preferred = await r.get(keys.preferred);
        if (preferred !== null && preferred !== undefined) {
          return preferred === "1";
        }
      }
      const val = await r.get(keys.legacy);
      if (val === null || val === undefined) return null;
      return val === "1";
    },
    null
  );
}

/**
 * Set user like state in Redis after a committed mutation
 */
export async function setUserLikeState(params: {
  userId: string;
  contentId: string;
  liked: boolean;
  contentType?: string;
}): Promise<void> {
  const { userId, contentId, liked, contentType } = params;
  const keys = userLikeKeys(userId, contentId, contentType);

  await engagementRedisSafe(
    "userLikeSet",
    async r => {
      const targets = [keys.preferred, keys.legacy].filter(Boolean) as string[];
      if (liked) {
        await Promise.all(targets.map(key => r.set(key, "1", "EX", 86400)));
      } else if (targets.length > 0) {
        await r.del(...targets);
      }
    },
    undefined
  ).catch(() => {});
}
