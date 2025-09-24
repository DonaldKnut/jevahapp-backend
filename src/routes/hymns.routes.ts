import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimiter";
import {
  getHymns,
  getHymnById,
  searchHymnsByScripture,
  syncPopularHymns,
  getHymnStats,
  updateHymnInteractions,
  getHymnsByCategory,
  searchHymnsByTags,
} from "../controllers/hymns.controller";

const router = express.Router();

// Rate limiters
const searchRateLimiter = rateLimiter(20, 60000); // 20 requests per minute
const syncRateLimiter = rateLimiter(5, 60000); // 5 requests per minute
const interactionRateLimiter = rateLimiter(10, 60000); // 10 requests per minute

/**
 * @swagger
 * /api/hymns:
 *   get:
 *     summary: Get hymns with pagination and filtering
 *     tags: [Hymns]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [praise, worship, traditional, contemporary, gospel, christmas, easter]
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title, author, and lyrics
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, author, year, viewCount, likeCount, createdAt]
 *           default: title
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [hymnary, openhymnal, manual]
 *         description: Filter by source
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags to filter by
 *     responses:
 *       200:
 *         description: Hymns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hymns:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Hymn'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         total:
 *                           type: number
 *                         totalPages:
 *                           type: number
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Internal server error
 */
router.get("/", getHymns);

/**
 * @swagger
 * /api/hymns/search/scripture:
 *   get:
 *     summary: Search hymns by Scripture reference using Hymnary.org API
 *     tags: [Hymns]
 *     parameters:
 *       - in: query
 *         name: reference
 *         schema:
 *           type: string
 *         description: Human-friendly Scripture reference (e.g., "John 3:16", "Psalm 23")
 *       - in: query
 *         name: book
 *         schema:
 *           type: string
 *         description: Bible book name
 *       - in: query
 *         name: fromChapter
 *         schema:
 *           type: integer
 *         description: Starting chapter
 *       - in: query
 *         name: fromVerse
 *         schema:
 *           type: integer
 *         description: Starting verse
 *       - in: query
 *         name: toChapter
 *         schema:
 *           type: integer
 *         description: Ending chapter
 *       - in: query
 *         name: toVerse
 *         schema:
 *           type: integer
 *         description: Ending verse
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Include all matches (including incomplete ones)
 *     responses:
 *       200:
 *         description: Hymns found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hymns:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Hymn'
 *                     searchOptions:
 *                       type: object
 *                     count:
 *                       type: number
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Internal server error
 */
router.get("/search/scripture", searchRateLimiter, searchHymnsByScripture);

/**
 * @swagger
 * /api/hymns/search/tags:
 *   get:
 *     summary: Search hymns by tags
 *     tags: [Hymns]
 *     parameters:
 *       - in: query
 *         name: tags
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated tags to search for
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: title
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Hymns found successfully
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Internal server error
 */
router.get("/search/tags", searchHymnsByTags);

/**
 * @swagger
 * /api/hymns/category/{category}:
 *   get:
 *     summary: Get hymns by category
 *     tags: [Hymns]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [praise, worship, traditional, contemporary, gospel, christmas, easter]
 *         description: Hymn category
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: title
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Hymns retrieved successfully
 *       400:
 *         description: Invalid category
 *       500:
 *         description: Internal server error
 */
router.get("/category/:category", getHymnsByCategory);

/**
 * @swagger
 * /api/hymns/{id}:
 *   get:
 *     summary: Get hymn by ID
 *     tags: [Hymns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hymn ID
 *     responses:
 *       200:
 *         description: Hymn retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Hymn'
 *       404:
 *         description: Hymn not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", getHymnById);

/**
 * @swagger
 * /api/hymns/stats:
 *   get:
 *     summary: Get hymn statistics
 *     tags: [Hymns]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalHymns:
 *                       type: number
 *                     hymnsByCategory:
 *                       type: object
 *                     hymnsBySource:
 *                       type: object
 *                     topHymns:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                           viewCount:
 *                             type: number
 *                           likeCount:
 *                             type: number
 *       500:
 *         description: Internal server error
 */
router.get("/stats", getHymnStats);

/**
 * @swagger
 * /api/hymns/sync/popular:
 *   post:
 *     summary: Sync popular hymns from Hymnary.org
 *     tags: [Hymns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hymns synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     synced:
 *                       type: number
 *                     errors:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/sync/popular", verifyToken, syncRateLimiter, syncPopularHymns);

/**
 * @swagger
 * /api/hymns/{id}/interactions:
 *   patch:
 *     summary: Update hymn interaction counts
 *     tags: [Hymns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hymn ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               likeCount:
 *                 type: number
 *               commentCount:
 *                 type: number
 *               shareCount:
 *                 type: number
 *               bookmarkCount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Interactions updated successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/:id/interactions",
  verifyToken,
  interactionRateLimiter,
  updateHymnInteractions
);

export default router;
