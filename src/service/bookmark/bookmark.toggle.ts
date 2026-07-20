import { Types, ClientSession } from "mongoose";
import { Bookmark } from "../../models/bookmark.model";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";
import { AuditService } from "../audit.service";
import { NotificationService } from "../notification.service";
import { getBookmarkCount } from "./bookmark.query";
import { normalizeContentType } from "../../modules/engagement/shared/contentType.resolver";
import { setFeedUserBookmarkFlag } from "../media/feedUserFlags";

export interface BookmarkResult {
  contentId: string;
  bookmarked: boolean;
  isBookmarked: boolean;
  bookmarkCount: number;
  saves: number;
  bookmarkId?: string;
}

const FLOOR_BOOKMARK = [
  {
    $set: {
      bookmarkCount: {
        $max: [0, { $subtract: [{ $ifNull: ["$bookmarkCount", 0] }, 1] }],
      },
    },
  },
];

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
    "devotional",
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
    let bookmarkId: string | undefined;

    await session.withTransaction(async () => {
      const existingBookmark = await Bookmark.findOne({
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(mediaId),
      }).session(session);

      if (existingBookmark) {
        await Bookmark.findByIdAndDelete(existingBookmark._id, { session });
        await Media.findByIdAndUpdate(mediaId, FLOOR_BOOKMARK, { session });
        bookmarked = false;
      } else {
        const created = await Bookmark.create(
          [
            {
              user: new Types.ObjectId(userId),
              media: new Types.ObjectId(mediaId),
            },
          ],
          { session }
        );
        bookmarkId = created[0]._id.toString();
        await Media.findByIdAndUpdate(
          mediaId,
          { $inc: { bookmarkCount: 1 } },
          { session }
        );
        bookmarked = true;
      }
    });

    const bookmarkCount = Math.max(0, await getBookmarkCount(mediaId));
    // No feed-cache invalidation: saved flags are overlaid fresh per request.
    void setFeedUserBookmarkFlag(userId, mediaId, bookmarked);

    if (bookmarked) {
      try {
        await NotificationService.notifyContentBookmark(
          userId,
          mediaId,
          "media",
          bookmarkId
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
      bookmarkId,
    };
  } catch (error: any) {
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
  let bookmarkId: string | undefined;
  if (existingBookmark) {
    await Bookmark.findByIdAndDelete(existingBookmark._id);
    await Media.findByIdAndUpdate(mediaId, FLOOR_BOOKMARK);
    bookmarked = false;
  } else {
    try {
      const created = await Bookmark.create({
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(mediaId),
      });
      bookmarkId = created._id.toString();
      await Media.findByIdAndUpdate(mediaId, { $inc: { bookmarkCount: 1 } });
      bookmarked = true;
    } catch (err: any) {
      if (err?.code === 11000) {
        bookmarked = true;
      } else {
        throw err;
      }
    }
  }

  const bookmarkCount = Math.max(0, await getBookmarkCount(mediaId));
  void setFeedUserBookmarkFlag(userId, mediaId, bookmarked);

  return {
    contentId: mediaId,
    bookmarked,
    isBookmarked: bookmarked,
    bookmarkCount,
    saves: bookmarkCount,
    bookmarkId,
  };
}
