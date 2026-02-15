import { Types, ClientSession } from "mongoose";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { Media } from "../models/media.model";
import { Devotional } from "../models/devotional.model";
import logger from "../utils/logger";

export interface CreateCommentData {
  userId: string;
  contentId: string;
  contentType: "media" | "devotional" | "ebook" | "podcast";
  content: string;
  parentCommentId?: string;
}

export interface UpdateCommentData {
  commentId: string;
  userId: string;
  content: string;
}

export class CommentService {
  /**
   * Create a new comment
   * Multiple comments per user per media are allowed
   */
  static async createComment(data: CreateCommentData): Promise<any> {
    try {
      const { userId, contentId, contentType, content, parentCommentId } = data;

      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
        throw new Error("Invalid user or content ID");
      }

      if (!content || content.trim().length === 0) {
        throw new Error("Comment content is required");
      }

      if (content.trim().length > 1000) {
        throw new Error("Comment must be less than 1000 characters");
      }

      // Normalize: ebook and podcast are just Media collection items, use "media"
      const normalizedContentType: "media" | "devotional" = 
        (contentType === "ebook" || contentType === "podcast") ? "media" : contentType as "media" | "devotional";
      
      if (!normalizedContentType || !["media", "devotional"].includes(normalizedContentType)) {
        throw new Error("Invalid content type. Supported: media, devotional, ebook, podcast");
      }

      // Validate content exists
      if (normalizedContentType === "media") {
        // Handles all Media collection items (videos, music, audio, ebook, podcast, etc.)
        const media = await Media.findById(contentId);
        if (!media) throw new Error("Content not found");
      } else if (normalizedContentType === "devotional") {
        const devotional = await Devotional.findById(contentId);
        if (!devotional) throw new Error("Devotional not found");
      }

      // Validate parent comment if provided
      if (parentCommentId) {
        if (!Types.ObjectId.isValid(parentCommentId)) {
          throw new Error("Invalid parent comment ID");
        }
        const parent = await MediaInteraction.findOne({
          _id: new Types.ObjectId(parentCommentId),
          interactionType: "comment",
          isRemoved: { $ne: true },
        });
        if (!parent) {
          throw new Error("Parent comment not found");
        }
      }

      const session: ClientSession = await Media.startSession();
      try {
        const comment = await session.withTransaction(async () => {
          const commentData: any = {
            user: new Types.ObjectId(userId),
            media: new Types.ObjectId(contentId),
            interactionType: "comment" as const,
            content: content.trim(),
            count: 1,
            reactions: new Map(),
            replyCount: 0,
            isRemoved: false,
          };

          if (parentCommentId && Types.ObjectId.isValid(parentCommentId)) {
            commentData.parentCommentId = new Types.ObjectId(parentCommentId);
          }

          // Create comment (allow multiple comments per user)
          const newComment = await MediaInteraction.create([commentData], {
            session,
          });

          // Update content comment count
          if (normalizedContentType === "media") {
            // Handles all Media collection items
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

          return newComment[0];
        });

        // Populate user info
        const populatedComment = await MediaInteraction.findById(comment._id)
          .populate("user", "firstName lastName avatar username")
          .populate("parentCommentId", "content user")
          .lean();

        logger.info("Comment created", {
          commentId: comment._id,
          userId,
          contentId,
          contentType,
          isReply: !!parentCommentId,
        });

        const formattedComment = this.formatComment(populatedComment, userId, normalizedContentType);
        
        // Emit real-time new comment event via Socket.io
        try {
          const { getIO } = require("../socket/socketManager");
          const io = getIO();
          if (io) {
            const roomKey = `content:${normalizedContentType}:${contentId}`;
            
            // Get updated comment count (including replies)
            const topLevelCount = await MediaInteraction.countDocuments({
              media: new Types.ObjectId(contentId),
              interactionType: "comment",
              isRemoved: { $ne: true },
              parentCommentId: { $exists: false },
            });
            const replyCount = await MediaInteraction.countDocuments({
              media: new Types.ObjectId(contentId),
              interactionType: "comment",
              isRemoved: { $ne: true },
              parentCommentId: { $exists: true },
            });
            const commentCount = topLevelCount + replyCount;
            
            const payload = {
              contentId,
              contentType: normalizedContentType, // Use normalized contentType
              commentId: formattedComment.id || formattedComment._id,
              action: "created",
              commentCount, // Include updated commentCount
            };
            // Emit to the specific content room (per spec: content:contentType:contentId)
            io.to(roomKey).emit("content:comment", payload);
            // Also emit the full comment for immediate UI updates
            io.to(roomKey).emit("new-comment", formattedComment);
            
            logger.debug("Emitted Socket.io comment event", {
              roomKey,
              commentId: formattedComment.id,
              commentCount,
            });
          }
        } catch (socketError: any) {
          // Don't fail the comment creation if socket emission fails
          logger.warn("Failed to emit Socket.io comment event", {
            error: socketError?.message,
            commentId: comment._id,
            contentId,
            contentType,
          });
        }

        return formattedComment;
      } finally {
        session.endSession();
      }
    } catch (error: any) {
      logger.error("Error creating comment:", error);
      throw error;
    }
  }

