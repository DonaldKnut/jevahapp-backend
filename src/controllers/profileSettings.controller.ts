import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";
import logger from "../utils/logger";
import { asyncHandler } from "../utils/asyncHandler";
import authService from "../service/auth.service";
import multer from "multer";

// Configure multer for avatar upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file format. Allowed formats: jpg, jpeg, png, webp"));
    }
  },
});

/**
 * Get profile settings configuration for dynamic UI
 */
export const getSettingsConfig = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const user = await User.findById(userId).select(
      "firstName lastName avatar avatarUpload settings pushNotifications"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    const avatar = user.avatar || user.avatarUpload || null;
    const settings = user.settings || {
      profileLock: false,
      liveSettings: false,
      pushNotifications: user.pushNotifications?.enabled ?? true,
      recommendationSettings: true,
    };

    const config = {
      profileImage: {
        type: "image",
        currentValue: avatar,
        uploadEndpoint: "/api/user/profile/upload-avatar",
        maxSizeBytes: 5 * 1024 * 1024, // 5MB
        allowedFormats: ["jpg", "jpeg", "png", "webp"],
        previewUrl: avatar,
      },
      name: {
        type: "editable_text",
        currentValue: {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
        },
        fieldType: "name",
        maxLength: {
          firstName: 50,
          lastName: 50,
        },
        updateEndpoint: "/api/user/profile/update-name",
      },
      profileLock: {
        type: "toggle",
        currentValue: settings.profileLock || false,
        label: "Profile lock",
        description: "When enabled, only approved followers can see your profile",
        updateEndpoint: "/api/user/profile/update-lock",
        enabled: true,
      },
      liveSettings: {
        type: "toggle",
        currentValue: settings.liveSettings || false,
        label: "Live settings",
        description: "Configure your live streaming preferences",
        updateEndpoint: "/api/user/profile/update-live-settings",
        enabled: false,
        comingSoon: true,
      },
      pushNotifications: {
        type: "toggle",
        currentValue: settings.pushNotifications ?? (user.pushNotifications?.enabled ?? true),
        label: "Push notifications",
        description: "Receive push notifications for important updates",
        updateEndpoint: "/api/user/profile/update-push-notifications",
        enabled: true,
      },
      recommendationSettings: {
        type: "toggle",
        currentValue: settings.recommendationSettings ?? true,
        label: "Recommendation settings",
        description: "Allow content recommendations based on your preferences",
        updateEndpoint: "/api/user/profile/update-recommendations",
        enabled: true,
      },
    };

    res.status(200).json({
      success: true,
      data: config,
    });
  }
);

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  const user = await User.findById(userId).select(
    "firstName lastName email avatar avatarUpload bio section role isProfileComplete isEmailVerified settings pushNotifications createdAt updatedAt"
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User not found",
      code: "USER_NOT_FOUND",
    });
  }

  const settings = user.settings || {
    profileLock: false,
    liveSettings: false,
    pushNotifications: user.pushNotifications?.enabled ?? true,
    recommendationSettings: true,
  };

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        avatar: user.avatar || user.avatarUpload || null,
        avatarUpload: user.avatarUpload || null,
        bio: user.bio || null,
        section: user.section || "adults",
        role: user.role || "learner",
        settings: {
          profileLock: settings.profileLock,
          liveSettings: settings.liveSettings,
          pushNotifications: settings.pushNotifications,
          recommendationSettings: settings.recommendationSettings,
        },
        isProfileComplete: user.isProfileComplete || false,
        isEmailVerified: user.isEmailVerified || false,
        isOnline: false, // TODO: Implement online status tracking
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
  });
});

/**
 * Upload/Update profile avatar
 */
export const uploadAvatar = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    upload.single("avatar")(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              success: false,
              error: "File too large. Maximum size is 5MB",
              code: "FILE_TOO_LARGE",
            });
          }
        }
        return res.status(400).json({
          success: false,
          error: err.message || "Invalid file",
          code: "INVALID_FILE_FORMAT",
        });
      }

      const avatarFile = req.file;

      if (!avatarFile) {
        return res.status(400).json({
          success: false,
          error: "Avatar image is required",
          code: "VALIDATION_ERROR",
        });
      }

      try {
        const updateResult = await authService.updateUserAvatar(
          userId,
          avatarFile.buffer,
          avatarFile.mimetype
        );

        res.status(200).json({
          success: true,
          data: {
            avatar: updateResult.avatarUrl,
            avatarUpload: updateResult.avatarUrl,
            previewUrl: updateResult.avatarUrl,
            message: "Avatar uploaded successfully",
          },
        });
      } catch (error: any) {
        logger.error("Avatar upload error", {
          error: error.message,
          userId,
        });

        if (error.message.includes("Invalid image type")) {
          return res.status(400).json({
            success: false,
            error: "Invalid file format. Allowed formats: jpg, jpeg, png, webp",
            code: "INVALID_FILE_FORMAT",
          });
        }

        return res.status(500).json({
          success: false,
          error: "Failed to upload avatar",
          code: "UPLOAD_FAILED",
        });
      }
    });
  }
);

/**
 * Update user name
 */
