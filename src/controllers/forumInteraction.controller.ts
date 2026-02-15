import { Request, Response } from "express";
import { ForumPost } from "../models/forumPost.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";
import { redisRateLimit } from "../lib/redisRateLimit";
import { incrPostCounter } from "../lib/redisCounters";

/**
 * Helper function to get comment nesting depth
 * Returns the depth level (0 = top-level, 1 = reply, 2 = reply to reply, etc.)
 */
async function getCommentDepth(commentId: string): Promise<number> {
  let depth = 0;
  let currentId: string | null = commentId;
  const maxIterations = 10; // Safety limit to prevent infinite loops
  let iterations = 0;

  while (currentId && iterations < maxIterations) {
    const comment: any = await MediaInteraction.findById(currentId).lean();
    if (!comment || !comment.parentCommentId) {
      break;
    }
    currentId = comment.parentCommentId ? String(comment.parentCommentId) : null;
    depth++;
    iterations++;
  }

  return depth;
}

/**
 * Like/Unlike Forum Post
 */
export const likeForumPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = req.params.postId;
    const userId = req.userId;

    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(userId!)) {
      res.status(400).json({ success: false, error: "Invalid post or user ID" });
      return;
    }

    // Check if post exists
    const post = await ForumPost.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, error: "Post not found" });
      return;
    }

    // Redis-backed rate limit (per user + per post)
    const likeRl = await redisRateLimit({
      key: `rl:like:${userId}:${postId}`,
      limit: 10,
      windowSeconds: 30,
    });
    if (!likeRl.allowed) {
      res.status(429).json({
        success: false,
        error: "Too many like requests. Please slow down.",
      });
      return;
    }

    // Check if user already liked this post
    const existingLike = await MediaInteraction.findOne({
      user: userId,
      media: new Types.ObjectId(postId),
      interactionType: "like",
    });

    let liked: boolean;
    let likeCount: number;

    if (existingLike) {
      // Unlike - remove the interaction
      await MediaInteraction.findByIdAndDelete(existingLike._id);
      liked = false;
      post.likesCount = Math.max(0, (post.likesCount || 0) - 1);
      await post.save();
      likeCount = post.likesCount || 0;
      incrPostCounter({ postId, field: "likes", delta: -1 }).catch(() => {});
    } else {
      // Like - create new interaction
      await MediaInteraction.create({
        user: userId,
        media: new Types.ObjectId(postId),
        interactionType: "like",
        lastInteraction: new Date(),
        count: 1,
      });
      liked = true;
      post.likesCount = (post.likesCount || 0) + 1;
      await post.save();
      likeCount = post.likesCount || 0;
      incrPostCounter({ postId, field: "likes", delta: 1 }).catch(() => {});
    }

    logger.info("Forum post like toggled", { postId, userId, liked, likeCount });

    res.status(200).json({
      success: true,
      data: {
        liked,
        likesCount: likeCount,
      },
    });
  } catch (error: any) {
    logger.error("Error toggling forum post like", { error: error.message, postId: req.params.postId });
    res.status(500).json({ success: false, error: "Failed to toggle like" });
  }
};

/**
 * Get Comments on Forum Post
 */
