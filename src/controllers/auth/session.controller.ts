import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import authService from "../../service/auth.service";
import { User } from "../../models/user.model";
import multer from "multer";

export async function completeUserProfile(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const userId = request.userId;

    if (!userId) {
      return response.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      age,
      isKid,
      section,
      role,
      location,
      churchId,
      churchBranchId,
      avatarUpload,
      interests,
      hasConsentedToPrivacyPolicy,
      parentalControlEnabled,
      parentEmail,
    } = request.body;

    const updateFields: any = {};
    if (age !== undefined) updateFields.age = age;
    if (isKid !== undefined) updateFields.isKid = isKid;
    if (section !== undefined) updateFields.section = section;
    if (role !== undefined) updateFields.role = role;
    if (location !== undefined) updateFields.location = location;
    if (avatarUpload !== undefined) updateFields.avatarUpload = avatarUpload;
    if (interests !== undefined) updateFields.interests = interests;
    if (hasConsentedToPrivacyPolicy !== undefined) {
      updateFields.hasConsentedToPrivacyPolicy = hasConsentedToPrivacyPolicy;
    }
    if (parentalControlEnabled !== undefined) {
      updateFields.parentalControlEnabled = parentalControlEnabled;
    }
    if (parentEmail !== undefined) updateFields.parentEmail = parentEmail;

    if (churchId !== undefined) {
      if (churchId === null || churchId === "") {
        updateFields.churchId = null;
      } else if (Types.ObjectId.isValid(String(churchId))) {
        const { Church } = await import("../../models/church.model");
        const exists = await Church.exists({
          _id: churchId,
          isListed: { $ne: false },
        });
        if (!exists) {
          return response.status(400).json({
            success: false,
            message: "Invalid or unlisted churchId",
          });
        }
        updateFields.churchId = churchId;
      } else {
        return response.status(400).json({
          success: false,
          message: "Invalid churchId",
        });
      }
    }

    if (churchBranchId !== undefined) {
      if (churchBranchId === null || churchBranchId === "") {
        updateFields.churchBranchId = null;
      } else if (Types.ObjectId.isValid(String(churchBranchId))) {
        updateFields.churchBranchId = churchBranchId;
      } else {
        return response.status(400).json({
          success: false,
          message: "Invalid churchBranchId",
        });
      }
    }

    const userBeforeUpdate = await User.findById(userId);

    if (!userBeforeUpdate) {
      return response.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isSet = (field: string) =>
      userBeforeUpdate[field] !== undefined ||
      updateFields[field] !== undefined;

    const isProfileComplete = isSet("hasConsentedToPrivacyPolicy");

    const finalUpdateFields = {
      ...updateFields,
      age: updateFields.age || userBeforeUpdate.age || 0,
      isKid:
        updateFields.isKid !== undefined
          ? updateFields.isKid
          : userBeforeUpdate.isKid || false,
      section: updateFields.section || userBeforeUpdate.section || "adults",
      role: updateFields.role || userBeforeUpdate.role || "learner",
      parentalControlEnabled:
        updateFields.parentalControlEnabled !== undefined
          ? updateFields.parentalControlEnabled
          : userBeforeUpdate.parentalControlEnabled || false,
      isProfileComplete,
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      finalUpdateFields,
      {
        new: true,
      }
    );

    return response.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentUser(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
    }

    const user = await authService.getCurrentUser(userId);

    return response.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return response.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

export async function getUserSession(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
    }

    const session = await authService.getUserSession(userId);

    return response.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return response.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

export async function updateUserAvatar(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const userId = request.userId;
    const avatarFile = request.file;

    if (!userId) {
      return response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
    }

    if (!avatarFile) {
      return response.status(400).json({
        success: false,
        message: "Avatar image is required",
      });
    }

    const validImageMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validImageMimeTypes.includes(avatarFile.mimetype)) {
      return response.status(400).json({
        success: false,
        message: `Invalid image type: ${avatarFile.mimetype}`,
      });
    }

    const updateResult = await authService.updateUserAvatar(
      userId,
      avatarFile.buffer,
      avatarFile.mimetype
    );

    return response.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: updateResult,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return response.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("Invalid image type")
    ) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }
    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_UNEXPECTED_FILE"
    ) {
      return response.status(400).json({
        success: false,
        message: `Unexpected field in file upload. Expected field name: 'avatar'`,
      });
    }
    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return response.status(400).json({
        success: false,
        message: "File size exceeds the 5MB limit",
      });
    }
    return next(error);
  }
}

export async function logout(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const userId = request.userId;
    const token = request.headers.authorization?.split(" ")[1];
    const refreshToken = request.cookies?.refreshToken;

    if (!userId || !token) {
      return response.status(401).json({
        success: false,
        message: "Unauthorized: User ID or token missing",
      });
    }

    await authService.logout(userId, token, refreshToken);

    response.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    return response.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return response.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

export async function getUserNameAndAge(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
    }

    const userInfo = await authService.getUserNameAndAge(userId);

    return response.status(200).json({
      success: true,
      user: userInfo,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return response.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

export async function getUserProfilePicture(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const userId = request.userId;
    if (!userId) {
      return response.status(401).json({
        success: false,
        message: "Unauthorized: User ID missing",
      });
    }

    const profilePicture = await authService.getUserProfilePicture(userId);

    return response.status(200).json({
      success: true,
      profilePicture,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return response.status(404).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const refreshTokenString =
      req.cookies?.refreshToken ||
      req.body?.refreshToken ||
      req.body?.token;

    if (!refreshTokenString) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    const result = await authService.refreshToken(refreshTokenString);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      token: result.accessToken,
      accessToken: result.accessToken,
      tokenType: result.tokenType || "bearer",
      expiresIn: result.expiresIn,
      user: result.user,
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user,
      },
    });
  } catch (error: any) {
    console.error("Token refresh error:", error);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      path: "/",
    });

    res.status(401).json({
      success: false,
      message: error.message || "Invalid or expired refresh token",
    });
  }
}
