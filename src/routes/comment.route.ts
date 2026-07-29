import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { deprecatedEndpoint } from "../middleware/deprecation.middleware";
import {
  createComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} from "../controllers/comment.controller";

/**
 * Legacy community comments API (`/api/comments`).
 * Prefer `/api/content/:contentType/:contentId/comment(s)` and
 * `/api/content/comments/:commentId` (edit/delete/reaction).
 * Runtime Deprecation headers are set per-route below — do not mark `router` with
 * JSDoc `@deprecated` (that makes every `router.*` call look deprecated in the IDE).
 */
const router = express.Router();
const commentRateLimiter = apiRateLimiter;

router.post(
  "/",
  deprecatedEndpoint("POST /api/content/:contentType/:contentId/comment"),
  verifyToken,
  commentRateLimiter,
  createComment
);

router.put(
  "/:commentId",
  deprecatedEndpoint("PATCH /api/content/comments/:commentId"),
  verifyToken,
  commentRateLimiter,
  updateComment
);

router.delete(
  "/:commentId",
  deprecatedEndpoint("DELETE /api/content/comments/:commentId"),
  verifyToken,
  commentRateLimiter,
  deleteComment
);

router.post(
  "/:commentId/like",
  deprecatedEndpoint("POST /api/content/comments/:commentId/reaction"),
  verifyToken,
  commentRateLimiter,
  toggleCommentLike
);

export default router;