export const getForumPostComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = req.params.postId;
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const includeReplies = String(req.query.includeReplies || "true") === "true";

    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ success: false, error: "Invalid post ID" });
      return;
    }

    // Check if post exists
    const post = await ForumPost.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, error: "Post not found" });
      return;
    }

    // Get top-level comments (no parentCommentId)
    // Sort by createdAt ascending (oldest first) as per spec
    const comments = await MediaInteraction.find({
      media: new Types.ObjectId(postId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      $or: [
        { parentCommentId: { $exists: false } },
        { parentCommentId: null },
      ],
    })
      .populate("user", "firstName lastName username avatar")
      .sort({ createdAt: 1 }) // ✅ Ascending (oldest first) as per spec
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await MediaInteraction.countDocuments({
      media: new Types.ObjectId(postId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      $or: [
        { parentCommentId: { $exists: false } },
        { parentCommentId: null },
      ],
    });

    // Get replies if requested
    let replies: any[] = [];
    if (includeReplies) {
      const commentIds = comments.map((c: any) => c._id);
      replies = await MediaInteraction.find({
        parentCommentId: { $in: commentIds },
        interactionType: "comment",
        isRemoved: { $ne: true },
      })
        .populate("user", "firstName lastName username avatar")
        .sort({ createdAt: 1 })
        .lean();
    }

    // Group replies by parent comment
    const repliesMap = new Map();
    replies.forEach((reply: any) => {
      const parentId = String(reply.parentCommentId);
      if (!repliesMap.has(parentId)) {
        repliesMap.set(parentId, []);
      }
      repliesMap.get(parentId).push(reply);
    });

    // Format comments with replies
    const userId = req.userId;
    const formattedComments = await Promise.all(
      comments.map(async (comment: any) => {
        // Get likes count for this comment
        const likesCount = await MediaInteraction.countDocuments({
          media: comment._id,
          interactionType: "like",
        });

        // Check if current user liked this comment
        const userLiked = userId && Types.ObjectId.isValid(userId)
          ? !!(await MediaInteraction.findOne({
              user: userId,
              media: comment._id,
              interactionType: "like",
            }))
          : false;

        const commentData: any = {
          _id: String(comment._id),
          id: String(comment._id), // ✅ Include id field as per spec
          postId: String(comment.media),
          userId: comment.user?._id ? String(comment.user._id) : String(comment.user),
          content: comment.content,
          parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
          createdAt: comment.createdAt ? (comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt) : new Date().toISOString(),
          updatedAt: comment.updatedAt ? (comment.updatedAt instanceof Date ? comment.updatedAt.toISOString() : comment.updatedAt) : new Date().toISOString(),
          likesCount,
          userLiked,
          author: comment.user
            ? {
                _id: String(comment.user._id),
                username: comment.user.username,
                firstName: comment.user.firstName || "", // ✅ Include firstName
                lastName: comment.user.lastName || "", // ✅ Include lastName
                avatarUrl: comment.user.avatar,
              }
            : null,
        };

        if (includeReplies) {
          // Process replies with likes count and userLiked
          const replyList = repliesMap.get(String(comment._id)) || [];
          commentData.replies = await Promise.all(
            replyList.map(async (reply: any) => {
              // Get likes count for reply
              const replyLikesCount = await MediaInteraction.countDocuments({
                media: reply._id,
                interactionType: "like",
              });

              // Check if current user liked this reply
              const replyUserLiked = userId && Types.ObjectId.isValid(userId)
                ? !!(await MediaInteraction.findOne({
                    user: userId,
                    media: reply._id,
                    interactionType: "like",
                  }))
                : false;

              return {
                _id: String(reply._id),
                id: String(reply._id), // ✅ Include id field
                postId: String(reply.media),
                userId: reply.user?._id ? String(reply.user._id) : String(reply.user),
                content: reply.content,
                parentCommentId: reply.parentCommentId ? String(reply.parentCommentId) : null,
                createdAt: reply.createdAt ? (reply.createdAt instanceof Date ? reply.createdAt.toISOString() : reply.createdAt) : new Date().toISOString(),
                updatedAt: reply.updatedAt ? (reply.updatedAt instanceof Date ? reply.updatedAt.toISOString() : reply.updatedAt) : new Date().toISOString(),
                likesCount: replyLikesCount, // ✅ Calculate actual likes count
                userLiked: replyUserLiked, // ✅ Calculate actual userLiked
                author: reply.user
                  ? {
                      _id: String(reply.user._id),
                      username: reply.user.username,
                      firstName: reply.user.firstName || "", // ✅ Include firstName
                      lastName: reply.user.lastName || "", // ✅ Include lastName
                      avatarUrl: reply.user.avatar,
                    }
                  : null,
                replies: [], // ✅ Replies don't have nested replies (as per spec)
              };
            })
          );
        } else {
          commentData.replies = [];
        }

        return commentData;
      })
    );

    res.status(200).json({
      success: true,
      data: {
        comments: formattedComments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error getting forum post comments", { error: error.message, postId: req.params.postId });
    res.status(500).json({ success: false, error: "Failed to get comments" });
  }
};

/**
 * Add Comment to Forum Post
 */
export const commentOnForumPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const postId = req.params.postId;
    const userId = req.userId;
    const { content, parentCommentId } = req.body || {};

    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(userId!)) {
      res.status(400).json({ success: false, error: "Invalid post or user ID" });
      return;
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ success: false, error: "Comment content is required" });
      return;
    }

    if (content.length > 2000) {
      res.status(400).json({ success: false, error: "Comment must be less than 2000 characters" });
      return;
    }

    // Check if post exists
    const post = await ForumPost.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, error: "Post not found" });
      return;
    }

    // Redis-backed rate limit (per user + per post)
    const commentRl = await redisRateLimit({
      key: `rl:comment:${userId}:${postId}`,
      limit: 5,
      windowSeconds: 30,
    });
    if (!commentRl.allowed) {
      res.status(429).json({
        success: false,
        error: "Too many comments. Please slow down.",
      });
      return;
    }

    // Validate parent comment if provided
    if (parentCommentId) {
      if (!Types.ObjectId.isValid(parentCommentId)) {
        res.status(400).json({ success: false, error: "Invalid parent comment ID" });
        return;
      }
      const parentComment = await MediaInteraction.findOne({
        _id: parentCommentId,
        media: new Types.ObjectId(postId),
        interactionType: "comment",
        isRemoved: { $ne: true },
      });
      if (!parentComment) {
        res.status(404).json({ success: false, error: "Parent comment not found" });
        return;
      }

      // Check nesting depth (max 3 levels)
      const depth = await getCommentDepth(parentCommentId);
      if (depth >= 3) {
        res.status(400).json({
          success: false,
          error: "Maximum nesting depth reached (3 levels). Cannot reply to this comment.",
        });
        return;
      }
    }

    // Create comment
    const comment = await MediaInteraction.create({
      user: userId,
      media: new Types.ObjectId(postId),
      interactionType: "comment",
      content: content.trim(),
      parentCommentId: parentCommentId ? new Types.ObjectId(parentCommentId) : undefined,
      lastInteraction: new Date(),
      count: 1,
      isRemoved: false,
    });

    // Update post commentsCount
    post.commentsCount = (post.commentsCount || 0) + 1;
    await post.save();
    incrPostCounter({ postId, field: "comments", delta: 1 }).catch(() => {});

    // Populate user info
    await comment.populate("user", "firstName lastName username avatar");

    logger.info("Forum post comment created", { postId, userId, commentId: comment._id });

    // Format response to match spec
    const responseData = {
      _id: String(comment._id),
      id: String(comment._id), // ✅ Include id field as per spec
      postId: String(comment.media),
      userId: comment.user?._id ? String(comment.user._id) : String(comment.user),
      content: comment.content,
      parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
      createdAt: comment.createdAt ? (comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt) : new Date().toISOString(),
      updatedAt: comment.updatedAt ? (comment.updatedAt instanceof Date ? comment.updatedAt.toISOString() : comment.updatedAt) : new Date().toISOString(),
      likesCount: 0,
      userLiked: false,
      author: comment.user && typeof comment.user === "object" && comment.user._id
        ? {
            _id: String(comment.user._id),
            username: comment.user.username,
            firstName: comment.user.firstName || "", // ✅ Include firstName
            lastName: comment.user.lastName || "", // ✅ Include lastName
            avatarUrl: comment.user.avatar,
          }
        : null,
      replies: [], // ✅ Empty replies array as per spec
    };

    res.status(201).json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    logger.error("Error creating forum post comment", { error: error.message, postId: req.params.postId });
    res.status(500).json({ success: false, error: "Failed to create comment" });
  }
};

