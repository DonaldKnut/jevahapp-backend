"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const community_controller_1 = require("../controllers/community.controller");
const communityContent_controller_1 = require("../controllers/communityContent.controller");
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
router.get("/prayer-wall/posts", communityContent_controller_1.listPrayerPosts);
router.get("/prayer-wall/posts/:id", communityContent_controller_1.getPrayerPost);
router.put("/prayer-wall/posts/:id", auth_middleware_1.verifyToken, communityContent_controller_1.updatePrayerPost);
router.delete("/prayer-wall/posts/:id", auth_middleware_1.verifyToken, communityContent_controller_1.deletePrayerPost);
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
// Forum
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
router.get("/polls", communityContent_controller_1.listPolls);
router.get("/polls/:id", communityContent_controller_1.getPoll);
router.post("/polls/:id/votes", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(60, 5 * 60 * 1000), communityContent_controller_1.voteOnPoll);
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
router.get("/groups", communityContent_controller_1.listGroups);
router.get("/groups/:id", communityContent_controller_1.getGroup);
router.put("/groups/:id", auth_middleware_1.verifyToken, communityContent_controller_1.updateGroup);
router.delete("/groups/:id", auth_middleware_1.verifyToken, communityContent_controller_1.deleteGroupPermanently);
router.post("/groups/:id/join", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(30, 10 * 60 * 1000), communityContent_controller_1.joinGroup);
router.post("/groups/:id/leave", auth_middleware_1.verifyToken, (0, rateLimiter_1.rateLimiter)(30, 10 * 60 * 1000), communityContent_controller_1.leaveGroup);
exports.default = router;
