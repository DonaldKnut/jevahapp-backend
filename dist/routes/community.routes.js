"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const community_controller_1 = require("../controllers/community.controller");
const communityContent_controller_1 = require("../controllers/communityContent.controller");
const prayerInteraction_controller_1 = require("../controllers/prayerInteraction.controller");
const prayerSearch_controller_1 = require("../controllers/prayerSearch.controller");
const forum_controller_1 = require("../controllers/forum.controller");
const forumInteraction_controller_1 = require("../controllers/forumInteraction.controller");
const groupEnhancement_controller_1 = require("../controllers/groupEnhancement.controller");
const pollEnhancement_controller_1 = require("../controllers/pollEnhancement.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
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
router.get("/modules", community_controller_1.getCommunityModules);
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
router.post("/prayer-wall/posts", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 15 * 60 * 1000), communityContent_controller_1.createPrayerPost);
router.post("/prayer-wall/create", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 15 * 60 * 1000), communityContent_controller_1.createPrayerPost); // Alias for frontend compatibility
router.get("/prayer-wall/posts", communityContent_controller_1.listPrayerPosts);
router.get("/prayer-wall", communityContent_controller_1.listPrayerPosts); // Alias for frontend compatibility
router.get("/prayer-wall/search", prayerSearch_controller_1.searchPrayers);
router.get("/prayer-wall/posts/:id", communityContent_controller_1.getPrayerPost);
router.put("/prayer-wall/posts/:id", auth_middleware_1.verifyToken, communityContent_controller_1.updatePrayerPost);
router.put("/prayer-wall/:id", auth_middleware_1.verifyToken, communityContent_controller_1.updatePrayerPost); // Alias for frontend compatibility
router.delete("/prayer-wall/posts/:id", auth_middleware_1.verifyToken, communityContent_controller_1.deletePrayerPost);
router.delete("/prayer-wall/:id", auth_middleware_1.verifyToken, communityContent_controller_1.deletePrayerPost); // Alias for frontend compatibility
// Prayer Interactions
router.post("/prayer-wall/:id/like", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(60, 5 * 60 * 1000), prayerInteraction_controller_1.likePrayer);
router.get("/prayer-wall/:id/comments", prayerInteraction_controller_1.getPrayerComments);
router.post("/prayer-wall/:id/comments", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 60 * 1000), prayerInteraction_controller_1.commentOnPrayer);
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
router.post("/forum/create", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(10, 60 * 60 * 1000), forum_controller_1.createForum); // Authenticated users
router.get("/forum", forum_controller_1.listForums);
router.get("/forum/:forumId/posts", forum_controller_1.getForumPosts);
router.post("/forum/:forumId/posts", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 15 * 60 * 1000), forum_controller_1.createForumPost);
router.put("/forum/posts/:postId", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 15 * 60 * 1000), forum_controller_1.updateForumPost);
router.delete("/forum/posts/:postId", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 15 * 60 * 1000), forum_controller_1.deleteForumPost);
// Forum Interactions
router.post("/forum/posts/:postId/like", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(60, 5 * 60 * 1000), forumInteraction_controller_1.likeForumPost);
router.get("/forum/posts/:postId/comments", forumInteraction_controller_1.getForumPostComments);
router.post("/forum/posts/:postId/comments", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 60 * 1000), forumInteraction_controller_1.commentOnForumPost);
router.post("/forum/comments/:commentId/like", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(60, 5 * 60 * 1000), forumInteraction_controller_1.likeForumComment);
// Legacy Forum Threads (for backward compatibility)
router.post("/forum/threads", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 15 * 60 * 1000), communityContent_controller_1.createForumThread);
router.get("/forum/threads", communityContent_controller_1.listForumThreads);
router.get("/forum/threads/:id", communityContent_controller_1.getForumThread);
router.put("/forum/threads/:id", auth_middleware_1.verifyToken, communityContent_controller_1.updateForumThread);
router.delete("/forum/threads/:id", auth_middleware_1.verifyToken, communityContent_controller_1.deleteForumThread);
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
router.post("/polls", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 15 * 60 * 1000), communityContent_controller_1.createPoll);
router.post("/polls/create", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(20, 15 * 60 * 1000), communityContent_controller_1.createPoll); // Alias for frontend compatibility
router.get("/polls", communityContent_controller_1.listPolls);
router.get("/polls/my", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, communityContent_controller_1.getMyPolls); // Get current user's polls
router.get("/polls/:id", communityContent_controller_1.getPoll);
router.post("/polls/:id/vote", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(60, 5 * 60 * 1000), communityContent_controller_1.voteOnPoll);
router.post("/polls/:id/votes", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(60, 5 * 60 * 1000), communityContent_controller_1.voteOnPoll); // Legacy alias
router.put("/polls/:id", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(10, 60 * 60 * 1000), pollEnhancement_controller_1.updatePoll); // Creator or Admin only
router.delete("/polls/:id", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(10, 60 * 60 * 1000), pollEnhancement_controller_1.deletePoll); // Creator or Admin only
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
router.post("/groups", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(10, 60 * 60 * 1000), communityContent_controller_1.createGroup);
router.post("/groups/create", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(10, 60 * 60 * 1000), communityContent_controller_1.createGroup); // Alias for frontend compatibility
router.get("/groups", communityContent_controller_1.listGroups);
router.get("/groups/my-groups", auth_middleware_1.verifyToken, communityContent_controller_1.listGroups); // Query param ?mine=true will be handled
router.get("/groups/explore", communityContent_controller_1.listGroups); // Query params will handle search/sort
router.get("/groups/:id", communityContent_controller_1.getGroup);
router.put("/groups/:id", auth_middleware_1.verifyToken, communityContent_controller_1.updateGroup);
router.delete("/groups/:id", auth_middleware_1.verifyToken, communityContent_controller_1.deleteGroupPermanently);
router.post("/groups/:id/join", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(30, 10 * 60 * 1000), communityContent_controller_1.joinGroup);
router.post("/groups/:id/leave", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(30, 10 * 60 * 1000), communityContent_controller_1.leaveGroup);
// Group Enhancements
router.post("/groups/:id/members", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(10, 60 * 1000), groupEnhancement_controller_1.addGroupMembers);
router.delete("/groups/:id/members/:userId", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(10, 60 * 1000), groupEnhancement_controller_1.removeGroupMember);
router.post("/groups/:id/image", auth_middleware_1.verifyToken, groupEnhancement_controller_1.uploadMiddleware, (0, rateLimiter_1.rateLimiter)(5, 60 * 1000), groupEnhancement_controller_1.uploadGroupImage);
exports.default = router;
