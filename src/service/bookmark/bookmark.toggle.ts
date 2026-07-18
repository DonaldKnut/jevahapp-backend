import { Types, ClientSession } from "mongoose";
import { Bookmark } from "../../models/bookmark.model";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";
import { AuditService } from "../audit.service";
import { NotificationService } from "../notification.service";
import { getBookmarkCount } from "./bookmark.query";
import { normalizeContentType } from "../../modules/engagement/shared/contentType.resolver";

export interface BookmarkResult {
  contentId: string;
  bookmarked: boolean;
  isBookmarked: boolean;
  bookmarkCount: number;
  saves: number;
}

/** Map feed / FE aliases to the collection bookmark supports */
export function mapBookmarkContentType(raw?: string): string {
  if (!raw || typeof raw !== "string") return "media";
  const t = raw.trim().toLowerCase();
  const mediaAliases = new Set([
    "media",
    "video",
    "videos",
    "audio",
    "music",
    "live",
    "sermon",
    "sermons",
    "devotional", // feed devotionals that live on Media (not Devotional collection)
    "ebook",
    "e-books",
    "ebooks",
    "books",
    "podcast",
    "podcasts",
    "image",
    "images",
  ]);
  if (mediaAliases.has(t)) return "media";
  if (t === "copyright_free_song" || t === "copyright-free" || t === "copyright_free") {
    return "copyright_free_song";
  }
  return normalizeContentType(t);
}

export async function verifyMediaExists(mediaId: string): Promise<boolean> {
  try {
    // Existence check outside the transaction — avoids session/replica false-negatives
    const media = await Media.findById(mediaId).select("_id").lean();
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
  mediaId: string,
  contentTypeHint?: string
): Promise<BookmarkResult> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(mediaId)) {
    throw new Error("Invalid user or media ID");
  }

  const mapped = mapBookmarkContentType(contentTypeHint);
  if (mapped === "copyright_free_song") {
    throw new Error(
      "Use POST /api/audio/copyright-free/:songId/save for copyright-free songs"
    );
  }
  if (mapped !== "media") {
    throw new Error(
      `Unsupported content type for feed bookmark: ${contentTypeHint}. Use contentType "media".`
    );
  }

  logger.info("Toggle bookmark request", {
    userId,
    mediaId,
    contentTypeHint: contentTypeHint || "media",
    timestamp: new Date().toISOString(),
  });

  const mediaExists = await verifyMediaExists(mediaId);
  if (!mediaExists) {
    throw new Error(`Media not found: ${mediaId}`);
  }

  const session: ClientSession = await Bookmark.startSession();
  try {
    let bookmarked = false;

    await session.withTransaction(async () => {
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

    const bookmarkCount = Math.max(0, await getBookmarkCount(mediaId));

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
      contentId: mediaId,
      bookmarked,
      isBookmarked: bookmarked,
      bookmarkCount,
      saves: bookmarkCount,
    };
  } catch (error: any) {
    // Standalone Mongo (no replica set): fall back to non-transactional toggle
    if (
      error.message?.includes("Transaction numbers are only allowed") ||
      error.message?.includes("replica set")
    ) {
      logger.warn("Bookmark toggle falling back without transaction", {
        mediaId,
        userId,
      });
      return toggleBookmarkWithoutTransaction(userId, mediaId);
    }

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

async function toggleBookmarkWithoutTransaction(
  userId: string,
  mediaId: string
): Promise<BookmarkResult> {
  const existingBookmark = await Bookmark.findOne({
    user: new Types.ObjectId(userId),
    media: new Types.ObjectId(mediaId),
  });

  let bookmarked = false;
  if (existingBookmark) {
    await Bookmark.findByIdAndDelete(existingBookmark._id);
    await Media.findByIdAndUpdate(mediaId, { $inc: { bookmarkCount: -1 } });
    bookmarked = false;
  } else {
    try {
      await Bookmark.create({
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(mediaId),
      });
      await Media.findByIdAndUpdate(mediaId, { $inc: { bookmarkCount: 1 } });
      bookmarked = true;
    } catch (err: any) {
      if (err?.code === 11000) {
        // Race: already bookmarked
        bookmarked = true;
      } else {
        throw err;
      }
    }
  }

  const bookmarkCount = Math.max(0, await getBookmarkCount(mediaId));
  return {
    contentId: mediaId,
    bookmarked,
    isBookmarked: bookmarked,
    bookmarkCount,
    saves: bookmarkCount,
  };
}
