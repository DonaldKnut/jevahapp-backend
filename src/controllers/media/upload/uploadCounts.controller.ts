import { Request, Response } from "express";
import { UPLOAD_LIMITS } from "../constants";

/**
 * Get current upload counts and limits for the authenticated user
 * Useful for frontend to display progress bars and check limits before upload
 */
export const getUploadCounts = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    // Validate user authentication
    if (!request.userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { Media } = await import("../../../models/media.model");
    const { Types } = await import("mongoose");
    const userIdObj = new Types.ObjectId(request.userId);

    // Get current upload counts (excluding default content)
    const [musicCount, sermonVideoCount] = await Promise.all([
      Media.countDocuments({
        uploadedBy: userIdObj,
        contentType: "music",
        isDefaultContent: { $ne: true },
      }),
      Media.countDocuments({
        uploadedBy: userIdObj,
        contentType: { $in: ["videos", "sermon"] },
        isDefaultContent: { $ne: true },
      }),
    ]);

    // Calculate remaining uploads
    const musicRemaining = Math.max(
      0,
      UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER - musicCount
    );
    const sermonVideoRemaining = Math.max(
      0,
      UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER - sermonVideoCount
    );

    // Calculate percentage used
    const musicPercentage = Math.round(
      (musicCount / UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER) * 100
    );
    const sermonVideoPercentage = Math.round(
      (sermonVideoCount / UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER) * 100
    );

    response.status(200).json({
      success: true,
      message: "Upload counts retrieved successfully",
      data: {
        music: {
          current: musicCount,
          max: UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER,
          remaining: musicRemaining,
          percentage: musicPercentage,
          canUpload: musicCount < UPLOAD_LIMITS.UPLOAD_COUNT.MUSIC_PER_USER,
        },
        sermons: {
          current: sermonVideoCount,
          max: UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER,
          remaining: sermonVideoRemaining,
          percentage: sermonVideoPercentage,
          canUpload:
            sermonVideoCount < UPLOAD_LIMITS.UPLOAD_COUNT.SERMON_PER_USER,
        },
        limits: {
          fileSize: UPLOAD_LIMITS.FILE_SIZE,
          uploadCount: UPLOAD_LIMITS.UPLOAD_COUNT,
        },
      },
    });
  } catch (error: any) {
    console.error("Get upload counts error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve upload counts",
      error: error.message,
    });
  }
};
