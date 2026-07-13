import { Media } from "../../models/media.model";
import { Types } from "mongoose";
import fileUploadService from "../fileUpload.service";

export class MediaDeleteService {
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

    if (media.fileObjectKey) {
      try {
        await fileUploadService.deleteMedia(media.fileObjectKey);
      } catch (error) {
        console.error("Error deleting media file from R2:", error);
      }
    }

    if (media.thumbnailObjectKey) {
      try {
        await fileUploadService.deleteMedia(media.thumbnailObjectKey);
      } catch (error) {
        console.error("Error deleting thumbnail file from R2:", error);
      }
    }

    await Media.findByIdAndDelete(mediaIdentifier);
    return true;
  }
}

export const mediaDeleteService = new MediaDeleteService();
