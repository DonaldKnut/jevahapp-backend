import { Types } from "mongoose";
import { execFile } from "child_process";
import { promisify } from "util";
import { CopyrightFreeSong, ICopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import fileUploadService from "../../service/fileUpload.service";
import { AuditService } from "../../service/audit.service";
import { hasFfprobe } from "../../utils/mediaTools";
import logger from "../../utils/logger";
import {
  ALLOWED_AUDIO_MIME,
  ALLOWED_COVER_MIME,
  TRACK_AUDIO_MAX_BYTES,
  TRACK_AUDIO_MULTIPART_MAX_BYTES,
  TRACK_COVER_MAX_BYTES,
  TRACK_MULTIPART_PART_SIZE_BYTES,
  TRACK_MULTIPART_THRESHOLD_BYTES,
  TRACK_PRESIGN_EXPIRES_SEC,
  extFromMime,
  normalizeCategory,
  normalizeGenre,
} from "./track.constants";
import {
  reviewTrackMetadata,
  shouldAutoApproveVerifiedArtist,
} from "./trackReview.service";
import { Artist } from "../../models/artist.model";
import { shapeTrackCard, fromFeVisibility, shapeTrackCardWithRelease } from "./track.formatter";
import { uploadProgressService } from "../../service/uploadProgress.service";

const execFileAsync = promisify(execFile);

export class TrackUploadError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "TrackUploadError";
    this.status = status;
    this.code = code;
  }
}

export interface UploadIntentInput {
  adminId: string;
  title: string;
  artistName: string;
  category?: string;
  genre?: string;
  language?: string;
  copyrightStatus?: string;
  licenseNote?: string;
  lane?: "curated" | "artist";
  artistId?: string | null;
  artistSlug?: string | null;
  contentType: string;
  fileName: string;
  fileSizeBytes: number;
  coverContentType?: string;
  coverFileName?: string;
  coverFileSizeBytes?: number;
  /** Optional release attachment (artist lane) */
  releaseId?: string | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  /** Force R2 multipart (also auto when size ≥ threshold) */
  multipart?: boolean;
}

function trackUploadId(trackId: string): string {
  return `track_${trackId}`;
}

function emitTrackFinalizeProgress(
  userId: string,
  trackId: string,
  progress: number,
  stage: string,
  message: string
): void {
  const uploadId = trackUploadId(trackId);
  uploadProgressService.registerUploadSession(uploadId, userId);
  uploadProgressService.setMediaId(uploadId, trackId);
  uploadProgressService.sendProgress(
    {
      uploadId,
      progress,
      stage,
      message,
      timestamp: new Date().toISOString(),
    },
    userId
  );
}

async function probeDurationSec(url: string): Promise<number | null> {
  if (!(await hasFfprobe())) return null;
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    try {
      const { stdout } = await execFileAsync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          url,
        ],
        { timeout: 90_000 }
      );
      const n = parseFloat(String(stdout).trim());
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    } catch (err: any) {
      logger.warn("ffprobe duration attempt failed for track", {
        attempt: i + 1,
        error: err?.message,
        url: url.slice(0, 120),
      });
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return null;
}

function assertAudioMime(mime: string) {
  if (!ALLOWED_AUDIO_MIME.has(mime.toLowerCase())) {
    throw new TrackUploadError(
      `Unsupported audio type: ${mime}. Allowed: mp3, m4a, wav`,
      400,
      "INVALID_AUDIO_TYPE"
    );
  }
}

function assertCoverMime(mime: string) {
  if (!ALLOWED_COVER_MIME.has(mime.toLowerCase())) {
    throw new TrackUploadError(
      `Unsupported cover type: ${mime}. Allowed: jpeg, png, webp`,
      400,
      "INVALID_COVER_TYPE"
    );
  }
}

