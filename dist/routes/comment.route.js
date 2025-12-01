"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const comment_controller_1 = require("../controllers/comment.controller");
const router = express_1.default.Router();
// Rate limiters
const commentRateLimiter = rateLimiter_1.apiRateLimiter; // Use default rate limiter
/**
 * @route   POST /api/comments
 * @desc    Create a new comment
 * @access  Protected (Authenticated users only)
 * @body    { contentId: string, contentType: "media" | "devotional", content: string, parentCommentId?: string }
 * @returns { success: boolean, message: string, data: comment }
 */
router.post("/", auth_middleware_1.verifyToken, commentRateLimiter, comment_controller_1.createComment);
/**
 * @route   PUT /api/comments/:commentId
 * @desc    Update a comment (owner only)
 * @access  Protected (Authenticated users only - owner only)
 * @param   { commentId: string } - MongoDB ObjectId of the comment
 * @body    { content: string }
 * @returns { success: boolean, message: string, data: comment }
 */
router.put("/:commentId", auth_middleware_1.verifyToken, commentRateLimiter, comment_controller_1.updateComment);
/**
 * @route   DELETE /api/comments/:commentId
 * @desc    Delete a comment (owner only)
 * @access  Protected (Authenticated users only - owner only)
 * @param   { commentId: string } - MongoDB ObjectId of the comment
 * @returns { success: boolean, message: string }
 */
router.delete("/:commentId", auth_middleware_1.verifyToken, commentRateLimiter, comment_controller_1.deleteComment);
/**
 * @route   POST /api/comments/:commentId/like
 * @desc    Like/unlike a comment
 * @access  Protected (Authenticated users only)
 * @param   { commentId: string } - MongoDB ObjectId of the comment
 * @returns { success: boolean, message: string, data: { liked: boolean, likesCount: number } }
 */
router.post("/:commentId/like", auth_middleware_1.verifyToken, commentRateLimiter, comment_controller_1.toggleCommentLike);
exports.default = router;
