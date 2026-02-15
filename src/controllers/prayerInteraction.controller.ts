import { Request, Response } from "express";
import { PrayerPost } from "../models/prayerPost.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { User } from "../models/user.model";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";
import { redisRateLimit } from "../lib/redisRateLimit";
import { incrPostCounter } from "../lib/redisCounters";

/**
 * Toggle like on a prayer post
 */
export const likePrayer = async (req: Request, res: Response): Promise<void> => {
  try {
    const prayerId = req.params.id;
    const userId = req.userId;

    if (!Types.ObjectId.isValid(prayerId) || !Types.ObjectId.isValid(userId!)) {
      res.status(400).json({ success: false, error: "Invalid prayer or user ID" });
      return;
    }

    // Check if prayer exists
    const prayer = await PrayerPost.findById(prayerId);
    if (!prayer) {
      res.status(404).json({ success: false, error: "Prayer not found" });
      return;
    }

    // Redis-backed rate limit (per user + per post)
    const likeRl = await redisRateLimit({
      key: `rl:like:${userId}:${prayerId}`,
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

    // Check if user already liked this prayer
    const existingLike = await MediaInteraction.findOne({
      user: userId,
      media: new Types.ObjectId(prayerId),
      interactionType: "like",
    });

    let liked: boolean;
    let likeCount: number;

    if (existingLike) {
      // Unlike - remove the interaction
      await MediaInteraction.findByIdAndDelete(existingLike._id);
      liked = false;
      // Update prayer likesCount
      prayer.likesCount = Math.max(0, (prayer.likesCount || 0) - 1);
      await prayer.save();
      likeCount = prayer.likesCount || 0;
      // Fast counter (best-effort, doesn't affect correctness)
      incrPostCounter({ postId: prayerId, field: "likes", delta: -1 }).catch(() => {});
    } else {
      // Like - create new interaction
      await MediaInteraction.create({
        user: userId,
        media: new Types.ObjectId(prayerId),
        interactionType: "like",
        lastInteraction: new Date(),
        count: 1,
      });
      liked = true;
      // Update prayer likesCount
      prayer.likesCount = (prayer.likesCount || 0) + 1;
      await prayer.save();
      likeCount = prayer.likesCount || 0;
      incrPostCounter({ postId: prayerId, field: "likes", delta: 1 }).catch(() => {});
    }

    logger.info("Prayer like toggled", { prayerId, userId, liked, likeCount });

    res.status(200).json({
      success: true,
      data: {
        liked,
        likesCount: likeCount,
      },
    });
  } catch (error: any) {
    logger.error("Error toggling prayer like", { error: error.message, prayerId: req.params.id });
    res.status(500).json({ success: false, error: "Failed to toggle like" });
  }
};

/**
 * Get comments on a prayer post
 */
export const getPrayerComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const prayerId = req.params.id;
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);

    if (!Types.ObjectId.isValid(prayerId)) {
      res.status(400).json({ success: false, error: "Invalid prayer ID" });
      return;
    }

    // Check if prayer exists
    const prayer = await PrayerPost.findById(prayerId);
    if (!prayer) {
      res.status(404).json({ success: false, error: "Prayer not found" });
      return;
    }

    // Get top-level comments (no parentCommentId)
    const comments = await MediaInteraction.find({
      media: new Types.ObjectId(prayerId),
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

    // Get total count
    const total = await MediaInteraction.countDocuments({
      media: new Types.ObjectId(prayerId),
      interactionType: "comment",
      isRemoved: { $ne: true },
      $or: [
        { parentCommentId: { $exists: false } },
        { parentCommentId: null },
      ],
    });

    // Get replies for each comment
    const commentIds = comments.map((c: any) => c._id);
    const replies = await MediaInteraction.find({
      parentCommentId: { $in: commentIds },
      interactionType: "comment",
      isRemoved: { $ne: true },
    })
      .populate("user", "firstName lastName username avatar")
      .sort({ createdAt: 1 })
      .lean();

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
        const userLiked = userId
          ? !!(await MediaInteraction.findOne({
              user: userId,
              media: comment._id,
              interactionType: "like",
            }))
          : false;

        return {
          _id: comment._id,
          userId: comment.user?._id,
          content: comment.content,
          createdAt: comment.createdAt,
          likesCount,
          userLiked,
          author: comment.user
            ? {
                _id: comment.user._id,
                username: comment.user.username,
                firstName: comment.user.firstName,
                lastName: comment.user.lastName,
                avatarUrl: comment.user.avatar,
              }
            : null,
          replies: (repliesMap.get(String(comment._id)) || []).map((reply: any) => ({
            _id: reply._id,
            userId: reply.user?._id,
            content: reply.content,
            createdAt: reply.createdAt,
            parentCommentId: reply.parentCommentId,
            likesCount: 0, // Could calculate if needed
            userLiked: false,
            author: reply.user
              ? {
                  _id: reply.user._id,
                  username: reply.user.username,
                  avatarUrl: reply.user.avatar,
                }
              : null,
          })),
        };
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
    logger.error("Error getting prayer comments", { error: error.message, prayerId: req.params.id });
    res.status(500).json({ success: false, error: "Failed to get comments" });
  }
};

/**
 * Add comment to a prayer post
 */
export const commentOnPrayer = async (req: Request, res: Response): Promise<void> => {
  try {
    const prayerId = req.params.id;
    const userId = req.userId;
    const { content, parentCommentId } = req.body;

    if (!Types.ObjectId.isValid(prayerId) || !Types.ObjectId.isValid(userId!)) {
      res.status(400).json({ success: false, error: "Invalid prayer or user ID" });
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

    // Check if prayer exists
    const prayer = await PrayerPost.findById(prayerId);
    if (!prayer) {
      res.status(404).json({ success: false, error: "Prayer not found" });
      return;
    }

    // Redis-backed rate limit (per user + per post)
    const commentRl = await redisRateLimit({
      key: `rl:comment:${userId}:${prayerId}`,
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
        media: new Types.ObjectId(prayerId),
        interactionType: "comment",
        isRemoved: { $ne: true },
      });
      if (!parentComment) {
        res.status(404).json({ success: false, error: "Parent comment not found" });
        return;
      }
    }

    // Create comment
    const comment = await MediaInteraction.create({
      user: userId,
      media: new Types.ObjectId(prayerId),
      interactionType: "comment",
      content: content.trim(),
      parentCommentId: parentCommentId ? new Types.ObjectId(parentCommentId) : undefined,
      lastInteraction: new Date(),
      count: 1,
      isRemoved: false,
    });

    // Update prayer commentsCount
    prayer.commentsCount = (prayer.commentsCount || 0) + 1;
    await prayer.save();
    incrPostCounter({ postId: prayerId, field: "comments", delta: 1 }).catch(() => {});

    // Populate user info
    await comment.populate("user", "firstName lastName username avatar");

    logger.info("Prayer comment created", { prayerId, userId, commentId: comment._id });

    res.status(201).json({
      success: true,
      data: {
        _id: comment._id,
        userId: comment.user?._id,
        content: comment.content,
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
    logger.error("Error creating prayer comment", { error: error.message, prayerId: req.params.id });
    res.status(500).json({ success: false, error: "Failed to create comment" });
  }
};