export async function createTrackUploadIntent(input: UploadIntentInput) {
  const {
    adminId,
    title,
    artistName,
    contentType,
    fileName,
    fileSizeBytes,
  } = input;

  if (!Types.ObjectId.isValid(adminId)) {
    throw new TrackUploadError("Invalid admin", 401);
  }
  if (!title?.trim() || !artistName?.trim()) {
    throw new TrackUploadError("title and artistName are required");
  }
  assertAudioMime(contentType);
  if (!fileSizeBytes || fileSizeBytes <= 0) {
    throw new TrackUploadError("fileSizeBytes is required");
  }

  const useMultipart =
    input.multipart === true ||
    fileSizeBytes >= TRACK_MULTIPART_THRESHOLD_BYTES;
  const maxBytes = useMultipart
    ? TRACK_AUDIO_MULTIPART_MAX_BYTES
    : TRACK_AUDIO_MAX_BYTES;
  if (fileSizeBytes > maxBytes) {
    throw new TrackUploadError(
      `Audio exceeds ${maxBytes / (1024 * 1024)}MB limit`,
      400,
      "FILE_TOO_LARGE"
    );
  }

  const lane = input.lane === "artist" ? "artist" : "curated";
  if (lane === "artist" && input.artistId && !Types.ObjectId.isValid(input.artistId)) {
    throw new TrackUploadError("Invalid artistId");
  }

  let releaseIdObj: Types.ObjectId | null = null;
  let trackNumber: number | null =
    typeof input.trackNumber === "number" && input.trackNumber > 0
      ? Math.floor(input.trackNumber)
      : null;
  const discNumber =
    typeof input.discNumber === "number" && input.discNumber > 0
      ? Math.floor(input.discNumber)
      : 1;

  if (input.releaseId) {
    if (lane !== "artist") {
      throw new TrackUploadError(
        "releaseId is only supported for artist-lane tracks",
        400,
        "INVALID_RELEASE"
      );
    }
    const {
      assertReleaseOwnedByArtist,
      nextTrackNumber,
    } = await import("./release.service");
    if (!input.artistId) {
      throw new TrackUploadError("artistId required when attaching to a release");
    }
    await assertReleaseOwnedByArtist(input.releaseId, input.artistId);
    releaseIdObj = new Types.ObjectId(input.releaseId);
    if (trackNumber == null) {
      trackNumber = await nextTrackNumber(input.releaseId);
    }
  }

  const trackId = new Types.ObjectId();
  const audioExt = extFromMime(contentType, fileName);
  const audioKey = `audio/${lane}/${trackId.toString()}/original.${audioExt}`;

  let coverKey: string | null = null;
  let coverPutUrl: string | null = null;
  if (input.coverContentType) {
    assertCoverMime(input.coverContentType);
    const coverSize = input.coverFileSizeBytes || 0;
    if (coverSize > TRACK_COVER_MAX_BYTES) {
      throw new TrackUploadError(
        `Cover exceeds ${TRACK_COVER_MAX_BYTES / (1024 * 1024)}MB limit`,
        400,
        "COVER_TOO_LARGE"
      );
    }
    const coverExt = extFromMime(
      input.coverContentType,
      input.coverFileName || "cover.jpg"
    );
    coverKey = `audio/${lane}/${trackId.toString()}/cover.${coverExt}`;
    coverPutUrl = await fileUploadService.getPresignedPutUrl(
      coverKey,
      input.coverContentType,
      coverSize > 0 ? coverSize : undefined,
      TRACK_PRESIGN_EXPIRES_SEC
    );
  }

  let audioPutUrl: string | null = null;
  let multipartUploadId: string | null = null;
  if (useMultipart) {
    const mp = await fileUploadService.createMultipartUpload(
      audioKey,
      contentType
    );
    multipartUploadId = mp.uploadId;
  } else {
    audioPutUrl = await fileUploadService.getPresignedPutUrl(
      audioKey,
      contentType,
      fileSizeBytes,
      TRACK_PRESIGN_EXPIRES_SEC
    );
  }

  const pendingUrl = `pending://${audioKey}`;
  const now = new Date();

  await CopyrightFreeSong.create({
    _id: trackId,
    title: title.trim(),
    singer: artistName.trim(),
    artistName: artistName.trim(),
    uploadedBy: new Types.ObjectId(adminId),
    createdByAdminId: new Types.ObjectId(adminId),
    fileUrl: pendingUrl,
    thumbnailUrl: null,
    category: normalizeCategory(input.category),
    genre: normalizeGenre(input.genre),
    language: input.language?.trim() || null,
    lane,
    visibility: "draft",
    copyrightStatus: input.copyrightStatus || "copyright_free",
    licenseNote: input.licenseNote?.trim() || null,
    artistId:
      lane === "artist" && input.artistId
        ? new Types.ObjectId(input.artistId)
        : null,
    artistSlug:
      lane === "artist" && input.artistSlug
        ? String(input.artistSlug).toLowerCase()
        : null,
    releaseId: releaseIdObj,
    albumId: releaseIdObj,
    trackNumber,
    discNumber: releaseIdObj ? discNumber : null,
    audio: {
      originalKey: audioKey,
      originalUrl: null,
      playbackUrl: pendingUrl,
      format: contentType,
      fileSizeBytes,
      signed: false,
      multipartUploadId,
    },
    artwork: coverKey ? { key: coverKey, url: null } : null,
    processing: {
      status: "pending",
      error: null,
      updatedAt: now,
    },
    likeCount: 0,
    shareCount: 0,
    saveCount: 0,
    viewCount: 0,
    playCount: 0,
    moderationStatus: lane === "artist" ? "pending" : "approved",
    moderationResult: {
      decision: lane === "artist" ? "pending" : "approved",
      reason: lane === "artist" ? "Awaiting finalize review" : "Admin curated",
      source: lane === "artist" ? null : "admin",
      reviewedAt: lane === "artist" ? null : now,
    },
  });

  await AuditService.logAdminAction(adminId, "create_track", trackId.toString(), {
    lane,
    title: title.trim(),
    stage: "upload_intent",
    multipart: useMultipart,
  });

  return {
    trackId: trackId.toString(),
    releaseId: releaseIdObj?.toString() || null,
    trackNumber,
    discNumber: releaseIdObj ? discNumber : null,
    mode: useMultipart ? ("multipart" as const) : ("single" as const),
    audio: {
      putUrl: audioPutUrl,
      key: audioKey,
      headers: { "Content-Type": contentType },
      expiresInSeconds: TRACK_PRESIGN_EXPIRES_SEC,
      mode: useMultipart ? ("multipart" as const) : ("single" as const),
      multipartUploadId,
      partSizeHint: useMultipart ? TRACK_MULTIPART_PART_SIZE_BYTES : null,
    },
    cover: coverKey
      ? {
          putUrl: coverPutUrl,
          key: coverKey,
          headers: { "Content-Type": input.coverContentType },
          expiresInSeconds: TRACK_PRESIGN_EXPIRES_SEC,
        }
      : null,
  };
}

