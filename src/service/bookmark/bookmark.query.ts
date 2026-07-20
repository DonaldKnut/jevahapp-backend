import { Types } from "mongoose";
import { Bookmark } from "../../models/bookmark.model";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";

export async function getBookmarkCount(mediaId: string): Promise<number> {
  try {
    const media = await Media.findById(mediaId).select("bookmarkCount").lean();
    return (media as any)?.bookmarkCount || 0;
  } catch (error: any) {
    logger.error("Failed to get bookmark count", {
      mediaId,
      error: error.message,
    });
    return 0;
  }
}

export async function isBookmarked(userId: string, mediaId: string): Promise<boolean> {
  try {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(mediaId)) {
      return false;
    }

    const bookmark = await Bookmark.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(mediaId),
    });
    return !!bookmark;
  } catch (error: any) {
    logger.error("Failed to check bookmark status", {
      userId,
      mediaId,
      error: error.message,
    });
    return false;
  }
}

export async function getUserBookmarks(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  bookmarks: any[];
  total: number;
  page: number;
  totalPages: number;
}> {
  try {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const skip = (page - 1) * limit;

    const bookmarks = await Bookmark.find({
      user: new Types.ObjectId(userId),
    })
      .populate({
        path: "media",
        match: { _id: { $exists: true } },
        select:
          "title description contentType category thumbnailUrl fileUrl likeCount viewCount commentCount bookmarkCount createdAt uploadedBy moderationStatus isHidden",
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const validBookmarks = bookmarks.filter(
      bookmark => bookmark.media !== null
    );

    const orphanedBookmarks = bookmarks.filter(
      bookmark => bookmark.media === null
    );
    if (orphanedBookmarks.length > 0) {
      logger.warn("Found orphaned bookmarks, cleaning up", {
        userId,
        orphanedCount: orphanedBookmarks.length,
        orphanedIds: orphanedBookmarks.map(b => b._id),
      });

      Bookmark.deleteMany({
        _id: { $in: orphanedBookmarks.map(b => b._id) },
      }).catch(cleanupError => {
        logger.error("Failed to clean up orphaned bookmarks", {
          error: cleanupError.message,
          userId,
        });
      });
    }

    const total = await Bookmark.countDocuments({
      user: new Types.ObjectId(userId),
    });

    const bookmarkedMedia = validBookmarks.map((bookmark: any) => {
      const mediaDoc = bookmark.media?.toObject
        ? bookmark.media.toObject()
        : bookmark.media;
      return {
        ...mediaDoc,
        isBookmarked: true,
        bookmarkedAt: bookmark.createdAt,
        bookmarkId: bookmark._id,
      };
    });

    logger.info("Get user bookmarks successful", {
      userId,
      page,
      limit,
      totalBookmarks: total,
      validBookmarks: validBookmarks.length,
      orphanedBookmarks: orphanedBookmarks.length,
    });

    return {
      bookmarks: bookmarkedMedia,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error: any) {
    logger.error("Failed to get user bookmarks", {
      userId,
      page,
      limit,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function getBookmarkStats(mediaId: string): Promise<{
  totalBookmarks: number;
  recentBookmarks: any[];
}> {
  try {
    if (!Types.ObjectId.isValid(mediaId)) {
      throw new Error("Invalid media ID");
    }

    const totalBookmarks = await Bookmark.countDocuments({
      media: new Types.ObjectId(mediaId),
    });

    const recentBookmarks = await Bookmark.find({
      media: new Types.ObjectId(mediaId),
    })
      .populate("user", "firstName lastName avatar")
      .sort({ createdAt: -1 })
      .limit(10);

    return {
      totalBookmarks,
      recentBookmarks: recentBookmarks.map(bookmark => ({
        user: bookmark.user,
        bookmarkedAt: bookmark.createdAt,
      })),
    };
  } catch (error: any) {
    logger.error("Failed to get bookmark stats", {
      mediaId,
      error: error.message,
    });
    throw error;
  }
}
