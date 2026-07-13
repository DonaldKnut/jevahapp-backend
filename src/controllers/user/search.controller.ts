import { Request, Response, NextFunction } from "express";
import userService from "../../service/user.service";
import logger from "../../utils/logger";

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid user ID format
 *       401:
 *         description: Unauthorized - User not authenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
export const getUserById = async (
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

    const user = await userService.getUserById(userId);

    logger.info("User profile retrieved by ID", {
      requestedBy: request.userId,
      targetUserId: userId,
    });

    response.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error("Error getting user by ID", {
      error: error.message,
      requestedBy: request.userId,
      targetUserId: request.params.userId,
    });
    next(error);
  }
};
