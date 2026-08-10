/**
 * Creator Studio analytics — Contabo-safe aggregations (no ML).
 * Spotify-for-Artists overview shape for GET /api/creators/me/analytics.
 */
import { Types } from "mongoose";
import { Artist } from "../../models/artist.model";
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import { CopyrightFreeSongInteraction } from "../../models/copyrightFreeSongInteraction.model";
import { FeedEvent } from "../../models/feedEvent.model";
import { User } from "../../models/user.model";
import logger from "../../utils/logger";

const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  KE: "Kenya",
  ZA: "South Africa",
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  IE: "Ireland",
  IN: "India",
  PH: "Philippines",
  BR: "Brazil",
  JM: "Jamaica",
  TT: "Trinidad and Tobago",
};

export type CreatorAnalyticsResult = {
  rangeDays: number;
  totalListens: number;
  uniqueListeners: number;
  completes: number;
  likes: number;
  saves: number;
  avgWatchPct: number;
  topRegions: Array<{
    region: string;
    countryCode: string;
    listens: number;
    sharePct: number;
  }>;
  focusHint: string;
  topTracks: Array<{
    trackId: string;
    title: string;
    listens: number;
    completes: number;
    likes: number;
    saves: number;
    avgWatchPct: number;
  }>;
  timeseries: Array<{ date: string; listens: number }>;
};

function clampRangeDays(raw: unknown): number {
  const n = parseInt(String(raw ?? 30), 10);
  if (!Number.isFinite(n)) return 30;
  return Math.min(90, Math.max(1, n));
}

function regionLabel(code: string): string {
  const cc = code.toUpperCase();
  const name = COUNTRY_NAMES[cc];
  return name ? `${name} (${cc})` : cc;
}

function buildFocusHint(
  topRegions: CreatorAnalyticsResult["topRegions"],
  topTracks: CreatorAnalyticsResult["topTracks"]
): string {
  const r0 = topRegions[0];
  if (r0 && r0.sharePct >= 25) {
    return `${r0.region} drives ~${Math.round(r0.sharePct)}% of listens — double down there (premieres, collabs, local playlists).`;
  }
  const t0 = topTracks[0];
  if (t0 && t0.listens > 0) {
    return `"${t0.title}" leads your catalog — push it in Stories and For You moments.`;
  }
  return "Keep uploading and sharing — analytics deepen as listeners engage with your tracks.";
}

function emptySeries(rangeDays: number): Array<{ date: string; listens: number }> {
  const out: Array<{ date: string; listens: number }> = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  for (let i = rangeDays - 1; i >= 0; i--) {
    const day = new Date(d);
    day.setUTCDate(d.getUTCDate() - i);
    out.push({ date: day.toISOString().slice(0, 10), listens: 0 });
  }
  return out;
}

export async function getCreatorStudioAnalytics(
  userId: string,
  rangeDaysRaw?: unknown
): Promise<
  | { ok: true; data: CreatorAnalyticsResult }
  | { ok: false; status: 403 | 404; message: string; code: string }
