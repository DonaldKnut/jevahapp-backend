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
exports.toggleCommentLike = exports.deleteComment = exports.updateComment = exports.createComment = void 0;
const mongoose_1 = require("mongoose");
const comment_service_1 = __importDefault(require("../service/comment.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Create a comment
 * POST /api/comments
 */
const createComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { contentId, contentType, content, parentCommentId } = req.body;
        if (!contentId || !mongoose_1.Types.ObjectId.isValid(contentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid content ID",
            });
            return;
        }
        if (!contentType || !["media", "devotional"].includes(contentType)) {
            res.status(400).json({
                success: false,
                message: "Invalid content type. Supported: media, devotional",
            });
            return;
        }
        if (!content || typeof content !== "string" || content.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "Comment content is required",
            });
            return;
        }
        if (content.trim().length > 1000) {
            res.status(400).json({
                success: false,
                message: "Comment must be less than 1000 characters",
            });
            return;
        }
        const comment = yield comment_service_1.default.createComment({
            userId,
            contentId,
            contentType,
            content,
            parentCommentId,
        });
        res.status(201).json({
            success: true,
            message: "Comment created successfully",
            data: comment,
        });
    }
    catch (error) {
        logger_1.default.error("Create comment error", {
            error: error.message,
            userId: req.userId,
            contentId: req.body.contentId,
            contentType: req.body.contentType,
        });
        if (error.message.includes("not found")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        if (error.message.includes("Invalid") ||
            error.message.includes("required") ||
            error.message.includes("must be less than")) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to create comment",
        });
    }
});
exports.createComment = createComment;
/**
 * Update a comment (owner only)
 * PUT /api/comments/:commentId
 */
const updateComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { commentId } = req.params;
        const { content } = req.body;
        if (!commentId || !mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid comment ID",
            });
            return;
        }
        if (!content || typeof content !== "string" || content.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "Comment content is required",
            });
            return;
        }
        if (content.trim().length > 1000) {
            res.status(400).json({
                success: false,
                message: "Comment must be less than 1000 characters",
            });
            return;
        }
        const comment = yield comment_service_1.default.updateComment({
            commentId,
            userId,
            content,
        });
        res.status(200).json({
            success: true,
            message: "Comment updated successfully",
            data: comment,
        });
    }
    catch (error) {
        logger_1.default.error("Update comment error", {
            error: error.message,
            userId: req.userId,
            commentId: req.params.commentId,
        });
        if (error.message.includes("not found")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        if (error.message.includes("only edit your own")) {
            res.status(403).json({
                success: false,
                message: error.message,
            });
            return;
        }
        if (error.message.includes("Invalid") ||
            error.message.includes("required") ||
            error.message.includes("must be less than")) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to update comment",
        });
    }
});
exports.updateComment = updateComment;
/**
 * Delete a comment (owner only)
 * DELETE /api/comments/:commentId
 */
const deleteComment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { commentId } = req.params;
        if (!commentId || !mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid comment ID",
            });
            return;
        }
        yield comment_service_1.default.deleteComment(commentId, userId);
        res.status(200).json({
            success: true,
            message: "Comment deleted successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Delete comment error", {
            error: error.message,
            userId: req.userId,
            commentId: req.params.commentId,
        });
        if (error.message.includes("not found")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        if (error.message.includes("only delete your own")) {
            res.status(403).json({
                success: false,
                message: error.message,
            });
            return;
        }
        if (error.message.includes("Invalid")) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to delete comment",
        });
    }
});
exports.deleteComment = deleteComment;
/**
 * Like/Unlike a comment
 * POST /api/comments/:commentId/like
 */
const toggleCommentLike = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { commentId } = req.params;
        if (!commentId || !mongoose_1.Types.ObjectId.isValid(commentId)) {
            res.status(400).json({
                success: false,
                message: "Invalid comment ID",
            });
            return;
        }
        const result = yield comment_service_1.default.toggleLike(commentId, userId);
        res.status(200).json({
            success: true,
            message: result.liked ? "Comment liked" : "Comment unliked",
            data: {
                liked: result.liked,
                likesCount: result.totalLikes,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Toggle comment like error", {
            error: error.message,
            userId: req.userId,
            commentId: req.params.commentId,
        });
        if (error.message.includes("not found")) {
            res.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }
        if (error.message.includes("Invalid")) {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to toggle comment like",
        });
    }
});
exports.toggleCommentLike = toggleCommentLike;