  /**
   * Update a comment (owner only)
   */
  static async updateComment(data: UpdateCommentData): Promise<any> {
    try {
      const { commentId, userId, content } = data;

      if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid comment or user ID");
      }

      if (!content || content.trim().length === 0) {
        throw new Error("Comment content is required");
      }

      if (content.trim().length > 1000) {
        throw new Error("Comment must be less than 1000 characters");
      }

      const comment = await MediaInteraction.findOne({
        _id: new Types.ObjectId(commentId),
        interactionType: "comment",
        isRemoved: { $ne: true },
      });

      if (!comment) {
        throw new Error("Comment not found");
      }

      // Check ownership
      if (comment.user.toString() !== userId) {
        throw new Error("You can only edit your own comments");
      }

      // Update comment
      comment.content = content.trim();
      comment.updatedAt = new Date();
      await comment.save();

      // Populate user info
      const updatedComment = await MediaInteraction.findById(comment._id)
        .populate("user", "firstName lastName avatar username")
        .populate("parentCommentId", "content user")
        .lean();

      logger.info("Comment updated", {
        commentId,
        userId,
      });

      // Note: userId should be passed but formatComment handles missing userId gracefully
      // contentType not needed for update response
      return this.formatComment(updatedComment, userId);
    } catch (error: any) {
      logger.error("Error updating comment:", error);
      throw error;
    }
  }

  /**
   * Delete a comment (owner only - soft delete)
   */
  static async deleteComment(commentId: string, userId: string): Promise<void> {
    try {
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

      // Check ownership
      if (comment.user.toString() !== userId) {
        throw new Error("You can only delete your own comments");
      }

      const session: ClientSession = await Media.startSession();
      try {
        await session.withTransaction(async () => {
          // Soft delete the comment
          await MediaInteraction.findByIdAndUpdate(
            commentId,
            {
              isRemoved: true,
              content: "[Deleted]", // Optionally clear content
            },
            { session }
          );

          // Decrement content comment count
          const contentType = await this.getContentTypeFromMediaId(comment.media.toString());
          if (contentType === "media") {
            await Media.findByIdAndUpdate(
              comment.media,
              { $inc: { commentCount: -1 } },
              { session }
            );
          } else if (contentType === "devotional") {
            await Devotional.findByIdAndUpdate(
              comment.media,
              { $inc: { commentCount: -1 } },
              { session }
            );
          }

          // If this is a reply, decrement parent's replyCount
          if (comment.parentCommentId) {
            await MediaInteraction.findByIdAndUpdate(
              comment.parentCommentId,
              { $inc: { replyCount: -1 } },
              { session }
            );
          }
        });
      } finally {
        session.endSession();
      }

      logger.info("Comment deleted", {
        commentId,
        userId,
      });

      // Emit real-time delete event via Socket.io
      try {
        const contentType = await this.getContentTypeFromMediaId(comment.media.toString());
        if (contentType) {
          const { getIO } = require("../socket/socketManager");
          const io = getIO();
          if (io) {
            const roomKey = `content:${contentType}:${comment.media.toString()}`;
            
            // Get updated comment count (including replies)
            const topLevelCount = await MediaInteraction.countDocuments({
              media: comment.media,
              interactionType: "comment",
              isRemoved: { $ne: true },
              parentCommentId: { $exists: false },
            });
            const replyCount = await MediaInteraction.countDocuments({
              media: comment.media,
              interactionType: "comment",
              isRemoved: { $ne: true },
              parentCommentId: { $exists: true },
            });
            const commentCount = topLevelCount + replyCount;
            
            const payload = {
              contentId: comment.media.toString(),
              contentType,
              commentId: commentId,
              action: "deleted",
              commentCount, // Include updated commentCount
            };
            // Emit to the specific content room
            io.to(roomKey).emit("content:comment", payload);
            
            logger.debug("Emitted Socket.io comment delete event", {
              roomKey,
              commentId,
              commentCount,
            });
          }
        }
      } catch (socketError: any) {
        // Don't fail the delete operation if socket emission fails
        logger.warn("Failed to emit Socket.io comment delete event", {
          error: socketError?.message,
          commentId,
        });
      }
    } catch (error: any) {
      logger.error("Error deleting comment:", error);
      throw error;
    }
  }

  /**
   * Like/unlike a comment
   */
  static async toggleLike(commentId: string, userId: string): Promise<{
    liked: boolean;
    totalLikes: number;
  }> {
    try {
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

      // Get reaction array for "like"
      const reactionType = "like";
      const reactionArray = reactions.get(reactionType) || [];
      const userIdObj = new Types.ObjectId(userId);
      const userIdStr = userIdObj.toString();

      // Check if user already liked
      const hasLiked = reactionArray.some(
        (id: any) => (id.toString ? id.toString() : String(id)) === userIdStr
      );

      let liked: boolean;

      if (hasLiked) {
        // Remove like (unlike)
        const filtered = reactionArray.filter(
          (id: any) => (id.toString ? id.toString() : String(id)) !== userIdStr
        );
        reactions.set(reactionType, filtered);
        liked = false;
      } else {
        // Add like
        reactionArray.push(userIdObj);
        reactions.set(reactionType, reactionArray);
        liked = true;
      }

      // Update comment with new reactions
      comment.reactions = reactions;
      await comment.save();

      // Calculate total likes
      const likeReactions = reactions.get("like") || [];
      const totalLikes = likeReactions.length;

      logger.info("Comment like toggled", {
        commentId,
        userId,
        liked,
        totalLikes,
      });

      // Emit real-time like event via Socket.io
      try {
        const contentType = await this.getContentTypeFromMediaId(comment.media.toString());
        if (contentType) {
          const { getIO } = require("../socket/socketManager");
          const io = getIO();
          if (io) {
            const roomKey = `content:${contentType}:${comment.media.toString()}`;
            
            const payload = {
              contentId: comment.media.toString(),
              contentType,
              commentId: commentId,
              action: "liked",
              likesCount: totalLikes,
            };
            // Emit to the specific content room
            io.to(roomKey).emit("content:comment", payload);
            
            logger.debug("Emitted Socket.io comment like event", {
              roomKey,
              commentId,
              totalLikes,
            });
          }
        }
      } catch (socketError: any) {
        // Don't fail the like operation if socket emission fails
        logger.warn("Failed to emit Socket.io comment like event", {
          error: socketError?.message,
          commentId,
        });
      }

      return { liked, totalLikes };
    } catch (error: any) {
      logger.error("Error toggling comment like:", error);
      throw error;
    }
  }

  /**
   * Format comment for frontend (matches documentation spec)
   */
  private static formatComment(comment: any, currentUserId?: string, contentType?: string): any {
    if (!comment) return null;

    // Calculate reactions count
    const likeReactions = comment.reactions?.["like"] || [];
    
    // Check if current user liked this comment
    let isLiked = false;
    if (currentUserId && likeReactions.length > 0) {
      const userIdStr = currentUserId.toString();
      isLiked = likeReactions.some((id: any) => {
        const idStr = id?.toString ? id.toString() : String(id);
        return idStr === userIdStr;
      });
    }

    // Format user info according to spec
    const user = comment.user
      ? {
          id: comment.user._id?.toString() || comment.user.toString(),
          firstName: comment.user.firstName || "",
          lastName: comment.user.lastName || "",
          avatar: comment.user.avatar || null,
        }
      : null;

    // Format username (firstName + lastName or username)
    const username = user
      ? `${user.firstName} ${user.lastName}`.trim() || comment.user.username || "User"
      : "User";

    // Format user object to match frontend expectations
    const userObj = user
      ? {
          _id: user.id,
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          username: comment.user?.username || `${user.firstName} ${user.lastName}`.trim().toLowerCase().replace(/\s+/g, "_"),
        }
      : null;

    return {
      _id: comment._id.toString(),
      id: comment._id.toString(), // Alias for backward compatibility
      contentId: comment.media?.toString() || comment.media,
      contentType: contentType || undefined, // Include contentType if provided
      userId: user?.id || null,
      username: username,
      userAvatar: user?.avatar || null,
      comment: comment.content,
      content: comment.content, // Alias
      timestamp: comment.createdAt,
      createdAt: comment.createdAt, // Alias
      likes: likeReactions.length,
      likesCount: likeReactions.length, // Alias
      isLiked: isLiked,
      replies: [], // Will be populated if needed
      user: userObj, // Full user object for backward compatibility
      replyCount: comment.replyCount || 0,
      parentCommentId: comment.parentCommentId
        ? (typeof comment.parentCommentId === "string"
            ? comment.parentCommentId
            : comment.parentCommentId._id?.toString() || comment.parentCommentId.toString())
        : null,
      isRemoved: comment.isRemoved || false,
    };
  }

  /**
   * Helper to determine content type from media ID
   * Returns normalized contentType (ebook/podcast normalized to "media")
   */
  private static async getContentTypeFromMediaId(mediaId: string): Promise<"media" | "devotional" | null> {
    const media = await Media.findById(mediaId);
    if (media) {
      return "media"; // All Media collection items use "media" endpoint
    }
    
    const devotional = await Devotional.findById(mediaId);
    if (devotional) return "devotional";
    
    return null;
  }
}

export default CommentService;

