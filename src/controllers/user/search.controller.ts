import { Request, Response, NextFunction } from "express";
import { User } from "../../models/user.model";
import userService from "../../service/user.service";
import { ensurePublicR2Url } from "../../service/fileUpload.service";
import logger from "../../utils/logger";

/**
 * GET /api/users/search?q=&limit=
 * Mention directory for the comment composer (phase 2).
 */
export const searchUsers = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const qRaw = request.query.q ?? request.query.query;
    const q = typeof qRaw === "string" ? qRaw.trim() : "";
    if (!q) {
      response.status(400).json({
        success: false,
        message: "Search query q is required",
      });
      return;
    }

    const limit = Math.min(
      Math.max(parseInt(String(request.query.limit || "10"), 10) || 10, 1),
      25
    );

    const escape = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escape, "i");

    const users = await User.find({
      isBanned: { $ne: true },
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
    })
      .select("_id firstName lastName avatar avatarUpload email")
      .limit(limit)
      .lean();

    response.status(200).json({
      success: true,
      data: {
        users: users.map((u: any) => {
          const raw = u.avatar || u.avatarUpload || "";
          const avatar = raw ? ensurePublicR2Url(raw) : "";
          return {
            _id: u._id.toString(),
            id: u._id.toString(),
            firstName: u.firstName || "",
            lastName: u.lastName || "",
            avatar,
            username: (u.email || "").split("@")[0] || "",
          };
        }),
      },
    });
  } catch (error: any) {
    logger.error("Error searching users", {
      error: error.message,
      requestedBy: request.userId,
    });
    next(error);
  }
};

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

    const avatar = user.avatar || user.avatarUpload || null;
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
    const publicUser = {
      _id: user.id,
      id: user.id,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      name,
      avatar,
      avatarUrl: avatar,
      avatarUpload: user.avatarUpload || avatar,
      email: user.email,
    };

    response.status(200).json({
      success: true,
      user: publicUser,
      data: {
        user: publicUser,
        ...user,
        _id: user.id,
        id: user.id,
        avatar,
      },
    });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("User not found") || msg.includes("Invalid user ID")) {
      logger.warn("User profile not found by ID", {
        requestedBy: request.userId,
        targetUserId: request.params.userId,
      });
      response.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
      return;
    }
    logger.error("Error getting user by ID", {
      error: error.message,
      requestedBy: request.userId,
      targetUserId: request.params.userId,
    });
    next(error);
  }
};
