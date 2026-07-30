import { Request, Response } from "express";
import { Types } from "mongoose";
import { Artist } from "../models/artist.model";
import { CopyrightFreeSong } from "../models/copyrightFreeSong.model";
import {
  shapeArtistCard,
  shapeCreatorMePayload,
} from "../modules/creators/creator.presenter";
import { shapeTrackCard, shapeUploadIntentResponse, publicArtistReadyFilter } from "../modules/audio/track.formatter";
import {
  createTrackUploadIntent,
  finalizeTrackUpload,
  hardDeleteTrack,
  patchTrack,
  TrackUploadError,
} from "../modules/audio/trackUpload.service";
import logger from "../utils/logger";

async function requireActiveArtist(userId: string) {
  const artist = await Artist.findOne({ userId });
  if (!artist) {
    return { error: { status: 404, message: "No creator profile — apply first" } as const };
  }
  if (artist.status !== "active") {
    return {
      error: {
        status: 403,
        message: "Creator must be active to manage catalog",
        code: "CREATOR_NOT_ACTIVE",
      } as const,
    };
  }
  return { artist };
}

function artistPublicTracksFilter(artistId: string) {
  return publicArtistReadyFilter({
    artistId: new Types.ObjectId(artistId),
  });
}

/**
 * GET /api/artists/:slug — public artist profile
 */
export const getPublicArtistBySlug = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase().trim();
    const artist = await Artist.findOne({ slug, status: "active" }).lean();
    if (!artist) {
      res.status(404).json({ success: false, message: "Artist not found" });
      return;
    }
    const artistDoc = artist as any;
    const trackCount = await CopyrightFreeSong.countDocuments(
      artistPublicTracksFilter(artistDoc._id.toString())
    );
    res.status(200).json({
      success: true,
      data: {
        artist: {
          ...shapeArtistCard(artistDoc),
          trackCount,
        },
        // Flat aliases for FE normalizers
        ...shapeArtistCard(artistDoc),
        trackCount,
      },
    });
  } catch (error: any) {
    logger.error("Get public artist error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to load artist" });
  }
};

/**
 * GET /api/artists/:slug/tracks — public artist catalog
 */
export const listPublicArtistTracks = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase().trim();
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      100
    );
    const artist = await Artist.findOne({ slug, status: "active" }).lean();
    if (!artist) {
      res.status(404).json({ success: false, message: "Artist not found" });
      return;
    }
    const artistDoc = artist as any;
    const filter = artistPublicTracksFilter(artistDoc._id.toString());
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      CopyrightFreeSong.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CopyrightFreeSong.countDocuments(filter),
    ]);
    const cards = rows.map((r) =>
      shapeTrackCard({ ...r, artistSlug: artistDoc.slug })
    );
    res.status(200).json({
      success: true,
      data: {
        artist: shapeArtistCard(artistDoc),
        tracks: cards,
        items: cards,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
        total,
      },
    });
  } catch (error: any) {
    logger.error("List artist tracks error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list tracks" });
  }
};

/**
 * GET /api/music/tracks?lane=artist|curated — browse catalog (Spotify-like shelf)
 * Hard shelf: lane=artist never returns curated; prefer /copyright-free for curated.
 */
export const browseMusicTracks = async (req: Request, res: Response) => {
  try {
    const requested = String(req.query.lane || "artist");
    const lane = requested === "curated" ? "curated" : "artist";
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      100
    );
    const search = String(req.query.search || "").trim();
    const genre = String(req.query.genre || "").trim();

    // Artists shelf: strict artist-lane only (never curated beds)
    // Curated browse: allow but CF endpoint remains source of truth for mobile CF tab
    const filter: Record<string, unknown> =
      lane === "artist"
        ? publicArtistReadyFilter()
        : {
            $and: [
              { $or: [{ lane: "curated" }, { lane: { $exists: false } }] },
              { lane: { $ne: "artist" } },
              {
                $or: [
                  { visibility: "published" },
                  { visibility: { $exists: false } },
                ],
              },
              {
                $or: [
                  { "processing.status": "ready" },
                  { processing: { $exists: false } },
                ],
              },
              { fileUrl: { $not: /^pending:\/\// } },
            ],
          };

    const andExtra: Record<string, unknown>[] = [];
    if (genre) {
      andExtra.push({ genre: new RegExp(`^${genre}$`, "i") });
    }
    if (search) {
      andExtra.push({
        $or: [
          { title: new RegExp(search, "i") },
          { artistName: new RegExp(search, "i") },
          { singer: new RegExp(search, "i") },
          { artistSlug: new RegExp(search, "i") },
        ],
      });
    }
    if (andExtra.length) {
      const existingAnd = Array.isArray((filter as any).$and)
        ? (filter as any).$and
        : [];
      (filter as any).$and = [...existingAnd, ...andExtra];
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      CopyrightFreeSong.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CopyrightFreeSong.countDocuments(filter),
    ]);

    const cards = rows.map((r: any) => shapeTrackCard(r));
    res.status(200).json({
      success: true,
      data: {
        lane,
        tracks: cards,
        items: cards,
        total,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("Browse music tracks error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to browse tracks" });
  }
};

/**
 * GET /api/creators/me/tracks — own catalog (includes drafts)
 */
export const listMyCreatorTracks = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const artist = await Artist.findOne({ userId });
    if (!artist) {
      res.status(200).json({
        success: true,
        data: {
          tracks: [],
          items: [],
          total: 0,
          pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        },
      });
      return;
    }
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      100
    );
    const skip = (page - 1) * limit;
    const filter = { artistId: artist._id, lane: "artist" as const };
    const [rows, total] = await Promise.all([
      CopyrightFreeSong.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CopyrightFreeSong.countDocuments(filter),
    ]);
    const cards = rows.map((r: any) =>
      shapeTrackCard({ ...r, artistSlug: artist.slug })
    );
    res.status(200).json({
      success: true,
      data: {
        tracks: cards,
        items: cards,
        total,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("List my creator tracks error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list your tracks" });
  }
};

/**
 * POST /api/creators/tracks/upload-intent — active creators only (reuses Track pipeline)
 */
export const createCreatorTrackUploadIntent = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const gate = await requireActiveArtist(userId);
    if ("error" in gate && gate.error) {
      res.status(gate.error.status).json({
        success: false,
        message: gate.error.message,
        code: (gate.error as any).code,
      });
      return;
    }
    const artist = gate.artist!;
    const body = req.body || {};
    const data = await createTrackUploadIntent({
      adminId: userId,
      title: body.title,
      artistName: body.artistName || artist.displayName,
      category: body.category,
      genre: body.genre,
      language: body.language,
      copyrightStatus: body.copyrightStatus || "original",
      licenseNote: body.licenseNote || "Artist original / licensed to Jevah",
      lane: "artist",
      artistId: artist._id.toString(),
      artistSlug: artist.slug,
      contentType: body.contentType,
      fileName: body.fileName || "audio.mp3",
      fileSizeBytes: Number(body.fileSizeBytes),
      coverContentType: body.coverContentType,
      coverFileName: body.coverFileName,
      coverFileSizeBytes: body.coverFileSizeBytes
        ? Number(body.coverFileSizeBytes)
        : undefined,
    });
    res.status(201).json({
      success: true,
      data: shapeUploadIntentResponse(data as any),
    });
  } catch (error: any) {
    if (error instanceof TrackUploadError) {
      res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }
    logger.error("Creator upload intent error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to create upload intent" });
  }
};

