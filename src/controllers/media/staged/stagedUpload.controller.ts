import { Request, Response } from "express";
import {
  createUploadIntent,
  finalizeUploadIntent,
  abortUploadIntent,
  getUploadStatus,
} from "../../../service/media/upload/stagedUpload.service";
import logger from "../../../utils/logger";

export const createStagedUploadIntent = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      title,
      contentType,
      description,
      category,
      topics,
      mimeType,
      sizeBytes,
      checksumSha256,
      thumbnailMimeType,
      thumbnailSizeBytes,
      speaker,
      church,
      scripture,
      series,
      mediaType,
      language,
    } = req.body || {};

    const idempotencyKey =
      (req.headers["idempotency-key"] as string) || req.body?.idempotencyKey;

    const result = await createUploadIntent({
      userId,
      title,
      contentType,
      description,
      category:
        contentType === "sermon" && !category ? "sermons" : category,
      topics,
      mimeType,
      sizeBytes: Number(sizeBytes),
      checksumSha256,
      thumbnailMimeType,
      thumbnailSizeBytes: thumbnailSizeBytes ? Number(thumbnailSizeBytes) : undefined,
      idempotencyKey,
      speaker,
      church,
      scripture,
      series,
      mediaType,
      language,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    logger.error("createStagedUploadIntent failed", { error: error.message });
    res.status(400).json({ success: false, message: error.message });
  }
};

export const finalizeStagedUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { mediaId } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const thumbnail = files?.thumbnail?.[0];

    const result = await finalizeUploadIntent({
      userId,
      mediaId,
      thumbnailBuffer: thumbnail?.buffer,
      thumbnailMimeType: thumbnail?.mimetype,
    });

    res.status(202).json({
      success: true,
      message: "Upload finalized. Processing and moderation queued.",
      data: result,
    });
  } catch (error: any) {
    logger.error("finalizeStagedUpload failed", { error: error.message });
    const status = error.message.includes("authorized")
      ? 403
      : error.message.includes("not found")
        ? 404
        : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

export const abortStagedUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const result = await abortUploadIntent(userId, req.params.mediaId);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getStagedUploadStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.mediaId;

    // FE poll: GET /api/media/upload/:uploadId/status (X-Upload-ID correlation)
    const { uploadProgressService } = await import(
      "../../../service/uploadProgress.service"
    );
    const progress = uploadProgressService.getProgressStatus(id, userId);
    if (progress) {
      res.status(200).json({
        success: true,
        data: {
          uploadId: progress.uploadId,
          progress: progress.progress,
          stage: progress.stage,
          message: progress.message,
          mediaId: progress.mediaId ?? null,
          timestamp: progress.timestamp,
        },
      });
      return;
    }

    const result = await getUploadStatus(userId, id);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.includes("authorized")
      ? 403
      : error.message.includes("not found")
        ? 404
        : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};
