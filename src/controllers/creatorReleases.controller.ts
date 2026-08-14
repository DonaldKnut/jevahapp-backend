import { Request, Response } from "express";
import { Artist } from "../models/artist.model";
import {
  archiveRelease,
  createRelease,
  createReleaseCoverUploadIntent,
  finalizeReleaseCover,
  getReleaseForArtist,
  listAdminReleases,
  listCreatorReleases,
  listPublicArtistReleases,
  getPublicRelease,
  patchRelease,
  publishRelease,
  reorderReleaseTracks,
  unlinkTrackFromRelease,
  ReleaseError,
} from "../modules/audio/release.service";
import logger from "../utils/logger";

async function requireActiveArtist(userId: string) {
  const artist = await Artist.findOne({ userId });
  if (!artist) {
    return {
      error: {
        status: 404,
        message: "No creator profile — apply first",
        code: "NOT_A_CREATOR",
      } as const,
    };
  }
  if (artist.status !== "active") {
    return {
      error: {
        status: 403,
        message: "Creator must be active to manage releases",
        code: "CREATOR_NOT_ACTIVE",
      } as const,
    };
  }
  return { artist };
}

function sendReleaseError(res: Response, error: any) {
  if (error instanceof ReleaseError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      code: error.code,
      error: { code: error.code, message: error.message },
      ...(error.data !== undefined ? { data: error.data } : {}),
    });
    return true;
  }
  return false;
}

/** POST /api/creators/releases */
export const createCreatorRelease = async (req: Request, res: Response) => {
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
    const body = req.body || {};
    const data = await createRelease({
      userId,
      artistId: gate.artist!._id.toString(),
      artistSlug: gate.artist!.slug,
      title: body.title,
      type: body.type,
      description: body.description,
      label: body.label,
      upc: body.upc,
      releaseDate: body.releaseDate,
    });
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    logger.error("Create release error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to create release" });
  }
};

/** GET /api/creators/releases */
export const listCreatorReleasesHandler = async (
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
      });
      return;
    }
    const data = await listCreatorReleases({
      artistId: gate.artist!._id.toString(),
      page: parseInt(String(req.query.page || "1"), 10),
      limit: parseInt(String(req.query.limit || "20"), 10),
      status: req.query.status ? String(req.query.status) : undefined,
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    logger.error("List creator releases error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list releases" });
  }
};

/** GET /api/creators/releases/:id */
export const getCreatorRelease = async (req: Request, res: Response) => {
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
    const data = await getReleaseForArtist(
      req.params.id,
      gate.artist!._id.toString()
    );
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res.status(500).json({ success: false, message: "Failed to load release" });
  }
};

/** PATCH /api/creators/releases/:id */
export const patchCreatorRelease = async (req: Request, res: Response) => {
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
    const data = await patchRelease(
      req.params.id,
      gate.artist!._id.toString(),
      userId,
      req.body || {}
    );
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res.status(500).json({ success: false, message: "Failed to update release" });
  }
};

/** POST /api/creators/releases/:id/cover/upload-intent */
export const creatorReleaseCoverIntent = async (
  req: Request,
  res: Response
) => {
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
    const body = req.body || {};
    const data = await createReleaseCoverUploadIntent({
      releaseId: req.params.id,
      artistId: gate.artist!._id.toString(),
      contentType: body.contentType,
      fileName: body.fileName,
      fileSizeBytes: body.fileSizeBytes
        ? Number(body.fileSizeBytes)
        : undefined,
    });
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res
      .status(500)
      .json({ success: false, message: "Failed to create cover upload intent" });
  }
};

/** POST /api/creators/releases/:id/cover/finalize */
export const creatorReleaseCoverFinalize = async (
  req: Request,
  res: Response
) => {
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
    const data = await finalizeReleaseCover(
      req.params.id,
      gate.artist!._id.toString()
    );
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res
      .status(500)
      .json({ success: false, message: "Failed to finalize cover" });
  }
};

/** POST /api/creators/releases/:id/tracks/reorder */
export const reorderCreatorReleaseTracks = async (
  req: Request,
  res: Response
) => {
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
    const orderedTrackIds =
      req.body?.orderedTrackIds || req.body?.trackIds || [];
    const data = await reorderReleaseTracks({
      releaseId: req.params.id,
      artistId: gate.artist!._id.toString(),
      orderedTrackIds: Array.isArray(orderedTrackIds) ? orderedTrackIds : [],
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res
      .status(500)
      .json({ success: false, message: "Failed to reorder tracks" });
  }
};

/** POST /api/creators/releases/:id/publish */
export const publishCreatorRelease = async (req: Request, res: Response) => {
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
    const body = req.body || {};
    const data = await publishRelease({
      releaseId: req.params.id,
      artistId: gate.artist!._id.toString(),
      userId,
      scheduledAt: body.scheduledAt,
      skipTypeHints:
        body.skipTypeHints === true || body.skipTypeHints === "true",
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res
      .status(500)
      .json({ success: false, message: "Failed to publish release" });
  }
};

/** DELETE /api/creators/releases/:releaseId/tracks/:trackId */
export const unlinkCreatorReleaseTrack = async (
  req: Request,
  res: Response
) => {
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
    const deleteTrack =
      req.query.deleteTrack === "true" ||
      req.query.deleteTrack === "1" ||
      req.body?.deleteTrack === true;
    const data = await unlinkTrackFromRelease({
      releaseId: req.params.id || req.params.releaseId,
      trackId: req.params.trackId,
      artistId: gate.artist!._id.toString(),
      userId,
      deleteTrack,
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    logger.error("Unlink release track error", { error: error.message });
    res
      .status(500)
      .json({ success: false, message: "Failed to unlink track" });
  }
};

/** DELETE /api/creators/releases/:id */
export const deleteCreatorRelease = async (req: Request, res: Response) => {
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
    const data = await archiveRelease(
      req.params.id,
      gate.artist!._id.toString(),
      userId
    );
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res
      .status(500)
      .json({ success: false, message: "Failed to delete release" });
  }
};

/** GET /api/music/releases/:idOrSlug */
export const getPublicReleaseHandler = async (req: Request, res: Response) => {
  try {
    const data = await getPublicRelease(req.params.idOrSlug);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res.status(500).json({ success: false, message: "Failed to load release" });
  }
};

/** GET /api/artists/:slug/releases */
export const listPublicArtistReleasesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const artist = await Artist.findOne({ slug }).select("_id slug").lean();
    if (!artist) {
      res.status(404).json({ success: false, message: "Artist not found" });
      return;
    }
    const data = await listPublicArtistReleases({
      artistId: String((artist as any)._id),
      artistSlug: (artist as any).slug,
      page: parseInt(String(req.query.page || "1"), 10),
      limit: parseInt(String(req.query.limit || "20"), 10),
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    if (sendReleaseError(res, error)) return;
    res
      .status(500)
      .json({ success: false, message: "Failed to list artist releases" });
  }
};

/** GET /api/admin/releases — read-only */
export const listAdminReleasesHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const data = await listAdminReleases({
      page: parseInt(String(req.query.page || "1"), 10),
      limit: parseInt(String(req.query.limit || "20"), 10),
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error("Admin list releases error", { error: error.message });
    res.status(500).json({ success: false, message: "Failed to list releases" });
  }
};