export async function finalizeTrackUpload(
  trackId: string,
  adminId: string,
  opts: { publish?: boolean } = {}
) {
  if (!Types.ObjectId.isValid(trackId)) {
    throw new TrackUploadError("Invalid track id");
  }

  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);

  const audioKey = track.audio?.originalKey;
  if (!audioKey) {
    throw new TrackUploadError("Track has no audio key — create via upload-intent");
  }

  if (track.audio?.multipartUploadId) {
    throw new TrackUploadError(
      "Multipart upload still open — complete or abort it before finalize",
      400,
      "MULTIPART_INCOMPLETE"
    );
  }

  emitTrackFinalizeProgress(
    adminId,
    trackId,
    5,
    "processing",
    "Finalize started"
  );

  track.processing = {
    ...(track.processing || { status: "pending" }),
    status: "processing",
    error: null,
    updatedAt: new Date(),
  };
  await track.save();

  try {
    emitTrackFinalizeProgress(
      adminId,
      trackId,
      25,
      "processing",
      "Verifying audio in storage"
    );
    const head = await fileUploadService.headObject(audioKey);
    const size = Number(head.ContentLength || track.audio?.fileSizeBytes || 0);
    const playbackUrl = fileUploadService.generatePublicUrl(audioKey);

    let coverUrl: string | null = track.thumbnailUrl || null;
    const coverKey = track.artwork?.key;
    if (coverKey) {
      try {
        await fileUploadService.headObject(coverKey);
        coverUrl = fileUploadService.generatePublicUrl(coverKey);
      } catch {
        logger.warn("Cover object missing on finalize", { trackId, coverKey });
      }
    }

    emitTrackFinalizeProgress(
      adminId,
      trackId,
      55,
      "processing",
      "Probing duration"
    );
    const durationSec = await probeDurationSec(playbackUrl);

    track.fileUrl = playbackUrl;
    track.thumbnailUrl = coverUrl;
    track.duration = durationSec;
    track.durationSec = durationSec;
    track.audio = {
      ...(track.audio || {}),
      originalKey: audioKey,
      originalUrl: playbackUrl,
      playbackUrl,
      format: track.audio?.format || head.ContentType || null,
      fileSizeBytes: size || track.audio?.fileSizeBytes || null,
      signed: false,
      expiresInSeconds: null,
      multipartUploadId: null,
    };
    if (coverKey) {
      track.artwork = { key: coverKey, url: coverUrl };
    }
    track.processing = {
      status: "ready",
      error: null,
      waveformUrl: null,
      updatedAt: new Date(),
    };

    const publish = opts.publish !== false;
    const wantsPublic = publish;

    // Curated admin uploads: auto-approved. Artist lane: AI + admin gate.
    if (track.lane === "artist") {
      emitTrackFinalizeProgress(
        adminId,
        trackId,
        75,
        "verifying",
        "Running content review"
      );
      let decision: "approved" | "under_review" | "rejected" = "under_review";
      let reason = "Queued for admin review";
      let source: string = "fail_open";

      let isVerified = false;
      if (track.artistId) {
        const artist = await Artist.findById(track.artistId)
          .select("isVerified")
          .lean();
        isVerified = Boolean((artist as any)?.isVerified);
      }

      if (shouldAutoApproveVerifiedArtist(isVerified)) {
        decision = "approved";
        reason = "Auto-approved verified artist";
        source = "auto_verified";
      } else {
        const ai = await reviewTrackMetadata({
          title: track.title,
          artistName: track.artistName || track.singer,
          genre: track.genre,
          category: track.category,
          licenseNote: track.licenseNote,
        });
        decision = ai.decision;
        reason = ai.reason;
        source = ai.source;
      }

      track.moderationStatus = decision;
      track.moderationResult = {
        decision,
        reason,
        source,
        reviewedAt: decision === "approved" ? new Date() : null,
        reviewedByAdminId: null,
      };

      // Public Artists shelf only if approved. Studio still sees published drafts via me/tracks.
      if (wantsPublic && decision === "approved") {
        track.visibility = "published";
        track.publishedAt = track.publishedAt || new Date();
      } else if (wantsPublic && decision === "under_review") {
        // Visible in studio as "public" intent but not on public shelf until approved
        track.visibility = "published";
        track.publishedAt = track.publishedAt || new Date();
      } else if (decision === "rejected") {
        track.visibility = "draft";
      } else if (!wantsPublic) {
        track.visibility = "draft";
      }
    } else {
      track.moderationStatus = "approved";
      track.moderationResult = {
        decision: "approved",
        reason: "Admin curated upload",
        source: "admin",
        reviewedAt: new Date(),
        reviewedByAdminId: new Types.ObjectId(adminId),
      };
      if (wantsPublic) {
        track.visibility = "published";
        track.publishedAt = new Date();
      }
    }

    emitTrackFinalizeProgress(
      adminId,
      trackId,
      95,
      "finalizing",
      "Saving track"
    );
    await track.save();

    await AuditService.logAdminAction(adminId, "finalize_track", trackId, {
      publish: wantsPublic,
      durationSec,
      audioKey,
      moderationStatus: track.moderationStatus,
      lane: track.lane,
    });

    emitTrackFinalizeProgress(
      adminId,
      trackId,
      100,
      "complete",
      "Track ready"
    );
    uploadProgressService.clearUploadSession(trackUploadId(trackId), 120_000);

    return shapeTrackCardWithRelease(track.toObject());
  } catch (err: any) {
    track.processing = {
      status: "failed",
      error: err?.message || "Finalize failed",
      updatedAt: new Date(),
    };
    await track.save().catch(() => undefined);

    emitTrackFinalizeProgress(
      adminId,
      trackId,
      0,
      "error",
      err?.message || "Finalize failed"
    );
    uploadProgressService.clearUploadSession(trackUploadId(trackId), 60_000);

    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      throw new TrackUploadError(
        "Audio object not found in storage — complete the presigned PUT first",
        400,
        "OBJECT_MISSING"
      );
    }
    if (err instanceof TrackUploadError) throw err;
    throw new TrackUploadError(
      err?.message || "Failed to finalize track",
      500,
      "FINALIZE_FAILED"
    );
  }
}