export const updateName = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  const { firstName, lastName } = req.body;

  // Validation
  if (firstName === undefined && lastName === undefined) {
    return res.status(400).json({
      success: false,
      error: "At least one name field must be provided",
      code: "VALIDATION_ERROR",
    });
  }

  const updateData: any = {};

  if (firstName !== undefined) {
    const trimmedFirstName = firstName?.trim();
    if (trimmedFirstName && trimmedFirstName.length > 50) {
      return res.status(400).json({
        success: false,
        error: "First name cannot exceed 50 characters",
        code: "VALIDATION_ERROR",
        field: "firstName",
      });
    }
    if (trimmedFirstName === "") {
      return res.status(400).json({
        success: false,
        error: "First name cannot be empty",
        code: "VALIDATION_ERROR",
        field: "firstName",
      });
    }
    updateData.firstName = trimmedFirstName;
  }

  if (lastName !== undefined) {
    const trimmedLastName = lastName?.trim();
    if (trimmedLastName && trimmedLastName.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Last name cannot exceed 50 characters",
        code: "VALIDATION_ERROR",
        field: "lastName",
      });
    }
    if (trimmedLastName === "") {
      return res.status(400).json({
        success: false,
        error: "Last name cannot be empty",
        code: "VALIDATION_ERROR",
        field: "lastName",
      });
    }
    updateData.lastName = trimmedLastName;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true }
  ).select("firstName lastName updatedAt");

  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User not found",
      code: "USER_NOT_FOUND",
    });
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        updatedAt: user.updatedAt,
      },
      message: "Name updated successfully",
    },
  });
});

/**
 * Update profile lock
 */
export const updateProfileLock = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const { profileLock } = req.body;

    if (typeof profileLock !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Invalid profile lock value",
        code: "VALIDATION_ERROR",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.settings) {
      user.settings = {};
    }

    user.settings.profileLock = profileLock;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        settings: {
          profileLock: user.settings.profileLock,
        },
        message: "Profile lock updated successfully",
      },
    });
  }
);

/**
 * Update live settings (placeholder - coming soon)
 */
export const updateLiveSettings = asyncHandler(
  async (req: Request, res: Response) => {
    res.status(400).json({
      success: false,
      error: "Live settings feature is coming soon",
      code: "FEATURE_NOT_AVAILABLE",
      comingSoon: true,
    });
  }
);

/**
 * Update push notifications
 */
export const updatePushNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const { pushNotifications } = req.body;

    if (typeof pushNotifications !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Invalid push notifications value",
        code: "VALIDATION_ERROR",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.settings) {
      user.settings = {};
    }

    user.settings.pushNotifications = pushNotifications;
    
    // Also update the nested pushNotifications.enabled for backward compatibility
    if (!user.pushNotifications) {
      user.pushNotifications = { enabled: pushNotifications, deviceTokens: [], preferences: {} };
    } else {
      user.pushNotifications.enabled = pushNotifications;
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        settings: {
          pushNotifications: user.settings.pushNotifications,
        },
        message: "Push notification settings updated successfully",
      },
    });
  }
);

/**
 * Update recommendation settings
 */
export const updateRecommendations = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    }

    const { recommendationSettings } = req.body;

    if (typeof recommendationSettings !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Invalid recommendation settings value",
        code: "VALIDATION_ERROR",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.settings) {
      user.settings = {};
    }

    user.settings.recommendationSettings = recommendationSettings;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        settings: {
          recommendationSettings: user.settings.recommendationSettings,
        },
        message: "Recommendation settings updated successfully",
      },
    });
  }
);

/**
 * Combined profile update (alternative endpoint)
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  const { firstName, lastName, settings } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: "User not found",
      code: "USER_NOT_FOUND",
    });
  }

  const updateData: any = {};

  // Update name fields
  if (firstName !== undefined) {
    const trimmed = firstName?.trim();
    if (trimmed && trimmed.length > 50) {
      return res.status(400).json({
        success: false,
        error: "First name cannot exceed 50 characters",
        code: "VALIDATION_ERROR",
        field: "firstName",
      });
    }
    if (trimmed !== undefined) {
      updateData.firstName = trimmed || "";
    }
  }

  if (lastName !== undefined) {
    const trimmed = lastName?.trim();
    if (trimmed && trimmed.length > 50) {
      return res.status(400).json({
        success: false,
        error: "Last name cannot exceed 50 characters",
        code: "VALIDATION_ERROR",
        field: "lastName",
      });
    }
    if (trimmed !== undefined) {
      updateData.lastName = trimmed || "";
    }
  }

  // Update settings
  if (settings) {
    if (!user.settings) {
      user.settings = {};
    }

    if (settings.profileLock !== undefined) {
      if (typeof settings.profileLock !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "Invalid profile lock value",
          code: "VALIDATION_ERROR",
        });
      }
      user.settings.profileLock = settings.profileLock;
    }

    if (settings.pushNotifications !== undefined) {
      if (typeof settings.pushNotifications !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "Invalid push notifications value",
          code: "VALIDATION_ERROR",
        });
      }
      user.settings.pushNotifications = settings.pushNotifications;
      if (!user.pushNotifications) {
        user.pushNotifications = { enabled: settings.pushNotifications, deviceTokens: [], preferences: {} };
      } else {
        user.pushNotifications.enabled = settings.pushNotifications;
      }
    }

    if (settings.recommendationSettings !== undefined) {
      if (typeof settings.recommendationSettings !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "Invalid recommendation settings value",
          code: "VALIDATION_ERROR",
        });
      }
      user.settings.recommendationSettings = settings.recommendationSettings;
    }

    updateData.settings = user.settings;
  }

  // Apply name updates
  if (Object.keys(updateData).length > 0) {
    Object.assign(user, updateData);
  }

  await user.save();

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        settings: user.settings || {
          profileLock: false,
          liveSettings: false,
          pushNotifications: true,
          recommendationSettings: true,
        },
        updatedAt: user.updatedAt,
      },
      message: "Profile updated successfully",
    },
  });
});

