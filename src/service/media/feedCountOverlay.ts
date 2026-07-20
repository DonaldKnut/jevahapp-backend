import { Types } from "mongoose";
import { Media } from "../../models/media.model";
import {
  mgetPostCounters,
  seedPostCountersIfMissing,
  type PostCounterField,
} from "../../lib/redisCounters";

/**
 * Read-time engagement count overlay for feed payloads (IG/TikTok pattern).
 *
 * 1. MGET Redis counters for the page
 * 2. On partial miss, cold-seed from Mongo (SET NX) so concurrent mutations win
 * 3. Overlay Redis values; fail-open to baked payload counts when Redis is down
 */

const COUNT_FIELDS: PostCounterField[] = ["likes", "comments", "views", "shares"];

function extractBakedCounts(item: any): {
  likes: number;
  comments: number;
  views: number;
  shares: number;
} {
  return {
    likes: Number(item.likeCount ?? item.totalLikes ?? 0) || 0,
    comments: Number(item.commentCount ?? 0) || 0,
    views: Number(item.viewCount ?? item.totalViews ?? 0) || 0,
    shares: Number(item.shareCount ?? item.totalShares ?? 0) || 0,
  };
}

function applyCounts(item: any, counts: Partial<Record<PostCounterField, number>>): any {
  const out = { ...item };
  if (counts.likes !== undefined) {
    out.likeCount = counts.likes;
    if ("totalLikes" in out || item.totalLikes !== undefined) out.totalLikes = counts.likes;
  }
  if (counts.comments !== undefined) {
    out.commentCount = counts.comments;
  }
  if (counts.views !== undefined) {
    out.viewCount = counts.views;
    if ("totalViews" in out || item.totalViews !== undefined) out.totalViews = counts.views;
  }
  if (counts.shares !== undefined) {
    out.shareCount = counts.shares;
    if ("totalShares" in out || item.totalShares !== undefined) out.totalShares = counts.shares;
  }
  return out;
}

export async function attachFreshEngagementCounts(
  mediaItems: any[],
  options: { fromMongoMiss?: boolean } = {}
): Promise<any[]> {
  if (!Array.isArray(mediaItems) || mediaItems.length === 0) return mediaItems;

  const ids = [
    ...new Set(
      mediaItems
        .map(m => (m._id || m.id)?.toString?.())
        .filter((id): id is string => !!id && Types.ObjectId.isValid(id))
    ),
  ];
  if (ids.length === 0) return mediaItems;

  const fresh = await mgetPostCounters(ids);
  if (fresh === null) {
    // Redis down — serve baked counts
    return mediaItems;
  }

  const missingIds = ids.filter(id => {
    const entry = fresh.get(id);
    if (!entry) return true;
    return COUNT_FIELDS.some(f => entry[f] === undefined);
  });

  if (missingIds.length > 0) {
    let seedSource = new Map<string, ReturnType<typeof extractBakedCounts>>();

    if (options.fromMongoMiss) {
      for (const item of mediaItems) {
        const id = (item._id || item.id)?.toString?.();
        if (id && missingIds.includes(id)) {
          seedSource.set(id, extractBakedCounts(item));
        }
      }
    } else {
      try {
        const docs = await Media.find({ _id: { $in: missingIds.map(id => new Types.ObjectId(id)) } })
          .select("likeCount commentCount viewCount shareCount")
          .lean();
        for (const doc of docs as any[]) {
          seedSource.set(doc._id.toString(), {
            likes: Number(doc.likeCount || 0),
            comments: Number(doc.commentCount || 0),
            views: Number(doc.viewCount || 0),
            shares: Number(doc.shareCount || 0),
          });
        }
        // Also seed zeros for IDs missing from Mongo (deleted) using baked payload
        for (const id of missingIds) {
          if (!seedSource.has(id)) {
            const item = mediaItems.find(m => (m._id || m.id)?.toString?.() === id);
            seedSource.set(id, item ? extractBakedCounts(item) : { likes: 0, comments: 0, views: 0, shares: 0 });
          }
        }
      } catch {
        // Cold-seed Mongo failure — keep baked values
        return mediaItems.map(item => {
          const id = (item._id || item.id)?.toString?.() || "";
          const entry = fresh.get(id);
          return entry ? applyCounts(item, entry) : item;
        });
      }
    }

    const seeds = missingIds.map(id => {
      const baked = seedSource.get(id) || { likes: 0, comments: 0, views: 0, shares: 0 };
      const existing = fresh.get(id) || {};
      return {
        postId: id,
        likes: existing.likes ?? baked.likes,
        comments: existing.comments ?? baked.comments,
        views: existing.views ?? baked.views,
        shares: existing.shares ?? baked.shares,
      };
    });

    const seeded = await seedPostCountersIfMissing(seeds);
    if (seeded) {
      for (const [id, entry] of seeded) {
        const merged = { ...(fresh.get(id) || {}), ...entry };
        fresh.set(id, merged);
      }
    }
  }

  return mediaItems.map(item => {
    const id = (item._id || item.id)?.toString?.() || "";
    const entry = fresh.get(id);
    return entry ? applyCounts(item, entry) : item;
  });
}
