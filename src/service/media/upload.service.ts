import { Types } from "mongoose";
import { Media, IMedia } from "../../models/media.model";
import { User } from "../../models/user.model";
import fileUploadService from "../fileUpload.service";
import { MediaInput } from "./types";

export class MediaUploadService {
  async uploadMedia(data: MediaInput): Promise<IMedia> {
    const validMimeTypes: { [key in MediaInput["contentType"]]: string[] } = {
      videos: [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/avi",
        "video/mov",
      ],
      music: [
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/ogg",
        "audio/aac",
        "audio/flac",
      ],
      sermon: [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/avi",
        "video/mov",
      ], // Sermons use same video formats as videos
      books: ["application/pdf", "application/epub+zip"],
      live: [],
    };
    const validThumbnailMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!["music", "videos", "books", "live", "sermon"].includes(data.contentType)) {
      throw new Error(
        `Invalid content type: ${data.contentType}. Must be 'music', 'videos', 'books', 'live', or 'sermon'`
      );
    }

    if (data.contentType !== "live") {
      if (!data.file || !data.fileMimeType) {
        throw new Error(
          `File and file MIME type are required for ${data.contentType} content type`
        );
      }

      // Map sermon to videos for MIME type validation (sermons are videos)
      const contentTypeForValidation = data.contentType === "sermon" ? "videos" : data.contentType;

      if (!validMimeTypes[contentTypeForValidation as keyof typeof validMimeTypes].includes(data.fileMimeType)) {
        throw new Error(
          `Invalid file MIME type for ${data.contentType}: ${data.fileMimeType}`
        );
      }

      // Thumbnail optional (FE may omit; worker can extract later)
      if (data.thumbnail || data.thumbnailMimeType) {
        if (!data.thumbnail || !data.thumbnailMimeType) {
          throw new Error(
            "Both thumbnail and thumbnail MIME type are required when providing a cover image"
          );
        }
        if (!validThumbnailMimeTypes.includes(data.thumbnailMimeType)) {
          throw new Error(
            `Invalid thumbnail MIME type: ${data.thumbnailMimeType}. Must be JPEG, PNG, or WebP`
          );
        }
        if (data.thumbnail.length > 5 * 1024 * 1024) {
          throw new Error("Thumbnail size must be less than 5MB");
        }
      }
    }

    let fileUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let fileObjectKey: string | undefined;
    let thumbnailObjectKey: string | undefined;

    // Generate contentId upfront for immutable URL structure
    // This ensures URLs use the format: media/{type}/{contentId}/filename
    const contentId = new Types.ObjectId().toString();

    try {
      if (data.contentType !== "live" && data.file && data.fileMimeType) {
        // Map contentType to folder structure
        const contentTypeFolder = data.contentType === "sermon" ? "videos" : data.contentType;
        const filename = contentTypeFolder === "videos" ? "video" : contentTypeFolder === "music" ? "audio" : "document";

        const uploadResult = await fileUploadService.uploadMedia(
          data.file,
          `media-${contentTypeFolder}`,
          data.fileMimeType,
          contentId, // Use contentId for immutable URL structure
          filename
        );
        fileUrl = uploadResult.secure_url;
        fileObjectKey = uploadResult.objectKey;
      }

      if (
        data.contentType !== "live" &&
        data.thumbnail &&
        data.thumbnailMimeType
      ) {
        const thumbnailResult = await fileUploadService.uploadMedia(
          data.thumbnail,
          "media-thumbnails",
          data.thumbnailMimeType,
          contentId, // Use same contentId for thumbnail
          "thumb" // Thumbnail filename
        );
        thumbnailUrl = thumbnailResult.secure_url;
        thumbnailObjectKey = thumbnailResult.objectKey;
      }

      const uploader = await User.findById(data.uploadedBy);
      if (!uploader) {
        throw new Error("Uploader not found");
      }

      const isArtist = uploader.role === "artist" && uploader.isVerifiedArtist;
      const isDownloadable = data.isDownloadable && isArtist;

      const shareUrl = `${process.env.FRONTEND_URL || "https://example.com"}/media/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let downloadUrl: string | undefined;
      if (isDownloadable && fileUrl) {
        downloadUrl = `${process.env.API_URL || "https://api.example.com"}/media/download/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const mediaData = {
        _id: new Types.ObjectId(contentId), // Use the pre-generated contentId as _id
        title: data.title,
        description: data.description,
        contentType: data.contentType,
        category: data.category,
        fileUrl,
        fileMimeType: data.fileMimeType,
        fileObjectKey,
        thumbnailUrl,
        thumbnailObjectKey,
        topics: data.topics,
        uploadedBy: new Types.ObjectId(data.uploadedBy),
        duration: data.duration,
        isLive: data.isLive || false,
        liveStreamStatus: data.liveStreamStatus,
        streamKey: data.streamKey,
        rtmpUrl: data.rtmpUrl,
        playbackUrl: data.playbackUrl,
        isDownloadable,
        downloadUrl,
        shareUrl: `${process.env.FRONTEND_URL || "https://example.com"}/media/${contentId}`, // Use contentId in share URL
        viewThreshold: data.viewThreshold || 30,
      };

      const media = await Media.create(mediaData);
      return media;
    } catch (error: any) {
      if (fileObjectKey) {
        try {
          await fileUploadService.deleteMedia(fileObjectKey);
        } catch (deleteError) {
          console.error("Failed to delete uploaded file from R2:", deleteError);
        }
      }
      if (thumbnailObjectKey) {
        try {
          await fileUploadService.deleteMedia(thumbnailObjectKey);
        } catch (deleteError) {
          console.error(
            "Failed to delete uploaded thumbnail from R2:",
            deleteError
          );
        }
      }
      throw error;
    }
  }
}

export const mediaUploadService = new MediaUploadService();
