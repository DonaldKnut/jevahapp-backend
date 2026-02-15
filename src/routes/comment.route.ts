import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import {
  createComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} from "../controllers/comment.controller";

const router = express.Router();

// Rate limiters
const commentRateLimiter = apiRateLimiter; // Use default rate limiter

/**
 * @route   POST /api/comments
 * @desc    Create a new comment
 * @access  Protected (Authenticated users only)
 * @body    { contentId: string, contentType: "media" | "devotional", content: string, parentCommentId?: string }
 * @returns { success: boolean, message: string, data: comment }
 */
router.post("/", verifyToken, commentRateLimiter, createComment);

/**
 * @route   PUT /api/comments/:commentId
 * @desc    Update a comment (owner only)
 * @access  Protected (Authenticated users only - owner only)
 * @param   { commentId: string } - MongoDB ObjectId of the comment
 * @body    { content: string }
 * @returns { success: boolean, message: string, data: comment }
 */
router.put("/:commentId", verifyToken, commentRateLimiter, updateComment);

/**
 * @route   DELETE /api/comments/:commentId
 * @desc    Delete a comment (owner only)
 * @access  Protected (Authenticated users only - owner only)
 * @param   { commentId: string } - MongoDB ObjectId of the comment
 * @returns { success: boolean, message: string }
 */
router.delete("/:commentId", verifyToken, commentRateLimiter, deleteComment);

/**
 * @route   POST /api/comments/:commentId/like
 * @desc    Like/unlike a comment
 * @access  Protected (Authenticated users only)
 * @param   { commentId: string } - MongoDB ObjectId of the comment
 * @returns { success: boolean, message: string, data: { liked: boolean, likesCount: number } }
 */
router.post("/:commentId/like", verifyToken, commentRateLimiter, toggleCommentLike);

export default router;

