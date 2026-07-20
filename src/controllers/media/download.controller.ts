import { Request, Response } from "express";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { Types } from "mongoose";
import { mediaService } from "../../service/media.service";
import { NotificationService } from "../../service/notification.service";

export const downloadMedia = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { mediaId } = request.params;
  const { fileSize } = request.body as { fileSize?: number };
  const userIdentifier = request.userId;

  // Log request for debugging
  console.log("[Download] Initiate request:", {
    mediaId,
    userId: userIdentifier,
    fileSize,
    timestamp: new Date().toISOString(),
  });

  try {
    // Validate authentication
    if (!userIdentifier) {
      console.log("[Download] Authentication failed: No user identifier");
      response.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Authentication required",
      });
      return;
    }

    // Validate mediaId format
    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      console.log("[Download] Validation failed: Invalid mediaId format", { mediaId });
      response.status(400).json({
        success: false,
        error: "INVALID_MEDIA_ID",
        message: "Invalid media ID format",
      });
      return;
    }

    // Validate fileSize if provided
    if (fileSize !== undefined && (typeof fileSize !== "number" || fileSize < 0)) {
      console.log("[Download] Validation failed: Invalid fileSize", { fileSize });
      response.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "File size must be a positive number",
      });
      return;
    }

    // Call service to initiate download
    console.log("[Download] Calling mediaService.downloadMedia");
    const result = await mediaService.downloadMedia({
      userId: userIdentifier,
      mediaId: mediaId,
      fileSize: fileSize,
    });

    console.log("[Download] Download initiated successfully:", {
      mediaId,
      fileName: result.fileName,
      fileSize: result.fileSize,
    });

    // Notify content owner about the download (if not self) - non-blocking
    try {
      await NotificationService.notifyContentDownload(
        userIdentifier,
        mediaId,
        "media"
      );
    } catch (notifyError) {
      console.warn("[Download] Notification failed (non-critical):", notifyError);
    }

    // Return response in format expected by frontend
    response.status(200).json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
        contentType: result.contentType,
      },
    });
  } catch (error: unknown) {
    console.error("[Download] Error occurred:", {
      mediaId,
      userId: userIdentifier,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("Media not found")) {
        response.status(404).json({
          success: false,
          error: "MEDIA_NOT_FOUND",
          message: "Media not found",
        });
        return;
      }

      if (error.message.includes("not available for download") ||
        error.message.includes("not available for download")) {
        response.status(403).json({
          success: false,
          error: "DOWNLOAD_NOT_ALLOWED",
          message: "This media is not available for download",
        });
        return;
      }

      if (
        error.message.includes("Invalid") ||
        error.message.includes("required") ||
        error.message.includes("validation")
      ) {
        response.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: error.message,
        });
        return;
      }
    }

    // Generic server error
    console.error("[Download] Unhandled error:", error);
    response.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to initiate download. Please try again later.",
    });
  }
};

