"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.likeForumComment = exports.deleteForumComment = exports.commentOnForumPost = exports.getForumPostComments = exports.likeForumPost = void 0;
const forumPost_model_1 = require("../models/forumPost.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const mongoose_1 = require("mongoose");
const logger_1 = __importDefault(require("../utils/logger"));
const redisRateLimit_1 = require("../lib/redisRateLimit");
const redisCounters_1 = require("../lib/redisCounters");
/**
 * Helper function to get comment nesting depth
 * Returns the depth level (0 = top-level, 1 = reply, 2 = reply to reply, etc.)
 */
function getCommentDepth(commentId) {
    return __awaiter(this, void 0, void 0, function* () {
        let depth = 0;
        let currentId = commentId;
        const maxIterations = 10; // Safety limit to prevent infinite loops
        let iterations = 0;
        while (currentId && iterations < maxIterations) {
            const comment = yield mediaInteraction_model_1.MediaInteraction.findById(currentId).lean();
            if (!comment || !comment.parentCommentId) {
                break;
            }
            currentId = comment.parentCommentId ? String(comment.parentCommentId) : null;
            depth++;
            iterations++;
        }
        return depth;
    });
}
/**
 * Like/Unlike Forum Post
 */
const likeForumPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const postId = req.params.postId;
        const userId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(postId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
            res.status(400).json({ success: false, error: "Invalid post or user ID" });
            return;
        }
        // Check if post exists
        const post = yield forumPost_model_1.ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ success: false, error: "Post not found" });
            return;
        }
        // Redis-backed rate limit (per user + per post)
        const likeRl = yield (0, redisRateLimit_1.redisRateLimit)({
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
        const existingLike = yield mediaInteraction_model_1.MediaInteraction.findOne({
            user: userId,
            media: new mongoose_1.Types.ObjectId(postId),
            interactionType: "like",
        });
        let liked;
        let likeCount;
        if (existingLike) {
            // Unlike - remove the interaction
            yield mediaInteraction_model_1.MediaInteraction.findByIdAndDelete(existingLike._id);
            liked = false;
            post.likesCount = Math.max(0, (post.likesCount || 0) - 1);
            yield post.save();
            likeCount = post.likesCount || 0;
            (0, redisCounters_1.incrPostCounter)({ postId, field: "likes", delta: -1 }).catch(() => { });
        }
        else {
            // Like - create new interaction
            yield mediaInteraction_model_1.MediaInteraction.create({
                user: userId,
                media: new mongoose_1.Types.ObjectId(postId),
                interactionType: "like",
                lastInteraction: new Date(),
                count: 1,
            });
            liked = true;
            post.likesCount = (post.likesCount || 0) + 1;
            yield post.save();
            likeCount = post.likesCount || 0;
            (0, redisCounters_1.incrPostCounter)({ postId, field: "likes", delta: 1 }).catch(() => { });
        }
        logger_1.default.info("Forum post like toggled", { postId, userId, liked, likeCount });
        res.status(200).json({
            success: true,
            data: {
                liked,
                likesCount: likeCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error toggling forum post like", { error: error.message, postId: req.params.postId });
        res.status(500).json({ success: false, error: "Failed to toggle like" });
    }
});
exports.likeForumPost = likeForumPost;
/**
 * Get Comments on Forum Post
 */
const getForumPostComments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const postId = req.params.postId;
        const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
        const includeReplies = String(req.query.includeReplies || "true") === "true";
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            res.status(400).json({ success: false, error: "Invalid post ID" });
            return;
        }
        // Check if post exists
        const post = yield forumPost_model_1.ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ success: false, error: "Post not found" });
            return;
        }
        // Get top-level comments (no parentCommentId)
        // Sort by createdAt ascending (oldest first) as per spec
        const comments = yield mediaInteraction_model_1.MediaInteraction.find({
            media: new mongoose_1.Types.ObjectId(postId),
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
        const total = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
            media: new mongoose_1.Types.ObjectId(postId),
            interactionType: "comment",
            isRemoved: { $ne: true },
            $or: [
                { parentCommentId: { $exists: false } },
                { parentCommentId: null },
            ],
        });
        // Get replies if requested
        let replies = [];
        if (includeReplies) {
            const commentIds = comments.map((c) => c._id);
            replies = yield mediaInteraction_model_1.MediaInteraction.find({
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
        replies.forEach((reply) => {
            const parentId = String(reply.parentCommentId);
            if (!repliesMap.has(parentId)) {
                repliesMap.set(parentId, []);
            }
            repliesMap.get(parentId).push(reply);
        });
        // Format comments with replies
        const userId = req.userId;
        const formattedComments = yield Promise.all(comments.map((comment) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            // Get likes count for this comment
            const likesCount = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
                media: comment._id,
                interactionType: "like",
            });
            // Check if current user liked this comment
            const userLiked = userId && mongoose_1.Types.ObjectId.isValid(userId)
                ? !!(yield mediaInteraction_model_1.MediaInteraction.findOne({
                    user: userId,
                    media: comment._id,
                    interactionType: "like",
                }))
                : false;
            const commentData = {
                _id: String(comment._id),
                id: String(comment._id), // ✅ Include id field as per spec
                postId: String(comment.media),
                userId: ((_a = comment.user) === null || _a === void 0 ? void 0 : _a._id) ? String(comment.user._id) : String(comment.user),
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
                commentData.replies = yield Promise.all(replyList.map((reply) => __awaiter(void 0, void 0, void 0, function* () {
                    var _a;
                    // Get likes count for reply
                    const replyLikesCount = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
                        media: reply._id,
                        interactionType: "like",
                    });
                    // Check if current user liked this reply
                    const replyUserLiked = userId && mongoose_1.Types.ObjectId.isValid(userId)
                        ? !!(yield mediaInteraction_model_1.MediaInteraction.findOne({
                            user: userId,
                            media: reply._id,
                            interactionType: "like",
                        }))
                        : false;
                    return {
                        _id: String(reply._id),
                        id: String(reply._id), // ✅ Include id field
                        postId: String(reply.media),
                        userId: ((_a = reply.user) === null || _a === void 0 ? void 0 : _a._id) ? String(reply.user._id) : String(reply.user),
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
                })));
            }
            else {
                commentData.replies = [];
            }
            return commentData;
        })));
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
    }
    catch (error) {
        logger_1.default.error("Error getting forum post comments", { error: error.message, postId: req.params.postId });
        res.status(500).json({ success: false, error: "Failed to get comments" });
    }
});
exports.getForumPostComments = getForumPostComments;
/**
 * Add Comment to Forum Post
 */
