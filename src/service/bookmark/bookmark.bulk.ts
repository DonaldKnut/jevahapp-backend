import { Types } from "mongoose";
import { Bookmark } from "../../models/bookmark.model";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";
import { NotificationService } from "../notification.service";

export async function bulkBookmark(
  userId: string,
  mediaIds: string[],
  action: "add" | "remove"
): Promise<{
  success: number;
  failed: number;
  results: Array<{
    mediaId: string;
    success: boolean;
    error?: string;
  }>;
}> {
  try {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const mediaId of mediaIds) {
      try {
        if (!Types.ObjectId.isValid(mediaId)) {
          results.push({
            mediaId,
            success: false,
            error: "Invalid media ID format",
          });
          failedCount++;
          continue;
        }

        if (action === "add") {
          const existing = await Bookmark.findOne({
            user: new Types.ObjectId(userId),
            media: new Types.ObjectId(mediaId),
          });

          if (!existing) {
            await Bookmark.create({
              user: new Types.ObjectId(userId),
              media: new Types.ObjectId(mediaId),
            });
            await Media.findByIdAndUpdate(mediaId, { $inc: { bookmarkCount: 1 } });
            try {
              await NotificationService.notifyContentBookmark(
                userId,
                mediaId,
                "media"
              );
            } catch (e: any) {
              logger.warn("Bulk bookmark notify failed", {
                userId,
                mediaId,
                error: e?.message,
              });
            }
          }
        } else {
          const deleted = await Bookmark.findOneAndDelete({
            user: new Types.ObjectId(userId),
            media: new Types.ObjectId(mediaId),
          });
          if (deleted) {
            await Media.findByIdAndUpdate(mediaId, { $inc: { bookmarkCount: -1 } });
          }
        }

        results.push({
          mediaId,
          success: true,
        });
        successCount++;
      } catch (error: any) {
        results.push({
          mediaId,
          success: false,
          error: error.message,
        });
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  } catch (error: any) {
    logger.error("Failed to perform bulk bookmark operation", {
      userId,
      mediaIds,
      action,
      error: error.message,
    });
    throw error;
  }
}
