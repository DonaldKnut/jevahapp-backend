import mongoose, { Types, ClientSession } from "mongoose";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { Media } from "../models/media.model";
import { User } from "../models/user.model";
import { Devotional } from "../models/devotional.model";
// Removed: import { DevotionalLike } from "../models/devotionalLike.model"; - devotional likes will be separate system
import { NotificationService } from "./notification.service";
import viralContentService from "./viralContent.service";
import mentionDetectionService from "./mentionDetection.service";
import logger from "../utils/logger";
import { Bookmark } from "../models/bookmark.model";
import { getUserLikeState, setUserLikeState, getPostCounter, incrPostCounter } from "../lib/redisCounters";

export interface ContentInteractionInput {
  userId: string;
  contentId: string;
  contentType:
    | "media"
    | "artist"
    | "merch"
    | "ebook"
    | "podcast"; // Note: devotional likes removed - will be separate system
  actionType: "like" | "comment" | "share" | "favorite" | "bookmark";
  content?: string; // For comments
  parentCommentId?: string; // For nested comments
  reactionType?: string; // For reactions
}

export interface ContentMetadata {
  id: string;
  title: string;
  description?: string;
  contentType: string;
  author?: {
    id: string;
    name: string;
    avatar?: string;
  };
  stats: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
    downloads?: number;
  };
  userInteraction: {
    hasLiked: boolean;
    hasCommented: boolean;
    hasShared: boolean;
    hasFavorited: boolean;
    hasBookmarked: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class ContentInteractionService {
  private async applyLikeDeltaToMedia(
    mediaId: string,
    delta: number,
    session: ClientSession
  ): Promise<void> {
    await Media.findByIdAndUpdate(
      mediaId,
      [
        {
          $set: {
            likeCount: {
              $max: [
                0,
                {
                  $add: [{ $ifNull: ["$likeCount", 0] }, delta],
                },
              ],
            },
          },
        },
      ],
      { session }
    );
  }

  // Removed: applyLikeDeltaToDevotional - devotional likes will be separate system in future

  private sanitizeCommentContent(raw: string): {
    text: string;
    hadProfanity: boolean;
  } {
    const urlRegex = /(https?:\/\/|www\.)[^\s]+/gi;
    let text = (raw || "").toString();
    text = text.replace(urlRegex, "");
    const list = (process.env.PROFANITY_BLOCK_LIST || "")
      .split(",")
      .map(w => w.trim())
      .filter(Boolean);
    let hadProfanity = false;
    for (const word of list) {
      const pattern = new RegExp(
        `\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
        "ig"
      );
      if (pattern.test(text)) {
        hadProfanity = true;
        text = text.replace(pattern, "***");
      }
    }
    return { text: text.trim(), hadProfanity };
  }
  /**
   * Fast toggle like using Redis (returns immediately)
   * This is the primary path for user requests - returns fast with optimistic updates
   */
  async toggleLikeFast(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<{ contentId: string; liked: boolean; likeCount: number }> {
    // Normalize contentType: ebook and podcast are just Media collection items
    const normalizedContentType = this.normalizeContentType(contentType);
    
    // Validate content type (devotional likes removed - will be separate system in future)
    const validContentTypes = ["media", "artist", "merch"];
    if (!validContentTypes.includes(normalizedContentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Check current like state in Redis (fast)
    const currentLiked = await getUserLikeState({ userId, contentId });
    
    // Toggle state (optimistic)
    const newLiked = currentLiked === null ? true : !currentLiked;
    
    // Update Redis immediately (non-blocking)
    setUserLikeState({ userId, contentId, liked: newLiked });
    
    // Update counter in Redis
    const delta = newLiked ? 1 : -1;
    const newCount = await incrPostCounter({ postId: contentId, field: "likes", delta });
    
    // Get base count from DB if Redis doesn't have it (fallback)
    let likeCount = newCount;
    if (likeCount === null) {
      // Fallback to DB count (slower, but ensures correctness)
      likeCount = await this.getLikeCount(contentId, normalizedContentType);
      // Update Redis with DB count
      if (likeCount !== null) {
        const redisCount = likeCount + delta;
        incrPostCounter({ postId: contentId, field: "likes", delta: redisCount - likeCount }).catch(() => {});
        likeCount = redisCount;
      }
    }

    // Emit real-time update (non-blocking)
    try {
      const io = require("../socket/socketManager").getIO();
      if (io) {
        const payload = {
          contentId,
          contentType: normalizedContentType, // Use normalized contentType for consistency
          likeCount: likeCount || 0,
          userLiked: newLiked,
          userId,
          timestamp: new Date().toISOString(),
        };
        io.emit("content-like-update", payload);
        const roomKey = normalizedContentType ? `content:${normalizedContentType}:${contentId}` : `content:${contentId}`;
        io.to(roomKey).emit("like-updated", payload);
      }
    } catch (socketError) {
      // Non-blocking
    }

    return {
      contentId,
      liked: newLiked,
      likeCount: likeCount || 0,
    };
  }

  /**
   * Toggle like on any content type (DB sync - runs in background)
   * This ensures DB consistency but doesn't block the request
   */
  async toggleLike(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<{ contentId: string; liked: boolean; likeCount: number }> {
    // Enhanced validation
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid user or content ID");
    }

    // Normalize contentType: ebook and podcast are just Media collection items
    const normalizedContentType = this.normalizeContentType(contentType);

    // Validate content type (devotional likes removed - will be separate system in future)
    const validContentTypes = ["media", "artist", "merch"];
    if (!validContentTypes.includes(normalizedContentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    logger.info("Toggle like request", {
      userId,
      contentId,
      contentType,
      timestamp: new Date().toISOString(),
    });

    const session: ClientSession = await Media.startSession();
    try {
      let liked = false;
      let contentExists = false;

      await session.withTransaction(async () => {
        // First, verify content exists (use normalized contentType)
        contentExists = await this.verifyContentExists(
          contentId,
          normalizedContentType,
          session
        );

        if (!contentExists) {
          throw new Error(
            `Content not found: ${contentType} with ID ${contentId}`
          );
        }

        // Check if user is trying to like their own content (optional business rule)
        const isOwnContent = await this.isUserOwnContent(
          userId,
          contentId,
          normalizedContentType,
          session
        );
        if (isOwnContent) {
          logger.info("User attempting to like own content", {
            userId,
            contentId,
            contentType,
          });
          // Allow self-likes but log for analytics
        }

        // Handle different content types (using normalized contentType)
        // Note: devotional likes removed - will be separate system in future
        switch (normalizedContentType) {
          case "media":
            // Handles: media, ebook, podcast (all Media collection items: videos, audio, ebooks, etc.)
            liked = await this.toggleMediaLike(userId, contentId, session);
            break;
          case "artist":
            liked = await this.toggleArtistFollow(userId, contentId, session);
            break;
          case "merch":
            liked = await this.toggleMerchFavorite(userId, contentId, session);
            break;
          default:
            throw new Error(`Unsupported content type: ${normalizedContentType}`);
        }
      });

      // Read the updated like count after transaction commits
      const likeCount = await this.getLikeCount(contentId, normalizedContentType);

      // Sync Redis counter with DB (background sync)
      if (likeCount !== null) {
        const redisCount = await getPostCounter({ postId: contentId, field: "likes" });
        if (redisCount === null || Math.abs(redisCount - likeCount) > 5) {
          // Redis is out of sync, update it (but don't block)
          incrPostCounter({ postId: contentId, field: "likes", delta: likeCount - (redisCount || 0) }).catch(() => {});
        }
      }

      // Send notification if content was liked (background, non-blocking)
      if (liked) {
        // Run notifications in background (don't await)
        Promise.all([
          normalizedContentType === "artist"
            ? NotificationService.notifyUserFollow(userId, contentId)
            : NotificationService.notifyContentLike(userId, contentId, normalizedContentType),
          this.getContentById(contentId, contentType).then((contentData) =>
            NotificationService.notifyPublicActivity(
              userId,
              "like",
              contentId,
              normalizedContentType,
              contentData?.title
            )
          ),
          viralContentService.checkViralMilestones(
            contentId,
            normalizedContentType as "media"
          ),
        ]).catch((err) => {
          logger.error("Background notification failed", {
            error: err.message,
            userId,
            contentId,
            contentType,
          });
        });
      }

      return {
        contentId,
        liked,
        likeCount,
      };
    } catch (error: any) {
      logger.error("Toggle like transaction failed", {
        error: error.message,
        userId,
        contentId,
        contentType,
        timestamp: new Date().toISOString(),
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Share content
   */
  async shareContent(
    userId: string,
    contentId: string,
    contentType: string,
    sharePlatform?: string
  ): Promise<{ shared: boolean; shareCount: number }> {
    try {
      const session = await Media.startSession();

      try {
        let shared = false;
        let shareCount = 0;

        await session.withTransaction(async () => {
          // Verify content exists
          const contentExists = await this.verifyContentExists(
            contentId,
            contentType,
            session
          );

          if (!contentExists) {
            throw new Error(
              `Content not found: ${contentType} with ID ${contentId}`
            );
          }

          // Increment share count
          if (contentType === "media") {
            await Media.findByIdAndUpdate(
              contentId,
              { $inc: { shareCount: 1 } },
              { session }
            );
          } else if (contentType === "devotional") {
            await Devotional.findByIdAndUpdate(
              contentId,
              { $inc: { shareCount: 1 } },
              { session }
            );
          }

          shared = true;
        });

        // Get updated share count
        shareCount = await this.getShareCount(contentId, contentType);

        // Send notifications
        if (shared) {
          try {
            await NotificationService.notifyContentShare(
              userId,
              contentId,
              contentType,
              sharePlatform
            );

            // Send public activity notification to followers
            const content = await this.getContentById(contentId, contentType);
            await NotificationService.notifyPublicActivity(
              userId,
              "share",
              contentId,
              contentType,
              content?.title
            );

            // Check for viral milestones
            await viralContentService.checkViralMilestones(
              contentId,
              contentType as "media" | "devotional"
            );

            logger.info("Share notification sent", {
              userId,
              contentId,
              contentType,
              sharePlatform,
            });
          } catch (notificationError: any) {
            logger.error("Failed to send share notification", {
              error: notificationError.message,
              userId,
              contentId,
              contentType,
            });
          }
        }

        return { shared, shareCount };
      } finally {
        session.endSession();
      }
    } catch (error: any) {
      logger.error("Share content failed", {
        error: error.message,
        userId,
        contentId,
        contentType,
      });
      throw error;
    }
  }

  /**
   * Add comment to any content type
   */
  async addComment(
    userId: string,
    contentId: string,
    contentType: string,
    content: string,
    parentCommentId?: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid user or content ID");
    }

    if (!content || content.trim().length === 0) {
      throw new Error("Comment content is required");
    }

    // Normalize contentType: ebook and podcast are just Media collection items
    const normalizedContentType = this.normalizeContentType(contentType);

    // Support media (includes ebook, podcast) and devotional
    if (!["media", "devotional"].includes(normalizedContentType)) {
      throw new Error(
        `Comments not supported for content type: ${contentType}`
      );
    }

    const session: ClientSession = await Media.startSession();
    try {
      const { text: sanitizedText } = this.sanitizeCommentContent(content);
      const comment = await session.withTransaction(async () => {
        const commentData: any = {
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "comment",
          content: sanitizedText,
        };

        if (parentCommentId && Types.ObjectId.isValid(parentCommentId)) {
          commentData.parentCommentId = new Types.ObjectId(parentCommentId);
        }

        const comment = await MediaInteraction.create([commentData], {
          session,
        });

        // Update content comment count
        if (normalizedContentType === "media") {
          // Handles all Media collection items (videos, music, audio, ebook, podcast, etc.)
          await Media.findByIdAndUpdate(
            contentId,
            { $inc: { commentCount: 1 } },
            { session }
          );
        } else if (normalizedContentType === "devotional") {
          await Devotional.findByIdAndUpdate(
            contentId,
            { $inc: { commentCount: 1 } },
            { session }
          );
        }

        // If this is a reply, increment parent's replyCount
        if (commentData.parentCommentId) {
          await MediaInteraction.findByIdAndUpdate(
            commentData.parentCommentId,
            { $inc: { replyCount: 1 } },
            { session }
          );
        }

        return comment[0];
      });

      // Send notification if comment was added
      try {
        await NotificationService.notifyContentComment(
          userId,
          contentId,
          contentType,
          content
        );

        // If this is a reply to an existing comment, notify the original commenter
        if (parentCommentId && Types.ObjectId.isValid(parentCommentId)) {
          try {
            const parentComment =
              await MediaInteraction.findById(parentCommentId).select("user");
            if (parentComment && parentComment.user.toString() !== userId) {
              const replier = await User.findById(userId).select(
                "firstName lastName email"
              );
              const replierName =
                (replier?.firstName || "").toString() ||
                replier?.email ||
                "Someone";

              await NotificationService.createNotification({
                userId: parentComment.user.toString(),
                type: "reply" as any,
                title: "New Reply",
                message: `${replierName} replied to your comment`,
                metadata: {
                  contentId,
                  contentType,
                  parentCommentId,
                  replyPreview: content.substring(0, 100),
                },
                priority: "medium",
              } as any);
            }
          } catch (replyNotifyError: any) {
            logger.warn("Failed to send reply notification", {
              error: replyNotifyError?.message,
              userId,
              contentId,
              parentCommentId,
            });
          }
        }

        // Send public activity notification to followers
        const contentData = await this.getContentById(contentId, contentType);
        await NotificationService.notifyPublicActivity(
          userId,
          "comment",
          contentId,
          contentType,
          contentData?.title
        );

        // Detect and notify mentions
        await mentionDetectionService.detectAndNotifyMentions(
          userId,
          contentId,
          normalizedContentType,
          content
        );

        // Check for viral milestones
        await viralContentService.checkViralMilestones(
          contentId,
          normalizedContentType as "media"
        );

        logger.info("Comment notification sent", {
          userId,
          contentId,
          contentType,
        });
      } catch (notificationError: any) {
        // Don't fail the comment operation if notification fails
        logger.error("Failed to send comment notification", {
          error: notificationError.message,
          userId,
          contentId,
          contentType,
        });
      }

      // Populate user info for response
      const populatedComment = await MediaInteraction.findById(comment._id)
        .populate("user", "firstName lastName avatar")
        .populate("parentCommentId", "content user")
        .lean();

      // Format comment for frontend compatibility
      const formattedComment = this.formatCommentWithReplies(populatedComment, false);
      formattedComment.replies = []; // New comments don't have replies yet

      // Emit real-time new comment with updated commentCount
      try {
        const io = require("../socket/socketManager").getIO();
        if (io) {
          const roomKey = `content:${normalizedContentType}:${contentId}`;
          
          // Get updated comment count (including replies)
          const topLevelCount = await MediaInteraction.countDocuments({
            media: new Types.ObjectId(contentId),
            interactionType: "comment",
            isRemoved: { $ne: true },
            isHidden: { $ne: true },
            parentCommentId: { $exists: false },
          });
          const replyCount = await MediaInteraction.countDocuments({
            media: new Types.ObjectId(contentId),
            interactionType: "comment",
            isRemoved: { $ne: true },
            isHidden: { $ne: true },
            parentCommentId: { $exists: true },
          });
          const commentCount = topLevelCount + replyCount;
          
          const payload = {
            contentId,
            contentType: normalizedContentType, // Use normalized contentType
            commentId: formattedComment.id || formattedComment._id,
            action: "created",
            commentCount, // Per spec: include updated commentCount
          };
          // Emit to the specific content room (per spec: content:contentType:contentId)
          io.to(roomKey).emit("content:comment", payload);
          // Also emit the full comment for immediate UI updates
          io.to(roomKey).emit("new-comment", formattedComment);
        }
      } catch {}

      return formattedComment;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get comments for content
   */
  /**
   * Helper function to format comment with nested replies and frontend-compatible fields
   */
  private formatCommentWithReplies(comment: any, includeReplies: boolean = true): any {
    // Calculate reactions count
    const reactionsCount = comment.reactions
      ? Object.values(comment.reactions as Record<string, any[]>).reduce(
          (sum: number, arr: any[]) => sum + arr.length,
          0
        )
      : 0;

    const likeReactions = comment.reactions?.["like"] || [];
    const likesCount = likeReactions.length;

    const formatted: any = {
      _id: comment._id,
      id: comment._id.toString(), // Alias for frontend compatibility
      content: comment.content,
      comment: comment.content, // Spec-compliant alias
      authorId: comment.user?._id?.toString() || comment.user?.toString(),
      userId: comment.user?._id?.toString() || comment.user?.toString(), // Alias
      // Provide both 'user' and 'author' for frontend compatibility
      user: comment.user
        ? {
            _id: comment.user._id || comment.user,
            id: (comment.user._id || comment.user).toString(),
            firstName: comment.user.firstName || "",
            lastName: comment.user.lastName || "",
            username: comment.user.username || comment.user.firstName?.toLowerCase()?.replace(/\s+/g, "_") || null,
            avatar: comment.user.avatar || null,
          }
        : null,
      author: comment.user
        ? {
            _id: comment.user._id || comment.user,
            firstName: comment.user.firstName || "",
            lastName: comment.user.lastName || "",
            avatar: comment.user.avatar || null,
          }
        : null,
      createdAt: comment.createdAt,
      timestamp: comment.createdAt, // Alias (ISO string)
      reactionsCount,
      likes: likesCount, // Alias for frontend
      likesCount: likesCount, // Spec-compliant field name
      replyCount: comment.replyCount || 0,
      parentCommentId: comment.parentCommentId
        ? (typeof comment.parentCommentId === "string"
            ? comment.parentCommentId
            : comment.parentCommentId._id?.toString() || comment.parentCommentId.toString())
        : undefined,
      replies: [], // Will be populated if includeReplies is true
      isLiked: false, // Will be set by formatCommentWithIsLiked if userId provided
    };

    // Add nested replies if requested (limit to first 50 replies per comment)
    if (includeReplies && comment._id) {
      // This will be populated by the calling function
    }

    return formatted;
  }

  /**
   * Helper function to add isLiked field to comment based on userId
   */
  private async formatCommentWithIsLiked(comment: any, userId?: string): Promise<any> {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      comment.isLiked = false;
      // Also format replies
      if (comment.replies && Array.isArray(comment.replies)) {
        comment.replies = comment.replies.map((reply: any) => {
          reply.isLiked = false;
          return reply;
        });
      }
      return comment;
    }

    const userIdObj = new Types.ObjectId(userId);
    
    // Check if user liked this comment
    const likeReactions = comment.reactions?.["like"] || [];
    const isLiked = likeReactions.some(
      (id: any) => (id.toString ? id.toString() : String(id)) === userIdObj.toString()
    );
    comment.isLiked = isLiked;

    // Also format replies with isLiked
    if (comment.replies && Array.isArray(comment.replies)) {
      comment.replies = comment.replies.map((reply: any) => {
        const replyLikeReactions = reply.reactions?.["like"] || [];
        reply.isLiked = replyLikeReactions.some(
          (id: any) => (id.toString ? id.toString() : String(id)) === userIdObj.toString()
        );
        return reply;
      });
    }

    return comment;
  }

  /**
   * Helper function to fetch and format replies for a comment
   */
  private async fetchCommentReplies(
    commentId: Types.ObjectId,
    limit: number = 50
  ): Promise<any[]> {
    const replies = await MediaInteraction.find({
      parentCommentId: commentId,
      interactionType: "comment",
      isRemoved: { $ne: true },
      isHidden: { $ne: true },
    })
      .populate("user", "firstName lastName avatar")
      .sort("createdAt")
      .limit(limit)
      .lean();

    return replies.map((reply: any) => this.formatCommentWithReplies(reply, false));
  }

  async getContentComments(
    contentId: string,
    contentType: string,
    page: number = 1,
    limit: number = 20,
    sortBy: "newest" | "oldest" | "top" = "newest",
    userId?: string // Optional, for isLiked calculation
  ): Promise<any> {
    if (!Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid content ID");
    }

    // Normalize contentType: ebook and podcast are just Media collection items
    const normalizedContentType = this.normalizeContentType(contentType);

    if (!["media", "devotional"].includes(normalizedContentType)) {
      throw new Error("Comments not supported for this content type");
    }

    const skip = (page - 1) * limit;

    // For now, we'll use MediaInteraction for both media and devotional
    // TODO: Create a more generic ContentInteraction model in the future
    // Return top-level comments with nested replies array
    if (sortBy === "top") {
      // Aggregate to compute a rough score: replyCount + total reactions
      const pipeline: any[] = [
        {
          $match: {
            media: new Types.ObjectId(contentId),
            interactionType: "comment",
            isRemoved: { $ne: true },
            isHidden: { $ne: true },
            parentCommentId: { $exists: false },
          },
        },
        {
          $addFields: {
            reactionsArray: { $objectToArray: "$reactions" },
          },
        },
        {
          $addFields: {
            reactionTotal: {
              $sum: {
                $map: {
                  input: "$reactionsArray",
                  as: "r",
                  in: { $size: "$$r.v" },
                },
              },
            },
          },
        },
        {
          $addFields: {
            score: { $add: ["$replyCount", "$reactionTotal"] },
          },
        },
        { $sort: { score: -1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ];

      const comments = await MediaInteraction.aggregate(pipeline);

      // Populate user after aggregation
      const ids = comments.map((c: any) => c._id);
      const withUsers = await MediaInteraction.find({ _id: { $in: ids } })
        .populate("user", "firstName lastName avatar")
        .lean();
      const map: any = new Map(
        withUsers.map((c: any) => [c._id.toString(), c])
      );
      const ordered = comments.map((c: any) => ({
        ...map.get(c._id.toString()),
        score: c.score,
      }));

      // Fetch nested replies for each comment
      const commentsWithReplies = await Promise.all(
        ordered.map(async (comment: any) => {
          const formatted = this.formatCommentWithReplies(comment, true);
          const replies = await this.fetchCommentReplies(comment._id);
          formatted.replies = replies;
          return formatted;
        })
      );

      // Count total comments INCLUDING replies (per spec: commentCount = topLevelCount + replyCount)
      const topLevelCount = await MediaInteraction.countDocuments({
        media: new Types.ObjectId(contentId),
        interactionType: "comment",
        isRemoved: { $ne: true },
        isHidden: { $ne: true },
        parentCommentId: { $exists: false },
      });

      const replyCount = await MediaInteraction.countDocuments({
        media: new Types.ObjectId(contentId),
        interactionType: "comment",
        isRemoved: { $ne: true },
        isHidden: { $ne: true },
        parentCommentId: { $exists: true },
      });

      const total = topLevelCount + replyCount; // Total includes replies per spec
      const hasMore = (page * limit) < topLevelCount; // hasMore based on top-level pagination

      // Format comments with isLiked if userId provided
      const formattedComments = await Promise.all(
        commentsWithReplies.map(async (comment: any) => {
          return await this.formatCommentWithIsLiked(comment, userId);
        })
      );

      return {
        comments: formattedComments,
        total: total, // Spec requires 'total' field
        totalComments: total, // Alias for backwards compatibility
        hasMore,
        page,
        limit,
      };
    }

    const sortStageStr = sortBy === "oldest" ? "createdAt" : "-createdAt";

    const comments = await MediaInteraction.find({
      media: new Types.ObjectId(contentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      isHidden: { $ne: true },
      parentCommentId: { $exists: false },
    })
      .populate("user", "firstName lastName avatar")
      .sort(sortStageStr)
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch nested replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment: any) => {
        const formatted = this.formatCommentWithReplies(comment, true);
        const replies = await this.fetchCommentReplies(comment._id);
        formatted.replies = replies;
        return formatted;
      })
    );

    // Count total comments INCLUDING replies (per spec: commentCount = topLevelCount + replyCount)
    const topLevelCount = await MediaInteraction.countDocuments({
      media: new Types.ObjectId(contentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      isHidden: { $ne: true },
      parentCommentId: { $exists: false },
    });

    const replyCount = await MediaInteraction.countDocuments({
      media: new Types.ObjectId(contentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      isHidden: { $ne: true },
      parentCommentId: { $exists: true },
    });

    const total = topLevelCount + replyCount; // Total includes replies per spec
    const hasMore = (page * limit) < topLevelCount; // hasMore based on top-level pagination

    // Format comments with isLiked if userId provided
    const formattedComments = await Promise.all(
      commentsWithReplies.map(async (comment: any) => {
        return await this.formatCommentWithIsLiked(comment, userId);
      })
    );

    return {
      comments: formattedComments,
      total: total, // Spec requires 'total' field
      totalComments: total, // Alias for backwards compatibility
      hasMore,
      page,
      limit,
    };
  }

  /**
   * Toggle reaction (like) on a comment
   */
  async toggleCommentReaction(
    commentId: string,
    userId: string,
    reactionType: string = "like"
  ): Promise<{ liked: boolean; totalLikes: number }> {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }

    const comment = await MediaInteraction.findOne({
      _id: new Types.ObjectId(commentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
    });

    if (!comment) {
      throw new Error("Comment not found");
    }

    // Handle reactions - Mongoose Maps can be Map or plain object when loaded
    let reactions: any = comment.reactions;
    
    // Convert to Map if it's a plain object
    if (!(reactions instanceof Map)) {
      reactions = new Map(Object.entries(reactions || {}));
    }

    // Get reaction array for the specified type
    const reactionArray = reactions.get(reactionType) || [];
    const userIdObj = new Types.ObjectId(userId);
    const userIdStr = userIdObj.toString();

    // Check if user already reacted
    const hasReacted = reactionArray.some(
      (id: any) => (id.toString ? id.toString() : String(id)) === userIdStr
    );

    let liked: boolean;

    if (hasReacted) {
      // Remove reaction (unlike)
      const filtered = reactionArray.filter(
        (id: any) => (id.toString ? id.toString() : String(id)) !== userIdStr
      );
      reactions.set(reactionType, filtered);
      liked = false;
    } else {
      // Add reaction (like)
      reactionArray.push(userIdObj);
      reactions.set(reactionType, reactionArray);
      liked = true;
    }

    // Update comment with new reactions
    comment.reactions = reactions;
    await comment.save();

    // Calculate total likes (sum of all reaction types, or just "like" if it exists)
    const likeReactions = reactions.get("like") || [];
    const reactionTotal = reactions.get(reactionType) || [];
    const totalLikes = reactionType === "like" 
      ? likeReactions.length 
      : (reactions.get("like") || []).length;

    logger.info("Comment reaction toggled", {
      commentId,
      userId,
      reactionType,
      liked,
      totalLikes,
    });

    return { liked, totalLikes };
  }

  /**
   * Get replies for a specific comment
   */
  async getCommentReplies(
    commentId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new Error("Invalid comment ID");
    }

    const skip = (page - 1) * limit;

    const replies = await MediaInteraction.find({
      parentCommentId: new Types.ObjectId(commentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      isHidden: { $ne: true },
    })
      .populate("user", "firstName lastName avatar")
      .sort("createdAt")
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await MediaInteraction.countDocuments({
      parentCommentId: new Types.ObjectId(commentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      isHidden: { $ne: true },
    });

    return {
      replies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Edit a comment (owner only)
   */
  async editContentComment(
    commentId: string,
    userId: string,
    newContent: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }
    if (!newContent || newContent.trim().length === 0) {
      throw new Error("Comment content is required");
    }

    const comment = await MediaInteraction.findOne({
      _id: new Types.ObjectId(commentId),
      user: new Types.ObjectId(userId),
      interactionType: "comment",
      isRemoved: { $ne: true },
    });

    if (!comment) {
      throw new Error(
        "Comment not found or you don't have permission to edit it"
      );
    }

    const { text: sanitized } = this.sanitizeCommentContent(newContent);
    await MediaInteraction.findByIdAndUpdate(commentId, {
      content: sanitized,
    });

    const updatedDoc = await MediaInteraction.findById(commentId).populate(
      "user",
      "firstName lastName avatar"
    );
    const updated: any = updatedDoc?.toObject
      ? updatedDoc.toObject()
      : updatedDoc;

    // Emit real-time edit
    try {
      const io = require("../socket/socketManager").getIO();
      if (io) {
        io.emit("comment-edited", {
          commentId,
          content: sanitized,
        });
      }
    } catch {}

    return updated;
  }

  /**
   * Report a comment
   * Returns comment details, media details, and report count for notifications
   */
  async reportContentComment(
    commentId: string,
    userId: string,
    reason?: string
  ): Promise<{
    reportCount: number;
    comment: {
      id: string;
      content: string;
      authorId: string;
      authorName: string;
      authorEmail: string;
      createdAt: Date;
    };
    media: {
      id: string;
      title: string;
      contentType: string;
      uploaderEmail: string;
    };
  }> {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }

    // Fetch comment with populated user and media
    const commentDoc = await MediaInteraction.findById(commentId)
      .populate("user", "firstName lastName email username")
      .populate("media", "title contentType uploadedBy");

    if (!commentDoc) {
      throw new Error("Comment not found");
    }

    // Check if comment is actually a comment type
    if (commentDoc.interactionType !== "comment") {
      throw new Error("Invalid comment ID");
    }

    // Check if user is trying to report their own comment
    const commentAuthorId = commentDoc.user?.toString();
    if (commentAuthorId === userId) {
      throw new Error("You cannot report your own comment");
    }

    // Check if user already reported this comment
    const reportedBy = commentDoc.reportedBy || [];
    const hasAlreadyReported = reportedBy.some(
      (id: any) => id.toString() === userId
    );

    if (hasAlreadyReported) {
      throw new Error("You have already reported this comment");
    }

    // Increment report count and add user to reportedBy array
    const update = await MediaInteraction.findByIdAndUpdate(
      commentId,
      {
        $inc: { reportCount: 1 },
        $addToSet: { reportedBy: new Types.ObjectId(userId) },
      },
      { new: true }
    );

    if (!update) {
      throw new Error("Failed to update comment report");
    }

    const newReportCount = update.reportCount || 0;

    // Get comment author info
    const author = commentDoc.user as any;
    const authorName =
      (author?.firstName && author?.lastName
        ? `${author.firstName} ${author.lastName}`.trim()
        : author?.username || author?.email) || "Unknown User";

    // Get media info
    const media = commentDoc.media as any;
    const mediaTitle = media?.title || "Unknown Media";
    const mediaContentType = media?.contentType || "unknown";
    const mediaId = media?._id?.toString() || commentDoc.media?.toString() || "";

    // Get media uploader email
    let uploaderEmail = "Unknown";
    const mediaUploadedBy = media?.uploadedBy;
    if (mediaUploadedBy) {
      const uploader = await User.findById(mediaUploadedBy)
        .select("email")
        .lean();
      uploaderEmail = (uploader as any)?.email || "Unknown";
    }

    return {
      reportCount: newReportCount,
      comment: {
        id: commentId,
        content: commentDoc.content || "",
        authorId: commentAuthorId || "",
        authorName,
        authorEmail: author?.email || "Unknown",
        createdAt: commentDoc.createdAt || new Date(),
      },
      media: {
        id: mediaId,
        title: mediaTitle,
        contentType: mediaContentType,
        uploaderEmail,
      },
    };
  }

  /**
   * Remove comment
   */
  async removeContentComment(commentId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }

    const comment = await MediaInteraction.findOne({
      _id: commentId,
      interactionType: "comment",
      isRemoved: { $ne: true },
    }).select("user media parentCommentId");

    if (!comment) {
      throw new Error(
        "Comment not found or you don't have permission to delete it"
      );
    }

    // Permission: owner can delete; moderators/admins can hide
    const isOwner = comment.user.toString() === userId;
    if (!isOwner) {
      throw new Error(
        "Comment not found or you don't have permission to delete it"
      );
    }

    // Soft delete the comment
    await MediaInteraction.findByIdAndUpdate(commentId, {
      isRemoved: true,
      content: "[Comment removed]",
    });

    // Decrement comment count on the content
    if (comment.media) {
      await Media.findByIdAndUpdate(comment.media, {
        $inc: { commentCount: -1 },
      });
    }

    // If it was a reply, decrement parent's replyCount
    if (comment.parentCommentId) {
      await MediaInteraction.findByIdAndUpdate(comment.parentCommentId, {
        $inc: { replyCount: -1 },
      });
    }

    // Emit real-time removal and reply count update
    try {
      const io = require("../socket/socketManager").getIO();
      if (io) {
        // Get content info to determine contentType
        const contentType = await this.getContentTypeFromMediaId(comment.media.toString());
        if (contentType) {
          const contentId = comment.media.toString();
          const roomKey = `content:${contentType}:${contentId}`;
          
          // Get updated comment count (including replies)
          const topLevelCount = await MediaInteraction.countDocuments({
            media: new Types.ObjectId(contentId),
            interactionType: "comment",
            isRemoved: { $ne: true },
            isHidden: { $ne: true },
            parentCommentId: { $exists: false },
          });
          const replyCount = await MediaInteraction.countDocuments({
            media: new Types.ObjectId(contentId),
            interactionType: "comment",
            isRemoved: { $ne: true },
            isHidden: { $ne: true },
            parentCommentId: { $exists: true },
          });
          const commentCount = topLevelCount + replyCount;
          
          // Emit content:comment event with updated count (per spec)
          io.to(roomKey).emit("content:comment", {
            contentId,
            contentType,
            commentId: commentId.toString(),
            action: "deleted",
            commentCount,
          });
        }
        
        // Also emit legacy events for backwards compatibility
        io.emit("comment-removed", { commentId });
        if (comment.parentCommentId) {
          io.emit("reply-count-updated", {
            commentId: comment.parentCommentId.toString(),
            delta: -1,
          });
        }
      }
    } catch {}
  }

  /**
   * Moderator hide comment (does not affect counts)
   */
  async moderateHideComment(
    commentId: string,
    moderatorId: string,
    reason?: string
  ): Promise<void> {
    if (
      !Types.ObjectId.isValid(commentId) ||
      !Types.ObjectId.isValid(moderatorId)
    ) {
      throw new Error("Invalid comment or user ID");
    }

    const updated = await MediaInteraction.findByIdAndUpdate(
      commentId,
      {
        isHidden: true,
        hiddenBy: new Types.ObjectId(moderatorId),
        hiddenReason: reason?.toString().slice(0, 500),
      },
      { new: true }
    ).select("_id");

    if (!updated) {
      throw new Error("Comment not found");
    }
  }

  /**
   * Get content metadata for frontend UI
   */
  async getContentMetadata(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<ContentMetadata> {
    if (!Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid content ID");
    }

    // Normalize contentType: ebook and podcast are just Media collection items
    const normalizedContentType = this.normalizeContentType(contentType);

    let content: any;
    let author: any;

    // Get content based on type
    switch (normalizedContentType) {
      case "media":
        // Handles all Media collection items (videos, music, audio, ebook, podcast, etc.)
        content = await Media.findById(contentId).populate(
          "uploadedBy",
          "firstName lastName avatar"
        );
        author = content?.uploadedBy;
        break;
      case "artist":
        content = await User.findById(contentId).select(
          "firstName lastName avatar artistProfile"
        );
        author = content;
        break;
      case "merch":
        content = await Media.findById(contentId).populate(
          "uploadedBy",
          "firstName lastName avatar"
        );
        author = content?.uploadedBy;
        break;
      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }

    if (!content) {
      throw new Error("Content not found");
    }

    // Get stats
    const stats = await this.getContentStats(contentId, contentType);

    // Get user interactions
    const userInteraction = await this.getUserInteraction(
      userId,
      contentId,
      contentType
    );

    return {
      id: content._id.toString(),
      title:
        content.title || content.firstName || content.artistProfile?.artistName,
      description:
        content.description || content.bio || content.artistProfile?.bio,
      contentType,
      author: author
        ? {
            id: author._id.toString(),
            name:
              author.firstName + " " + author.lastName ||
              author.artistProfile?.artistName,
            avatar: author.avatar,
          }
        : undefined,
      stats,
      userInteraction,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    };
  }

  /**
   * Get content statistics
   */
  private async getContentStats(
    contentId: string,
    contentType: string
  ): Promise<any> {
    // Normalize contentType: ebook and podcast are just Media collection items
    const normalizedContentType = this.normalizeContentType(contentType);
    
    switch (normalizedContentType) {
      case "media":
        // Handles all Media collection items (videos, music, audio, ebook, podcast, etc.)
        const media = await Media.findById(contentId);
        // Calculate commentCount including replies (per spec)
        const mediaTopLevelCount = await MediaInteraction.countDocuments({
          media: new Types.ObjectId(contentId),
          interactionType: "comment",
          isRemoved: { $ne: true },
          isHidden: { $ne: true },
          parentCommentId: { $exists: false },
        });
        const mediaReplyCount = await MediaInteraction.countDocuments({
          media: new Types.ObjectId(contentId),
          interactionType: "comment",
          isRemoved: { $ne: true },
          isHidden: { $ne: true },
          parentCommentId: { $exists: true },
        });
        const mediaCommentCount = mediaTopLevelCount + mediaReplyCount;
        return {
          likes: media?.likeCount || 0,
          comments: mediaCommentCount, // Includes replies per spec
          shares: media?.shareCount || 0,
          views: media?.viewCount || 0,
          downloads: media?.downloadCount || 0,
        };
      case "artist":
        const artist = await User.findById(contentId);
        return {
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0,
          followers: artist?.artistProfile?.followerCount || 0,
        };
      case "merch":
        const merch = await Media.findById(contentId);
        // Calculate commentCount including replies (per spec)
        const merchTopLevelCount = await MediaInteraction.countDocuments({
          media: new Types.ObjectId(contentId),
          interactionType: "comment",
          isRemoved: { $ne: true },
          isHidden: { $ne: true },
          parentCommentId: { $exists: false },
        });
        const merchReplyCount = await MediaInteraction.countDocuments({
          media: new Types.ObjectId(contentId),
          interactionType: "comment",
          isRemoved: { $ne: true },
          isHidden: { $ne: true },
          parentCommentId: { $exists: true },
        });
        const merchCommentCount = merchTopLevelCount + merchReplyCount;
        return {
          likes: merch?.likeCount || 0,
          comments: merchCommentCount, // Includes replies per spec
          shares: merch?.shareCount || 0,
          views: merch?.viewCount || 0,
          sales: 0, // TODO: Implement sales tracking
        };
      default:
        return { likes: 0, comments: 0, shares: 0, views: 0 };
    }
  }

  /**
   * Get user interaction status
   */
  private async getUserInteraction(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<any> {
    if (!userId) {
      return {
        hasLiked: false,
        hasCommented: false,
        hasShared: false,
        hasFavorited: false,
        hasBookmarked: false,
      };
    }

    // Validate userId format before querying
    if (!Types.ObjectId.isValid(userId)) {
      logger.warn("Invalid userId format in getUserInteraction", {
        userId,
        contentId,
        contentType,
      });
      return {
        hasLiked: false,
        hasCommented: false,
        hasShared: false,
        hasFavorited: false,
        hasBookmarked: false,
      };
    }

    try {
      const [hasLiked, hasCommented, hasShared, hasFavorited, hasBookmarked] =
        await Promise.all([
          this.checkUserLike(userId, contentId, contentType),
          this.checkUserComment(userId, contentId, contentType),
          this.checkUserShare(userId, contentId, contentType),
          this.checkUserFavorite(userId, contentId, contentType),
          this.checkUserBookmark(userId, contentId, contentType),
        ]);

      return {
        hasLiked,
        hasCommented,
        hasShared,
        hasFavorited,
        hasBookmarked,
      };
    } catch (error: any) {
      logger.error("Error in getUserInteraction", {
        error: error.message,
        userId,
        contentId,
        contentType,
      });
      // Return false for all on error to prevent UI issues
      return {
        hasLiked: false,
        hasCommented: false,
        hasShared: false,
        hasFavorited: false,
        hasBookmarked: false,
      };
    }
  }

  /**
   * Check if user has liked content
   */
  private async checkUserLike(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<boolean> {
    if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      return false;
    }

    // Normalize contentType: ebook and podcast are just Media collection items
    const normalizedContentType = this.normalizeContentType(contentType);
    
    switch (normalizedContentType) {
      case "media":
        // Handles all Media collection items
        const mediaLike = await MediaInteraction.findOne({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "like",
          isRemoved: { $ne: true },
        });
        return !!mediaLike;
      // Removed: devotional likes - will be separate system in future
      // case "devotional": - removed
      case "artist":
        const artist = await User.findById(new Types.ObjectId(userId));
        return artist?.following?.some(
          (id: any) => id.toString() === contentId
        ) || false;
      case "merch":
        // Merch uses "favorite" interactionType, not "like"
        const merchFavorite = await MediaInteraction.findOne({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "favorite",
          isRemoved: { $ne: true },
        });
        return !!merchFavorite;
      default:
        return false;
    }
  }

  /**
   * Check if user has commented on content
   */
  private async checkUserComment(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<boolean> {
    if (!["media", "devotional"].includes(contentType)) return false;
    if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      return false;
    }

    const comment = await MediaInteraction.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(contentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
    });
    return !!comment;
  }

  /**
   * Check if user has shared content
   */
  private async checkUserShare(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<boolean> {
    if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      return false;
    }

    const share = await MediaInteraction.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(contentId),
      interactionType: "share",
      isRemoved: { $ne: true },
    });
    return !!share;
  }

  /**
   * Check if user has favorited content
   */
  private async checkUserFavorite(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<boolean> {
    if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      return false;
    }

    const favorite = await MediaInteraction.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(contentId),
      interactionType: "favorite",
      isRemoved: { $ne: true },
    });
    return !!favorite;
  }

  /**
   * Check if user has bookmarked content
   */
  private async checkUserBookmark(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<boolean> {
    try {
      if (
        !userId ||
        !Types.ObjectId.isValid(userId) ||
        !Types.ObjectId.isValid(contentId)
      ) {
        return false;
      }
      // Only media-like entities currently support bookmarks
      if (!["media", "ebook", "podcast", "merch"].includes(contentType)) {
        return false;
      }
      const exists = await Bookmark.findOne({
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(contentId),
      })
        .select("_id")
        .lean();
      return !!exists;
    } catch (error: any) {
      logger.error("Failed to check user bookmark", {
        userId,
        contentId,
        contentType,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get like count for content (Redis-first, DB fallback)
   */
  private async getLikeCount(
    contentId: string,
    contentType: string
  ): Promise<number> {
    // Try Redis first (fast path)
    const redisCount = await getPostCounter({ postId: contentId, field: "likes" });
    if (redisCount !== null) {
      return redisCount;
    }

    // Fallback to DB (slower, but ensures correctness)
    try {
      let dbCount = 0;
      switch (contentType) {
        case "media":
          // Handles all Media collection items (videos, music, audio, ebook, podcast, etc.)
          const media = await Media.findById(contentId).select("likeCount").lean();
          dbCount = (media as any)?.likeCount || 0;
          break;
        // Removed: devotional likes - will be separate system in future
        // case "devotional": - removed
        case "artist":
          const artist = await User.findById(contentId).select("artistProfile.followerCount").lean();
          dbCount = ((artist as any)?.artistProfile?.followerCount) || 0;
          break;
        case "merch":
          const merch = await Media.findById(contentId).select("favoriteCount").lean();
          dbCount = (merch as any)?.favoriteCount || 0;
          break;
        default:
          return 0;
      }
      
      // Cache DB result in Redis for future requests (24 hours TTL)
      if (dbCount > 0) {
        incrPostCounter({ postId: contentId, field: "likes", delta: dbCount }).catch(() => {});
      }
      
      return dbCount;
    } catch (error: any) {
      logger.error("Failed to get like count", {
        contentId,
        contentType,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get bookmark count for media-like content
   */
  private async getBookmarkCount(contentId: string): Promise<number> {
    try {
      const total = await Bookmark.countDocuments({
        media: new Types.ObjectId(contentId),
      });
      return total || 0;
    } catch (error: any) {
      logger.error("Failed to get bookmark count", {
        contentId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Batch content metadata for multiple content IDs
   * Returns per-id counts and user interaction flags
   */
  async getBatchContentMetadata(
    userId: string | undefined,
    contentIds: string[],
    contentType: string = "media"
  ): Promise<
    Array<{
      id: string;
      likeCount: number;
      commentCount: number;
      shareCount: number;
      bookmarkCount: number;
      viewCount: number;
      hasLiked: boolean;
      hasBookmarked: boolean;
      hasShared: boolean;
      hasViewed: boolean;
    }>
  > {
    const validIds = contentIds.filter(id => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];

    // Validate userId format
    let validUserId = userId || "";
    if (validUserId && !Types.ObjectId.isValid(validUserId)) {
      logger.warn("Invalid userId format in batch metadata", {
        userId: validUserId,
        contentType,
      });
      validUserId = "";
    }

    // Get all content stats in parallel
    const statsPromises = validIds.map(id => this.getContentStats(id, contentType));
    const statsResults = await Promise.all(statsPromises);

    // Get all bookmark counts in parallel
    const bookmarkCountPromises = validIds.map(id => this.getBookmarkCount(id));
    const bookmarkCounts = await Promise.all(bookmarkCountPromises);

    // Efficient batch queries for user interactions (if user is authenticated)
    let userLikesMap = new Map<string, boolean>();
    let userBookmarksMap = new Map<string, boolean>();
    let userSharesMap = new Map<string, boolean>();
    let userViewsMap = new Map<string, boolean>();

    if (validUserId && Types.ObjectId.isValid(validUserId)) {
      try {
        const userIdObj = new Types.ObjectId(validUserId);
        const contentIdsObj = validIds.map(id => new Types.ObjectId(id));

        // Batch query for likes (efficient - single query)
        // Normalize contentType: ebook and podcast are just Media collection items
        const normalizedContentType = this.normalizeContentType(contentType || "");
        
        if (normalizedContentType === "media") {
          // Handles all Media collection items
          const userLikes = await MediaInteraction.find({
            user: userIdObj,
            media: { $in: contentIdsObj },
            interactionType: "like",
            isRemoved: { $ne: true },
          })
            .select("media")
            .lean();
          userLikes.forEach(like => {
            userLikesMap.set(like.media.toString(), true);
          });
        // Removed: devotional likes - will be separate system in future
        // else if (contentType === "devotional") { ... } - removed
        } else if (contentType === "artist") {
          const user = await User.findById(userIdObj).select("following").lean() as any;
          if (user?.following && Array.isArray(user.following)) {
            contentIdsObj.forEach(id => {
              if (user.following.some((fid: any) => fid.toString() === id.toString())) {
                userLikesMap.set(id.toString(), true);
              }
            });
          }
        } else if (contentType === "merch") {
          const userFavorites = await MediaInteraction.find({
            user: userIdObj,
            media: { $in: contentIdsObj },
            interactionType: "favorite",
            isRemoved: { $ne: true },
          })
            .select("media")
            .lean();
          userFavorites.forEach(fav => {
            userLikesMap.set(fav.media.toString(), true);
          });
        }

        // Batch query for bookmarks (efficient - single query)
        const userBookmarks = await Bookmark.find({
          user: userIdObj,
          media: { $in: contentIdsObj },
        })
          .select("media")
          .lean();
        userBookmarks.forEach(bookmark => {
          userBookmarksMap.set(bookmark.media.toString(), true);
        });

        // Batch query for shares (efficient - single query)
        const userShares = await MediaInteraction.find({
          user: userIdObj,
          media: { $in: contentIdsObj },
          interactionType: "share",
          isRemoved: { $ne: true },
        })
          .select("media")
          .lean();
        userShares.forEach(share => {
          userSharesMap.set(share.media.toString(), true);
        });

        // Batch query for views (efficient - single query)
        const userViews = await MediaInteraction.find({
          user: userIdObj,
          media: { $in: contentIdsObj },
          interactionType: "view",
          isRemoved: { $ne: true },
        })
          .select("media")
          .lean();
        userViews.forEach(view => {
          userViewsMap.set(view.media.toString(), true);
        });
      } catch (error: any) {
        logger.error("Error in batch user interaction queries", {
          error: error.message,
          userId: validUserId,
          contentType,
        });
      }
    }

    // Combine results
    return validIds.map((id, index) => {
      const stats = statsResults[index];
      const bookmarkCount = bookmarkCounts[index];

      return {
        id,
        likeCount: stats?.likes ?? 0,
        commentCount: stats?.comments ?? 0,
        shareCount: stats?.shares ?? 0,
        bookmarkCount: bookmarkCount ?? 0,
        viewCount: stats?.views ?? 0,
        hasLiked: userLikesMap.has(id),
        hasBookmarked: userBookmarksMap.has(id),
        hasShared: userSharesMap.has(id),
        hasViewed: userViewsMap.has(id),
      };
    });
  }

  /**
   * Verify content exists in database
   */
  private async verifyContentExists(
    contentId: string,
    contentType: string,
    session: ClientSession
  ): Promise<boolean> {
    try {
      // Normalize contentType: ebook and podcast are just Media collection items
      const normalizedContentType = this.normalizeContentType(contentType);
      
      switch (normalizedContentType) {
        case "media":
          // Handles all Media collection items
          const media = await Media.findById(contentId)
            .session(session)
            .select("_id");
          return !!media;

        case "artist":
          const artist = await User.findById(contentId)
            .session(session)
            .select("_id");
          return !!artist;

        case "merch":
          const merch = await Media.findById(contentId)
            .session(session)
            .select("_id");
          return !!merch;

        default:
          return false;
      }
    } catch (error: any) {
      logger.error("Failed to verify content exists", {
        contentId,
        contentType,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Check if user owns the content
   */
  private async isUserOwnContent(
    userId: string,
    contentId: string,
    contentType: string,
    session: ClientSession
  ): Promise<boolean> {
    try {
      // Normalize contentType: ebook and podcast are just Media collection items
      const normalizedContentType = this.normalizeContentType(contentType);
      
      switch (normalizedContentType) {
        case "media":
        case "merch":
          // Handles all Media collection items (videos, music, audio, ebook, podcast, merch, etc.)
          const media = await Media.findById(contentId)
            .session(session)
            .select("uploadedBy");
          return media?.uploadedBy?.toString() === userId;

        case "artist":
          return contentId === userId; // Artist ID is the same as user ID

        default:
          return false;
      }
    } catch (error: any) {
      logger.error("Failed to check content ownership", {
        userId,
        contentId,
        contentType,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Toggle media like
   */
  private async toggleMediaLike(
    userId: string,
    contentId: string,
    session: ClientSession
  ): Promise<boolean> {
    const userObjId = new Types.ObjectId(userId);
    const contentObjId = new Types.ObjectId(contentId);

    // Defensive dedupe:
    // If multiple active like rows exist, toggle must remove ALL of them.
    const activeLikes = await MediaInteraction.find({
      user: userObjId,
      media: contentObjId,
      interactionType: "like",
      isRemoved: { $ne: true },
    })
      .session(session)
      .select("_id")
      .lean();

    const activeCount = activeLikes.length;
    if (activeCount > 0) {
      await MediaInteraction.updateMany(
        { _id: { $in: activeLikes.map((l: any) => l._id) } },
        { $set: { isRemoved: true, lastInteraction: new Date() } },
        { session }
      );
      await this.applyLikeDeltaToMedia(contentId, -activeCount, session);
      return false;
    }

    // Like - restore a soft-deleted like if possible, otherwise create a new one
    const softDeletedLike = await MediaInteraction.findOne({
      user: userObjId,
      media: contentObjId,
      interactionType: "like",
      isRemoved: true,
    })
      .session(session)
      .sort({ lastInteraction: -1, updatedAt: -1, createdAt: -1 });

    if (softDeletedLike) {
      await MediaInteraction.findByIdAndUpdate(
        softDeletedLike._id,
        { isRemoved: false, lastInteraction: new Date() },
        { session }
      );
    } else {
      await MediaInteraction.create(
        [
          {
            user: userObjId,
            media: contentObjId,
            interactionType: "like",
            lastInteraction: new Date(),
            count: 1,
            isRemoved: false,
          },
        ],
        { session }
      );
    }

    await this.applyLikeDeltaToMedia(contentId, 1, session);
    return true;
  }

  // Removed: toggleDevotionalLike - devotional likes will be separate system in future

  /**
   * Toggle artist follow
   */
  private async toggleArtistFollow(
    userId: string,
    contentId: string,
    session: ClientSession
  ): Promise<boolean> {
    const follower = await User.findById(userId).session(session);
    const artist = await User.findById(contentId).session(session);

    if (!follower || !artist) {
      throw new Error("User or artist not found");
    }

    const isFollowing = follower.following?.some(
      (followedArtistId: Types.ObjectId) =>
        followedArtistId.equals(new Types.ObjectId(contentId))
    );

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(
        userId,
        { $pull: { following: new Types.ObjectId(contentId) } },
        { session }
      );
      await User.findByIdAndUpdate(
        contentId,
        {
          $pull: { followers: new Types.ObjectId(userId) },
          $inc: { "artistProfile.followerCount": -1 },
        },
        { session }
      );
      return false;
    } else {
      // Follow
      await User.findByIdAndUpdate(
        userId,
        { $push: { following: new Types.ObjectId(contentId) } },
        { session }
      );
      await User.findByIdAndUpdate(
        contentId,
        {
          $push: { followers: new Types.ObjectId(userId) },
          $inc: { "artistProfile.followerCount": 1 },
        },
        { session }
      );
      return true;
    }
  }

  /**
   * Toggle merch favorite
   */
  private async toggleMerchFavorite(
    userId: string,
    contentId: string,
    session: ClientSession
  ): Promise<boolean> {
    const existingFavorite = await MediaInteraction.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(contentId),
      interactionType: "favorite",
      isRemoved: { $ne: true },
    }).session(session);

    if (existingFavorite) {
      // Remove favorite
      await MediaInteraction.findByIdAndUpdate(
        existingFavorite._id,
        { isRemoved: true },
        { session }
      );
      // Decrement favoriteCount atomically
      await Media.findByIdAndUpdate(
        contentId,
        { $inc: { favoriteCount: -1 } },
        { session }
      );
      return false;
    } else {
      // Check if there's a soft-deleted favorite to restore
      const softDeletedFavorite = await MediaInteraction.findOne({
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(contentId),
        interactionType: "favorite",
        isRemoved: true,
      }).session(session);

      if (softDeletedFavorite) {
        // Restore soft-deleted favorite
        await MediaInteraction.findByIdAndUpdate(
          softDeletedFavorite._id,
          {
            isRemoved: false,
            lastInteraction: new Date(),
          },
          { session }
        );
      } else {
        // Create new favorite
        await MediaInteraction.create(
          [
            {
              user: new Types.ObjectId(userId),
              media: new Types.ObjectId(contentId),
              interactionType: "favorite",
              lastInteraction: new Date(),
              count: 1,
              isRemoved: false,
            },
          ],
          { session }
        );
      }

      // Increment favoriteCount atomically
      await Media.findByIdAndUpdate(
        contentId,
        { $inc: { favoriteCount: 1 } },
        { session }
      );
      return true;
    }
  }

  /**
   * Get share count for content
   */
  private async getShareCount(
    contentId: string,
    contentType: string
  ): Promise<number> {
    if (contentType === "media") {
      const media = await Media.findById(contentId);
      return media?.shareCount || 0;
    } else if (contentType === "devotional") {
      const devotional = await Devotional.findById(contentId);
      return devotional?.shareCount || 0;
    }
    return 0;
  }

  /**
   * Get content by ID
   */
  private async getContentById(
    contentId: string,
    contentType: string
  ): Promise<any> {
    if (contentType === "media") {
      return await Media.findById(contentId);
    } else if (contentType === "devotional") {
      return await Devotional.findById(contentId);
    }
    return null;
  }

  /**
   * Normalize contentType for API endpoint
   * ebook and podcast are Media collection items, so normalize to "media"
   */
  private normalizeContentType(contentType: string): string {
    // ebook and podcast are just Media collection items with different media.contentType field
    if (contentType === "ebook" || contentType === "podcast") {
      return "media";
    }
    return contentType;
  }

  /**
   * Helper to determine content type from media ID
   * Returns normalized contentType (ebook/podcast normalized to "media")
   */
  private async getContentTypeFromMediaId(mediaId: string): Promise<"media" | "devotional" | null> {
    const media = await Media.findById(mediaId);
    if (media) {
      return "media"; // All Media collection items use "media" endpoint
    }
    
    const devotional = await Devotional.findById(mediaId);
    if (devotional) return "devotional";
    
    return null;
  }

  /**
   * Paginated list of likers for content (for "Liked by ..." UI).
   *
   * Note: Username is derived from name/email because this codebase does not store a dedicated `username` field.
   */
  async getContentLikers(
    contentId: string,
    contentType: string,
    page: number,
    limit: number
  ): Promise<{
    items: Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      likedAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }> {
    const skip = (page - 1) * limit;

    if (!Types.ObjectId.isValid(contentId)) {
      return { items: [], page, limit, total: 0, hasMore: false };
    }

    if (["media", "ebook", "podcast"].includes(contentType)) {
      const filter = {
        media: new Types.ObjectId(contentId),
        interactionType: "like" as const,
        isRemoved: { $ne: true },
      };

      const [total, rows] = await Promise.all([
        MediaInteraction.countDocuments(filter),
        MediaInteraction.find(filter)
          .sort({ lastInteraction: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("user", "firstName lastName email avatar avatarUpload")
          .select("user lastInteraction createdAt")
          .lean(),
      ]);

      const items = (rows || []).map((r: any) => {
        const u = r.user || {};
        const username =
          `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
          (u.email ? String(u.email).split("@")[0] : "user");
        const avatarUrl = u.avatarUpload || u.avatar || null;
        const likedAt = new Date(r.lastInteraction || r.createdAt).toISOString();
        return {
          userId: u._id?.toString?.() || "",
          username,
          avatarUrl,
          likedAt,
        };
      });

      return {
        items,
        page,
        limit,
        total,
        hasMore: skip + items.length < total,
      };
    }

    // Removed: devotional likes - will be separate system in future
    // if (contentType === "devotional") { ... } - removed

    return { items: [], page, limit, total: 0, hasMore: false };
  }
}

export default new ContentInteractionService();