export const finalizeCreatorTrack = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const gate = await requireActiveArtist(userId);
    if ("error" in gate && gate.error) {
      res.status(gate.error.status).json({
        success: false,
        message: gate.error.message,
      });
      return;
    }
    const track = await CopyrightFreeSong.findById(req.params.trackId);
    if (!track || String(track.artistId) !== String(gate.artist!._id)) {
      res.status(404).json({ success: false, message: "Track not found" });
      return;
    }
    // Ensure lane + slug never drift off artist shelf
    track.lane = "artist";
    if (!track.artistSlug) track.artistSlug = gate.artist!.slug;
    await track.save();

    const publish =
      req.body?.publish === false || req.body?.publish === "false"
        ? false
        : true;
    const card = await finalizeTrackUpload(req.params.trackId, userId, {
      publish,
    });
    res.status(200).json({
      success: true,
      data: {
        ...card,
        artistSlug: card.artistSlug || gate.artist!.slug,
        lane: "artist",
      },
    });
  } catch (error: any) {
    if (error instanceof TrackUploadError) {
      res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to finalize track" });
  }
};

export const patchCreatorTrack = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const gate = await requireActiveArtist(userId);
    if ("error" in gate && gate.error) {
      res.status(gate.error.status).json({
        success: false,
        message: gate.error.message,
      });
      return;
    }
    const track = await CopyrightFreeSong.findById(req.params.id);
    if (!track || String(track.artistId) !== String(gate.artist!._id)) {
      res.status(404).json({ success: false, message: "Track not found" });
      return;
    }
    const card = await patchTrack(req.params.id, userId, req.body || {});
    res.status(200).json({ success: true, data: card });
  } catch (error: any) {
    if (error instanceof TrackUploadError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to update track" });
  }
};

export const deleteCreatorTrack = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const gate = await requireActiveArtist(userId);
    if ("error" in gate && gate.error) {
      res.status(gate.error.status).json({
        success: false,
        message: gate.error.message,
      });
      return;
    }
    const track = await CopyrightFreeSong.findById(req.params.id);
    if (!track || String(track.artistId) !== String(gate.artist!._id)) {
      res.status(404).json({ success: false, message: "Track not found" });
      return;
    }
    await hardDeleteTrack(req.params.id, userId);
    res.status(200).json({ success: true, message: "Track deleted" });
  } catch (error: any) {
    if (error instanceof TrackUploadError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: "Failed to delete track" });
  }
};

/** Re-export for apply/me enrichment */
export { shapeCreatorMePayload };

/**
 * GET /api/artists — public directory (scale to 1000+)
 */
export const listPublicArtists = async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      100
    );
    const search = String(req.query.search || "").trim();
    const genre = String(req.query.genre || "").trim();
    const query: Record<string, unknown> = { status: "active" };
    if (search) {
      query.$or = [
        { displayName: new RegExp(search, "i") },
        { slug: new RegExp(search, "i") },
      ];
    }
    if (genre) {
      query.genres = new RegExp(genre, "i");
    }
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      Artist.find(query)
        .sort({ isVerified: -1, displayName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Artist.countDocuments(query),
    ]);
    const items = rows.map((r: any) => shapeArtistCard(r));
    res.status(200).json({
      success: true,
      data: {
        artists: items,
        items,
        total,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error("List public artists error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list artists" });
  }
};

/** Alias play handler for /api/music/tracks/:songId/play */
export const recordMusicTrackPlay = async (req: Request, res: Response) => {
  const { recordPlay } = await import("./copyrightFreeSong/engagement.controller");
  // Normalize param name — music routes use :songId
  return recordPlay(req, res);
};
