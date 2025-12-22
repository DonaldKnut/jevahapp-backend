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
exports.commentOnPrayer = exports.getPrayerComments = exports.likePrayer = void 0;
const prayerPost_model_1 = require("../models/prayerPost.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const mongoose_1 = require("mongoose");
const logger_1 = __importDefault(require("../utils/logger"));
const redisRateLimit_1 = require("../lib/redisRateLimit");
const redisCounters_1 = require("../lib/redisCounters");
/**
 * Toggle like on a prayer post
 */
const likePrayer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const prayerId = req.params.id;
        const userId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(prayerId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
            res.status(400).json({ success: false, error: "Invalid prayer or user ID" });
            return;
        }
        // Check if prayer exists
        const prayer = yield prayerPost_model_1.PrayerPost.findById(prayerId);
        if (!prayer) {
            res.status(404).json({ success: false, error: "Prayer not found" });
            return;
        }
        // Redis-backed rate limit (per user + per post)
        const likeRl = yield (0, redisRateLimit_1.redisRateLimit)({
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
        const existingLike = yield mediaInteraction_model_1.MediaInteraction.findOne({
            user: userId,
            media: new mongoose_1.Types.ObjectId(prayerId),
            interactionType: "like",
        });
        let liked;
        let likeCount;
        if (existingLike) {
            // Unlike - remove the interaction
            yield mediaInteraction_model_1.MediaInteraction.findByIdAndDelete(existingLike._id);
            liked = false;
            // Update prayer likesCount
            prayer.likesCount = Math.max(0, (prayer.likesCount || 0) - 1);
            yield prayer.save();
            likeCount = prayer.likesCount || 0;
            // Fast counter (best-effort, doesn't affect correctness)
            (0, redisCounters_1.incrPostCounter)({ postId: prayerId, field: "likes", delta: -1 }).catch(() => { });
        }
        else {
            // Like - create new interaction
            yield mediaInteraction_model_1.MediaInteraction.create({
                user: userId,
                media: new mongoose_1.Types.ObjectId(prayerId),
                interactionType: "like",
                lastInteraction: new Date(),
                count: 1,
            });
            liked = true;
            // Update prayer likesCount
            prayer.likesCount = (prayer.likesCount || 0) + 1;
            yield prayer.save();
            likeCount = prayer.likesCount || 0;
            (0, redisCounters_1.incrPostCounter)({ postId: prayerId, field: "likes", delta: 1 }).catch(() => { });
        }
        logger_1.default.info("Prayer like toggled", { prayerId, userId, liked, likeCount });
        res.status(200).json({
            success: true,
            data: {
                liked,
                likesCount: likeCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error toggling prayer like", { error: error.message, prayerId: req.params.id });
        res.status(500).json({ success: false, error: "Failed to toggle like" });
    }
});
exports.likePrayer = likePrayer;
/**
 * Get comments on a prayer post
 */
const getPrayerComments = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const prayerId = req.params.id;
        const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
        if (!mongoose_1.Types.ObjectId.isValid(prayerId)) {
            res.status(400).json({ success: false, error: "Invalid prayer ID" });
            return;
        }
        // Check if prayer exists
        const prayer = yield prayerPost_model_1.PrayerPost.findById(prayerId);
        if (!prayer) {
            res.status(404).json({ success: false, error: "Prayer not found" });
            return;
        }
        // Get top-level comments (no parentCommentId)
        const comments = yield mediaInteraction_model_1.MediaInteraction.find({
            media: new mongoose_1.Types.ObjectId(prayerId),
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
        const total = yield mediaInteraction_model_1.MediaInteraction.countDocuments({
            media: new mongoose_1.Types.ObjectId(prayerId),
            interactionType: "comment",
            isRemoved: { $ne: true },
            $or: [
                { parentCommentId: { $exists: false } },
                { parentCommentId: null },
            ],
        });
        // Get replies for each comment
        const commentIds = comments.map((c) => c._id);
        const replies = yield mediaInteraction_model_1.MediaInteraction.find({
            parentCommentId: { $in: commentIds },
            interactionType: "comment",
            isRemoved: { $ne: true },
        })
            .populate("user", "firstName lastName username avatar")
            .sort({ createdAt: 1 })
            .lean();
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
            const userLiked = userId
                ? !!(yield mediaInteraction_model_1.MediaInteraction.findOne({
                    user: userId,
                    media: comment._id,
                    interactionType: "like",
                }))
                : false;
            return {
                _id: comment._id,
                userId: (_a = comment.user) === null || _a === void 0 ? void 0 : _a._id,
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
                replies: (repliesMap.get(String(comment._id)) || []).map((reply) => {
                    var _a;
                    return ({
                        _id: reply._id,
                        userId: (_a = reply.user) === null || _a === void 0 ? void 0 : _a._id,
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
                    });
                }),
            };
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
        logger_1.default.error("Error getting prayer comments", { error: error.message, prayerId: req.params.id });
        res.status(500).json({ success: false, error: "Failed to get comments" });
    }
});
exports.getPrayerComments = getPrayerComments;
/**
 * Add comment to a prayer post
 */
const commentOnPrayer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const prayerId = req.params.id;
        const userId = req.userId;
        const { content, parentCommentId } = req.body;
        if (!mongoose_1.Types.ObjectId.isValid(prayerId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
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
        const prayer = yield prayerPost_model_1.PrayerPost.findById(prayerId);
        if (!prayer) {
            res.status(404).json({ success: false, error: "Prayer not found" });
            return;
        }
        // Redis-backed rate limit (per user + per post)
        const commentRl = yield (0, redisRateLimit_1.redisRateLimit)({
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
            if (!mongoose_1.Types.ObjectId.isValid(parentCommentId)) {
                res.status(400).json({ success: false, error: "Invalid parent comment ID" });
                return;
            }
            const parentComment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                _id: parentCommentId,
                media: new mongoose_1.Types.ObjectId(prayerId),
                interactionType: "comment",
                isRemoved: { $ne: true },
            });
            if (!parentComment) {
                res.status(404).json({ success: false, error: "Parent comment not found" });
                return;
            }
        }
        // Create comment
        const comment = yield mediaInteraction_model_1.MediaInteraction.create({
            user: userId,
            media: new mongoose_1.Types.ObjectId(prayerId),
            interactionType: "comment",
            content: content.trim(),
            parentCommentId: parentCommentId ? new mongoose_1.Types.ObjectId(parentCommentId) : undefined,
            lastInteraction: new Date(),
            count: 1,
            isRemoved: false,
        });
        // Update prayer commentsCount
        prayer.commentsCount = (prayer.commentsCount || 0) + 1;
        yield prayer.save();
        (0, redisCounters_1.incrPostCounter)({ postId: prayerId, field: "comments", delta: 1 }).catch(() => { });
        // Populate user info
        yield comment.populate("user", "firstName lastName username avatar");
        logger_1.default.info("Prayer comment created", { prayerId, userId, commentId: comment._id });
        res.status(201).json({
            success: true,
            data: {
                _id: comment._id,
                userId: (_a = comment.user) === null || _a === void 0 ? void 0 : _a._id,
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
    }
    catch (error) {
        logger_1.default.error("Error creating prayer comment", { error: error.message, prayerId: req.params.id });
        res.status(500).json({ success: false, error: "Failed to create comment" });
    }
});
exports.commentOnPrayer = commentOnPrayer;