export async function createReplaceAudioIntent(
  trackId: string,
  adminId: string,
  input: { contentType: string; fileName: string; fileSizeBytes: number }
) {
  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);
  assertAudioMime(input.contentType);
  if (input.fileSizeBytes > TRACK_AUDIO_MAX_BYTES) {
    throw new TrackUploadError("Audio file too large", 400, "FILE_TOO_LARGE");
  }

  const lane = track.lane || "curated";
  const ext = extFromMime(input.contentType, input.fileName);
  const key = `audio/${lane}/${trackId}/original.${ext}`;
  const putUrl = await fileUploadService.getPresignedPutUrl(
    key,
    input.contentType,
    input.fileSizeBytes,
    TRACK_PRESIGN_EXPIRES_SEC
  );

  track.audio = {
    ...(track.audio || {}),
    originalKey: key,
    format: input.contentType,
    fileSizeBytes: input.fileSizeBytes,
  };
  track.processing = {
    status: "pending",
    error: null,
    updatedAt: new Date(),
  };
  await track.save();

  await AuditService.logAdminAction(adminId, "replace_track_audio_intent", trackId, {
    key,
  });

  return {
    trackId,
    audio: {
      putUrl,
      key,
      headers: { "Content-Type": input.contentType },
      expiresInSeconds: TRACK_PRESIGN_EXPIRES_SEC,
    },
  };
}

