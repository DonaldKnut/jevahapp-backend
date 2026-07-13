import { Media } from "../../models/media.model";
import { Types } from "mongoose";
import { mediaEngagementService } from "./engagement.service";

export class MediaDownloadService {
  async downloadMedia(data: {
    mediaId: string;
    userId: string;
    fileSize?: number;
  }) {
    try {
      const { mediaId, userId, fileSize } = data;

      const media = await Media.findById(mediaId);
      if (!media) {
        throw new Error("Media not found");
      }

      // Check if media is available for download
      if (!media.fileUrl) {
        throw new Error("Media file not available for download");
      }

      // Generate signed download URL from Cloudflare R2
      const { default: fileUploadService } = await import(
        "../fileUpload.service"
      );

      // Extract object key from fileUrl
      const objectKey = this.extractObjectKeyFromUrl(media.fileUrl);
      if (!objectKey) {
        // If we can't extract object key, use public URL as fallback
        console.log("[Download Service] Could not extract object key, using public URL as fallback");
        const downloadUrl = media.fileUrl;
        const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
        const contentType = this.getContentTypeFromMedia(media);

        // Prepare response data
        const responseData = {
          success: true,
          downloadUrl,
          fileName: media.title || "Untitled",
          fileSize: media.fileSize || fileSize || 0,
          contentType,
          mediaId: media._id.toString(),
          downloadId: `dl_${media._id.toString()}`,
          expiresAt: expiresAt.toISOString(),
        };

        // Try to add to offline downloads (non-critical)
        try {
          await this.addToOfflineDownloads(userId, mediaId, {
            fileName: media.title || "Untitled",
            fileSize: media.fileSize || fileSize || 0,
            contentType,
            downloadUrl,
          });
        } catch (offlineError) {
          console.warn("[Download Service] Failed to add to offline downloads (non-critical):", {
            error: offlineError instanceof Error ? offlineError.message : String(offlineError),
          });
          // Continue - download URL is still valid
        }

        // Always return the download URL, even if recording failed
        return responseData;
      }

      // Generate signed URL with 1 hour expiration
      // If signed URL generation fails, fall back to public URL
      let downloadUrl: string;
      let expiresAt: Date;

      try {
        const expiresInSeconds = 3600; // 1 hour
        downloadUrl = await fileUploadService.getPresignedGetUrl(
          objectKey,
          expiresInSeconds
        );
        expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
        console.log("[Download Service] Generated signed URL successfully");
      } catch (urlError) {
        // Fallback to public URL if signed URL generation fails
        console.warn("[Download Service] Signed URL generation failed, using public URL:", {
          error: urlError instanceof Error ? urlError.message : String(urlError),
        });
        downloadUrl = media.fileUrl;
        expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
      }

      // Determine content type
      const contentType = this.getContentTypeFromMedia(media);

      // Prepare response data
      const responseData = {
        success: true,
        downloadUrl,
        fileName: media.title || "Untitled",
        fileSize: media.fileSize || fileSize || 0,
        contentType,
        mediaId: media._id.toString(),
        downloadId: `dl_${media._id.toString()}`,
        expiresAt: expiresAt.toISOString(),
      };

      // Add to user's offline downloads (upsert - update if exists, create if not)
      // This is non-critical - if it fails, we still return the download URL
      try {
        console.log("[Download Service] Adding to offline downloads:", {
          userId,
          mediaId,
          fileName: media.title || "Untitled",
        });

        await this.addToOfflineDownloads(userId, mediaId, {
          fileName: media.title || "Untitled",
          fileSize: media.fileSize || fileSize || 0,
          contentType,
          downloadUrl,
        });
        console.log("[Download Service] Successfully added to offline downloads");
      } catch (offlineError) {
        // Log but don't fail the download - user can still download the file
        console.error("[Download Service] Failed to add to offline downloads (non-critical):", {
          error: offlineError instanceof Error ? offlineError.message : String(offlineError),
          stack: offlineError instanceof Error ? offlineError.stack : undefined,
          userId,
          mediaId,
        });
        // Continue - download URL is still valid and will be returned
      }

      // Always return the download URL, even if recording failed
      return responseData;
    } catch (error) {
      console.error("[Download Service] Error in downloadMedia:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        mediaId: data.mediaId,
        userId: data.userId,
      });
      throw error;
    }
  }

  /**
   * Get content type from media object
   */
  private getContentTypeFromMedia(media: any): string {
    if (media.fileMimeType) {
      return media.fileMimeType;
    }
    // Fallback based on contentType field
    const contentTypeMap: { [key: string]: string } = {
      videos: "video/mp4",
      music: "audio/mpeg",
      sermon: "video/mp4",
      ebook: "application/pdf",
      podcast: "audio/mpeg",
    };
    return contentTypeMap[media.contentType] || "application/octet-stream";
  }

  /**
   * Extract object key from Cloudflare R2 URL
   * Handles formats like:
   * - https://pub-xxx.r2.dev/jevah/media-videos/file.mp4
   * - https://custom-domain.com/jevah/media-videos/file.mp4
   */
  private extractObjectKeyFromUrl(url: string): string | null {
    try {
      if (!url) return null;

      // Parse URL
      const urlObj = new URL(url);

      // Extract pathname and remove leading slash
      let pathname = urlObj.pathname;
      if (pathname.startsWith("/")) {
        pathname = pathname.substring(1);
      }

      // For R2 public URLs, the pathname is the object key
      // e.g., "jevah/media-videos/file.mp4"
      if (pathname) {
        return decodeURIComponent(pathname);
      }

      // Fallback: try to extract from full URL
      const parts = url.split("/");
      if (parts.length > 0) {
        // Get everything after the domain
        const domainIndex = url.indexOf("://");
        if (domainIndex !== -1) {
          const afterProtocol = url.substring(domainIndex + 3);
          const pathStart = afterProtocol.indexOf("/");
          if (pathStart !== -1) {
            return decodeURIComponent(afterProtocol.substring(pathStart + 1));
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error extracting object key from URL:", error);
      return null;
    }
  }

  /**
   * Add media to user's offline downloads
   */
  private async addToOfflineDownloads(
    userId: string,
    mediaId: string,
    downloadInfo: {
      fileName: string;
      fileSize: number;
      contentType: string;
      downloadUrl: string;
    }
  ) {
    try {
      console.log("[Download Service] addToOfflineDownloads called:", {
        userId,
        mediaId,
        fileName: downloadInfo.fileName,
      });

      const { User } = await import("../../models/user.model");

      // Validate userId and mediaId
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error(`Invalid userId format: ${userId}`);
      }
      if (!Types.ObjectId.isValid(mediaId)) {
        throw new Error(`Invalid mediaId format: ${mediaId}`);
      }

      const offlineDownload = {
        mediaId: new Types.ObjectId(mediaId),
        downloadDate: new Date(),
        fileName: downloadInfo.fileName,
        fileSize: downloadInfo.fileSize,
        contentType: downloadInfo.contentType,
        downloadUrl: downloadInfo.downloadUrl,
        isDownloaded: false, // Will be updated by frontend
        downloadStatus: "pending", // Initial status
        downloadProgress: 0, // Initial progress
      };

      console.log("[Download Service] Attempting to update existing download record");

      // Avoid unbounded duplicates:
      // - If the item already exists in offlineDownloads, just refresh its metadata/date.
      // - Only increment totalDownloads and push a new entry when it's a new mediaId.
      const existingUpdate = await User.updateOne(
        {
          _id: new Types.ObjectId(userId),
          "offlineDownloads.mediaId": new Types.ObjectId(mediaId),
        },
        {
          $set: {
            "offlineDownloads.$.downloadDate": offlineDownload.downloadDate,
            "offlineDownloads.$.fileName": offlineDownload.fileName,
            "offlineDownloads.$.fileSize": offlineDownload.fileSize,
            "offlineDownloads.$.contentType": offlineDownload.contentType,
            "offlineDownloads.$.downloadUrl": offlineDownload.downloadUrl,
            "offlineDownloads.$.downloadStatus": "pending",
            "offlineDownloads.$.downloadProgress": 0,
          },
        }
      );

      if ((existingUpdate as any)?.modifiedCount > 0) {
        console.log("[Download Service] Updated existing download record");
        return;
      }

      console.log("[Download Service] Creating new download record");

      // Check if user exists
      const userExists = await User.findById(userId);
      if (!userExists) {
        throw new Error(`User not found: ${userId}`);
      }

      const newRecordResult = await User.updateOne(
        { _id: new Types.ObjectId(userId) },
        {
          $push: { offlineDownloads: offlineDownload },
          $inc: { totalDownloads: 1 },
        }
      );

      console.log("[Download Service] Created new download record:", {
        matched: newRecordResult.matchedCount,
        modified: newRecordResult.modifiedCount,
      });

      if (newRecordResult.matchedCount === 0) {
        throw new Error(`User not found when creating download record: ${userId}`);
      }

      console.log("[Download Service] Successfully added to offline downloads:", {
        userId,
        mediaId,
        fileName: downloadInfo.fileName,
      });
    } catch (error) {
      // Log error but don't throw - this is non-critical
      // The download URL is still valid and will be returned to the user
      console.error("[Download Service] Error adding to offline downloads (non-critical):", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        mediaId,
      });
      // Silently fail - don't throw, don't block the download
    }
  }

  /**
   * Get user's offline downloads with filtering
   */
  async getUserOfflineDownloads(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: string;
      contentType?: string;
    }
  ) {
    try {
      const { User } = await import("../../models/user.model");

      const user = await User.findById(userId)
        .populate(
          "offlineDownloads.mediaId",
          "title description thumbnailUrl contentType duration isPublicDomain speaker year category tags fileUrl"
        )
        .lean();

      if (!user) {
        throw new Error("User not found");
      }

      let downloads = (user as any).offlineDownloads || [];

      // Apply filters
      if (filters?.status) {
        downloads = downloads.filter(
          (d: any) => d.downloadStatus === filters.status
        );
      }

      if (filters?.contentType) {
        // Map frontend contentType to backend contentType
        const contentTypeMap: { [key: string]: string } = {
          video: "videos",
          audio: "music",
          ebook: "ebook",
        };
        const backendContentType = contentTypeMap[filters.contentType] || filters.contentType;

        downloads = downloads.filter((d: any) => {
          const mediaContentType = d.mediaId?.contentType || d.contentType;
          return mediaContentType === backendContentType;
        });
      }

      // Sort by downloadDate descending (newest first)
      downloads = downloads.sort(
        (a: any, b: any) =>
          new Date(b.downloadDate).getTime() -
          new Date(a.downloadDate).getTime()
      );

      const total = downloads.length;
      const skip = (page - 1) * limit;
      const paginatedDownloads = downloads.slice(skip, skip + limit);

      // Transform downloads to match spec format
      const transformedDownloads = paginatedDownloads.map((download: any) => ({
        _id: download._id || download.mediaId?._id,
        mediaId: download.mediaId?._id || download.mediaId,
        userId: userId,
        fileName: download.fileName,
        fileSize: download.fileSize,
        contentType: download.contentType,
        downloadStatus: download.downloadStatus || "pending",
        downloadProgress: download.downloadProgress || 0,
        isDownloaded: download.isDownloaded || false,
        localPath: download.localPath,
        downloadUrl: download.downloadUrl, // Original download URL (may be expired)
        // Include media object with fileUrl for playback
        media: download.mediaId
          ? {
            _id: download.mediaId._id,
            title: download.mediaId.title,
            description: download.mediaId.description,
            thumbnailUrl: download.mediaId.thumbnailUrl,
            fileUrl: download.mediaId.fileUrl, // For playback - always available
            contentType: download.mediaId.contentType,
            duration: download.mediaId.duration,
            category: download.mediaId.category,
          }
          : undefined,
        createdAt: download.downloadDate,
        updatedAt: download.downloadDate,
      }));

      return {
        downloads: transformedDownloads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove media from user's offline downloads
   */
  async removeFromOfflineDownloads(userId: string, mediaId: string) {
    try {
      const { User } = await import("../../models/user.model");

      const result = await User.findByIdAndUpdate(userId, {
        $pull: { offlineDownloads: { mediaId: new Types.ObjectId(mediaId) } },
        $inc: { totalDownloads: -1 },
      });

      if (!result) {
        throw new Error("User not found");
      }

      console.log("Removed from offline downloads:", { userId, mediaId });
    } catch (error) {
      console.error("Error removing from offline downloads:", error);
      throw error;
    }
  }

  /**
   * Update download status, progress, and local path
   */
  async updateDownloadStatus(
    userId: string,
    mediaId: string,
    updates: {
      localPath?: string;
      isDownloaded?: boolean;
      downloadStatus?: "pending" | "downloading" | "completed" | "failed" | "cancelled";
      downloadProgress?: number;
    }
  ) {
    try {
      const { User } = await import("../../models/user.model");

      // Validate downloadStatus
      if (updates.downloadStatus) {
        const validStatuses = ["pending", "downloading", "completed", "failed", "cancelled"];
        if (!validStatuses.includes(updates.downloadStatus)) {
          throw new Error("Invalid download status");
        }
      }

      // Validate downloadProgress (0-100)
      if (updates.downloadProgress !== undefined) {
        if (updates.downloadProgress < 0 || updates.downloadProgress > 100) {
          throw new Error("Download progress must be between 0 and 100");
        }
      }

      // Build update object
      const updateFields: any = {};
      if (updates.localPath !== undefined) {
        updateFields["offlineDownloads.$.localPath"] = updates.localPath;
      }
      if (updates.isDownloaded !== undefined) {
        updateFields["offlineDownloads.$.isDownloaded"] = updates.isDownloaded;
      }
      if (updates.downloadStatus !== undefined) {
        updateFields["offlineDownloads.$.downloadStatus"] = updates.downloadStatus;
      }
      if (updates.downloadProgress !== undefined) {
        updateFields["offlineDownloads.$.downloadProgress"] = updates.downloadProgress;
      }

      // Update the download record
      const result = await User.updateOne(
        {
          _id: new Types.ObjectId(userId),
          "offlineDownloads.mediaId": new Types.ObjectId(mediaId),
        },
        {
          $set: updateFields,
        }
      );

      if (result.matchedCount === 0) {
        // Download record doesn't exist, create it
        const media = await Media.findById(mediaId);
        if (!media) {
          throw new Error("Media not found");
        }

        const newDownload = {
          mediaId: new Types.ObjectId(mediaId),
          downloadDate: new Date(),
          fileName: media.title || "Untitled",
          fileSize: media.fileSize || 0,
          contentType: this.getContentTypeFromMedia(media),
          downloadUrl: media.fileUrl || "",
          localPath: updates.localPath,
          isDownloaded: updates.isDownloaded || false,
          downloadProgress: updates.downloadProgress || 0,
          downloadStatus: updates.downloadStatus || "pending",
        };

        await User.updateOne(
          { _id: new Types.ObjectId(userId) },
          {
            $push: { offlineDownloads: newDownload },
          }
        );
      }

      // Fetch updated download record
      const user = await User.findById(userId)
        .select("offlineDownloads")
        .lean();

      const download = (user as any)?.offlineDownloads?.find(
        (d: any) => d.mediaId?.toString() === mediaId
      );

      if (!download) {
        throw new Error("Download record not found");
      }

      return {
        mediaId: download.mediaId?.toString() || mediaId,
        downloadStatus: download.downloadStatus || "pending",
        downloadProgress: download.downloadProgress || 0,
        isDownloaded: download.isDownloaded || false,
        localPath: download.localPath,
        fileName: download.fileName,
        fileSize: download.fileSize,
        contentType: download.contentType,
        updatedAt: download.downloadDate || new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get download status for a specific media item
   */
  async getDownloadStatus(userId: string, mediaId: string) {
    try {
      const { User } = await import("../../models/user.model");

      const user = await User.findById(userId)
        .select("offlineDownloads")
        .lean();

      if (!user) {
        throw new Error("User not found");
      }

      const download = (user as any)?.offlineDownloads?.find(
        (d: any) => d.mediaId?.toString() === mediaId
      );

      if (!download) {
        throw new Error("Download not found");
      }

      return {
        _id: download._id,
        mediaId: download.mediaId?.toString() || mediaId,
        downloadStatus: download.downloadStatus || "pending",
        downloadProgress: download.downloadProgress || 0,
        isDownloaded: download.isDownloaded || false,
        localPath: download.localPath,
        fileName: download.fileName,
        fileSize: download.fileSize,
        contentType: download.contentType,
        createdAt: download.downloadDate,
        updatedAt: download.downloadDate,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Download media file directly (for UI components)
   */
  async downloadMediaFile(data: { mediaId: string; userId: string; range?: string }) {
    try {
      const { mediaId, userId } = data;

      const media = await Media.findById(mediaId);
      if (!media) {
        throw new Error("Media not found");
      }

      // Check if media is available for download
      if (!media.fileUrl) {
        throw new Error("Media file not available for download");
      }

      // NOTE: Do not buffer large media into memory. Stream it through the API when needed.
      // Also forward Range requests so clients can resume downloads and stream efficiently.
      const rangeHeader = data.range;
      // If the client is resuming via Range requests, avoid duplicate DB writes on every chunk.
      if (!rangeHeader) {
        // Record download interaction
        await mediaEngagementService.recordInteraction({
          userIdentifier: userId,
          mediaIdentifier: mediaId,
          interactionType: "download",
          duration: 0,
        });
      }
      const fileResponse = await fetch(media.fileUrl, {
        headers: rangeHeader ? { Range: rangeHeader } : undefined,
      });
      if (!fileResponse.ok) {
        throw new Error("Failed to fetch media file");
      }

      const contentType =
        fileResponse.headers.get("content-type") ||
        (media.mimeType as any) ||
        "application/octet-stream";
      const contentLengthHeader = fileResponse.headers.get("content-length");
      const contentLength = contentLengthHeader
        ? parseInt(contentLengthHeader, 10)
        : undefined;

      // Add to user's offline downloads only for the initial request
      // (Range resume requests should not create/refresh records repeatedly).
      if (!rangeHeader) {
        await this.addToOfflineDownloads(userId, mediaId, {
          fileName: media.title || "Untitled",
          fileSize: media.fileSize || contentLength || 0,
          contentType: media.contentType,
          downloadUrl: media.fileUrl,
        });
      }

      return {
        success: true,
        // Stream instead of buffering.
        // Express response will pipe this to the client.
        stream: fileResponse.body,
        fileName: media.title || "Untitled",
        fileSize: media.fileSize || contentLength || 0,
        contentType,
        status: fileResponse.status,
        headers: {
          acceptRanges: fileResponse.headers.get("accept-ranges"),
          contentRange: fileResponse.headers.get("content-range"),
          contentLength: contentLengthHeader,
        },
        message: "File downloaded successfully",
      };
    } catch (error) {
      throw error;
    }
  }
}

export const mediaDownloadService = new MediaDownloadService();