const commentOnForumPost = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const postId = req.params.postId;
        const userId = req.userId;
        const { content, parentCommentId } = req.body || {};
        if (!mongoose_1.Types.ObjectId.isValid(postId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
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
        const post = yield forumPost_model_1.ForumPost.findById(postId);
        if (!post) {
            res.status(404).json({ success: false, error: "Post not found" });
            return;
        }
        // Redis-backed rate limit (per user + per post)
        const commentRl = yield (0, redisRateLimit_1.redisRateLimit)({
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
            if (!mongoose_1.Types.ObjectId.isValid(parentCommentId)) {
                res.status(400).json({ success: false, error: "Invalid parent comment ID" });
                return;
            }
            const parentComment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                _id: parentCommentId,
                media: new mongoose_1.Types.ObjectId(postId),
                interactionType: "comment",
                isRemoved: { $ne: true },
            });
            if (!parentComment) {
                res.status(404).json({ success: false, error: "Parent comment not found" });
                return;
            }
            // Check nesting depth (max 3 levels)
            const depth = yield getCommentDepth(parentCommentId);
            if (depth >= 3) {
                res.status(400).json({
                    success: false,
                    error: "Maximum nesting depth reached (3 levels). Cannot reply to this comment.",
                });
                return;
            }
        }
        // Create comment
        const comment = yield mediaInteraction_model_1.MediaInteraction.create({
            user: userId,
            media: new mongoose_1.Types.ObjectId(postId),
            interactionType: "comment",
            content: content.trim(),
            parentCommentId: parentCommentId ? new mongoose_1.Types.ObjectId(parentCommentId) : undefined,
            lastInteraction: new Date(),
            count: 1,
            isRemoved: false,
        });
        // Update post commentsCount
        post.commentsCount = (post.commentsCount || 0) + 1;
        yield post.save();
        (0, redisCounters_1.incrPostCounter)({ postId, field: "comments", delta: 1 }).catch(() => { });
        // Populate user info
        yield comment.populate("user", "firstName lastName username avatar");
        logger_1.default.info("Forum post comment created", { postId, userId, commentId: comment._id });
        // Format response to match spec
        const responseData = {
            _id: String(comment._id),
            id: String(comment._id), // ✅ Include id field as per spec
            postId: String(comment.media),
            userId: ((_a = comment.user) === null || _a === void 0 ? void 0 : _a._id) ? String(comment.user._id) : String(comment.user),
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
    }
    catch (error) {
        logger_1.default.error("Error creating forum post comment", { error: error.message, postId: req.params.postId });
        res.status(500).json({ success: false, error: "Failed to create comment" });
    }
});
exports.commentOnForumPost = commentOnForumPost;
/**
 * Delete Forum Comment (Creator Only)
 */
const deleteForumComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { commentId } = req.params;
        const userId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
            res.status(400).json({ success: false, error: "Invalid comment or user ID" });
            return;
        }
        // Find the comment
        const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
            _id: new mongoose_1.Types.ObjectId(commentId),
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
        const post = yield forumPost_model_1.ForumPost.findById(postId);
        if (post) {
            // Decrement commentsCount
            post.commentsCount = Math.max(0, (post.commentsCount || 0) - 1);
            yield post.save();
        }
        // Mark comment as removed (soft delete)
        comment.isRemoved = true;
        yield comment.save();
        logger_1.default.info("Forum comment deleted", { commentId, userId, postId });
        res.status(200).json({
            success: true,
            message: "Comment deleted successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Error deleting forum comment", { error: error.message, commentId: req.params.commentId });
        res.status(500).json({ success: false, error: "Failed to delete comment" });
    }
});
exports.deleteForumComment = deleteForumComment;
/**
 * Like/Unlike Forum Comment
 */
const likeForumComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const commentId = req.params.commentId;
        const userId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
            res.status(400).json({ success: false, error: "Invalid comment or user ID" });
            return;
        }
        // Check if comment exists
        const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
            _id: commentId,
            interactionType: "comment",
            isRemoved: { $ne: true },
        });
        if (!comment) {
            res.status(404).json({ success: false, error: "Comment not found" });
            return;
        }
        // Check if user already liked this comment
        const existingLike = yield mediaInteraction_model_1.MediaInteraction.findOne({
            user: userId,
            media: new mongoose_1.Types.ObjectId(commentId),
            interactionType: "like",
        });
        let liked;
        let likesCount;
        if (existingLike) {
            // Unlike - remove the interaction
            yield mediaInteraction_model_1.MediaInteraction.findByIdAndDelete(existingLike._id);
            liked = false;
        }
        else {
            // Like - create new interaction
            yield mediaInteraction_model_1.MediaInteraction.create({
                user: userId,
                media: new mongoose_1.Types.ObjectId(commentId),
                interactionType: "like",
                lastInteraction: new Date(),
                count: 1,
            });
            liked = true;
        }
        // Get current likes count
        likesCount = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
            media: new mongoose_1.Types.ObjectId(commentId),
            interactionType: "like",
        });
        logger_1.default.info("Forum comment like toggled", { commentId, userId, liked, likesCount });
        res.status(200).json({
            success: true,
            data: {
                liked,
                likesCount: likesCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error toggling forum comment like", { error: error.message, commentId: req.params.commentId });
        res.status(500).json({ success: false, error: "Failed to toggle like" });
    }
});
exports.likeForumComment = likeForumComment;