export async function createReplaceCoverIntent(
  trackId: string,
  adminId: string,
  input: { contentType: string; fileName: string; fileSizeBytes?: number }
) {
  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);
  assertCoverMime(input.contentType);
  const size = input.fileSizeBytes || 0;
  if (size > TRACK_COVER_MAX_BYTES) {
    throw new TrackUploadError("Cover too large", 400, "COVER_TOO_LARGE");
  }

  const lane = track.lane || "curated";
  const ext = extFromMime(input.contentType, input.fileName || "cover.jpg");
  const key = `audio/${lane}/${trackId}/cover.${ext}`;
  const putUrl = await fileUploadService.getPresignedPutUrl(
    key,
    input.contentType,
    size > 0 ? size : undefined,
    TRACK_PRESIGN_EXPIRES_SEC
  );

  track.artwork = { ...(track.artwork || {}), key, url: track.artwork?.url || null };
  await track.save();

  await AuditService.logAdminAction(adminId, "replace_track_cover_intent", trackId, {
    key,
  });

  return {
    trackId,
    cover: {
      putUrl,
      key,
      headers: { "Content-Type": input.contentType },
      expiresInSeconds: TRACK_PRESIGN_EXPIRES_SEC,
    },
  };
}

export async function finalizeReplaceCover(trackId: string, adminId: string) {
  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);
  const key = track.artwork?.key;
  if (!key) throw new TrackUploadError("No cover key on track");
  await fileUploadService.headObject(key);
  const url = fileUploadService.generatePublicUrl(key);
  track.artwork = { key, url };
  track.thumbnailUrl = url;
  await track.save();
  await AuditService.logAdminAction(adminId, "replace_track_cover", trackId, { key });
  return shapeTrackCard(track.toObject());
}

