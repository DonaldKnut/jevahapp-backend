import { Media } from "../../models/media.model";
import { Types } from "mongoose";
import fileUploadService from "../fileUpload.service";
import logger from "../../utils/logger";

/**
 * Collect every known R2 object key for a media document so cascade delete
 * can remove versioned derivatives, not just the primary file + thumbnail.
 */
export function collectMediaObjectKeys(media: {
  fileObjectKey?: string | null;
  thumbnailObjectKey?: string | null;
  derivativeKeys?: string[] | null;
  uploadIntent?: {
    stagingKey?: string | null;
    thumbnailStagingKey?: string | null;
  } | null;
}): string[] {
  const keys = new Set<string>();
  if (media.fileObjectKey) keys.add(media.fileObjectKey);
  if (media.thumbnailObjectKey) keys.add(media.thumbnailObjectKey);
  for (const key of media.derivativeKeys || []) {
    if (key) keys.add(key);
  }
  const stagingKey = media.uploadIntent?.stagingKey;
  if (stagingKey?.startsWith("staging/")) keys.add(stagingKey);
  const thumbStaging = media.uploadIntent?.thumbnailStagingKey;
  if (thumbStaging?.startsWith("staging/")) keys.add(thumbStaging);
  return [...keys];
}

export class MediaDeleteService {
  /**
   * Soft-delete: hide from public feeds; keep DB + R2 for audit / restore.
   * Sets isHidden, publicationState=tombstoned, deletedAt.
   */
  async softDeleteMedia(
    mediaIdentifier: string,
    userIdentifier: string,
    userRole: string
  ) {
    if (!Types.ObjectId.isValid(mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    if (
      media.uploadedBy.toString() !== userIdentifier &&
      userRole !== "admin"
    ) {
      throw new Error("Unauthorized to delete this media");
    }

    (media as any).isHidden = true;
    (media as any).publicationState = "tombstoned";
    (media as any).deletedAt = new Date();
    await media.save();
    return true;
  }

  async deleteMedia(
    mediaIdentifier: string,
    userIdentifier: string,
    userRole: string
  ) {
    if (!Types.ObjectId.isValid(mediaIdentifier)) {
      throw new Error("Invalid media identifier");
    }

    const media = await Media.findById(mediaIdentifier);
    if (!media) {
      throw new Error("Media not found");
    }

    if (
      media.uploadedBy.toString() !== userIdentifier &&
      userRole !== "admin"
    ) {
      throw new Error("Unauthorized to delete this media");
    }

    const keys = collectMediaObjectKeys(media as any);
    await Promise.all(
      keys.map(objectKey =>
        fileUploadService.deleteMedia(objectKey).catch((error: any) => {
          logger.warn("Error deleting media object from R2", {
            mediaId: mediaIdentifier,
            objectKey,
            storagePrefix: (media as any).storagePrefix,
            error: error?.message,
          });
        })
      )
    );

    await Media.findByIdAndDelete(mediaIdentifier);
    return true;
  }
}

export const mediaDeleteService = new MediaDeleteService();
