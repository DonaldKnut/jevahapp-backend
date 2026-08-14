import { Types } from "mongoose";
import { Artist } from "../../models/artist.model";
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import { CopyrightFreeSongInteraction } from "../../models/copyrightFreeSongInteraction.model";
import { User } from "../../models/user.model";

const NON_STAT_SOURCES = ["studio_preview", "admin", "inspect"];

export function nonStatSourceFilter(): Record<string, unknown> {
  return { $nor: [{ source: { $in: NON_STAT_SOURCES } }] };
}

export function isNonStatPlaySource(source?: unknown): boolean {
  const s = String(source || "")
    .trim()
    .toLowerCase();
  return NON_STAT_SOURCES.includes(s);
}

export async function countArtistFollowers(
  userId: string,
  _artistId?: Types.ObjectId
): Promise<number> {
  if (!userId || !Types.ObjectId.isValid(userId)) return 0;
  const user = await User.findById(userId).select("followers").lean();
  const n = Array.isArray((user as any)?.followers)
    ? (user as any).followers.length
    : 0;
  return n;
}

export async function uniqueListenersSince(
  artistId: Types.ObjectId,
  days: number
): Promise<number> {
  const tracks = await CopyrightFreeSong.find({
    artistId,
    lane: "artist",
  })
    .select("_id")
    .lean();
  if (!tracks.length) return 0;
  const trackIds = tracks.map(t => t._id);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const agg = await CopyrightFreeSongInteraction.aggregate([
    {
      $match: {
        songId: { $in: trackIds },
        hasViewed: true,
        $or: [
          { lastViewedAt: { $gte: since } },
          { viewedAt: { $gte: since } },
          { updatedAt: { $gte: since } },
        ],
      },
    },
    { $group: { _id: "$userId" } },
    { $count: "n" },
  ]);
  return agg[0]?.n ?? 0;
}

export async function uniqueListenersByTrackIds(
  trackIds: Types.ObjectId[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!trackIds.length) return out;
  const rows = await CopyrightFreeSongInteraction.aggregate([
    { $match: { songId: { $in: trackIds }, hasViewed: true } },
    { $group: { _id: "$songId", n: { $sum: 1 } } },
  ]);
  for (const r of rows as any[]) {
    out.set(String(r._id), r.n || 0);
  }
  return out;
}

export async function getCreatorAudience(userId: string, rangeDays = 28) {
  const days = Number.isFinite(rangeDays) ? Math.min(90, Math.max(1, rangeDays)) : 28;
  const artist = await Artist.findOne({ userId }).select("_id status").lean();
  if (!artist) {
    return {
      ok: false as const,
      status: 404 as const,
      message: "No creator profile yet — apply first",
      code: "NOT_A_CREATOR",
    };
  }

  const artistId = (artist as any)._id as Types.ObjectId;
  const tracks = await CopyrightFreeSong.find({
    artistId,
    lane: "artist",
  })
    .select("saveCount")
    .lean();

  const [followers, monthlyListeners] = await Promise.all([
    countArtistFollowers(userId, artistId),
    uniqueListenersSince(artistId, 28),
  ]);

  const playlistAdds = tracks.reduce((s, t: any) => s + (t.saveCount || 0), 0);

  return {
    ok: true as const,
    data: {
      rangeDays: days,
      followers,
      followersDelta: 0,
      monthlyListeners,
      playlistAdds,
    },
  };
}
