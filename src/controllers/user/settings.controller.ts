import { Request, Response, NextFunction } from "express";
import userService from "../../service/user.service";
import logger from "../../utils/logger";

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Update current user profile
 *     description: Update the authenticated user's own profile information including bio
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
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 description: User's bio (max 500 characters)
 *               section:
 *                 type: string
 *                 enum: [kids, adults]
 *                 description: User's section
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *                 message:
 *                   type: string
 *                   example: Profile updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
export const updateMyProfile = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = request.userId;
    const updateData = request.body;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
      return;
    }

    // Only allow specific fields to be updated
    const allowedFields = ['firstName', 'lastName', 'bio', 'section'];
    const filteredData: any = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    const updatedUser = await userService.updateUserProfile(userId, filteredData);

    logger.info("Current user profile updated", {
      userId,
      updatedFields: Object.keys(filteredData),
    });

    response.status(200).json({
      success: true,
      user: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error: any) {
    logger.error("Error updating current user profile", {
      error: error.message,
      userId: request.userId,
      updateData: request.body,
    });
    
    if (error.message.includes("500 characters")) {
      response.status(400).json({
        success: false,
        error: error.message,
        code: "VALIDATION_ERROR",
      });
      return;
    }
    
    next(error);
  }
};

export const updateUserProfile = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = request.params;
    const updateData = request.body;

    if (!userId) {
      response.status(400).json({
        success: false,
        message: "User ID is required",
      });
      return;
    }

    const updatedUser = await userService.updateUserProfile(userId, updateData);

    logger.info("User profile updated", {
      requestedBy: request.userId,
      targetUserId: userId,
      updatedFields: Object.keys(updateData),
    });

    response.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error: any) {
    logger.error("Error updating user profile", {
      error: error.message,
      requestedBy: request.userId,
      targetUserId: request.params.userId,
      updateData: request.body,
    });
    next(error);
  }
};

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
 *                   example: Profile completed successfully
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid request data or missing required fields
 *       401:
 *         description: Unauthorized - User not authenticated
 *       500:
 *         description: Internal server error
 */
export const completeUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    const {
      age,
      isKid,
      section,
      role,
      location,
      hasConsentedToPrivacyPolicy,
      parentalControlEnabled,
      parentEmail,
    } = req.body;

    // Make validation more flexible - only require basic fields
    if (hasConsentedToPrivacyPolicy === undefined) {
      res.status(400).json({
        success: false,
        message: "Privacy policy consent is required",
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User ID is required",
      });
      return;
    }

    const user = await userService.updateUserProfile(userId, {
      age: age || 0,
      isKid: isKid || false,
      section: section || "adults",
      role: role || "learner",
      location,
      parentEmail,
      parentalControlEnabled: parentalControlEnabled || false,
      hasConsentedToPrivacyPolicy,
      isProfileComplete: true,
    });

    logger.info("User profile completed", {
      userId,
      completedFields: Object.keys(req.body),
    });

    res.status(200).json({
      success: true,
      message: "Profile completed successfully",
      user,
    });
  } catch (error: any) {
    logger.error("Error completing user profile", {
      error: error.message,
      userId: req.userId,
      profileData: req.body,
    });
    next(error);
  }
};
