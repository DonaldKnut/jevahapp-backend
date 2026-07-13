import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../../models/user.model";
import emailService from "../email.service";
import {
  extractUserInfoFromToken,
  validateUserInfo,
} from "../../utils/clerk";
import fileUploadService from "../fileUpload.service";
import aiReengagementService from "../aiReengagement.service";
import { TOKEN_EXPIRATION } from "../../config/tokenConfig";
import { JWT_SECRET_ASSERTED } from "./shared";

export async function oauthLogin(
  provider: string,
  token: string,
  userInfo: any
) {
  try {
    if (!provider || !token || !userInfo) {
      throw new Error("Provider, token, and user information are required");
    }

    const tokenData = await extractUserInfoFromToken(token);
    const validatedUserInfo = validateUserInfo(userInfo);

    if (!tokenData.email) {
      throw new Error(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} email not found in Clerk token`
      );
    }

    let user = await User.findOne({ email: tokenData.email });
    const isNewUser = !user;

    if (!user) {
      user = await User.create({
        email: tokenData.email,
        firstName: validatedUserInfo.firstName,
        lastName: validatedUserInfo.lastName,
        avatar: validatedUserInfo.avatar,
        provider: provider.toLowerCase(),
        clerkId: tokenData.clerkId,
        isEmailVerified: tokenData.emailVerified,
        isProfileComplete: false,
        age: 0,
        isKid: false,
        section: "adults",
        role: "learner",
        hasConsentedToPrivacyPolicy: false,
      });

      if (tokenData.emailVerified) {
        await emailService.sendWelcomeEmail(
          user.email,
          user.firstName || "User"
        );
      }
    } else {
      if (!user.clerkId) {
        user.clerkId = tokenData.clerkId;
        await user.save();
      }
    }

    const jwtToken = jwt.sign({ userId: user._id }, JWT_SECRET_ASSERTED, {
      expiresIn: "7d",
    });

    return {
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isProfileComplete: user.isProfileComplete,
        role: user.role,
      },
      isNewUser,
    };
  } catch (error) {
    console.error("OAuth login error:", error);
    throw error;
  }
}

export async function clerkLogin(token: string, userInfo: any) {
  try {
    if (!token || !userInfo) {
      throw new Error("Token and user information are required");
    }

    const tokenData = await extractUserInfoFromToken(token);
    const validatedUserInfo = validateUserInfo(userInfo);

    if (!tokenData.email) {
      throw new Error("Email not found in Clerk token");
    }

    let user = await User.findOne({ email: tokenData.email });
    const isNewUser = !user;

    if (!user) {
      user = await User.create({
        email: tokenData.email,
        firstName: validatedUserInfo.firstName,
        lastName: validatedUserInfo.lastName,
        avatar: validatedUserInfo.avatar,
        provider: "clerk",
        clerkId: tokenData.clerkId,
        isEmailVerified: tokenData.emailVerified,
        isProfileComplete: false,
        age: 0,
        isKid: false,
        section: "adults",
        role: "learner",
        hasConsentedToPrivacyPolicy: false,
      });

      if (tokenData.emailVerified) {
        await emailService.sendWelcomeEmail(
          user.email,
          user.firstName || "User"
        );
      }
    } else {
      if (!user.clerkId) {
        user.clerkId = tokenData.clerkId;
        await user.save();
      }
    }

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        isProfileComplete: user.isProfileComplete,
        role: user.role,
      },
      needsAgeSelection: !user.age,
      isNewUser,
    };
  } catch (error) {
    console.error("Clerk login error:", error);
    throw error;
  }
}

export async function loginUser(
  email: string,
  password: string,
  rememberMe: boolean = false,
  deviceInfo?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const user = await User.findOne({ email, provider: "email" });
  if (!user || !(await bcrypt.compare(password, user.password || ""))) {
    throw new Error("Invalid email or password");
  }

  if (!user.isEmailVerified) {
    throw new Error("Please verify your email before logging in");
  }

  const expiresIn = rememberMe
    ? TOKEN_EXPIRATION.REMEMBER_ME
    : TOKEN_EXPIRATION.STANDARD;

  const tokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    rememberMe: rememberMe,
  };

  const accessToken = jwt.sign(tokenPayload, JWT_SECRET_ASSERTED, {
    expiresIn: expiresIn,
    algorithm: "HS256",
  });

  let refreshToken: string | undefined;

  if (rememberMe) {
    const { RefreshToken } = await import("../../models/refreshToken.model");
    const crypto = await import("crypto");

    refreshToken = crypto.randomBytes(64).toString("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await RefreshToken.create({
      token: refreshToken,
      userId: user._id,
      deviceInfo,
      ipAddress,
      userAgent,
      expiresAt,
      isRevoked: false,
    });
  }

  await User.findByIdAndUpdate(user._id, {
    lastLoginAt: new Date(),
  });

  await aiReengagementService.trackUserReturn(user._id.toString());

  console.log(
    `🔐 User login: ${user.email}, Remember Me: ${rememberMe}, Expires in: ${expiresIn}s`
  );

  return {
    accessToken,
    refreshToken,
    expiresIn,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      isProfileComplete: user.isProfileComplete,
    },
  };
}

export async function getCurrentUser(userId: string) {
  const user = (await User.findById(userId)
    .select(
      "firstName lastName email avatar avatarUpload bio section role isProfileComplete isEmailVerified createdAt updatedAt"
    )
    .lean()) as any;

  if (!user) {
    throw new Error("User not found");
  }

  const avatar = user.avatar || user.avatarUpload || null;

  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar,
    avatarUpload: user.avatarUpload || null,
    bio: user.bio || null,
    section: user.section || "adults",
    role: user.role,
    isProfileComplete: user.isProfileComplete || false,
    isEmailVerified: user.isEmailVerified || false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserSession(userId: string) {
  const user = await User.findById(userId).select(
    "_id email firstName lastName isProfileComplete role"
  );

  if (!user) {
    throw new Error("User not found");
  }

  return {
    userId: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isProfileComplete: user.isProfileComplete,
    role: user.role,
  };
}

export async function updateUserAvatar(
  userId: string,
  avatarBuffer: Buffer,
  mimetype: string
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.avatar) {
    try {
      const publicId = user.avatar.split("/").pop()?.split(".")[0];
      if (publicId) {
        await fileUploadService.deleteMedia(`user-avatars/${publicId}`);
      }
    } catch (error) {
      console.error("Error deleting old avatar:", error);
    }
  }

  const validImageMimeTypes = ["image/jpeg", "image/png", "image/gif"];
  if (!validImageMimeTypes.includes(mimetype)) {
    throw new Error(`Invalid image type: ${mimetype}`);
  }

  const uploadResult = await fileUploadService.uploadMedia(
    avatarBuffer,
    "user-avatars",
    mimetype
  );
  console.log("Avatar Upload Result:", uploadResult);

  user.avatar = uploadResult.secure_url;

  await user.save();

  return {
    avatarUrl: user.avatar,
    userId: user._id,
  };
}

export async function getUserNameAndAge(userId: string) {
  const user = await User.findById(userId).select(
    "firstName lastName age isKid section"
  );

  if (!user) {
    throw new Error("User not found");
  }

  let userType = "adult";
  if (user.isKid === true) {
    userType = "kid";
  } else if (user.age) {
    userType = user.age < 18 ? "kid" : "adult";
  } else if (user.section) {
    userType = user.section === "kids" ? "kid" : "adult";
  }

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    age: user.age,
    isKid: user.isKid,
    section: user.section,
    userType,
  };
}

export async function getUserProfilePicture(userId: string) {
  const user = await User.findById(userId).select("avatar avatarUpload");

  if (!user) {
    throw new Error("User not found");
  }

  const profilePicture = user.avatar || user.avatarUpload || null;

  return {
    profilePicture,
    hasProfilePicture: !!profilePicture,
  };
}
