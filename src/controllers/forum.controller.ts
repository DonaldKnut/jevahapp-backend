import { Request, Response } from "express";
import { Forum } from "../models/forum.model";
import { ForumPost } from "../models/forumPost.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { User } from "../models/user.model";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";

/**
 * Create Forum (Admin Only)
 */
export const createForum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description } = req.body || {};

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      res.status(400).json({ success: false, error: "Validation error: title must be at least 3 characters" });
      return;
    }

    if (title.length > 100) {
      res.status(400).json({ success: false, error: "Validation error: title must be less than 100 characters" });
      return;
    }

    if (!description || typeof description !== "string" || description.trim().length < 10) {
      res.status(400).json({ success: false, error: "Validation error: description must be at least 10 characters" });
      return;
    }

    if (description.length > 500) {
      res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
      return;
    }

    // Check if user is admin (you may need to adjust this based on your auth middleware)
    const user = await User.findById(req.userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
      return;
    }

    const forum = await Forum.create({
      title: title.trim(),
      description: description.trim(),
      createdBy: req.userId,
      isActive: true,
      postsCount: 0,
      participantsCount: 0,
    });

    await forum.populate("createdBy", "firstName lastName username avatar");

    logger.info("Forum created", { forumId: forum._id, createdBy: req.userId });

    res.status(201).json({
      success: true,
      data: serializeForum(forum),
    });
  } catch (error: any) {
    logger.error("Error creating forum", { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, error: "Failed to create forum" });
  }
};

/**
 * Get All Forums
 */
export const listForums = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);

    const [forums, total] = await Promise.all([
      Forum.find({ isActive: true })
        .populate("createdBy", "firstName lastName username avatar")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Forum.countDocuments({ isActive: true }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        forums: forums.map(serializeForum),
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
    logger.error("Error listing forums", { error: error.message });
    res.status(500).json({ success: false, error: "Failed to list forums" });
  }
};

/**
 * Create Forum Post
 */
export const createForumPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { forumId } = req.params;
    const { content, embeddedLinks } = req.body || {};

    if (!Types.ObjectId.isValid(forumId)) {
      res.status(400).json({ success: false, error: "Invalid forum ID" });
      return;
    }

    // Check if forum exists
    const forum = await Forum.findById(forumId);
    if (!forum || !forum.isActive) {
      res.status(404).json({ success: false, error: "Forum not found or inactive" });
      return;
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ success: false, error: "Validation error: content is required" });
      return;
    }

    if (content.length > 5000) {
      res.status(400).json({ success: false, error: "Validation error: content must be less than 5000 characters" });
      return;
    }

    // Validate embedded links if provided
    if (embeddedLinks && Array.isArray(embeddedLinks)) {
      if (embeddedLinks.length > 5) {
        res.status(400).json({ success: false, error: "Validation error: maximum 5 embedded links allowed" });
        return;
      }

      for (const link of embeddedLinks) {
        if (!link.url || typeof link.url !== "string") {
          res.status(400).json({ success: false, error: "Validation error: each link must have a valid URL" });
          return;
        }

        // Validate URL format
        try {
          new URL(link.url);
        } catch {
          res.status(400).json({ success: false, error: "Validation error: invalid URL format" });
          return;
        }

        if (!link.type || !["video", "article", "resource", "other"].includes(link.type)) {
          res.status(400).json({ success: false, error: "Validation error: link type must be video, article, resource, or other" });
          return;
        }

        if (link.title && link.title.length > 200) {
          res.status(400).json({ success: false, error: "Validation error: link title must be less than 200 characters" });
          return;
        }

        if (link.description && link.description.length > 500) {
          res.status(400).json({ success: false, error: "Validation error: link description must be less than 500 characters" });
          return;
        }
      }
    }

    const post = await ForumPost.create({
      forumId: new Types.ObjectId(forumId),
      userId: req.userId,
      content: content.trim(),
      embeddedLinks: Array.isArray(embeddedLinks) ? embeddedLinks : undefined,
      likesCount: 0,
      commentsCount: 0,
    });

    // Update forum stats
    forum.postsCount = (forum.postsCount || 0) + 1;
    
    // Check if this is a new participant
    const existingPosts = await ForumPost.findOne({
      forumId: forum._id,
      userId: req.userId,
    });
    if (!existingPosts || String(existingPosts._id) === String(post._id)) {
      forum.participantsCount = (forum.participantsCount || 0) + 1;
    }
    
    await forum.save();

    await post.populate("userId", "firstName lastName username avatar");
    await post.populate("forumId", "title");

    logger.info("Forum post created", { postId: post._id, forumId, userId: req.userId });

    res.status(201).json({
      success: true,
      data: await serializeForumPost(post, req.userId),
    });
  } catch (error: any) {
    logger.error("Error creating forum post", { error: error.message, forumId: req.params.forumId });
    res.status(500).json({ success: false, error: "Failed to create forum post" });
  }
};

/**
 * Get Forum Posts
 */