/**
 * Delete Forum Comment (Creator Only)
 */
export const deleteForumComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId!)) {
      res.status(400).json({ success: false, error: "Invalid comment or user ID" });
      return;
    }

    // Find the comment
    const comment = await MediaInteraction.findOne({
      _id: new Types.ObjectId(commentId),
      interactionType: "comment",
      isRemoved: { $ne: true },
    });

    if (!comment) {
      res.status(404).json({ success: false, error: "Comment not found" });
      return;
    }

    // Check if user is the comment creator
    if (String(comment.user) !== String(userId)) {
      res.status(403).json({ success: false, error: "Forbidden: Only comment creator can delete" });
      return;
    }

    // Get the post to update commentsCount
    const postId = String(comment.media);
    const post = await ForumPost.findById(postId);

    if (post) {
      // Decrement commentsCount
      post.commentsCount = Math.max(0, (post.commentsCount || 0) - 1);
      await post.save();
    }

    // Mark comment as removed (soft delete)
    comment.isRemoved = true;
    await comment.save();

    logger.info("Forum comment deleted", { commentId, userId, postId });

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting forum comment", { error: error.message, commentId: req.params.commentId });
    res.status(500).json({ success: false, error: "Failed to delete comment" });
  }
};

/**
 * Like/Unlike Forum Comment
 */
export const likeForumComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const commentId = req.params.commentId;
    const userId = req.userId;

    if (!Types.ObjectId.isValid(commentId) || !Types.ObjectId.isValid(userId!)) {
      res.status(400).json({ success: false, error: "Invalid comment or user ID" });
      return;
    }

    // Check if comment exists
    const comment = await MediaInteraction.findOne({
      _id: commentId,
      interactionType: "comment",
      isRemoved: { $ne: true },
    });

    if (!comment) {
      res.status(404).json({ success: false, error: "Comment not found" });
      return;
    }

    // Check if user already liked this comment
    const existingLike = await MediaInteraction.findOne({
      user: userId,
      media: new Types.ObjectId(commentId),
      interactionType: "like",
    });

    let liked: boolean;
    let likesCount: number;

    if (existingLike) {
      // Unlike - remove the interaction
      await MediaInteraction.findByIdAndDelete(existingLike._id);
      liked = false;
    } else {
      // Like - create new interaction
      await MediaInteraction.create({
        user: userId,
        media: new Types.ObjectId(commentId),
        interactionType: "like",
        lastInteraction: new Date(),
        count: 1,
      });
      liked = true;
    }

    // Get current likes count
    likesCount = await MediaInteraction.countDocuments({
      media: new Types.ObjectId(commentId),
      interactionType: "like",
    });

    logger.info("Forum comment like toggled", { commentId, userId, liked, likesCount });

    res.status(200).json({
      success: true,
      data: {
        liked,
        likesCount: likesCount,
      },
    });
  } catch (error: any) {
    logger.error("Error toggling forum comment like", { error: error.message, commentId: req.params.commentId });
    res.status(500).json({ success: false, error: "Failed to toggle like" });
  }
};

