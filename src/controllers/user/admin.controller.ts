import { Request, Response, NextFunction } from "express";
import userService from "../../service/user.service";
import logger from "../../utils/logger";

/**
 * @swagger
 * components:
 *   schemas:
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User's unique identifier
 *         firstName:
 *           type: string
 *           description: User's first name
 *         lastName:
 *           type: string
 *           description: User's last name
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         avatar:
 *           type: string
 *           description: User's avatar URL
 *         avatarUpload:
 *           type: string
 *           description: User's uploaded avatar URL
 *         section:
 *           type: string
 *           enum: [kids, adults]
 *           description: User's section (kids or adults)
 *         role:
 *           type: string
 *           enum: [learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist]
 *           description: User's role in the platform
 *         isProfileComplete:
 *           type: boolean
 *           description: Whether the user's profile is complete
 *         isEmailVerified:
 *           type: boolean
 *           description: Whether the user's email is verified
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: User creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: User last update timestamp
 *     UserListResponse:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserProfile'
 *         total:
 *           type: number
 *           description: Total number of users
 *         page:
 *           type: number
 *           description: Current page number
 *         limit:
 *           type: number
 *           description: Number of users per page
 *         totalPages:
 *           type: number
 *           description: Total number of pages
 *     UserStats:
 *       type: object
 *       properties:
 *         totalUsers:
 *           type: number
 *           description: Total number of users
 *         verifiedUsers:
 *           type: number
 *           description: Number of verified users
 *         completeProfiles:
 *           type: number
 *           description: Number of users with complete profiles
 *         usersByRole:
 *           type: object
 *           description: Users grouped by role
 *         usersBySection:
 *           type: object
 *           description: Users grouped by section
 */

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserListResponse'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
export const getAllUsers = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      section,
      isProfileComplete,
      isEmailVerified,
    } = request.query;

    // Parse and validate query parameters
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;

    // Build filters object
    const filters: any = {};

    if (search) filters.search = search as string;
    if (role) filters.role = role as string;
    if (section) filters.section = section as string;
    if (isProfileComplete !== undefined) {
      filters.isProfileComplete = isProfileComplete === "true";
    }
    if (isEmailVerified !== undefined) {
      filters.isEmailVerified = isEmailVerified === "true";
    }

    const result = await userService.getAllUsers(pageNum, limitNum, filters);

    logger.info("Users list retrieved", {
      requestedBy: request.userId,
      page: pageNum,
      limit: limitNum,
      total: result.total,
      filters: Object.keys(filters),
    });

    response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error("Error getting all users", {
      error: error.message,
      requestedBy: request.userId,
      query: request.query,
    });
    next(error);
  }
};

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User account deleted successfully
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const deleteUser = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = request.params;

    if (!userId) {
      response.status(400).json({
        success: false,
        message: "User ID is required",
      });
      return;
    }

    const { User } = await import("../../models/user.model");
    const { isMasterAdminUser } = await import("../../config/superAdmin");
    const target = await User.findById(userId).select("email role");
    if (isMasterAdminUser(target)) {
      response.status(403).json({
        success: false,
        message: "Cannot delete the master admin account",
        code: "MASTER_ADMIN_PROTECTED",
      });
      return;
    }

    const result = await userService.deleteUser(userId);

    logger.info("User account deleted", {
      requestedBy: request.userId,
      targetUserId: userId,
    });

    response.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    logger.error("Error deleting user", {
      error: error.message,
      requestedBy: request.userId,
      targetUserId: request.params.userId,
    });
    next(error);
  }
};

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserStats'
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
export const getUserStats = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await userService.getUserStats();

    logger.info("User statistics retrieved", {
      requestedBy: request.userId,
    });

    response.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error("Error getting user statistics", {
      error: error.message,
      requestedBy: request.userId,
    });
    next(error);
  }
};
