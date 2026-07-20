import express from "express";
import { verifyToken } from "../../middleware/auth.middleware";
import { rateLimiter, apiRateLimiter } from "../../middleware/rateLimiter";
import { verifyTokenOptional } from "../../middleware/optionalAuth.middleware";
import { likeRateLimiter } from "../../middleware/likeRateLimiter.middleware";
import { bookmarkRateLimiter } from "../../middleware/bookmarkRateLimiter.middleware";
import { commentRateLimiter as redisCommentRateLimiter } from "../../middleware/commentRateLimiter.middleware";
import { shareRateLimiter } from "../../middleware/shareRateLimiter.middleware";
import { idempotencyMiddleware } from "../../middleware/idempotency.middleware";
import {
  toggleContentLike,
  shareContent,
  recordContentView,
  getContentMetadata,
  getBatchContentMetadata,
  getContentLikers,
} from "./interactions.controller";
import {
  addContentComment,
  removeContentComment,
  getContentComments,
  getCommentReplies,
  editContentComment,
  reportContentComment,
  hideContentComment,
} from "./comments/comments.controller";
import {
  toggleBookmark,
  getBookmarkStatus,
  getUserBookmarks,
  getBookmarkStats,
  bulkBookmark,
} from "../../controllers/unifiedBookmark.controller";
import {
  removeComment,
  addCommentReaction,
} from "./comments/comments.controller";
import { getShareUrls, getShareStats } from "./share/share.controller";
import {
  sendMessage,
  getConversationMessages,
  getUserConversations,
  deleteMessage,
} from "./messaging/messaging.controller";

const interactionRateLimiter = rateLimiter(10, 60000);
const messageRateLimiter = rateLimiter(20, 60000);

// ─── Content interactions (like, share, view, metadata) ─────────────────────
const contentRouter = express.Router();

contentRouter.post(
  "/:contentType/:contentId/like",
  verifyToken,
  // Idempotency first: replays never consume rate-limit window
  idempotencyMiddleware(),
  likeRateLimiter,
  toggleContentLike
);
contentRouter.post(
  "/:contentType/:contentId/share",
  verifyToken,
  idempotencyMiddleware(),
  shareRateLimiter,
  shareContent
);
contentRouter.post(
  "/:contentType/:contentId/view",
  verifyTokenOptional,
  interactionRateLimiter,
  recordContentView
);
contentRouter.get(
  "/:contentType/:contentId/metadata",
  verifyTokenOptional,
  getContentMetadata
);
contentRouter.post("/batch-metadata", verifyTokenOptional, getBatchContentMetadata);
contentRouter.get("/:contentType/:contentId/likers", getContentLikers);

// Comments (content module — separate from icon toggles)
contentRouter.post(
  "/:contentType/:contentId/comment",
  verifyToken,
  idempotencyMiddleware(),
  redisCommentRateLimiter,
  addContentComment
);
contentRouter.delete("/comments/:commentId", verifyToken, removeContentComment);
contentRouter.get(
  "/:contentType/:contentId/comments",
  verifyTokenOptional,
  getContentComments
);
contentRouter.get("/comments/:commentId/replies", getCommentReplies);
contentRouter.patch("/comments/:commentId", verifyToken, editContentComment);
contentRouter.post("/comments/:commentId/report", verifyToken, reportContentComment);
contentRouter.post("/comments/:commentId/hide", verifyToken, hideContentComment);

// ─── Save / Bookmark ─────────────────────────────────────────────────────────
const saveRouter = express.Router();
// Single pattern — controller reads mediaId OR contentId from params
saveRouter.post(
  "/:mediaId/toggle",
  verifyToken,
  idempotencyMiddleware(),
  bookmarkRateLimiter,
  toggleBookmark
);
saveRouter.get("/:mediaId/status", verifyToken, getBookmarkStatus);
saveRouter.get("/user", verifyToken, getUserBookmarks);
saveRouter.get("/:mediaId/stats", getBookmarkStats);
saveRouter.post("/bulk", verifyToken, apiRateLimiter, bulkBookmark);

// ─── Legacy interaction routes (share URLs, comment reactions, messaging) ────
const legacyRouter = express.Router();
legacyRouter.delete("/comments/:commentId", verifyToken, removeComment);
legacyRouter.post(
  "/comments/:commentId/reaction",
  verifyToken,
  interactionRateLimiter,
  addCommentReaction
);
legacyRouter.get("/media/:mediaId/share-urls", getShareUrls);
legacyRouter.get("/media/:mediaId/share-stats", getShareStats);
legacyRouter.post("/messages/:recipientId", verifyToken, messageRateLimiter, sendMessage);
legacyRouter.get("/conversations", verifyToken, getUserConversations);
legacyRouter.get(
  "/conversations/:conversationId/messages",
  verifyToken,
  getConversationMessages
);
legacyRouter.delete("/messages/:messageId", verifyToken, deleteMessage);

export { contentRouter, saveRouter, legacyRouter };