export const getForumPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { forumId } = req.params;
    const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
    const sortBy = String(req.query.sortBy || "createdAt");
    const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;

    if (!Types.ObjectId.isValid(forumId)) {
      res.status(400).json({ success: false, error: "Invalid forum ID" });
      return;
    }

    // Check if forum exists
    const forum = await Forum.findById(forumId);
    if (!forum || !forum.isActive) {
      res.status(404).json({ success: false, error: "Forum not found or inactive" });
      return;
    }

    // Build sort object
    const sort: any = {};
    if (sortBy === "likesCount") sort.likesCount = sortOrder;
    else if (sortBy === "commentsCount") sort.commentsCount = sortOrder;
    else sort.createdAt = sortOrder;

    const [posts, total] = await Promise.all([
      ForumPost.find({ forumId: new Types.ObjectId(forumId) })
        .populate("userId", "firstName lastName username avatar")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      ForumPost.countDocuments({ forumId: new Types.ObjectId(forumId) }),
    ]);

    const userId = req.userId;
    const formattedPosts = await Promise.all(
      posts.map(async (post) => await serializeForumPost(post, userId))
    );

    res.status(200).json({
      success: true,
      data: {
        posts: formattedPosts,
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
    logger.error("Error getting forum posts", { error: error.message, forumId: req.params.forumId });
    res.status(500).json({ success: false, error: "Failed to get forum posts" });
  }
};

/**
 * Update Forum Post
 */
export const updateForumPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const { content, embeddedLinks } = req.body || {};

    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ success: false, error: "Invalid post ID" });
      return;
    }

    const post = await ForumPost.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, error: "Post not found" });
      return;
    }

    if (String(post.userId) !== String(req.userId)) {
      res.status(403).json({ success: false, error: "Forbidden: Only author can edit" });
      return;
    }

    if (content !== undefined) {
      if (typeof content !== "string" || content.trim().length === 0) {
        res.status(400).json({ success: false, error: "Validation error: content must be a non-empty string" });
        return;
      }
      if (content.length > 5000) {
        res.status(400).json({ success: false, error: "Validation error: content must be less than 5000 characters" });
        return;
      }
      post.content = content.trim();
    }

    if (embeddedLinks !== undefined) {
      if (embeddedLinks === null) {
        post.embeddedLinks = undefined;
      } else if (Array.isArray(embeddedLinks)) {
        if (embeddedLinks.length > 5) {
          res.status(400).json({ success: false, error: "Validation error: maximum 5 embedded links allowed" });
          return;
        }
        // Validate each link
        for (const link of embeddedLinks) {
          if (!link.url || typeof link.url !== "string") {
            res.status(400).json({ success: false, error: "Validation error: each link must have a valid URL" });
            return;
          }
          try {
            new URL(link.url);
          } catch {
            res.status(400).json({ success: false, error: "Validation error: invalid URL format" });
            return;
          }
          if (!link.type || !["video", "article", "resource", "other"].includes(link.type)) {
            res.status(400).json({ success: false, error: "Validation error: link type must be video, article, resource, or other" });
            return;
          }
        }
        post.embeddedLinks = embeddedLinks;
      } else {
        res.status(400).json({ success: false, error: "Validation error: embeddedLinks must be an array or null" });
        return;
      }
    }

    await post.save();
    await post.populate("userId", "firstName lastName username avatar");

    logger.info("Forum post updated", { postId: post._id, userId: req.userId });

    res.status(200).json({
      success: true,
      data: await serializeForumPost(post, req.userId),
    });
  } catch (error: any) {
    logger.error("Error updating forum post", { error: error.message, postId: req.params.postId });
    res.status(500).json({ success: false, error: "Failed to update forum post" });
  }
};

/**
 * Delete Forum Post
 */
export const deleteForumPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ success: false, error: "Invalid post ID" });
      return;
    }

    const post = await ForumPost.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, error: "Post not found" });
      return;
    }

    // Check if user is author or admin
    const user = await User.findById(req.userId);
    const isAuthor = String(post.userId) === String(req.userId);
    const isAdmin = user?.role === "admin";

    if (!isAuthor && !isAdmin) {
      res.status(403).json({ success: false, error: "Forbidden: Only author or admin can delete" });
      return;
    }

    // Update forum stats
    const forum = await Forum.findById(post.forumId);
    if (forum) {
      forum.postsCount = Math.max(0, (forum.postsCount || 0) - 1);
      await forum.save();
    }

    await ForumPost.findByIdAndDelete(postId);

    logger.info("Forum post deleted", { postId, userId: req.userId, isAdmin });

    res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting forum post", { error: error.message, postId: req.params.postId });
    res.status(500).json({ success: false, error: "Failed to delete forum post" });
  }
};

/**
 * Serialize Forum
 */
function serializeForum(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    _id: String(obj._id),
    title: obj.title,
    description: obj.description,
    createdBy: String(obj.createdBy?._id || obj.createdBy),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    isActive: obj.isActive,
    postsCount: obj.postsCount || 0,
    participantsCount: obj.participantsCount || 0,
    createdByUser: obj.createdBy && typeof obj.createdBy === "object" && obj.createdBy._id
      ? {
          _id: String(obj.createdBy._id),
          username: obj.createdBy.username,
          avatarUrl: obj.createdBy.avatar,
        }
      : null,
  };
}

/**
 * Serialize Forum Post with user interaction data
 */
async function serializeForumPost(doc: any, userId?: string) {
  const obj = doc.toObject ? doc.toObject() : doc;

  // Check if user liked this post
  let userLiked = false;
  if (userId && Types.ObjectId.isValid(userId)) {
    const like = await MediaInteraction.findOne({
      user: userId,
      media: obj._id,
      interactionType: "like",
    });
    userLiked = !!like;
  }

  return {
    _id: String(obj._id),
    forumId: String(obj.forumId?._id || obj.forumId),
    userId: String(obj.userId?._id || obj.userId),
    content: obj.content,
    embeddedLinks: obj.embeddedLinks || [],
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    likesCount: obj.likesCount || 0,
    commentsCount: obj.commentsCount || 0,
    userLiked,
    author: obj.userId && typeof obj.userId === "object" && obj.userId._id
      ? {
          _id: String(obj.userId._id),
          username: obj.userId.username,
          firstName: obj.userId.firstName,
          lastName: obj.userId.lastName,
          avatarUrl: obj.userId.avatar,
        }
      : obj.userId
        ? { _id: String(obj.userId) }
        : null,
  };
}