export async function hardDeleteTrack(trackId: string, adminId: string) {
  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);

  const keys = [
    track.audio?.originalKey,
    track.artwork?.key,
  ].filter(Boolean) as string[];

  for (const key of keys) {
    try {
      await fileUploadService.deleteMedia(key);
    } catch (err: any) {
      logger.warn("R2 delete failed during track delete", {
        trackId,
        key,
        error: err?.message,
      });
    }
  }

  await CopyrightFreeSong.findByIdAndDelete(trackId);
  await AuditService.logAdminAction(adminId, "delete_track", trackId, {
    keys,
    title: track.title,
  });
  return true;
}

export async function patchTrack(
  trackId: string,
  adminId: string,
  body: Record<string, unknown>
) {
  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);

  const artistName =
    (body.artistName as string) || (body.singer as string) || undefined;
  if (typeof body.title === "string" && body.title.trim()) {
    track.title = body.title.trim();
  }
  if (artistName?.trim()) {
    track.singer = artistName.trim();
    track.artistName = artistName.trim();
  }
  if (body.category !== undefined) {
    track.category = normalizeCategory(body.category as string);
  }
  if (body.genre !== undefined) {
    track.genre = normalizeGenre(body.genre as string);
  }
  if (body.language !== undefined) {
    track.language = (body.language as string)?.trim() || null;
  }
  if (body.licenseNote !== undefined) {
    track.licenseNote = (body.licenseNote as string)?.trim() || null;
  }
  if (body.copyrightStatus !== undefined) {
    track.copyrightStatus = body.copyrightStatus as any;
  }
  if (body.publish === true) {
    track.visibility = "published";
    if (!track.publishedAt) track.publishedAt = new Date();
  } else if (body.publish === false) {
    track.visibility = "draft";
  }

  if (body.visibility !== undefined) {
    const mapped = fromFeVisibility(String(body.visibility));
    if (!mapped) {
      throw new TrackUploadError("Invalid visibility (use public|draft|archived)");
    }
    track.visibility = mapped;
    if (mapped === "published" && !track.publishedAt) {
      track.publishedAt = new Date();
    }
  }

  // Never allow creator/artist tracks to leave artist lane
  if (track.lane === "artist") {
    track.lane = "artist";
  }

  await track.save();
  await AuditService.logAdminAction(adminId, "update_track", trackId, {
    fields: Object.keys(body),
  });
  return shapeTrackCardWithRelease(track.toObject());
}

/** Poll finalize / processing state (socket fallback). */
export async function getTrackUploadStatus(trackId: string, userId: string) {
  if (!Types.ObjectId.isValid(trackId)) {
    throw new TrackUploadError("Invalid track id");
  }
  const track = await CopyrightFreeSong.findById(trackId)
    .select(
      "processing moderationStatus moderationResult visibility audio.multipartUploadId audio.originalKey"
    )
    .lean();
  if (!track) throw new TrackUploadError("Track not found", 404);

  const processingStatus = (track as any).processing?.status || "pending";
  const socket = uploadProgressService.getProgressStatus(
    trackUploadId(trackId),
    userId
  );

  return {
    trackId,
    uploadId: trackUploadId(trackId),
    processingStatus,
    processingError: (track as any).processing?.error || null,
    processingUpdatedAt: (track as any).processing?.updatedAt || null,
    moderationStatus: (track as any).moderationStatus || null,
    visibility: (track as any).visibility || null,
    multipartOpen: Boolean((track as any).audio?.multipartUploadId),
    multipartUploadId: (track as any).audio?.multipartUploadId || null,
    progress: socket
      ? {
          progress: socket.progress,
          stage: socket.stage,
          message: socket.message,
          timestamp: socket.timestamp,
        }
      : null,
  };
}

