/**
 * User affinity from FeedEvent + CF song interactions.
 * Contabo-safe: Mongo aggregations only — no ML process, no GPU, no Torch.
 */
import { Types } from "mongoose";
import { FeedEvent } from "../../../models/feedEvent.model";
import { CopyrightFreeSongInteraction } from "../../../models/copyrightFreeSongInteraction.model";
import { CopyrightFreeSong } from "../../../models/copyrightFreeSong.model";

export type UserAffinity = {
  likedContentIds: Set<string>;
  skippedContentIds: Set<string>;
  watchedContentIds: Set<string>;
  preferredContentTypes: Map<string, number>;
  preferredGenres: Map<string, number>;
  preferredArtistIds: Set<string>;
  preferredTopics: Map<string, number>;
};

function bump(map: Map<string, number>, key: string, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + by);
}

export async function loadUserAffinity(
  userId: string,
  options: { sinceDays?: number } = {}
): Promise<UserAffinity> {
  const empty: UserAffinity = {
    likedContentIds: new Set(),
    skippedContentIds: new Set(),
    watchedContentIds: new Set(),
    preferredContentTypes: new Map(),
    preferredGenres: new Map(),
    preferredArtistIds: new Set(),
    preferredTopics: new Map(),
  };
  if (!Types.ObjectId.isValid(userId)) return empty;

  const sinceDays = options.sinceDays ?? 30;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const userObj = new Types.ObjectId(userId);

  const [feedRows, cfInteractions] = await Promise.all([
    FeedEvent.find({
      userId: userObj,
      createdAt: { $gte: since },
      eventType: { $in: ["like", "save", "share", "watch_time", "skip", "impression"] },
    })
      .select("contentId contentType eventType watchMs progressPct")
      .sort({ createdAt: -1 })
      .limit(800)
      .lean(),
    CopyrightFreeSongInteraction.find({
      userId: userObj,
      $or: [{ hasLiked: true }, { hasViewed: true }, { hasShared: true }],
    })
      .select("songId hasLiked hasViewed hasShared")
      .limit(200)
      .lean(),
  ]);

  for (const row of feedRows as any[]) {
    const id = row.contentId?.toString?.();
    if (!id) continue;
    const ct = String(row.contentType || "media").toLowerCase();
    if (row.eventType === "like" || row.eventType === "save") {
      empty.likedContentIds.add(id);
      bump(empty.preferredContentTypes, ct, 3);
    } else if (row.eventType === "share") {
      empty.likedContentIds.add(id);
      bump(empty.preferredContentTypes, ct, 2);
    } else if (row.eventType === "skip") {
      empty.skippedContentIds.add(id);
      bump(empty.preferredContentTypes, ct, -1);
    } else if (row.eventType === "watch_time") {
      const progress = Number(row.progressPct || 0);
      const watchMs = Number(row.watchMs || 0);
      if (progress >= 0.25 || watchMs >= 3000) {
        empty.watchedContentIds.add(id);
        bump(empty.preferredContentTypes, ct, 1);
      }
    }
  }

  const songIds = (cfInteractions as any[])
    .map(r => r.songId)
    .filter(Boolean);
  if (songIds.length) {
    for (const row of cfInteractions as any[]) {
      const id = row.songId?.toString?.();
      if (!id) continue;
      if (row.hasLiked) empty.likedContentIds.add(id);
      if (row.hasViewed) empty.watchedContentIds.add(id);
    }
    const songs = await CopyrightFreeSong.find({ _id: { $in: songIds } })
      .select("genre artistId topics category")
      .limit(200)
      .lean();
    for (const s of songs as any[]) {
      if (s.genre) bump(empty.preferredGenres, String(s.genre).toLowerCase(), 2);
      if (s.artistId) empty.preferredArtistIds.add(s.artistId.toString());
      if (Array.isArray(s.topics)) {
        for (const t of s.topics) bump(empty.preferredTopics, String(t).toLowerCase(), 1);
      }
      if (s.category) bump(empty.preferredTopics, String(s.category).toLowerCase(), 1);
    }
  }

  return empty;
}
