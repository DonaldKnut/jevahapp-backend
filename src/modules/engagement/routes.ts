import express from "express";
import { verifyToken } from "../../middleware/auth.middleware";
import { rateLimiter, apiRateLimiter } from "../../middleware/rateLimiter";
import { verifyTokenOptional } from "../../middleware/optionalAuth.middleware";
import { likeRateLimiter } from "../../middleware/likeRateLimiter.middleware";
import { bookmarkRateLimiter } from "../../middleware/bookmarkRateLimiter.middleware";
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
  toggleBookmark,
  getBookmarkStatus,
  getUserBookmarks,
  getBookmarkStats,
  bulkBookmark,
} from "../../controllers/unifiedBookmark.controller";
import { getShareUrls, getShareStats } from "./share/share.controller";
import {
  sendMessage,
  getConversationMessages,
  getUserConversations,
  deleteMessage,
} from "./messaging/messaging.controller";
import {
  bindContentComments,
  bindInteractionsCommentAliases,
} from "./shared/routeAdapters";

const interactionRateLimiter = rateLimiter(10, 60000);
const messageRateLimiter = rateLimiter(20, 60000);

// ─── Content interactions (like, share, view, metadata, comments) ───────────
const contentRouter = express.Router();

// Static paths first — before /:contentType/:contentId/*
contentRouter.post("/batch-metadata", verifyTokenOptional, getBatchContentMetadata);

contentRouter.post(
  "/:contentType/:contentId/like",
  verifyToken,
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
contentRouter.get("/:contentType/:contentId/likers", getContentLikers);

// Comments — single binder (canonical + type-omitted + reaction)
bindContentComments(contentRouter);

// ─── Save / Bookmark ─────────────────────────────────────────────────────────
const saveRouter = express.Router();
// Static paths before /:mediaId/* so /user and /bulk are never captured as ids
saveRouter.get("/user", verifyToken, getUserBookmarks);
saveRouter.post("/bulk", verifyToken, apiRateLimiter, bulkBookmark);
saveRouter.post(
  "/:mediaId/toggle",
  verifyToken,
  idempotencyMiddleware(),
  bookmarkRateLimiter,
  toggleBookmark
);
saveRouter.get("/:mediaId/status", verifyToken, getBookmarkStatus);
saveRouter.get("/:mediaId/stats", getBookmarkStats);

// ─── Legacy interaction routes (comment aliases, share URLs, messaging) ─────
const legacyRouter = express.Router();
bindInteractionsCommentAliases(legacyRouter);
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