export async function signTrackMultipartParts(
  trackId: string,
  partNumbers: number[]
) {
  if (!Types.ObjectId.isValid(trackId)) {
    throw new TrackUploadError("Invalid track id");
  }
  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);

  const key = track.audio?.originalKey;
  const uploadId = track.audio?.multipartUploadId;
  if (!key || !uploadId) {
    throw new TrackUploadError(
      "No open multipart upload for this track",
      400,
      "MULTIPART_MISSING"
    );
  }

  const nums = [
    ...new Set(
      (partNumbers || [])
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 10_000)
    ),
  ].sort((a, b) => a - b);

  if (!nums.length) {
    throw new TrackUploadError("partNumbers required", 400, "INVALID_PARTS");
  }
  if (nums.length > 100) {
    throw new TrackUploadError("Request at most 100 parts at a time", 400);
  }

  const parts = await Promise.all(
    nums.map(async (partNumber) => ({
      partNumber,
      putUrl: await fileUploadService.getPresignedUploadPartUrl(
        key,
        uploadId,
        partNumber,
        TRACK_PRESIGN_EXPIRES_SEC
      ),
      headers: {},
      expiresInSeconds: TRACK_PRESIGN_EXPIRES_SEC,
    }))
  );

  return {
    trackId,
    key,
    multipartUploadId: uploadId,
    partSizeHint: TRACK_MULTIPART_PART_SIZE_BYTES,
    parts,
  };
}

export async function completeTrackMultipartUpload(
  trackId: string,
  parts: Array<{ PartNumber?: number; partNumber?: number; ETag?: string; etag?: string }>
) {
  if (!Types.ObjectId.isValid(trackId)) {
    throw new TrackUploadError("Invalid track id");
  }
  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);

  const key = track.audio?.originalKey;
  const uploadId = track.audio?.multipartUploadId;
  if (!key || !uploadId) {
    throw new TrackUploadError(
      "No open multipart upload for this track",
      400,
      "MULTIPART_MISSING"
    );
  }

  const normalized = (parts || [])
    .map((p) => ({
      PartNumber: Math.floor(Number(p.PartNumber ?? p.partNumber)),
      ETag: String(p.ETag ?? p.etag ?? "").trim(),
    }))
    .filter((p) => p.PartNumber >= 1 && p.ETag);

  if (!normalized.length) {
    throw new TrackUploadError(
      "parts with PartNumber + ETag required",
      400,
      "INVALID_PARTS"
    );
  }

  try {
    await fileUploadService.completeMultipartUpload(key, uploadId, normalized);
  } catch (err: any) {
    throw new TrackUploadError(
      err?.message || "Failed to complete multipart upload",
      400,
      "MULTIPART_COMPLETE_FAILED"
    );
  }

  track.audio = {
    ...(track.audio || {}),
    multipartUploadId: null,
  };
  await track.save();

  return {
    trackId,
    key,
    readyForFinalize: true,
  };
}

export async function abortTrackMultipartUpload(trackId: string) {
  if (!Types.ObjectId.isValid(trackId)) {
    throw new TrackUploadError("Invalid track id");
  }
  const track = await CopyrightFreeSong.findById(trackId);
  if (!track) throw new TrackUploadError("Track not found", 404);

  const key = track.audio?.originalKey;
  const uploadId = track.audio?.multipartUploadId;
  if (key && uploadId) {
    try {
      await fileUploadService.abortMultipartUpload(key, uploadId);
    } catch (err: any) {
      logger.warn("Abort multipart failed", {
        trackId,
        error: err?.message,
      });
    }
  }

  track.audio = {
    ...(track.audio || {}),
    multipartUploadId: null,
  };
  await track.save();

  return { trackId, aborted: true };
}

export type { ICopyrightFreeSong };
