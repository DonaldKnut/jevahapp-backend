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
exports.CommentService = void 0;
const mongoose_1 = require("mongoose");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const media_model_1 = require("../models/media.model");
const devotional_model_1 = require("../models/devotional.model");
const logger_1 = __importDefault(require("../utils/logger"));
class CommentService {
    /**
     * Create a new comment
     * Multiple comments per user per media are allowed
     */
    static createComment(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, contentId, contentType, content, parentCommentId } = data;
                if (!mongoose_1.Types.ObjectId.isValid(userId) || !mongoose_1.Types.ObjectId.isValid(contentId)) {
                    throw new Error("Invalid user or content ID");
                }
                if (!content || content.trim().length === 0) {
                    throw new Error("Comment content is required");
                }
                if (content.trim().length > 1000) {
                    throw new Error("Comment must be less than 1000 characters");
                }
                // Validate content exists
                if (contentType === "media") {
                    const media = yield media_model_1.Media.findById(contentId);
                    if (!media)
                        throw new Error("Media not found");
                }
                else if (contentType === "devotional") {
                    const devotional = yield devotional_model_1.Devotional.findById(contentId);
                    if (!devotional)
                        throw new Error("Devotional not found");
                }
                // Validate parent comment if provided
                if (parentCommentId) {
                    if (!mongoose_1.Types.ObjectId.isValid(parentCommentId)) {
                        throw new Error("Invalid parent comment ID");
                    }
                    const parent = yield mediaInteraction_model_1.MediaInteraction.findOne({
                        _id: new mongoose_1.Types.ObjectId(parentCommentId),
                        interactionType: "comment",
                        isRemoved: { $ne: true },
                    });
                    if (!parent) {
                        throw new Error("Parent comment not found");
                    }
                }
                const session = yield media_model_1.Media.startSession();
                try {
                    const comment = yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                        const commentData = {
                            user: new mongoose_1.Types.ObjectId(userId),
                            media: new mongoose_1.Types.ObjectId(contentId),
                            interactionType: "comment",
                            content: content.trim(),
                            count: 1,
                            reactions: new Map(),
                            replyCount: 0,
                            isRemoved: false,
                        };
                        if (parentCommentId && mongoose_1.Types.ObjectId.isValid(parentCommentId)) {
                            commentData.parentCommentId = new mongoose_1.Types.ObjectId(parentCommentId);
                        }
                        // Create comment (allow multiple comments per user)
                        const newComment = yield mediaInteraction_model_1.MediaInteraction.create([commentData], {
                            session,
                        });
                        // Update content comment count
                        if (contentType === "media") {
                            yield media_model_1.Media.findByIdAndUpdate(contentId, { $inc: { commentCount: 1 } }, { session });
                        }
                        else if (contentType === "devotional") {
                            yield devotional_model_1.Devotional.findByIdAndUpdate(contentId, { $inc: { commentCount: 1 } }, { session });
                        }
                        // If this is a reply, increment parent's replyCount
                        if (commentData.parentCommentId) {
                            yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(commentData.parentCommentId, { $inc: { replyCount: 1 } }, { session });
                        }
                        return newComment[0];
                    }));
                    // Populate user info
                    const populatedComment = yield mediaInteraction_model_1.MediaInteraction.findById(comment._id)
                        .populate("user", "firstName lastName avatar username")
                        .populate("parentCommentId", "content user")
                        .lean();
                    logger_1.default.info("Comment created", {
                        commentId: comment._id,
                        userId,
                        contentId,
                        contentType,
                        isReply: !!parentCommentId,
                    });
                    return this.formatComment(populatedComment);
                }
                finally {
                    session.endSession();
                }
            }
            catch (error) {
                logger_1.default.error("Error creating comment:", error);
                throw error;
            }
        });
    }
    /**
     * Update a comment (owner only)
     */
    static updateComment(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { commentId, userId, content } = data;
                if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
                    throw new Error("Invalid comment or user ID");
                }
                if (!content || content.trim().length === 0) {
                    throw new Error("Comment content is required");
                }
                if (content.trim().length > 1000) {
                    throw new Error("Comment must be less than 1000 characters");
                }
                const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                    _id: new mongoose_1.Types.ObjectId(commentId),
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
                yield comment.save();
                // Populate user info
                const updatedComment = yield mediaInteraction_model_1.MediaInteraction.findById(comment._id)
                    .populate("user", "firstName lastName avatar username")
                    .populate("parentCommentId", "content user")
                    .lean();
                logger_1.default.info("Comment updated", {
                    commentId,
                    userId,
                });
                return this.formatComment(updatedComment);
            }
            catch (error) {
                logger_1.default.error("Error updating comment:", error);
                throw error;
            }
        });
    }
    /**
     * Delete a comment (owner only - soft delete)
     */
    static deleteComment(commentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
                    throw new Error("Invalid comment or user ID");
                }
                const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                    _id: new mongoose_1.Types.ObjectId(commentId),
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
                const session = yield media_model_1.Media.startSession();
                try {
                    yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                        // Soft delete the comment
                        yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(commentId, {
                            isRemoved: true,
                            content: "[Deleted]", // Optionally clear content
                        }, { session });
                        // Decrement content comment count
                        const contentType = yield this.getContentTypeFromMediaId(comment.media.toString());
                        if (contentType === "media") {
                            yield media_model_1.Media.findByIdAndUpdate(comment.media, { $inc: { commentCount: -1 } }, { session });
                        }
                        else if (contentType === "devotional") {
                            yield devotional_model_1.Devotional.findByIdAndUpdate(comment.media, { $inc: { commentCount: -1 } }, { session });
                        }
                        // If this is a reply, decrement parent's replyCount
                        if (comment.parentCommentId) {
                            yield mediaInteraction_model_1.MediaInteraction.findByIdAndUpdate(comment.parentCommentId, { $inc: { replyCount: -1 } }, { session });
                        }
                    }));
                }
                finally {
                    session.endSession();
                }
                logger_1.default.info("Comment deleted", {
                    commentId,
                    userId,
                });
            }
            catch (error) {
                logger_1.default.error("Error deleting comment:", error);
                throw error;
            }
        });
    }
    /**
     * Like/unlike a comment
     */
    static toggleLike(commentId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(commentId) || !mongoose_1.Types.ObjectId.isValid(userId)) {
                    throw new Error("Invalid comment or user ID");
                }
                const comment = yield mediaInteraction_model_1.MediaInteraction.findOne({
                    _id: new mongoose_1.Types.ObjectId(commentId),
                    interactionType: "comment",
                    isRemoved: { $ne: true },
                });
                if (!comment) {
                    throw new Error("Comment not found");
                }
                // Handle reactions - Mongoose Maps can be Map or plain object when loaded
                let reactions = comment.reactions;
                // Convert to Map if it's a plain object
                if (!(reactions instanceof Map)) {
                    reactions = new Map(Object.entries(reactions || {}));
                }
                // Get reaction array for "like"
                const reactionType = "like";
                const reactionArray = reactions.get(reactionType) || [];
                const userIdObj = new mongoose_1.Types.ObjectId(userId);
                const userIdStr = userIdObj.toString();
                // Check if user already liked
                const hasLiked = reactionArray.some((id) => (id.toString ? id.toString() : String(id)) === userIdStr);
                let liked;
                if (hasLiked) {
                    // Remove like (unlike)
                    const filtered = reactionArray.filter((id) => (id.toString ? id.toString() : String(id)) !== userIdStr);
                    reactions.set(reactionType, filtered);
                    liked = false;
                }
                else {
                    // Add like
                    reactionArray.push(userIdObj);
                    reactions.set(reactionType, reactionArray);
                    liked = true;
                }
                // Update comment with new reactions
                comment.reactions = reactions;
                yield comment.save();
                // Calculate total likes
                const likeReactions = reactions.get("like") || [];
                const totalLikes = likeReactions.length;
                logger_1.default.info("Comment like toggled", {
                    commentId,
                    userId,
                    liked,
                    totalLikes,
                });
                return { liked, totalLikes };
            }
            catch (error) {
                logger_1.default.error("Error toggling comment like:", error);
                throw error;
            }
        });
    }
    /**
     * Format comment for frontend
     */
    static formatComment(comment) {
        var _a;
        if (!comment)
            return null;
        // Calculate reactions count
        const reactionsCount = comment.reactions
            ? Object.values(comment.reactions).reduce((sum, arr) => sum + arr.length, 0)
            : 0;
        // Check if current user liked (need to pass userId for this)
        const likeReactions = ((_a = comment.reactions) === null || _a === void 0 ? void 0 : _a["like"]) || [];
        const isLiked = false; // This should be set based on current user
        return {
            id: comment._id.toString(),
            content: comment.content,
            user: comment.user
                ? {
                    id: comment.user._id || comment.user,
                    firstName: comment.user.firstName,
                    lastName: comment.user.lastName,
                    avatar: comment.user.avatar,
                    username: comment.user.username,
                }
                : null,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            likesCount: likeReactions.length,
            isLiked,
            replyCount: comment.replyCount || 0,
            parentCommentId: comment.parentCommentId
                ? (typeof comment.parentCommentId === "string"
                    ? comment.parentCommentId
                    : comment.parentCommentId._id.toString())
                : null,
            isRemoved: comment.isRemoved || false,
            reactionsCount,
        };
    }
    /**
     * Helper to determine content type from media ID
     */
    static getContentTypeFromMediaId(mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            const media = yield media_model_1.Media.findById(mediaId);
            if (media)
                return "media";
            const devotional = yield devotional_model_1.Devotional.findById(mediaId);
            if (devotional)
                return "devotional";
            return null;
        });
    }
}
exports.CommentService = CommentService;
exports.default = CommentService;
