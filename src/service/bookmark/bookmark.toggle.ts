import { Types, ClientSession } from "mongoose";
import { Bookmark } from "../../models/bookmark.model";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";
import { AuditService } from "../audit.service";
import { NotificationService } from "../notification.service";
import { getBookmarkCount } from "./bookmark.query";

export interface BookmarkResult {
  bookmarked: boolean;
  bookmarkCount: number;
}

export async function verifyMediaExists(
  mediaId: string,
  session: ClientSession
): Promise<boolean> {
  try {
    const media = await Media.findById(mediaId)
      .session(session)
      .select("_id");
    return !!media;
  } catch (error: any) {
    logger.error("Failed to verify media exists", {
      mediaId,
      error: error.message,
    });
    return false;
  }
}

export async function toggleBookmark(
  userId: string,
  mediaId: string
): Promise<BookmarkResult> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(mediaId)) {
    throw new Error("Invalid user or media ID");
  }

  logger.info("Toggle bookmark request", {
    userId,
    mediaId,
    timestamp: new Date().toISOString(),
  });

  const session: ClientSession = await Bookmark.startSession();
  try {
    let bookmarked = false;

    await session.withTransaction(async () => {
      const mediaExists = await verifyMediaExists(mediaId, session);
      if (!mediaExists) {
        throw new Error(`Media not found: ${mediaId}`);
      }

      const existingBookmark = await Bookmark.findOne({
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(mediaId),
      }).session(session);

      if (existingBookmark) {
        await Bookmark.findByIdAndDelete(existingBookmark._id, { session });
        await Media.findByIdAndUpdate(
          mediaId,
          { $inc: { bookmarkCount: -1 } },
          { session }
        );
        bookmarked = false;
      } else {
        await Bookmark.create(
          [
            {
              user: new Types.ObjectId(userId),
              media: new Types.ObjectId(mediaId),
            },
          ],
          { session }
        );
        await Media.findByIdAndUpdate(
          mediaId,
          { $inc: { bookmarkCount: 1 } },
          { session }
        );
        bookmarked = true;
      }
    });

    const bookmarkCount = await getBookmarkCount(mediaId);

    if (bookmarked) {
      try {
        await NotificationService.notifyContentBookmark(
          userId,
          mediaId,
          "media"
        );
      } catch (notificationError: any) {
        logger.warn("Failed to send bookmark notification", {
          error: notificationError?.message,
          userId,
          mediaId,
        });
      }
    }

    logger.info("Toggle bookmark completed", {
      userId,
      mediaId,
      bookmarked,
      bookmarkCount,
      timestamp: new Date().toISOString(),
    });

    try {
      await AuditService.logMediaInteraction(
        userId,
        bookmarked ? "media_save" : "media_remove",
        mediaId
      );
    } catch (auditError: any) {
      logger.warn("Failed to write audit log for bookmark toggle", {
        error: auditError?.message,
        userId,
        mediaId,
        bookmarked,
      });
    }

    return {
      bookmarked,
      bookmarkCount,
    };
  } catch (error: any) {
    logger.error("Toggle bookmark transaction failed", {
      error: error.message,
      stack: error.stack,
      userId,
      mediaId,
      timestamp: new Date().toISOString(),
    });
    throw error;
  } finally {
    session.endSession();
  }
}
