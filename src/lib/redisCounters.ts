import { redisSafe } from "./redis";

/**
 * Fast-changing counters for posts/media.
 * Keys (as requested):
 * - post:{postId}:likes
 * - post:{postId}:views
 * - post:{postId}:comments
 *
 * Redis is an optimization layer only: DB remains source of truth.
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