> {
  if (!Types.ObjectId.isValid(userId)) {
    return { ok: false, status: 403, message: "Unauthorized", code: "AUTHENTICATION_REQUIRED" };
  }

  const user = await User.findById(userId).select("isBanned").lean();
  if (!user) {
    return { ok: false, status: 403, message: "Unauthorized", code: "AUTHENTICATION_REQUIRED" };
  }
  if ((user as any).isBanned) {
    return {
      ok: false,
      status: 403,
      message: "Account is banned",
      code: "ACCOUNT_BANNED",
    };
  }

  const artist = await Artist.findOne({ userId }).select("_id status").lean();
  if (!artist) {
    return {
      ok: false,
      status: 404,
      message: "No creator profile yet",
      code: "ARTIST_NOT_FOUND",
    };
  }

  const rangeDays = clampRangeDays(rangeDaysRaw);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - rangeDays);
  since.setUTCHours(0, 0, 0, 0);

  const tracks = await CopyrightFreeSong.find({
    artistId: artist._id,
    lane: "artist",
  })
    .select("_id title playCount viewCount likeCount saveCount")
    .lean();

  if (!tracks.length) {
    const data: CreatorAnalyticsResult = {
      rangeDays,
      totalListens: 0,
      uniqueListeners: 0,
      completes: 0,
      likes: 0,
      saves: 0,
      avgWatchPct: 0,
      topRegions: [],
      focusHint: "Upload your first track to start seeing Studio analytics.",
      topTracks: [],
      timeseries: emptySeries(rangeDays),
    };
    return { ok: true, data };
  }

  const trackIds = tracks.map(t => t._id as Types.ObjectId);

  const likes = tracks.reduce((s, t) => s + (t.likeCount || 0), 0);
  const saves = tracks.reduce((s, t) => s + (t.saveCount || 0), 0);
  const catalogListens = tracks.reduce(
    (s, t) => s + (t.playCount || 0) + (t.viewCount || 0),
    0
  );

  const [
    uniqueAgg,
    qualityAgg,
    regionAgg,
    feedDayAgg,
    perTrackComplete,
  ] = await Promise.all([
    CopyrightFreeSongInteraction.aggregate([
      {
        $match: {
          songId: { $in: trackIds },
          hasViewed: true,
        },
      },
      { $group: { _id: "$userId" } },
      { $count: "n" },
    ]),
    CopyrightFreeSongInteraction.aggregate([
      {
        $match: {
          songId: { $in: trackIds },
          hasViewed: true,
        },
      },
      {
        $group: {
          _id: null,
          completes: { $sum: { $cond: ["$isComplete", 1, 0] } },
          avgWatchPct: { $avg: "$progressPct" },
        },
      },
    ]),
    CopyrightFreeSongInteraction.aggregate([
      {
        $match: {
          songId: { $in: trackIds },
          hasViewed: true,
          countryCode: { $type: "string", $ne: "" },
        },
      },
      { $group: { _id: "$countryCode", listens: { $sum: 1 } } },
      { $sort: { listens: -1 } },
      { $limit: 10 },
    ]),
    FeedEvent.aggregate([
      {
        $match: {
          contentId: { $in: trackIds },
          eventType: { $in: ["watch_time", "impression"] },
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
          },
          listens: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    CopyrightFreeSongInteraction.aggregate([
      {
        $match: {
          songId: { $in: trackIds },
          hasViewed: true,
        },
      },
      {
        $group: {
          _id: "$songId",
          completes: { $sum: { $cond: ["$isComplete", 1, 0] } },
          avgWatchPct: { $avg: "$progressPct" },
          uniqueListeners: { $sum: 1 },
        },
      },
    ]),
  ]);

  const uniqueListeners = uniqueAgg[0]?.n ?? 0;
  const completes = qualityAgg[0]?.completes ?? 0;
  const avgWatchPct = Math.round(((qualityAgg[0]?.avgWatchPct as number) || 0) * 10) / 10;

  const rangeListens = (feedDayAgg as any[]).reduce(
    (s, row) => s + (row.listens || 0),
    0
  );
  const totalListens = rangeListens > 0 ? rangeListens : catalogListens;

  const regionTotal =
    (regionAgg as any[]).reduce((s, r) => s + (r.listens || 0), 0) || 1;
  const topRegions = (regionAgg as any[]).map(r => {
    const code = String(r._id || "").toUpperCase();
    const listens = r.listens || 0;
    return {
      region: regionLabel(code),
      countryCode: code,
      listens,
      sharePct: Math.round((listens / regionTotal) * 1000) / 10,
    };
  });

  const qualityByTrack = new Map<string, { completes: number; avgWatchPct: number }>();
  for (const row of perTrackComplete as any[]) {
    qualityByTrack.set(String(row._id), {
      completes: row.completes || 0,
      avgWatchPct: Math.round((row.avgWatchPct || 0) * 10) / 10,
    });
  }

  const topTracks = [...tracks]
    .map(t => {
      const id = (t._id as Types.ObjectId).toString();
      const q = qualityByTrack.get(id) || { completes: 0, avgWatchPct: 0 };
      const listens = (t.playCount || 0) + (t.viewCount || 0);
      return {
        trackId: id,
        title: t.title || "Untitled",
        listens,
        completes: q.completes,
        likes: t.likeCount || 0,
        saves: t.saveCount || 0,
        avgWatchPct: q.avgWatchPct,
      };
    })
    .sort((a, b) => b.listens - a.listens)
    .slice(0, 20);

  const seriesMap = new Map<string, number>();
  for (const row of feedDayAgg as any[]) {
    seriesMap.set(row._id, row.listens || 0);
  }
  const timeseries = emptySeries(rangeDays).map(point => ({
    date: point.date,
    listens: seriesMap.get(point.date) || 0,
  }));

  const data: CreatorAnalyticsResult = {
    rangeDays,
    totalListens,
    uniqueListeners,
    completes,
    likes,
    saves,
    avgWatchPct,
    topRegions,
    focusHint: buildFocusHint(topRegions, topTracks),
    topTracks,
    timeseries,
  };

  logger.info("creator_studio_analytics", {
    userId,
    artistId: artist._id.toString(),
    trackCount: tracks.length,
    rangeDays,
    totalListens,
    uniqueListeners,
    regions: topRegions.length,
  });

  return { ok: true, data };
}

/**
 * Per-track Studio breakdown — GET /api/creators/me/analytics/tracks/:trackId
 */
export async function getCreatorTrackAnalytics(
  userId: string,
  trackId: string,
  rangeDaysRaw?: unknown
): Promise<
  | {
      ok: true;
      data: {
        rangeDays: number;
        trackId: string;
        title: string;
        listens: number;
        uniqueListeners: number;
        completes: number;
        likes: number;
        saves: number;
        avgWatchPct: number;
        topRegions: CreatorAnalyticsResult["topRegions"];
        timeseries: CreatorAnalyticsResult["timeseries"];
        focusHint: string;
      };
    }
  | { ok: false; status: 403 | 404; message: string; code: string }
> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(trackId)) {
    return { ok: false, status: 404, message: "Track not found", code: "TRACK_NOT_FOUND" };
  }

  const user = await User.findById(userId).select("isBanned").lean();
  if (!user || (user as any).isBanned) {
    return {
      ok: false,
      status: 403,
      message: (user as any)?.isBanned ? "Account is banned" : "Unauthorized",
      code: (user as any)?.isBanned ? "ACCOUNT_BANNED" : "AUTHENTICATION_REQUIRED",
    };
  }

  const artist = await Artist.findOne({ userId }).select("_id").lean();
  if (!artist) {
    return {
      ok: false,
      status: 404,
      message: "No creator profile yet",
      code: "ARTIST_NOT_FOUND",
    };
  }

  const track = await CopyrightFreeSong.findOne({
    _id: trackId,
    artistId: artist._id,
    lane: "artist",
  })
    .select("title playCount viewCount likeCount saveCount")
    .lean();

  if (!track) {
    return { ok: false, status: 404, message: "Track not found", code: "TRACK_NOT_FOUND" };
  }

  const rangeDays = clampRangeDays(rangeDaysRaw);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - rangeDays);
  since.setUTCHours(0, 0, 0, 0);
  const songObj = new Types.ObjectId(trackId);

  const [uniqueAgg, qualityAgg, regionAgg, feedDayAgg] = await Promise.all([
    CopyrightFreeSongInteraction.aggregate([
      { $match: { songId: songObj, hasViewed: true } },
      { $group: { _id: "$userId" } },
      { $count: "n" },
    ]),
    CopyrightFreeSongInteraction.aggregate([
      { $match: { songId: songObj, hasViewed: true } },
      {
        $group: {
          _id: null,
          completes: { $sum: { $cond: ["$isComplete", 1, 0] } },
          avgWatchPct: { $avg: "$progressPct" },
        },
      },
    ]),
    CopyrightFreeSongInteraction.aggregate([
      {
        $match: {
          songId: songObj,
          hasViewed: true,
          countryCode: { $type: "string", $ne: "" },
        },
      },
      { $group: { _id: "$countryCode", listens: { $sum: 1 } } },
      { $sort: { listens: -1 } },
      { $limit: 10 },
    ]),
    FeedEvent.aggregate([
      {
        $match: {
          contentId: songObj,
          eventType: { $in: ["watch_time", "impression"] },
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
          },
          listens: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const catalogListens = (track.playCount || 0) + (track.viewCount || 0);
  const rangeListens = (feedDayAgg as any[]).reduce((s, r) => s + (r.listens || 0), 0);
  const listens = rangeListens > 0 ? rangeListens : catalogListens;
  const uniqueListeners = uniqueAgg[0]?.n ?? 0;
  const completes = qualityAgg[0]?.completes ?? 0;
  const avgWatchPct = Math.round(((qualityAgg[0]?.avgWatchPct as number) || 0) * 10) / 10;
  const regionTotal =
    (regionAgg as any[]).reduce((s, r) => s + (r.listens || 0), 0) || 1;
  const topRegions = (regionAgg as any[]).map(r => {
    const code = String(r._id || "").toUpperCase();
    const n = r.listens || 0;
    return {
      region: regionLabel(code),
      countryCode: code,
      listens: n,
      sharePct: Math.round((n / regionTotal) * 1000) / 10,
    };
  });

  const seriesMap = new Map<string, number>();
  for (const row of feedDayAgg as any[]) {
    seriesMap.set(row._id, row.listens || 0);
  }
  const timeseries = emptySeries(rangeDays).map(p => ({
    date: p.date,
    listens: seriesMap.get(p.date) || 0,
  }));

  const title = track.title || "Untitled";
  const focusHint = buildFocusHint(topRegions, [
    {
      trackId,
      title,
      listens,
      completes,
      likes: track.likeCount || 0,
      saves: track.saveCount || 0,
      avgWatchPct,
    },
  ]);

  return {
    ok: true,
    data: {
      rangeDays,
      trackId,
      title,
      listens,
      uniqueListeners,
      completes,
      likes: track.likeCount || 0,
      saves: track.saveCount || 0,
      avgWatchPct,
      topRegions,
      timeseries,
      focusHint,
    },
  };
}

/** Cloudflare / proxy country header → ISO alpha-2 */
export function countryCodeFromRequest(headers: Record<string, unknown>): string | null {
  const raw =
    headers["cf-ipcountry"] ||
    headers["CF-IPCountry"] ||
    headers["x-vercel-ip-country"] ||
    headers["x-country-code"];
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
  return code;
}

/** Best-effort: stamp country on first qualified view (never overwrite). */
export async function stampInteractionCountryCode(
  userId: string,
  songId: string,
  countryCode: string | null
): Promise<void> {
  if (!countryCode) return;
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(songId)) return;
  try {
    await CopyrightFreeSongInteraction.updateOne(
      {
        userId: new Types.ObjectId(userId),
        songId: new Types.ObjectId(songId),
        hasViewed: true,
        $or: [{ countryCode: { $exists: false } }, { countryCode: null }, { countryCode: "" }],
      },
      { $set: { countryCode } }
    );
  } catch {
    /* soft-fail geo stamp */
  }
}
