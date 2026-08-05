import { Types } from "mongoose";
import { Bookmark } from "../../models/bookmark.model";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";
import { AuditService } from "../audit.service";
import { NotificationService } from "../notification.service";
import { getBookmarkCount } from "./bookmark.query";
import {
  MEDIA_LIKE_ALIASES,
  normalizeContentType,
  resolveBookmarkableMedia,
} from "../../modules/engagement/shared/contentType.resolver";
import { setFeedUserBookmarkFlag } from "../media/feedUserFlags";

export interface BookmarkResult {
  contentId: string;
  bookmarked: boolean;
  isBookmarked: boolean;
  bookmarkCount: number;
  saves: number;
  bookmarkId?: string;
}

export class BookmarkToggleError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "BookmarkToggleError";
    this.statusCode = statusCode;
    this.code = code;
  }
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

/**
 * Map feed / FE aliases to the collection bookmark supports.
 * Aligns with like aliases; Media-card "devotional" also bookmarks Media (not Devotional coll).
 */
export function mapBookmarkContentType(raw?: string): string {
  if (!raw || typeof raw !== "string") return "media";
  const t = raw.trim().toLowerCase();
  if (
    t === "copyright_free_song" ||
    t === "copyright-free" ||
    t === "copyright_free"
  ) {
    return "copyright_free_song";
  }
  // Feed Media docs often carry contentType "devotional" — same Media collection as likes
  if (t === "devotional" || MEDIA_LIKE_ALIASES.has(t) || t === "merch") {
    return "media";
  }
  return normalizeContentType(t);
}

/** @deprecated Prefer resolveBookmarkableMedia — kept for tests / callers */
export async function verifyMediaExists(mediaId: string): Promise<boolean> {
  const doc = await resolveBookmarkableMedia(mediaId);
  return !!doc;
}

export async function toggleBookmark(
  userId: string,
  mediaId: string,
  contentTypeHint?: string
): Promise<BookmarkResult> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(mediaId)) {
    throw new BookmarkToggleError(
      "Invalid user or media ID",
      400,
      "INVALID_ID"
    );
  }

  const mapped = mapBookmarkContentType(contentTypeHint);
  if (mapped === "copyright_free_song") {
    throw new BookmarkToggleError(
      "Use POST /api/audio/copyright-free/:songId/save for copyright-free songs",
      400,
      "WRONG_ENDPOINT"
    );
  }
  if (mapped !== "media") {
    throw new BookmarkToggleError(
      `Unsupported content type for feed bookmark: ${contentTypeHint}. Use contentType "media".`,
      400,
      "UNSUPPORTED_CONTENT_TYPE"
    );
  }

  logger.info("Toggle bookmark request", {
    userId,
    mediaId,
    contentTypeHint: contentTypeHint || "media",
    timestamp: new Date().toISOString(),
  });

  // Same Media collection as likes/views — pending / under_review / processing allowed
  const content = await resolveBookmarkableMedia(mediaId);
  if (!content) {
    throw new BookmarkToggleError("Media not found", 404, "MEDIA_NOT_FOUND");
  }
  if (content.moderationStatus === "rejected") {
    throw new BookmarkToggleError(
      "This content can’t be saved",
      400,
      "MEDIA_REJECTED"
    );
  }

  // Non-transactional: standalone Mongo rejects multi-doc transactions (→ opaque 500s).
  // Duplicate key 11000 is treated as already-bookmarked.
  return toggleBookmarkWithoutTransaction(userId, mediaId);
}

async function finalizeBookmarkResult(
  userId: string,
  mediaId: string,
  bookmarked: boolean,
  bookmarkId?: string
): Promise<BookmarkResult> {
  const bookmarkCount = Math.max(0, await getBookmarkCount(mediaId));
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

  return finalizeBookmarkResult(userId, mediaId, bookmarked, bookmarkId);
}
