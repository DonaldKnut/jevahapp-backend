import { Router } from "express";
import {
  getCurrentUser,
  getAllUsers,
  getUserById,
  updateUserProfile,
  updateMyProfile,
  deleteUser,
  getUserStats,
  completeUserProfile,
  getUserPosts,
  getUserMedia,
  getUserVideos,
  getUserAnalytics,
} from "../controllers/user.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile information of the currently authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/me", verifyToken, apiRateLimiter, getCurrentUser);

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Update current user profile
 *     description: Update the authenticated user's own profile information including bio
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.patch("/me", verifyToken, apiRateLimiter, updateMyProfile);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with pagination and filtering
 *     description: Retrieve a paginated list of users with optional filtering and search capabilities
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page (max 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering users by name or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *         description: Filter users by role
 *       - in: query
 *         name: section
 *         schema:
 *           type: string
 *           enum: [kids, adults]
 *         description: Filter users by section
 *       - in: query
 *         name: isProfileComplete
 *         schema:
 *           type: boolean
 *         description: Filter users by profile completion status
 *       - in: query
 *         name: isEmailVerified
 *         schema:
 *           type: boolean
 *         description: Filter users by email verification status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get("/", verifyToken, requireAdmin, apiRateLimiter, getAllUsers);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics
 *     description: Retrieve comprehensive statistics about users in the platform
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get("/stats", verifyToken, requireAdmin, apiRateLimiter, getUserStats);

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a specific user's profile by their ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       400:
 *         description: Invalid user ID format
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/:userId",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getUserById
);

/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Update user profile
 *     description: Update a user's profile information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               section:
 *                 type: string
 *                 enum: [kids, adults]
 *                 description: User's section
 *               role:
 *                 type: string
 *                 enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *                 description: User's role
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put("/:userId", verifyToken, apiRateLimiter, updateUserProfile);

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete user account
 *     description: Permanently delete a user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's unique identifier
 *     responses:
 *       200:
 *         description: User account deleted successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/:userId",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  deleteUser
);

/**
 * @swagger
 * /api/users/profile/complete:
 *   post:
 *     summary: Complete user profile
 *     description: Complete the user's profile with additional information
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               age:
 *                 type: number
 *                 description: User's age
 *               isKid:
 *                 type: boolean
 *                 description: Whether the user is a child
 *               section:
 *                 type: string
 *                 enum: [kids, adults]
 *                 description: User's section
 *               role:
 *                 type: string
 *                 enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *                 description: User's role
 *               location:
 *                 type: string
 *                 description: User's location
 *               hasConsentedToPrivacyPolicy:
 *                 type: boolean
 *                 description: Whether user has consented to privacy policy
 *               parentalControlEnabled:
 *                 type: boolean
 *                 description: Whether parental controls are enabled
 *               parentEmail:
 *                 type: string
 *                 format: email
 *                 description: Parent's email address
 *     responses:
 *       200:
 *         description: Profile completed successfully
 *       400:
 *         description: Invalid request data or missing required fields
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
router.post(
  "/profile/complete",
  verifyToken,
  apiRateLimiter,
  completeUserProfile
);

/**
 * @swagger
 * /api/users/{userId}/posts:
 *   get:
 *     summary: Get user's posts
 *     description: Retrieve paginated list of user's posts
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:userId/posts", verifyToken, apiRateLimiter, getUserPosts);

/**
 * @swagger
 * /api/users/{userId}/media:
 *   get:
 *     summary: Get user's media (images)
 *     description: Retrieve paginated list of user's uploaded images/photos
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:userId/media",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getUserMedia
);

/**
 * @swagger
 * /api/users/{userId}/videos:
 *   get:
 *     summary: Get user's videos
 *     description: Retrieve paginated list of user's uploaded videos
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:userId/videos",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getUserVideos
);

/**
 * @swagger
 * /api/users/{userId}/analytics:
 *   get:
 *     summary: Get user analytics
 *     description: Retrieve aggregated analytics metrics for the user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:userId/analytics", verifyToken, apiRateLimiter, getUserAnalytics);

export default router;
