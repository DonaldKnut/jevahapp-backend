import mongoose, { Types, ClientSession } from "mongoose";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { Media } from "../models/media.model";
import { User } from "../models/user.model";
import { Devotional } from "../models/devotional.model";
import { DevotionalLike } from "../models/devotionalLike.model";
import { NotificationService } from "./notification.service";
import viralContentService from "./viralContent.service";
import mentionDetectionService from "./mentionDetection.service";
import logger from "../utils/logger";
import { Bookmark } from "../models/bookmark.model";

export interface ContentInteractionInput {
  userId: string;
  contentId: string;
  contentType:
    | "media"
    | "devotional"
    | "artist"
    | "merch"
    | "ebook"
    | "podcast";
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
   * Toggle like on any content type
   */
  async toggleLike(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<{ liked: boolean; likeCount: number }> {
    // Enhanced validation
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid user or content ID");
    }

    // Validate content type
    const validContentTypes = [
      "media",
      "devotional",
      "artist",
      "merch",
      "ebook",
      "podcast",
    ];
    if (!validContentTypes.includes(contentType)) {
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
        // First, verify content exists
        contentExists = await this.verifyContentExists(
          contentId,
          contentType,
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
          contentType,
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

        // Handle different content types
        switch (contentType) {
          case "media":
            liked = await this.toggleMediaLike(userId, contentId, session);
            break;
          case "devotional":
            liked = await this.toggleDevotionalLike(userId, contentId, session);
            break;
          case "artist":
            liked = await this.toggleArtistFollow(userId, contentId, session);
            break;
          case "merch":
            liked = await this.toggleMerchFavorite(userId, contentId, session);
            break;
          case "ebook":
          case "podcast":
            // Handle ebook and podcast likes using media interaction
            liked = await this.toggleMediaLike(userId, contentId, session);
            break;
          default:
            throw new Error(`Unsupported content type: ${contentType}`);
        }
      });

      const likeCount = await this.getLikeCount(contentId, contentType);

      // Send notification if content was liked (not unliked)
      if (liked) {
        try {
          if (contentType === "artist") {
            await NotificationService.notifyUserFollow(userId, contentId);
          } else {
            await NotificationService.notifyContentLike(
              userId,
              contentId,
              contentType
            );
          }

          // Send public activity notification to followers
          const contentData = await this.getContentById(contentId, contentType);
          await NotificationService.notifyPublicActivity(
            userId,
            "like",
            contentId,
            contentType,
            contentData?.title
          );

          // Check for viral milestones
          await viralContentService.checkViralMilestones(
            contentId,
            contentType as "media" | "devotional"
          );

          logger.info("Like notification sent", {
            userId,
            contentId,
            contentType,
          });
        } catch (notificationError: any) {
          // Don't fail the like operation if notification fails
          logger.error("Failed to send like notification", {
            error: notificationError.message,
            userId,
            contentId,
            contentType,
          });
        }
      }

      // Send real-time notification via Socket.IO
      try {
        const io = require("../socket/socketManager").getIO();
        if (io) {
          const payload = {
            contentId,
            contentType,
            likeCount,
            userLiked: liked,
            userId,
            timestamp: new Date().toISOString(),
          };
          // Global event (backward compatible)
          io.emit("content-like-update", payload);
          // Room-scoped event for fine-grained subscriptions (spec format: content:contentType:contentId)
          const roomKey = contentType ? `content:${contentType}:${contentId}` : `content:${contentId}`;
          io.to(roomKey).emit("like-updated", payload);
        }
      } catch (socketError) {
        logger.warn("Failed to send real-time like update", {
          error: socketError,
          contentId,
          contentType,
        });
      }

      logger.info("Toggle like completed", {
        userId,
        contentId,
        contentType,
        liked,
        likeCount,
        timestamp: new Date().toISOString(),
      });

      return {
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

    // Only media and devotional support comments for now
    if (!["media", "devotional"].includes(contentType)) {
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
        if (contentType === "media") {
          await Media.findByIdAndUpdate(
            contentId,
            { $inc: { commentCount: 1 } },
            { session }
          );
        } else if (contentType === "devotional") {
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
          contentType,
          content
        );

        // Check for viral milestones
        await viralContentService.checkViralMilestones(
          contentId,
          contentType as "media" | "devotional"
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

      // Emit real-time new comment
      try {
        const io = require("../socket/socketManager").getIO();
        if (io) {
          const roomKey = `content:${contentType}:${contentId}`;
          const payload = {
            contentId,
            contentType,
            commentId: formattedComment.id || formattedComment._id,
            action: "created",
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

    const formatted: any = {
      _id: comment._id,
      id: comment._id.toString(), // Alias for frontend compatibility
      content: comment.content,
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
      timestamp: comment.createdAt, // Alias
      reactionsCount,
      likes: reactionsCount, // Alias for frontend
      likesCount: reactionsCount, // Spec-compliant field name
      replyCount: comment.replyCount || 0,
      replies: [], // Will be populated if includeReplies is true
    };

    // Add nested replies if requested (limit to first 50 replies per comment)
    if (includeReplies && comment._id) {
      // This will be populated by the calling function
    }

    return formatted;
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
    sortBy: "newest" | "oldest" | "top" = "newest"
  ): Promise<any> {
    if (!Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid content ID");
    }

    if (!["media", "devotional"].includes(contentType)) {
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

      const total = await MediaInteraction.countDocuments({
        media: new Types.ObjectId(contentId),
        interactionType: "comment",
        isRemoved: { $ne: true },
        isHidden: { $ne: true },
        parentCommentId: { $exists: false },
      });

      const hasMore = (page * limit) < total;

      return {
        comments: commentsWithReplies,
        totalComments: total,
        hasMore,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
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

    const total = await MediaInteraction.countDocuments({
      media: new Types.ObjectId(contentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      isHidden: { $ne: true },
      parentCommentId: { $exists: false },
    });

    const hasMore = (page * limit) < total;

    return {
      comments: commentsWithReplies,
      totalComments: total,
      hasMore,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
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
   */
  async reportContentComment(
    commentId: string,
    userId: string,
    reason?: string
  ): Promise<{ reportCount: number }> {
    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid comment or user ID");
    }

    const update = await MediaInteraction.findByIdAndUpdate(
      commentId,
      {
        $inc: { reportCount: 1 },
        $addToSet: { reportedBy: new Types.ObjectId(userId) },
      },
      { new: true }
    ).select("reportCount");

    if (!update) {
      throw new Error("Comment not found");
    }

    return { reportCount: update.reportCount || 0 };
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

    let content: any;
    let author: any;

    // Get content based on type
    switch (contentType) {
      case "media":
        content = await Media.findById(contentId).populate(
          "uploadedBy",
          "firstName lastName avatar"
        );
        author = content?.uploadedBy;
        break;
      case "devotional":
        content = await Devotional.findById(contentId).populate(
          "author",
          "firstName lastName avatar"
        );
        author = content?.author;
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
    switch (contentType) {
      case "media":
        const media = await Media.findById(contentId);
        return {
          likes: media?.likeCount || 0,
          comments: media?.commentCount || 0,
          shares: media?.shareCount || 0,
          views: media?.viewCount || 0,
          downloads: media?.downloadCount || 0,
        };
      case "devotional":
        const devotional = await Devotional.findById(contentId);
        const devotionalLikes = await DevotionalLike.countDocuments({
          devotional: contentId,
        });
        return {
          likes: devotionalLikes,
          comments: 0, // Devotionals don't have comments yet
          shares: 0,
          views: devotional?.viewCount || 0,
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
        return {
          likes: merch?.likeCount || 0,
          comments: merch?.commentCount || 0,
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

    switch (contentType) {
      case "media":
        const mediaLike = await MediaInteraction.findOne({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "like",
          isRemoved: { $ne: true },
        });
        return !!mediaLike;
      case "devotional":
        const devotionalLike = await DevotionalLike.findOne({
          user: new Types.ObjectId(userId),
          devotional: new Types.ObjectId(contentId),
        });
        return !!devotionalLike;
      case "artist":
        const artist = await User.findById(new Types.ObjectId(userId));
        return artist?.following?.some(
          (id: any) => id.toString() === contentId
        ) || false;
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
   * Get like count for content
   */
  private async getLikeCount(
    contentId: string,
    contentType: string
  ): Promise<number> {
    try {
      switch (contentType) {
        case "media":
        case "ebook":
        case "podcast":
          const media = await Media.findById(contentId).select("likeCount");
          return media?.likeCount || 0;
        case "devotional":
          const devotionalLikes = await DevotionalLike.countDocuments({
            devotional: contentId,
          });
          return devotionalLikes;
        case "artist":
          const artist = await User.findById(contentId);
          return artist?.artistProfile?.followerCount || 0;
        case "merch":
          const merch = await Media.findById(contentId).select("favoriteCount");
          return merch?.favoriteCount || 0;
        default:
          return 0;
      }
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

    const tasks = validIds.map(async id => {
      try {
        const stats = await this.getContentStats(id, contentType);

        // Map stats from existing structure to requested names
        const likeCount = stats?.likes ?? 0;
        const commentCount = stats?.comments ?? 0;
        const shareCount = stats?.shares ?? 0;
        const viewCount = stats?.views ?? 0;

        // Bookmark count (for media-like)
        const bookmarkCount = await this.getBookmarkCount(id);

        // User interaction flags - ensure userId is valid ObjectId
        let validUserId = userId || "";
        if (validUserId && !Types.ObjectId.isValid(validUserId)) {
          logger.warn("Invalid userId format in batch metadata", {
            userId: validUserId,
            contentId: id,
            contentType,
          });
          validUserId = "";
        }
        
        const userFlags = await this.getUserInteraction(
          validUserId,
          id,
          contentType
        );

        // hasViewed: infer from MediaInteraction 'view' events if present
        let hasViewed = false;
        if (validUserId && Types.ObjectId.isValid(validUserId)) {
          try {
            const view = await MediaInteraction.findOne({
              user: new Types.ObjectId(validUserId),
              media: new Types.ObjectId(id),
              interactionType: "view",
              isRemoved: { $ne: true },
            })
              .select("_id")
              .lean();
            hasViewed = !!view;
          } catch (error: any) {
            logger.warn("Error checking hasViewed in batch metadata", {
              error: error.message,
              userId: validUserId,
              contentId: id,
            });
          }
        }

        return {
          id,
          likeCount,
          commentCount,
          shareCount,
          bookmarkCount,
          viewCount,
          hasLiked: !!userFlags?.hasLiked,
          hasBookmarked: !!userFlags?.hasBookmarked,
          hasShared: !!userFlags?.hasShared,
          hasViewed,
        };
      } catch (error: any) {
        logger.warn("Batch metadata item failed", {
          id,
          contentType,
          error: error.message,
        });
        return {
          id,
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          bookmarkCount: 0,
          viewCount: 0,
          hasLiked: false,
          hasBookmarked: false,
          hasShared: false,
          hasViewed: false,
        };
      }
    });

    return await Promise.all(tasks);
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
      switch (contentType) {
        case "media":
        case "ebook":
        case "podcast":
          const media = await Media.findById(contentId)
            .session(session)
            .select("_id");
          return !!media;

        case "devotional":
          const devotional = await Devotional.findById(contentId)
            .session(session)
            .select("_id");
          return !!devotional;

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
      switch (contentType) {
        case "media":
        case "ebook":
        case "podcast":
        case "merch":
          const media = await Media.findById(contentId)
            .session(session)
            .select("uploadedBy");
          return media?.uploadedBy?.toString() === userId;

        case "devotional":
          const devotional = await Devotional.findById(contentId)
            .session(session)
            .select("uploadedBy");
          return devotional?.uploadedBy?.toString() === userId;

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
    const existingLike = await MediaInteraction.findOne({
      user: new Types.ObjectId(userId),
      media: new Types.ObjectId(contentId),
      interactionType: "like",
      isRemoved: { $ne: true },
    }).session(session);

    if (existingLike) {
      // Unlike
      await MediaInteraction.findByIdAndUpdate(
        existingLike._id,
        { isRemoved: true },
        { session }
      );
      await Media.findByIdAndUpdate(
        contentId,
        { $inc: { likeCount: -1 } },
        { session }
      );
      return false;
    } else {
      // Like
      await MediaInteraction.findOneAndUpdate(
        {
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "like",
        },
        { isRemoved: false },
        { upsert: true, session }
      );
      await Media.findByIdAndUpdate(
        contentId,
        { $inc: { likeCount: 1 } },
        { session }
      );
      return true;
    }
  }

  /**
   * Toggle devotional like
   */
  private async toggleDevotionalLike(
    userId: string,
    contentId: string,
    session: ClientSession
  ): Promise<boolean> {
    const existingLike = await DevotionalLike.findOne({
      user: new Types.ObjectId(userId),
      devotional: new Types.ObjectId(contentId),
    }).session(session);

    if (existingLike) {
      // Unlike
      await DevotionalLike.findByIdAndDelete(existingLike._id, { session });
      await Devotional.findByIdAndUpdate(
        contentId,
        { $inc: { likeCount: -1 } },
        { session }
      );
      return false;
    } else {
      // Like
      await DevotionalLike.create(
        [
          {
            user: new Types.ObjectId(userId),
            devotional: new Types.ObjectId(contentId),
          },
        ],
        { session }
      );
      await Devotional.findByIdAndUpdate(
        contentId,
        { $inc: { likeCount: 1 } },
        { session }
      );
      return true;
    }
  }

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
      return false;
    } else {
      // Add favorite
      await MediaInteraction.findOneAndUpdate(
        {
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "favorite",
        },
        { isRemoved: false },
        { upsert: true, session }
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
}

export default new ContentInteractionService();
