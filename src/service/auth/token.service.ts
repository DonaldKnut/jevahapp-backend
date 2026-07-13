import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { User } from "../../models/user.model";
import { BlacklistedToken } from "../../models/blacklistedToken.model";
import aiReengagementService from "../aiReengagement.service";
import { TOKEN_EXPIRATION } from "../../config/tokenConfig";
import { JWT_SECRET_ASSERTED } from "./shared";

export async function logout(
  userId: string,
  token: string,
  refreshToken?: string
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const decodedToken = jwt.decode(token) as { exp?: number; userId?: string };
  if (!decodedToken || !decodedToken.exp) {
    throw new Error("Invalid token");
  }

  const expiresAt = new Date(decodedToken.exp * 1000);

  const existingBlacklistedToken = await BlacklistedToken.findOne({ token });
  if (existingBlacklistedToken) {
    throw new Error("Token already invalidated");
  }

  await BlacklistedToken.create({
    token,
    expiresAt,
  });

  if (refreshToken) {
    await revokeRefreshToken(refreshToken, userId);
  }

  await aiReengagementService.trackUserSignout(userId);

  return { message: "User logged out successfully" };
}

export async function refreshToken(refreshTokenString: string) {
  try {
    const { RefreshToken } = await import("../../models/refreshToken.model");

    const refreshTokenDoc = await RefreshToken.findOne({
      token: refreshTokenString,
      isRevoked: false,
    });

    if (!refreshTokenDoc) {
      throw new Error("Invalid refresh token");
    }

    if (new Date() > refreshTokenDoc.expiresAt) {
      refreshTokenDoc.isRevoked = true;
      refreshTokenDoc.revokedAt = new Date();
      await refreshTokenDoc.save();
      throw new Error("Refresh token expired");
    }

    const user = await User.findById(refreshTokenDoc.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.isBanned) {
      await RefreshToken.updateMany(
        { userId: user._id },
        { isRevoked: true, revokedAt: new Date() }
      );
      throw new Error("Account is banned");
    }

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      rememberMe: true,
    };

    const newAccessToken = jwt.sign(tokenPayload, JWT_SECRET_ASSERTED, {
      expiresIn: TOKEN_EXPIRATION.REMEMBER_ME,
      algorithm: "HS256",
    });

    return {
      accessToken: newAccessToken,
      expiresIn: TOKEN_EXPIRATION.REMEMBER_ME,
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
  } catch (error: any) {
    throw new Error(error.message || "Invalid or expired refresh token");
  }
}

export async function revokeRefreshToken(
  refreshTokenString: string,
  userId: string
) {
  const { RefreshToken } = await import("../../models/refreshToken.model");

  await RefreshToken.findOneAndUpdate(
    { token: refreshTokenString, userId: new Types.ObjectId(userId) },
    { isRevoked: true, revokedAt: new Date() }
  );
}

export async function revokeAllUserRefreshTokens(userId: string) {
  const { RefreshToken } = await import("../../models/refreshToken.model");

  await RefreshToken.updateMany(
    { userId: new Types.ObjectId(userId) },
    { isRevoked: true, revokedAt: new Date() }
  );
}
