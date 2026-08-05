import { Types } from "mongoose";
import {
  Release,
  RELEASE_TYPE_TRACK_HINTS,
  slugifyReleaseTitle,
  type IRelease,
  type ReleaseStatus,
  type ReleaseType,
} from "../../models/release.model";
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import fileUploadService from "../../service/fileUpload.service";
import { AuditService } from "../../service/audit.service";
import { distributionProvider } from "../../service/distribution/noopDistribution.provider";
import logger from "../../utils/logger";
import {
  ALLOWED_COVER_MIME,
  TRACK_COVER_MAX_BYTES,
  TRACK_PRESIGN_EXPIRES_SEC,
  extFromMime,
} from "./track.constants";
import { shapeReleaseCard } from "./release.formatter";
import { TrackUploadError } from "./trackUpload.service";

export class ReleaseError extends Error {
  status: number;
  code?: string;
  data?: unknown;
  constructor(
    message: string,
    status = 400,
    code?: string,
    data?: unknown
  ) {
    super(message);
    this.name = "ReleaseError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function uniqueReleaseSlug(
  baseTitle: string,
  excludeReleaseId?: string
): Promise<string> {
  let slug = slugifyReleaseTitle(baseTitle);
  let n = 0;
  for (;;) {
    const clash = await Release.exists({
      slug,
      ...(excludeReleaseId && Types.ObjectId.isValid(excludeReleaseId)
        ? { _id: { $ne: new Types.ObjectId(excludeReleaseId) } }
        : {}),
    });
    if (!clash) return slug;
    n += 1;
    const base = slugifyReleaseTitle(baseTitle).slice(0, 72);
    slug = `${base}-${n}`;
  }
}

function parseReleaseSlug(raw: unknown): string {
  const slug = String(raw || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ReleaseError(
      "slug must be lowercase letters, numbers, and hyphens (3–80 chars)",
      400,
      "INVALID_SLUG"
    );
  }
  if (slug.length < 3 || slug.length > 80) {
    throw new ReleaseError(
      "slug must be 3–80 characters",
      400,
      "INVALID_SLUG"
    );
  }
  return slug;
}

function parseReleaseType(raw: unknown): ReleaseType {
  const t = String(raw || "single").toLowerCase();
  if (t === "single" || t === "ep" || t === "album" || t === "mixtape") {
    return t;
  }
  throw new ReleaseError(
    "type must be one of: single, ep, album, mixtape",
    400,
    "INVALID_RELEASE_TYPE"
  );
}

export async function createRelease(input: {
  userId: string;
  artistId: string;
  artistSlug: string;
  title: string;
  type?: string;
  description?: string;
  label?: string;
  upc?: string;
  releaseDate?: string | Date | null;
}) {
  if (!input.title?.trim()) {
    throw new ReleaseError("title is required");
  }
  const type = parseReleaseType(input.type);
  const slug = await uniqueReleaseSlug(input.title);
  const doc = await Release.create({
    artistId: new Types.ObjectId(input.artistId),
    artistSlug: input.artistSlug,
    title: input.title.trim(),
    slug,
    type,
    description: input.description?.trim() || null,
    label: input.label?.trim() || null,
    upc: input.upc?.trim() || null,
    releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
    status: "draft",
    lane: "artist",
    artwork: null,
    createdByUserId: new Types.ObjectId(input.userId),
  });

  try {
    await AuditService.logAdminAction(
      input.userId,
      "create_release",
      doc._id.toString(),
      { title: doc.title, type: doc.type }
    );
  } catch {
    /* non-fatal */
  }

  return shapeReleaseCard(doc, { trackCount: 0 });
}

export async function listCreatorReleases(input: {
  artistId: string;
  page?: number;
  limit?: number;
  status?: string;
}) {
  const page = Math.max(input.page || 1, 1);
  const limit = Math.min(Math.max(input.limit || 20, 1), 100);
  const skip = (page - 1) * limit;
  const query: Record<string, unknown> = {
    artistId: new Types.ObjectId(input.artistId),
  };
  if (input.status) query.status = input.status;

  const [rows, total] = await Promise.all([
    Release.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Release.countDocuments(query),
  ]);

  const releaseIds = rows.map((r: any) => r._id);
  const counts = await CopyrightFreeSong.aggregate([
    { $match: { releaseId: { $in: releaseIds } } },
    { $group: { _id: "$releaseId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(
    counts.map((c: any) => [String(c._id), c.count as number])
  );

  return {
    items: rows.map((r: any) =>
      shapeReleaseCard(r, { trackCount: countMap.get(String(r._id)) || 0 })
    ),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getReleaseForArtist(
  releaseId: string,
  artistId: string,
  opts: { includeTracks?: boolean } = {}
) {
  if (!Types.ObjectId.isValid(releaseId)) {
    throw new ReleaseError("Invalid release id", 400);
  }
  const doc = await Release.findOne({
    _id: releaseId,
    artistId: new Types.ObjectId(artistId),
  }).lean();
  if (!doc) throw new ReleaseError("Release not found", 404);

  let tracks: any[] = [];
  if (opts.includeTracks !== false) {
    tracks = await CopyrightFreeSong.find({
      releaseId: new Types.ObjectId(releaseId),
    })
      .sort({ discNumber: 1, trackNumber: 1, createdAt: 1 })
      .lean();
  }
  return shapeReleaseCard(doc, {
    tracks,
    trackCount: tracks.length,
  });
}

export async function patchRelease(
  releaseId: string,
  artistId: string,
  userId: string,
  body: Record<string, unknown>
) {
  const release = await Release.findOne({
    _id: releaseId,
    artistId: new Types.ObjectId(artistId),
  });
  if (!release) throw new ReleaseError("Release not found", 404);
  if (release.status === "archived") {
    throw new ReleaseError("Archived releases cannot be edited", 400);
  }

  if (typeof body.title === "string" && body.title.trim()) {
    const nextTitle = body.title.trim();
    if (nextTitle !== release.title) {
      release.title = nextTitle;
      // Only auto-refresh slug when FE did not send an explicit slug
      if (body.slug === undefined) {
        release.slug = await uniqueReleaseSlug(
          nextTitle,
          release._id.toString()
        );
      }
    }
  }
  if (body.slug !== undefined) {
    const nextSlug = parseReleaseSlug(body.slug);
    const clash = await Release.exists({
      slug: nextSlug,
      _id: { $ne: release._id },
    });
    if (clash) {
      throw new ReleaseError("slug already in use", 409, "SLUG_TAKEN");
    }
    release.slug = nextSlug;
  }
  if (body.type != null) release.type = parseReleaseType(body.type);
  if (typeof body.description === "string") {
    release.description = body.description.trim() || null;
  }
  if (typeof body.label === "string") {
    release.label = body.label.trim() || null;
  }
  if (typeof body.upc === "string") {
    release.upc = body.upc.trim() || null;
  }
  if (body.releaseDate !== undefined) {
    release.releaseDate = body.releaseDate
      ? new Date(String(body.releaseDate))
      : null;
  }

  await release.save();
  try {
    await AuditService.logAdminAction(userId, "update_release", releaseId, {
      status: release.status,
    });
  } catch {
    /* ignore */
  }
  return getReleaseForArtist(releaseId, artistId);
}

export async function createReleaseCoverUploadIntent(input: {
  releaseId: string;
  artistId: string;
  contentType: string;
  fileName?: string;
  fileSizeBytes?: number;
}) {
  const release = await Release.findOne({
    _id: input.releaseId,
    artistId: new Types.ObjectId(input.artistId),
  });
  if (!release) throw new ReleaseError("Release not found", 404);

  const mime = String(input.contentType || "").toLowerCase();
  if (!ALLOWED_COVER_MIME.has(mime)) {
    throw new ReleaseError(
      `Unsupported cover type: ${mime}. Allowed: jpeg, png, webp`,
      400,
      "INVALID_COVER_TYPE"
    );
  }
  const size = Number(input.fileSizeBytes || 0);
  if (size > TRACK_COVER_MAX_BYTES) {
    throw new ReleaseError(
      `Cover exceeds ${TRACK_COVER_MAX_BYTES / (1024 * 1024)}MB limit`,
      400,
      "COVER_TOO_LARGE"
    );
  }

  const ext = extFromMime(mime, input.fileName || "cover.jpg");
  const key = `releases/${release._id.toString()}/cover.${ext}`;
  const putUrl = await fileUploadService.getPresignedPutUrl(
    key,
    mime,
    size > 0 ? size : undefined,
    TRACK_PRESIGN_EXPIRES_SEC
  );

  release.artwork = {
    ...(release.artwork || {}),
    key,
    url: release.artwork?.url || null,
  };
  await release.save();

  return {
    releaseId: release._id.toString(),
    cover: {
      putUrl,
      key,
      headers: { "Content-Type": mime },
      expiresInSeconds: TRACK_PRESIGN_EXPIRES_SEC,
    },
  };
}

export async function finalizeReleaseCover(
  releaseId: string,
  artistId: string
) {
  const release = await Release.findOne({
    _id: releaseId,
    artistId: new Types.ObjectId(artistId),
  });
  if (!release) throw new ReleaseError("Release not found", 404);
  const key = release.artwork?.key;
  if (!key) {
    throw new ReleaseError("No cover upload intent — call cover/upload-intent first");
  }
  try {
    await fileUploadService.headObject(key);
  } catch {
    throw new ReleaseError("Cover object missing in R2", 400, "OBJECT_MISSING");
  }
  const url = fileUploadService.generatePublicUrl(key);
  release.artwork = { key, url };
  await release.save();
  return shapeReleaseCard(release.toObject());
}

export async function reorderReleaseTracks(input: {
  releaseId: string;
  artistId: string;
  orderedTrackIds: string[];
}) {
  const release = await Release.findOne({
    _id: input.releaseId,
    artistId: new Types.ObjectId(input.artistId),
  }).lean();
  if (!release) throw new ReleaseError("Release not found", 404);

  const ids = (input.orderedTrackIds || []).filter((id) =>
    Types.ObjectId.isValid(id)
  );
  if (!ids.length) {
    throw new ReleaseError("orderedTrackIds is required");
  }

  const tracks = await CopyrightFreeSong.find({
    _id: { $in: ids },
    releaseId: new Types.ObjectId(input.releaseId),
    artistId: new Types.ObjectId(input.artistId),
  }).select("_id");
  if (tracks.length !== ids.length) {
    throw new ReleaseError(
      "All track ids must belong to this release",
      400,
      "INVALID_TRACKLIST"
    );
  }

  await Promise.all(
    ids.map((id, index) =>
      CopyrightFreeSong.findByIdAndUpdate(id, {
        $set: {
          trackNumber: index + 1,
          discNumber: 1,
          releaseId: new Types.ObjectId(input.releaseId),
          albumId: new Types.ObjectId(input.releaseId),
        },
      })
    )
  );

  return getReleaseForArtist(input.releaseId, input.artistId);
}

async function loadReleaseTracks(releaseId: string) {
  return CopyrightFreeSong.find({
    releaseId: new Types.ObjectId(releaseId),
  }).lean();
}

export async function publishRelease(input: {
  releaseId: string;
  artistId: string;
  userId: string;
  scheduledAt?: string | Date | null;
  skipTypeHints?: boolean;
}) {
  const release = await Release.findOne({
    _id: input.releaseId,
    artistId: new Types.ObjectId(input.artistId),
  });
  if (!release) throw new ReleaseError("Release not found", 404);
  if (release.status === "archived") {
    throw new ReleaseError("Cannot publish an archived release");
  }

  const tracks = await loadReleaseTracks(input.releaseId);
  if (!tracks.length) {
    throw new ReleaseError("Add at least one track before publishing", 400, "NO_TRACKS");
  }

  const notReady = tracks.filter(
    (t: any) => (t.processing?.status || "pending") !== "ready"
  );
  const underReview = tracks.filter(
    (t: any) =>
      t.moderationStatus === "under_review" || t.moderationStatus === "pending"
  );
  const rejected = tracks.filter(
    (t: any) => t.moderationStatus === "rejected"
  );

  if (rejected.length) {
    throw new ReleaseError(
      "Cannot publish while any track is rejected",
      400,
      "TRACKS_REJECTED",
      {
        blockingTrackIds: rejected.map((t: any) => String(t._id)),
        reasons: rejected.map(() => "rejected"),
      }
    );
  }

  if (notReady.length || underReview.length) {
    const blockers = [...notReady, ...underReview];
    const seen = new Set<string>();
    const blockingTrackIds: string[] = [];
    const reasons: string[] = [];
    for (const t of blockers as any[]) {
      const id = String(t._id);
      if (seen.has(id)) continue;
      seen.add(id);
      blockingTrackIds.push(id);
      if ((t.processing?.status || "pending") !== "ready") {
        reasons.push(`processing:${t.processing?.status || "pending"}`);
      } else {
        reasons.push("pending moderation");
      }
    }
    throw new ReleaseError(
      `${blockingTrackIds.length} track(s) are not ready to publish`,
      400,
      "TRACKS_NOT_READY",
      { blockingTrackIds, reasons }
    );
  }

  const hint = RELEASE_TYPE_TRACK_HINTS[release.type as ReleaseType];
  if (!input.skipTypeHints) {
    if (tracks.length < hint.min || tracks.length > hint.max) {
      const label =
        release.type === "ep"
          ? "EP"
          : release.type.charAt(0).toUpperCase() + release.type.slice(1);
      throw new ReleaseError(
        `${label} usually has ${hint.min}–${hint.max} tracks (you have ${tracks.length})`,
        400,
        "TYPE_HINT_MISMATCH",
        {
          expected: { min: hint.min, max: hint.max },
          actual: tracks.length,
          type: release.type,
        }
      );
    }
  }

  const scheduleAt = input.scheduledAt
    ? new Date(input.scheduledAt)
    : release.scheduledAt;
  const now = new Date();
  const isScheduled = Boolean(
    scheduleAt && scheduleAt.getTime() > now.getTime()
  );

  // Ensure contiguous track numbers. Only go public when publishing now —
  // scheduled releases wait for the scheduler tick.
  const sorted = [...tracks].sort((a: any, b: any) => {
    const d = (a.discNumber || 1) - (b.discNumber || 1);
    if (d !== 0) return d;
    return (a.trackNumber || 0) - (b.trackNumber || 0);
  });
  await Promise.all(
    sorted.map((t: any, i) =>
      CopyrightFreeSong.findByIdAndUpdate(t._id, {
        $set: {
          trackNumber: t.trackNumber || i + 1,
          ...(isScheduled
            ? {}
            : {
                visibility: "published",
                publishedAt: t.publishedAt || now,
              }),
        },
      })
    )
  );

  if (isScheduled) {
    release.status = "scheduled";
    release.scheduledAt = scheduleAt!;
    release.publishedAt = null;
  } else {
    release.status = "published";
    release.publishedAt = now;
    release.scheduledAt = null;
    if (!release.releaseDate) release.releaseDate = now;
  }
  await release.save();

  // Future DSP hook (no-op) — only when live
  if (!isScheduled) {
    void distributionProvider
      .enqueueRelease({
        releaseId: release._id.toString(),
        targets: [],
      })
      .catch((err) =>
        logger.warn("Distribution stub failed", { error: err?.message })
      );
  }

  try {
    await AuditService.logAdminAction(
      input.userId,
      "publish_release",
      release._id.toString(),
      { status: release.status }
    );
  } catch {
    /* ignore */
  }

  const releaseCard = await getReleaseForArtist(
    release._id.toString(),
    input.artistId
  );
  return { release: releaseCard };
}

export async function unlinkTrackFromRelease(input: {
  releaseId: string;
  trackId: string;
  artistId: string;
  userId: string;
  deleteTrack?: boolean;
}) {
  if (
    !Types.ObjectId.isValid(input.releaseId) ||
    !Types.ObjectId.isValid(input.trackId)
  ) {
    throw new ReleaseError("Invalid release or track id", 400);
  }

  const release = await Release.findOne({
    _id: input.releaseId,
    artistId: new Types.ObjectId(input.artistId),
  });
  if (!release) throw new ReleaseError("Release not found", 404);
  if (release.status === "archived") {
    throw new ReleaseError("Cannot edit an archived release", 400);
  }

  const track = await CopyrightFreeSong.findOne({
    _id: input.trackId,
    releaseId: release._id,
    artistId: new Types.ObjectId(input.artistId),
  });
  if (!track) {
    throw new ReleaseError("Track not found on this release", 404);
  }

  // Published → auto-unpublish; studio must re-publish after tracklist edits
  if (release.status === "published") {
    release.status = "draft";
    release.publishedAt = null;
    release.scheduledAt = null;
    await release.save();
  }

  if (input.deleteTrack) {
    const { hardDeleteTrack } = await import("./trackUpload.service");
    await hardDeleteTrack(input.trackId, input.userId);
  } else {
    track.releaseId = null;
    track.albumId = null;
    track.trackNumber = null;
    track.discNumber = null;
    await track.save();
  }

  const remaining = await CopyrightFreeSong.find({
    releaseId: release._id,
  })
    .sort({ discNumber: 1, trackNumber: 1, createdAt: 1 })
    .select("_id");
  await Promise.all(
    remaining.map((t, i) =>
      CopyrightFreeSong.findByIdAndUpdate(t._id, {
        $set: { trackNumber: i + 1, discNumber: 1 },
      })
    )
  );

  try {
    await AuditService.logAdminAction(
      input.userId,
      "unlink_release_track",
      input.releaseId,
      { trackId: input.trackId, deleteTrack: Boolean(input.deleteTrack) }
    );
  } catch {
    /* ignore */
  }

  return getReleaseForArtist(input.releaseId, input.artistId);
}

export async function archiveRelease(
  releaseId: string,
  artistId: string,
  userId: string
) {
  const release = await Release.findOne({
    _id: releaseId,
    artistId: new Types.ObjectId(artistId),
  });
  if (!release) throw new ReleaseError("Release not found", 404);

  if (release.status === "draft") {
    await CopyrightFreeSong.updateMany(
      { releaseId: release._id },
      { $set: { releaseId: null, albumId: null, trackNumber: null } }
    );
    await Release.deleteOne({ _id: release._id });
    try {
      await AuditService.logAdminAction(userId, "delete_release", releaseId, {});
    } catch {
      /* ignore */
    }
    return { deleted: true };
  }

  release.status = "archived";
  await release.save();
  await CopyrightFreeSong.updateMany(
    { releaseId: release._id },
    { $set: { visibility: "archived" } }
  );
  try {
    await AuditService.logAdminAction(userId, "archive_release", releaseId, {});
  } catch {
    /* ignore */
  }
  return { deleted: false, archived: true };
}

/** Public: published release by id or slug */
export async function getPublicRelease(idOrSlug: string) {
  const query: Record<string, unknown> = { status: "published" };
  if (Types.ObjectId.isValid(idOrSlug)) {
    query.$or = [{ _id: idOrSlug }, { slug: idOrSlug.toLowerCase() }];
  } else {
    query.slug = idOrSlug.toLowerCase();
  }

  const doc = await Release.findOne(query).lean();
  if (!doc) throw new ReleaseError("Release not found", 404);
  const releaseDoc = doc as any;

  const tracks = await CopyrightFreeSong.find({
    releaseId: releaseDoc._id,
    visibility: "published",
    "processing.status": "ready",
    moderationStatus: "approved",
  })
    .sort({ discNumber: 1, trackNumber: 1 })
    .lean();

  return shapeReleaseCard(releaseDoc, { tracks, trackCount: tracks.length });
}

export async function listPublicArtistReleases(input: {
  artistId?: string;
  artistSlug?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(input.page || 1, 1);
  const limit = Math.min(Math.max(input.limit || 20, 1), 50);
  const skip = (page - 1) * limit;
  const query: Record<string, unknown> = { status: "published" };
  if (input.artistId && Types.ObjectId.isValid(input.artistId)) {
    query.artistId = new Types.ObjectId(input.artistId);
  } else if (input.artistSlug) {
    query.artistSlug = input.artistSlug.toLowerCase();
  } else {
    throw new ReleaseError("artistId or artistSlug required");
  }

  const [rows, total] = await Promise.all([
    Release.find(query)
      .sort({ releaseDate: -1, publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Release.countDocuments(query),
  ]);

  const releaseIds = rows.map((r: any) => r._id);
  const counts = await CopyrightFreeSong.aggregate([
    {
      $match: {
        releaseId: { $in: releaseIds },
        visibility: "published",
      },
    },
    { $group: { _id: "$releaseId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(
    counts.map((c: any) => [String(c._id), c.count as number])
  );

  return {
    items: rows.map((r: any) =>
      shapeReleaseCard(r, { trackCount: countMap.get(String(r._id)) || 0 })
    ),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function listAdminReleases(input: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const page = Math.max(input.page || 1, 1);
  const limit = Math.min(Math.max(input.limit || 20, 1), 100);
  const skip = (page - 1) * limit;
  const query: Record<string, unknown> = {};
  if (input.status) query.status = input.status;
  if (input.search?.trim()) {
    query.title = new RegExp(input.search.trim(), "i");
  }
  const [rows, total] = await Promise.all([
    Release.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Release.countDocuments(query),
  ]);

  const releaseIds = rows.map((r: any) => r._id);
  const artistIds = [
    ...new Set(
      rows
        .map((r: any) => String(r.artistId || ""))
        .filter((id) => Types.ObjectId.isValid(id))
    ),
  ];

  const [{ Artist }, counts] = await Promise.all([
    import("../../models/artist.model"),
    CopyrightFreeSong.aggregate([
      { $match: { releaseId: { $in: releaseIds } } },
      { $group: { _id: "$releaseId", count: { $sum: 1 } } },
    ]),
  ]);

  const artists = artistIds.length
    ? await Artist.find({
        _id: { $in: artistIds.map((id) => new Types.ObjectId(id)) },
      })
        .select("slug displayName userId")
        .lean()
    : [];

  const countMap = new Map(
    counts.map((c: any) => [String(c._id), c.count as number])
  );
  const artistMap = new Map(
    (artists as any[]).map((a) => [String(a._id), a])
  );

  return {
    items: rows.map((r: any) => {
      const artist = artistMap.get(String(r.artistId));
      const card = shapeReleaseCard(r, {
        trackCount: countMap.get(String(r._id)) || 0,
      });
      return {
        ...card,
        creatorId: r.createdByUserId?.toString?.() || null,
        artistDisplayName: artist?.displayName || null,
        artistSlug: card.artistSlug || artist?.slug || null,
        trackCount: card.trackCount,
        status: card.status,
        updatedAt: card.updatedAt,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function publishDueScheduledReleases(): Promise<{
  published: number;
  ids: string[];
}> {
  const now = new Date();
  const due = await Release.find({
    status: "scheduled",
    scheduledAt: { $lte: now },
  })
    .limit(50)
    .lean();

  const ids: string[] = [];
  for (const row of due as any[]) {
    try {
      const release = await Release.findById(row._id);
      if (!release || release.status !== "scheduled") continue;

      const tracks = await CopyrightFreeSong.find({
        releaseId: release._id,
      }).lean();

      const blocked = tracks.some(
        (t: any) =>
          (t.processing?.status || "") !== "ready" ||
          t.moderationStatus === "rejected" ||
          t.moderationStatus === "pending" ||
          t.moderationStatus === "under_review"
      );
      if (blocked) {
        logger.warn("Scheduled release not ready to publish", {
          releaseId: String(release._id),
          trackCount: tracks.length,
        });
        continue;
      }

      await Promise.all(
        tracks.map((t: any) =>
          CopyrightFreeSong.findByIdAndUpdate(t._id, {
            $set: {
              visibility: "published",
              publishedAt: t.publishedAt || now,
            },
          })
        )
      );

      release.status = "published";
      release.publishedAt = now;
      if (!release.releaseDate) release.releaseDate = now;
      await release.save();
      ids.push(String(release._id));

      void distributionProvider
        .enqueueRelease({
          releaseId: String(release._id),
          targets: [],
        })
        .catch(() => undefined);
    } catch (err: any) {
      logger.error("Failed to auto-publish scheduled release", {
        releaseId: String((row as any)._id),
        error: err?.message,
      });
    }
  }

  if (ids.length) {
    logger.info("Auto-published scheduled releases", {
      count: ids.length,
      ids,
    });
  }

  return { published: ids.length, ids };
}

/** Attach track to release during upload-intent */
export async function assertReleaseOwnedByArtist(
  releaseId: string,
  artistId: string
): Promise<IRelease> {
  if (!Types.ObjectId.isValid(releaseId)) {
    throw new TrackUploadError("Invalid releaseId", 400, "INVALID_RELEASE");
  }
  const release = await Release.findOne({
    _id: releaseId,
    artistId: new Types.ObjectId(artistId),
  });
  if (!release) {
    throw new TrackUploadError("Release not found", 404, "RELEASE_NOT_FOUND");
  }
  if (release.status === "archived") {
    throw new TrackUploadError(
      "Cannot add tracks to an archived release",
      400,
      "RELEASE_ARCHIVED"
    );
  }
  return release;
}

export async function nextTrackNumber(releaseId: string): Promise<number> {
  const last = await CopyrightFreeSong.findOne({
    releaseId: new Types.ObjectId(releaseId),
  })
    .sort({ trackNumber: -1 })
    .select("trackNumber")
    .lean();
  const n = Number((last as any)?.trackNumber || 0);
  return n + 1;
}
