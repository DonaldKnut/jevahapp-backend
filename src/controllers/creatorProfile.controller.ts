import { Request, Response } from "express";
import { CreatorProfileError, loadCreatorMe, patchCreatorMe } from "../modules/creators/creatorProfile.service";
import {
  createArtistImageUploadIntent,
  finalizeArtistImage,
} from "../modules/creators/creatorImagery.service";
import { getCreatorAudience } from "../modules/creators/creatorAudience.service";
import logger from "../utils/logger";

function fail(
  res: Response,
  status: number,
  code: string,
  message: string
): void {
  res.status(status).json({
    success: false,
    message,
    code,
    error: { code, message },
  });
}

function handleProfileError(res: Response, error: any, fallback: string): void {
  if (error instanceof CreatorProfileError) {
    fail(res, error.status, error.code, error.message);
    return;
  }
  logger.error(fallback, { error: error?.message });
  fail(res, 500, "INTERNAL_ERROR", fallback);
}

/**
 * GET /api/creators/me
 */
export async function getMyCreatorProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      fail(res, 401, "AUTHENTICATION_REQUIRED", "Unauthorized");
      return;
    }
    const data = await loadCreatorMe(userId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    handleProfileError(res, error, "Failed to load creator profile");
  }
}

/**
 * PATCH /api/creators/me — active + pending artists. Do not fall back to /apply.
 */
export async function patchMyCreatorProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      fail(res, 401, "AUTHENTICATION_REQUIRED", "Unauthorized");
      return;
    }
    const data = await patchCreatorMe(userId, req.body || {});
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    handleProfileError(res, error, "Failed to update creator profile");
  }
}

/**
 * GET /api/creators/me/audience?rangeDays=28
 */
export async function getMyCreatorAudience(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      fail(res, 401, "AUTHENTICATION_REQUIRED", "Unauthorized");
      return;
    }
    const rangeDays = parseInt(String(req.query.rangeDays || "28"), 10);
    const result = await getCreatorAudience(userId, rangeDays);
    if (!result.ok) {
      fail(res, result.status, result.code, result.message);
      return;
    }
    res.status(200).json({ success: true, data: result.data });
  } catch (error: any) {
    handleProfileError(res, error, "Failed to load audience");
  }
}

async function imageIntent(
  req: Request,
  res: Response,
  kind: "avatar" | "banner"
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      fail(res, 401, "AUTHENTICATION_REQUIRED", "Unauthorized");
      return;
    }
    const body = req.body || {};
    const data = await createArtistImageUploadIntent({
      userId,
      kind,
      contentType: body.contentType,
      fileName: body.fileName,
      fileSizeBytes: body.fileSizeBytes != null ? Number(body.fileSizeBytes) : undefined,
    });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    handleProfileError(res, error, `Failed to create ${kind} upload intent`);
  }
}

async function imageFinalize(
  req: Request,
  res: Response,
  kind: "avatar" | "banner"
): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      fail(res, 401, "AUTHENTICATION_REQUIRED", "Unauthorized");
      return;
    }
    const data = await finalizeArtistImage({ userId, kind });
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    handleProfileError(res, error, `Failed to finalize ${kind}`);
  }
}

export const creatorAvatarUploadIntent = (req: Request, res: Response) =>
  imageIntent(req, res, "avatar");
export const creatorAvatarFinalize = (req: Request, res: Response) =>
  imageFinalize(req, res, "avatar");
export const creatorBannerUploadIntent = (req: Request, res: Response) =>
  imageIntent(req, res, "banner");
export const creatorBannerFinalize = (req: Request, res: Response) =>
  imageFinalize(req, res, "banner");
