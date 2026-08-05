import { Request, Response } from "express";
import { Types } from "mongoose";
import { CopyrightFreeSong } from "../models/copyrightFreeSong.model";
import {
  createTrackUploadIntent,
  finalizeTrackUpload,
  createReplaceAudioIntent,
  createReplaceCoverIntent,
  finalizeReplaceCover,
  hardDeleteTrack,
  patchTrack,
  TrackUploadError,
} from "../modules/audio/trackUpload.service";
import { shapeTrackCard, shapeUploadIntentResponse } from "../modules/audio/track.formatter";
import {
  TRACK_CATEGORIES,
  TRACK_GENRES,
} from "../modules/audio/track.constants";
import logger from "../utils/logger";

function handleTrackError(res: Response, error: any, fallback: string) {
  if (error instanceof TrackUploadError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
    });
    return;
  }
  logger.error(fallback, { error: error?.message });
  res.status(500).json({ success: false, message: fallback });
}

/**
 * GET /api/admin/audio/tracks
 */
export const listAdminTracks = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      100
    );
    const lane = (req.query.lane as string) || "curated";
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const visibility = String(req.query.visibility || "").trim();
    const moderationStatus = String(req.query.moderationStatus || "").trim();

    const query: Record<string, unknown> = {};
    if (lane === "curated" || lane === "artist") query.lane = lane;
    if (category) query.category = new RegExp(category, "i");
    if (visibility) query.visibility = visibility === "public" ? "published" : visibility;
    if (moderationStatus) query.moderationStatus = moderationStatus;
    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { singer: new RegExp(search, "i") },
        { artistName: new RegExp(search, "i") },
      ];
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      CopyrightFreeSong.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CopyrightFreeSong.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: rows.map((r) => shapeTrackCard(r)),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
        meta: {
          categories: TRACK_CATEGORIES,
          genres: TRACK_GENRES,
        },
      },
    });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to list tracks");
  }
};

/**
 * GET /api/admin/audio/tracks/:id
 */
export const getAdminTrack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid track id" });
      return;
    }
    const doc = await CopyrightFreeSong.findById(id).lean();
    if (!doc) {
      res.status(404).json({ success: false, message: "Track not found" });
      return;
    }
    res.status(200).json({ success: true, data: shapeTrackCard(doc) });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to get track");
  }
};

/**
 * POST /api/admin/audio/tracks/upload-intent
 */
export const createAdminTrackUploadIntent = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const body = req.body || {};
    const data = await createTrackUploadIntent({
      adminId,
      title: body.title,
      artistName: body.artistName || body.singer,
      category: body.category,
      genre: body.genre,
      language: body.language,
      copyrightStatus: body.copyrightStatus,
      licenseNote: body.licenseNote,
      lane: body.lane,
      artistId: body.artistId,
      contentType: body.contentType,
      fileName: body.fileName || "audio.mp3",
      fileSizeBytes: Number(body.fileSizeBytes),
      coverContentType: body.coverContentType,
      coverFileName: body.coverFileName,
      coverFileSizeBytes: body.coverFileSizeBytes
        ? Number(body.coverFileSizeBytes)
        : undefined,
      multipart:
        body.multipart === true ||
        body.multipart === "true" ||
        body.mode === "multipart",
    });
    res.status(201).json({
      success: true,
      data: shapeUploadIntentResponse(data as any),
    });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to create upload intent");
  }
};

/**
 * POST /api/admin/audio/tracks/:trackId/finalize
 */
export const finalizeAdminTrack = async (req: Request, res: Response) => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const card = await finalizeTrackUpload(req.params.trackId, adminId, {
      publish: req.body?.publish !== false,
    });
    res.status(200).json({ success: true, data: card });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to finalize track");
  }
};

export const patchAdminTrack = async (req: Request, res: Response) => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const card = await patchTrack(req.params.id, adminId, req.body || {});
    res.status(200).json({ success: true, data: card });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to update track");
  }
};

export const deleteAdminTrack = async (req: Request, res: Response) => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    await hardDeleteTrack(req.params.id, adminId);
    res.status(200).json({ success: true, message: "Track deleted" });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to delete track");
  }
};

/**
 * PATCH /api/admin/audio/tracks/:id/moderation
 * Body: { status: "approved"|"rejected"|"under_review", reason? }
 * Approving puts track on public Artists shelf (if visibility published + ready).
 */
export const reviewAdminTrackModeration = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid track id" });
      return;
    }
    const status = String(req.body?.status || "").toLowerCase();
    if (!["approved", "rejected", "under_review"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "status must be approved|rejected|under_review",
      });
      return;
    }
    const track = await CopyrightFreeSong.findById(id);
    if (!track) {
      res.status(404).json({ success: false, message: "Track not found" });
      return;
    }
    track.moderationStatus = status as any;
    track.moderationResult = {
      decision: status,
      reason: String(req.body?.reason || `Admin ${status}`).slice(0, 500),
      source: "admin",
      reviewedAt: new Date(),
      reviewedByAdminId: new Types.ObjectId(adminId),
    };
    if (status === "approved" && track.visibility === "published" && !track.publishedAt) {
      track.publishedAt = new Date();
    }
    if (status === "rejected") {
      track.visibility = "draft";
    }
    await track.save();

    const { AuditService } = await import("../service/audit.service");
    await AuditService.logAdminAction(adminId, "review_track_moderation", id, {
      status,
      lane: track.lane,
    });

    res.status(200).json({ success: true, data: shapeTrackCard(track.toObject()) });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to review track");
  }
};

export const replaceAdminTrackAudioIntent = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = req.userId!;
    const data = await createReplaceAudioIntent(req.params.id, adminId, {
      contentType: req.body.contentType,
      fileName: req.body.fileName || "audio.mp3",
      fileSizeBytes: Number(req.body.fileSizeBytes),
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to create replace-audio intent");
  }
};

export const finalizeAdminTrackAudioReplace = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = req.userId!;
    const card = await finalizeTrackUpload(req.params.id, adminId, {
      publish: req.body?.publish !== false,
    });
    res.status(200).json({ success: true, data: card });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to finalize replace-audio");
  }
};

export const replaceAdminTrackCoverIntent = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = req.userId!;
    const data = await createReplaceCoverIntent(req.params.id, adminId, {
      contentType: req.body.contentType,
      fileName: req.body.fileName || "cover.jpg",
      fileSizeBytes: req.body.fileSizeBytes
        ? Number(req.body.fileSizeBytes)
        : undefined,
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to create replace-cover intent");
  }
};

export const finalizeAdminTrackCoverReplace = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = req.userId!;
    const card = await finalizeReplaceCover(req.params.id, adminId);
    res.status(200).json({ success: true, data: card });
  } catch (error: any) {
    handleTrackError(res, error, "Failed to finalize replace-cover");
  }
};
