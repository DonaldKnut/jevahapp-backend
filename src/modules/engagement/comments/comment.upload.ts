import { Request, Response } from "express";
import fileUploadService from "../../../service/fileUpload.service";
import { ensurePublicR2Url } from "../../../service/fileUpload.service";
import { createImageUpload } from "../../../middleware/imageUpload.middleware";
import logger from "../../../utils/logger";
import { CommentErrors } from "./comment.errors";

/** Bucket key folder — public URL gets `jevah/` via toPublicR2Url. */
export const COMMENT_IMAGE_FOLDER = "comments";

const imageUpload = createImageUpload({ field: "image", maxBytes: 5 * 1024 * 1024 });

export const parseCommentMultipartIfNeeded = imageUpload.parseIfMultipart;
export const commentImageUploadMiddleware = imageUpload.single;

/** @deprecated Use ensurePublicR2Url from fileUpload.service */
export function ensureJevahCommentImageUrl(url: string): string {
  return ensurePublicR2Url(url);
}

export async function uploadCommentImageBuffer(
  file: Express.Multer.File
): Promise<string> {
  const result = await fileUploadService.uploadMedia(
    file.buffer,
    COMMENT_IMAGE_FOLDER,
    file.mimetype
  );

  try {
    await fileUploadService.headObject(result.objectKey);
  } catch (err: any) {
    logger.error("Comment image PutObject succeeded but HeadObject failed", {
      objectKey: result.objectKey,
      error: err?.message,
    });
    throw CommentErrors.uploadFailed();
  }

  // secure_url already goes through generatePublicUrl → toPublicR2Url
  const url = ensurePublicR2Url(result.secure_url);
  if (!url) throw CommentErrors.uploadFailed();
  return url;
}

/** POST /api/content/comments/upload-image */
export const uploadCommentImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({
        success: false,
        message: "No image file provided (field name: image)",
      });
      return;
    }

    const url = await uploadCommentImageBuffer(file);
    logger.info("Comment image uploaded", {
      userId: req.userId,
      url,
      bytes: file.size,
    });

    res.status(200).json({
      success: true,
      data: { url, imageUrl: url },
    });
  } catch (error: any) {
    logger.error("Comment image upload failed", { error: error?.message });
    const status = error?.status || 500;
    res.status(status).json({
      success: false,
      message: error?.code === "UPLOAD_FAILED" ? "UPLOAD_FAILED" : "Failed to upload comment image",
      code: error?.code,
    });
  }
};
