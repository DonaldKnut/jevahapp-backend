import { Router } from "express";
import { getCommunityModules } from "../controllers/community.controller";
import {
  createPrayerPost,
  listPrayerPosts,
  getPrayerPost,
  updatePrayerPost,
  deletePrayerPost,
  createForumThread,
  listForumThreads,
  getForumThread,
  updateForumThread,
  deleteForumThread,
  createPoll,
  listPolls,
  getPoll,
  getMyPolls,
  voteOnPoll,
  createGroup,
  listGroups,
  getGroup,
  joinGroup,
  leaveGroup,
  updateGroup,
  deleteGroupPermanently,
} from "../controllers/communityContent.controller";
import {
  likePrayer,
  getPrayerComments,
  commentOnPrayer,
} from "../controllers/prayerInteraction.controller";
import { searchPrayers } from "../controllers/prayerSearch.controller";
import {
  createForum,
  listForums,
  createForumPost,
  getForumPosts,
  updateForumPost,
  deleteForumPost,
} from "../controllers/forum.controller";
import {
  likeForumPost,
  getForumPostComments,
  commentOnForumPost,
  likeForumComment,
} from "../controllers/forumInteraction.controller";
import {
  uploadGroupImage,
  addGroupMembers,
  removeGroupMember,
  uploadMiddleware,
} from "../controllers/groupEnhancement.controller";
import {
  updatePoll,
  deletePoll,
} from "../controllers/pollEnhancement.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { rateLimiter, apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

/**
 * @openapi
 * /api/community/modules:
 *   get:
 *     tags: [Community]
 *     summary: Get community modules
 *     description: Returns visible modules to render Community screen cards.
 *     responses:
 *       200:
 *         description: Modules list
 */
// GET /api/community/modules
router.get("/modules", getCommunityModules);

/**
 * @openapi
 * /api/community/prayer-wall/posts:
 *   post:
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     summary: Create prayer post
 *   get:
 *     tags: [Community]
 *     summary: List prayer posts
 */
// Prayer Wall
router.post("/prayer-wall/posts", verifyToken, rateLimiter(20, 15 * 60 * 1000), createPrayerPost);
router.post("/prayer-wall/create", verifyToken, rateLimiter(20, 15 * 60 * 1000), createPrayerPost); // Alias for frontend compatibility
router.get("/prayer-wall/posts", listPrayerPosts);
router.get("/prayer-wall", listPrayerPosts); // Alias for frontend compatibility
router.get("/prayer-wall/search", searchPrayers);
router.get("/prayer-wall/posts/:id", getPrayerPost);
router.put("/prayer-wall/posts/:id", verifyToken, updatePrayerPost);
router.put("/prayer-wall/:id", verifyToken, updatePrayerPost); // Alias for frontend compatibility
router.delete("/prayer-wall/posts/:id", verifyToken, deletePrayerPost);
router.delete("/prayer-wall/:id", verifyToken, deletePrayerPost); // Alias for frontend compatibility
// Prayer Interactions
router.post("/prayer-wall/:id/like", verifyToken, rateLimiter(60, 5 * 60 * 1000), likePrayer);
router.get("/prayer-wall/:id/comments", getPrayerComments);
router.post("/prayer-wall/:id/comments", verifyToken, rateLimiter(20, 60 * 1000), commentOnPrayer);

/**
 * @openapi
 * /api/community/forum/threads:
 *   post:
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     summary: Create forum thread
 *   get:
 *     tags: [Community]
 *     summary: List forum threads
 */
// Forum (New Structure)
router.post("/forum/create", verifyToken, rateLimiter(10, 60 * 60 * 1000), createForum); // Admin only
router.get("/forum", listForums);
router.get("/forum/:forumId/posts", getForumPosts);
router.post("/forum/:forumId/posts", verifyToken, rateLimiter(20, 15 * 60 * 1000), createForumPost);
router.put("/forum/posts/:postId", verifyToken, rateLimiter(20, 15 * 60 * 1000), updateForumPost);
router.delete("/forum/posts/:postId", verifyToken, rateLimiter(20, 15 * 60 * 1000), deleteForumPost);
// Forum Interactions
router.post("/forum/posts/:postId/like", verifyToken, rateLimiter(60, 5 * 60 * 1000), likeForumPost);
router.get("/forum/posts/:postId/comments", getForumPostComments);
router.post("/forum/posts/:postId/comments", verifyToken, rateLimiter(20, 60 * 1000), commentOnForumPost);
router.post("/forum/comments/:commentId/like", verifyToken, rateLimiter(60, 5 * 60 * 1000), likeForumComment);
// Legacy Forum Threads (for backward compatibility)
router.post("/forum/threads", verifyToken, rateLimiter(20, 15 * 60 * 1000), createForumThread);
router.get("/forum/threads", listForumThreads);
router.get("/forum/threads/:id", getForumThread);
router.put("/forum/threads/:id", verifyToken, updateForumThread);
router.delete("/forum/threads/:id", verifyToken, deleteForumThread);

/**
 * @openapi
 * /api/community/polls:
 *   post:
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     summary: Create poll
 *   get:
 *     tags: [Community]
 *     summary: List polls
 */
// Polls
router.post("/polls", verifyToken, rateLimiter(20, 15 * 60 * 1000), createPoll);
router.post("/polls/create", verifyToken, rateLimiter(20, 15 * 60 * 1000), createPoll); // Alias for frontend compatibility
router.get("/polls", listPolls);
router.get("/polls/my", verifyToken, apiRateLimiter, getMyPolls); // Get current user's polls
router.get("/polls/:id", getPoll);
router.post("/polls/:id/vote", verifyToken, rateLimiter(60, 5 * 60 * 1000), voteOnPoll);
router.post("/polls/:id/votes", verifyToken, rateLimiter(60, 5 * 60 * 1000), voteOnPoll); // Legacy alias
router.put("/polls/:id", verifyToken, rateLimiter(10, 60 * 60 * 1000), updatePoll); // Creator or Admin only
router.delete("/polls/:id", verifyToken, rateLimiter(10, 60 * 60 * 1000), deletePoll); // Creator or Admin only

/**
 * @openapi
 * /api/community/groups:
 *   post:
 *     tags: [Community]
 *     security: [{ bearerAuth: [] }]
 *     summary: Create group
 *   get:
 *     tags: [Community]
 *     summary: List groups
 */
// Groups
router.post("/groups", verifyToken, rateLimiter(10, 60 * 60 * 1000), createGroup);
router.post("/groups/create", verifyToken, rateLimiter(10, 60 * 60 * 1000), createGroup); // Alias for frontend compatibility
router.get("/groups", listGroups);
router.get("/groups/my-groups", verifyToken, listGroups); // Query param ?mine=true will be handled
router.get("/groups/explore", listGroups); // Query params will handle search/sort
router.get("/groups/:id", getGroup);
router.put("/groups/:id", verifyToken, updateGroup);
router.delete("/groups/:id", verifyToken, deleteGroupPermanently);
router.post("/groups/:id/join", verifyToken, rateLimiter(30, 10 * 60 * 1000), joinGroup);
router.post("/groups/:id/leave", verifyToken, rateLimiter(30, 10 * 60 * 1000), leaveGroup);
// Group Enhancements
router.post("/groups/:id/members", verifyToken, rateLimiter(10, 60 * 1000), addGroupMembers);
router.delete("/groups/:id/members/:userId", verifyToken, rateLimiter(10, 60 * 1000), removeGroupMember);
router.post("/groups/:id/image", verifyToken, uploadMiddleware, rateLimiter(5, 60 * 1000), uploadGroupImage);

export default router;


