import { engagementRedisSafe } from "./engagementRedis";
import { CACHE_TTL } from "./cacheKeys";

/**
 * Fast-changing counters for posts/media.
 * Keys:
 * - content:{contentType}:{contentId}:likeCount (preferred for likes)
 * - post:{postId}:likes|views|comments|shares
 *
 * Redis is a post-commit cache. DB is source of truth for writes.
 * Cold-seed uses SET NX so concurrent mutations always win.
 */

const COUNTER_TTL = CACHE_TTL.counters;

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

function counterKey(postId: string, field: PostCounterField): string {
  return `post:${postId}:${field}`;
}

function parseIntOrNull(val: string | null): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

export type PostCounterField = "likes" | "views" | "comments" | "shares";

export async function incrPostCounter(params: {
  postId: string;
  field: PostCounterField;
  delta: number;
  contentType?: string;
}): Promise<number | null> {
  const { postId, field, delta, contentType } = params;
  const keys =
    field === "likes"
      ? likeCountKeys(postId, contentType)
      : { preferred: undefined, legacy: counterKey(postId, field) };

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
      await r.expire(key, COUNTER_TTL).catch(() => {});
      if (keys.preferred && keys.preferred !== keys.legacy) {
        await r.set(keys.legacy, String(next), "EX", COUNTER_TTL).catch(() => {});
      }
      return next;
    },
    null
  );
}

export function clampCount(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export async function getPostCounter(params: {
  postId: string;
  field: PostCounterField;
  contentType?: string;
}): Promise<number | null> {
  const { postId, field, contentType } = params;
  const keys =
    field === "likes"
      ? likeCountKeys(postId, contentType)
      : { preferred: undefined, legacy: counterKey(postId, field) };

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
  field: PostCounterField;
  count: number;
  contentType?: string;
}): Promise<void> {
  const { postId, field, count, contentType } = params;
  const keys =
    field === "likes"
      ? likeCountKeys(postId, contentType)
      : { preferred: undefined, legacy: counterKey(postId, field) };

  await engagementRedisSafe(
    "counterSet",
    async r => {
      if (keys.preferred) {
        await r.set(keys.preferred, String(count), "EX", COUNTER_TTL);
      }
      await r.set(keys.legacy, String(count), "EX", COUNTER_TTL);
    },
    undefined
  ).catch(() => {});
}

/**
 * Batch MGET of post:{id}:likes|comments|views|shares for a page of media.
 * Returns null when Redis is unavailable.
 */
export async function mgetPostCounters(
  postIds: string[]
): Promise<Map<string, Partial<Record<PostCounterField, number>>> | null> {
  if (postIds.length === 0) return new Map();
  const fields: PostCounterField[] = ["likes", "comments", "views", "shares"];
  const keys: string[] = [];
  for (const id of postIds) {
    for (const field of fields) keys.push(counterKey(id, field));
  }

  const values = await engagementRedisSafe<(string | null)[] | null>(
    "counterMget",
    async r => r.mget(...keys),
    null
  );
  if (!values) return null;

  const out = new Map<string, Partial<Record<PostCounterField, number>>>();
  postIds.forEach((id, i) => {
    const entry: Partial<Record<PostCounterField, number>> = {};
    fields.forEach((field, j) => {
      const n = parseIntOrNull(values[i * fields.length + j]);
      if (n !== null) entry[field] = Math.max(0, n);
    });
    if (Object.keys(entry).length > 0) out.set(id, entry);
  });
  return out;
}

/**
 * Seed missing counters with SET NX so a concurrent mutation always wins.
 * Returns the values present in Redis after the seed attempt.
 */
export async function seedPostCountersIfMissing(
  seeds: Array<{ postId: string; likes?: number; comments?: number; views?: number; shares?: number }>
): Promise<Map<string, Partial<Record<PostCounterField, number>>> | null> {
  if (seeds.length === 0) return new Map();

  return engagementRedisSafe(
    "counterSeedNx",
    async r => {
      const lua = `
        local results = {}
        local i = 1
        while i <= #ARGV do
          local key = ARGV[i]
          local val = ARGV[i + 1]
          local ttl = ARGV[i + 2]
          local existing = redis.call('GET', key)
          if existing == false then
            redis.call('SET', key, val, 'EX', tonumber(ttl))
            results[#results + 1] = val
          else
            results[#results + 1] = existing
            redis.call('EXPIRE', key, tonumber(ttl))
          end
          i = i + 3
        end
        return results
      `;

      const args: string[] = [];
      const meta: Array<{ postId: string; field: PostCounterField }> = [];
      for (const seed of seeds) {
        const pairs: Array<[PostCounterField, number | undefined]> = [
          ["likes", seed.likes],
          ["comments", seed.comments],
          ["views", seed.views],
          ["shares", seed.shares],
        ];
        for (const [field, count] of pairs) {
          if (count === undefined || count === null) continue;
          const n = Math.max(0, Math.floor(count));
          args.push(counterKey(seed.postId, field), String(n), String(COUNTER_TTL));
          meta.push({ postId: seed.postId, field });
        }
      }
      if (args.length === 0) return new Map();

      const raw = (await r.eval(lua, 0, ...args)) as (string | number)[];
      const out = new Map<string, Partial<Record<PostCounterField, number>>>();
      meta.forEach((m, i) => {
        const n = parseIntOrNull(String(raw[i]));
        if (n === null) return;
        const entry = out.get(m.postId) || {};
        entry[m.field] = n;
        out.set(m.postId, entry);
      });
      return out;
    },
    null
  );
}

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
        await Promise.all(targets.map(key => r.set(key, "1", "EX", COUNTER_TTL)));
      } else if (targets.length > 0) {
        // Keep explicit "0" so known-false is distinguishable from miss for
        // legacy single-key reads; feed flags use feed-user-flags keys.
        await Promise.all(targets.map(key => r.set(key, "0", "EX", COUNTER_TTL)));
      }
    },
    undefined
  ).catch(() => {});
}