// New method for direct file download (for UI components)
export const downloadMediaFile = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media ID",
      });
      return;
    }

    const result = await mediaService.downloadMediaFile({
      userId: userIdentifier,
      mediaId: id,
      range: typeof request.headers.range === "string" ? request.headers.range : undefined,
    });

    // Notify content owner about the download (if not self)
    try {
      await NotificationService.notifyContentDownload(
        userIdentifier,
        id,
        "media"
      );
    } catch (notifyError) {
      // Non-blocking
    }

    // Prefer CDN redirect (avoids proxying large files through Node)
    if ((result as any).redirectUrl) {
      response.redirect(302, (result as any).redirectUrl);
      return;
    }

    // Set appropriate headers for file download (supports Range / resumable downloads)
    response.setHeader(
      "Content-Type",
      result.contentType || "application/octet-stream"
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );

    if (result.headers?.acceptRanges) {
      response.setHeader("Accept-Ranges", result.headers.acceptRanges);
    }
    if (result.headers?.contentRange) {
      response.setHeader("Content-Range", result.headers.contentRange);
    }
    if (result.headers?.contentLength) {
      response.setHeader("Content-Length", result.headers.contentLength);
    } else if (result.fileSize) {
      response.setHeader("Content-Length", String(result.fileSize));
    }

    if (!result.stream) {
      response.status(502).json({
        success: false,
        message: "Upstream media stream unavailable",
      });
      return;
    }

    response.status(result.status || 200);
    const nodeStream = Readable.fromWeb(result.stream as any);
    await pipeline(nodeStream, response);
  } catch (error: unknown) {
    console.error("Download media file error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        response.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message.includes("not available for download")) {
        response.status(403).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (
        error.message.includes("Invalid") ||
        error.message.includes("required")
      ) {
        response.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    response.status(500).json({
      success: false,
      message: "Failed to download media file",
    });
  }
};

// Get user's offline downloads
export const getOfflineDownloads = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    const page = parseInt(request.query.page as string) || 1;
    const limit = Math.min(parseInt(request.query.limit as string) || 20, 100); // Max 100
    const status = request.query.status as string | undefined;
    const contentType = request.query.contentType as string | undefined;

    if (!userId) {
      response.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    const filters: { status?: string; contentType?: string } = {};
    if (status) {
      filters.status = status;
    }
    if (contentType) {
      filters.contentType = contentType;
    }

    const result = await mediaService.getUserOfflineDownloads(
      userId,
      page,
      limit,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Get offline downloads error:", error);

    if (error.message.includes("not found")) {
      response.status(404).json({
        success: false,
        error: error.message,
        code: "NOT_FOUND",
      });
      return;
    }

    response.status(500).json({
      success: false,
      error: "Failed to get offline downloads",
      code: "SERVER_ERROR",
    });
  }
};

// Remove media from offline downloads
export const removeFromOfflineDownloads = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { mediaId } = request.params;
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      response.status(400).json({
        success: false,
        error: "Invalid media ID",
        code: "INVALID_MEDIA_ID",
      });
      return;
    }

    await mediaService.removeFromOfflineDownloads(userId, mediaId);

    response.status(200).json({
      success: true,
      message: "Download removed successfully",
    });
  } catch (error: any) {
    console.error("Remove from offline downloads error:", error);

    if (error.message.includes("not found")) {
      response.status(404).json({
        success: false,
        error: "Download not found",
        code: "DOWNLOAD_NOT_FOUND",
      });
      return;
    }

    response.status(500).json({
      success: false,
      error: "Failed to remove download",
      code: "SERVER_ERROR",
    });
  }
};

// Update download status
export const updateDownloadStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { mediaId } = request.params;
    const userId = request.userId;
    const { localPath, isDownloaded, downloadStatus, downloadProgress } =
      request.body as {
        localPath?: string;
        isDownloaded?: boolean;
        downloadStatus?: string;
        downloadProgress?: number;
      };

    if (!userId) {
      response.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      response.status(400).json({
        success: false,
        error: "Invalid media ID",
        code: "INVALID_MEDIA_ID",
      });
      return;
    }

    const result = await mediaService.updateDownloadStatus(userId, mediaId, {
      localPath,
      isDownloaded,
      downloadStatus: downloadStatus as any,
      downloadProgress,
    });

    response.status(200).json({
      success: true,
      data: result,
      message: "Download status updated successfully",
    });
  } catch (error: any) {
    console.error("Update download status error:", error);

    if (error.message.includes("not found")) {
      response.status(404).json({
        success: false,
        error: "Download record not found",
        code: "DOWNLOAD_NOT_FOUND",
      });
      return;
    }

    if (
      error.message.includes("Invalid download status") ||
      error.message.includes("Download progress must be between")
    ) {
      response.status(400).json({
        success: false,
        error: error.message,
        code: "VALIDATION_ERROR",
        field:
          error.message.includes("status") ? "downloadStatus" : "downloadProgress",
      });
      return;
    }

    response.status(500).json({
      success: false,
      error: "Failed to update download status",
      code: "SERVER_ERROR",
    });
  }
};

// Get single download status
export const getDownloadStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { mediaId } = request.params;
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      });
      return;
    }

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      response.status(400).json({
        success: false,
        error: "Invalid media ID",
        code: "INVALID_MEDIA_ID",
      });
      return;
    }

    const result = await mediaService.getDownloadStatus(userId, mediaId);

    response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Get download status error:", error);

    if (error.message.includes("not found")) {
      response.status(404).json({
        success: false,
        error: "Download not found",
        code: "DOWNLOAD_NOT_FOUND",
      });
      return;
    }

    response.status(500).json({
      success: false,
      error: "Failed to get download status",
      code: "SERVER_ERROR",
    });
  }
};
