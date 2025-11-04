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
  voteOnPoll,
  createGroup,
  listGroups,
  getGroup,
  joinGroup,
  leaveGroup,
  updateGroup,
  deleteGroupPermanently,
} from "../controllers/communityContent.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimiter";

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
router.get("/prayer-wall/posts", listPrayerPosts);
router.get("/prayer-wall/posts/:id", getPrayerPost);
router.put("/prayer-wall/posts/:id", verifyToken, updatePrayerPost);
router.delete("/prayer-wall/posts/:id", verifyToken, deletePrayerPost);

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
router.get("/polls", listPolls);
router.get("/polls/:id", getPoll);
router.post("/polls/:id/votes", verifyToken, rateLimiter(60, 5 * 60 * 1000), voteOnPoll);

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
router.get("/groups", listGroups);
router.get("/groups/:id", getGroup);
router.put("/groups/:id", verifyToken, updateGroup);
router.delete("/groups/:id", verifyToken, deleteGroupPermanently);
router.post("/groups/:id/join", verifyToken, rateLimiter(30, 10 * 60 * 1000), joinGroup);
router.post("/groups/:id/leave", verifyToken, rateLimiter(30, 10 * 60 * 1000), leaveGroup);

export default router;


