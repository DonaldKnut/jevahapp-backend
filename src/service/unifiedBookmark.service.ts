import mongoose, { Types, ClientSession } from "mongoose";
import { Bookmark } from "../models/bookmark.model";
import { Media } from "../models/media.model";
import logger from "../utils/logger";
import { AuditService } from "./audit.service";
import { NotificationService } from "./notification.service";

export interface BookmarkResult {
  bookmarked: boolean;
  bookmarkCount: number;
}

export class UnifiedBookmarkService {
  /**
   * Toggle bookmark status (save/unsave)
   */
  static async toggleBookmark(
    userId: string,
    mediaId: string
  ): Promise<BookmarkResult> {
    // Enhanced validation
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
        // Verify media exists
        const mediaExists = await this.verifyMediaExists(mediaId, session);
        if (!mediaExists) {
          throw new Error(`Media not found: ${mediaId}`);
        }

        // Check existing bookmark
        const existingBookmark = await Bookmark.findOne({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(mediaId),
        }).session(session);

        if (existingBookmark) {
          // Remove bookmark (unsave)
          await Bookmark.findByIdAndDelete(existingBookmark._id, { session });
          bookmarked = false;

          logger.info("Bookmark removed", {
            userId,
            mediaId,
            bookmarkId: existingBookmark._id,
          });
        } else {
          // Add bookmark (save)
          const newBookmark = await Bookmark.create(
            [
              {
                user: new Types.ObjectId(userId),
                media: new Types.ObjectId(mediaId),
              },
            ],
            { session }
          );
          bookmarked = true;

          logger.info("Bookmark created", {
            userId,
            mediaId,
            bookmarkId: newBookmark[0]._id,
          });
        }
      });

      const bookmarkCount = await this.getBookmarkCount(mediaId);

      // Send notification only when a bookmark is added (not removed)
      if (bookmarked) {
        try {
          await NotificationService.notifyContentBookmark(
            userId,
            mediaId,
            "media"
          );
        } catch (notificationError: any) {
          // Do not fail the operation if notification sending fails
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

      // Audit log (media_save when bookmarked; media_remove when unbookmarked)
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

  /**
   * Verify media exists in database
   */
  private static async verifyMediaExists(
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

  /**
   * Get bookmark count for media
   */
  static async getBookmarkCount(mediaId: string): Promise<number> {
    try {
      return await Bookmark.countDocuments({
        media: new Types.ObjectId(mediaId),
      });
    } catch (error: any) {
      logger.error("Failed to get bookmark count", {
        mediaId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Check if user has bookmarked media
   */
  static async isBookmarked(userId: string, mediaId: string): Promise<boolean> {
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

  /**
   * Get user's bookmarked media with pagination
   */
  static async getUserBookmarks(
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

      // First, get bookmarks with populated media, filtering out any with null media
      const bookmarks = await Bookmark.find({
        user: new Types.ObjectId(userId),
      })
        .populate({
          path: "media",
          match: { _id: { $exists: true } }, // Only populate if media exists
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Filter out bookmarks where media is null (orphaned bookmarks)
      const validBookmarks = bookmarks.filter(
        bookmark => bookmark.media !== null
      );

      // Clean up orphaned bookmarks in the background (don't await)
      const orphanedBookmarks = bookmarks.filter(
        bookmark => bookmark.media === null
      );
      if (orphanedBookmarks.length > 0) {
        logger.warn("Found orphaned bookmarks, cleaning up", {
          userId,
          orphanedCount: orphanedBookmarks.length,
          orphanedIds: orphanedBookmarks.map(b => b._id),
        });

        // Clean up orphaned bookmarks asynchronously
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

      const bookmarkedMedia = validBookmarks.map(bookmark => ({
        ...bookmark.media.toObject(),
        isBookmarked: true,
        bookmarkedAt: bookmark.createdAt,
        bookmarkId: bookmark._id,
      }));

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

  /**
   * Get bookmark statistics for media
   */
  static async getBookmarkStats(mediaId: string): Promise<{
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

  /**
   * Bulk bookmark operations
   */
  static async bulkBookmark(
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
              const created = await Bookmark.create({
                user: new Types.ObjectId(userId),
                media: new Types.ObjectId(mediaId),
              });
              // Fire-and-forget notification for each added bookmark
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
            await Bookmark.findOneAndDelete({
              user: new Types.ObjectId(userId),
              media: new Types.ObjectId(mediaId),
            });
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
}
