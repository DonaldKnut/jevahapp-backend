import { Request, Response } from "express";
import { ForumPost } from "../models/forumPost.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";

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
      .sort({ createdAt: -1 })
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
          _id: comment._id,
          postId: String(comment.media),
          userId: comment.user?._id,
          content: comment.content,
          parentCommentId: comment.parentCommentId || null,
          createdAt: comment.createdAt,
          likesCount,
          userLiked,
          author: comment.user
            ? {
                _id: comment.user._id,
                username: comment.user.username,
                avatarUrl: comment.user.avatar,
              }
            : null,
        };

        if (includeReplies) {
          commentData.replies = (repliesMap.get(String(comment._id)) || []).map((reply: any) => ({
            _id: reply._id,
            postId: String(reply.media),
            userId: reply.user?._id,
            content: reply.content,
            parentCommentId: reply.parentCommentId,
            createdAt: reply.createdAt,
            likesCount: 0, // Could calculate if needed
            userLiked: false,
            author: reply.user
              ? {
                  _id: reply.user._id,
                  username: reply.user.username,
                  avatarUrl: reply.user.avatar,
                }
              : null,
          }));
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

    // Populate user info
    await comment.populate("user", "firstName lastName username avatar");

    logger.info("Forum post comment created", { postId, userId, commentId: comment._id });

    res.status(201).json({
      success: true,
      data: {
        _id: comment._id,
        postId: String(comment.media),
        userId: comment.user?._id,
        content: comment.content,
        parentCommentId: comment.parentCommentId || null,
        createdAt: comment.createdAt,
        likesCount: 0,
        userLiked: false,
        author: comment.user
          ? {
              _id: comment.user._id,
              username: comment.user.username,
              firstName: comment.user.firstName,
              lastName: comment.user.lastName,
              avatarUrl: comment.user.avatar,
            }
          : null,
        replies: [],
      },
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

