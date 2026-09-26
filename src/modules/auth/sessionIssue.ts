import crypto from "crypto";
import jwt from "jsonwebtoken";
import { isMasterAdminEmail } from "../../config/superAdmin";
import { TOKEN_EXPIRATION } from "../../config/tokenConfig";
import { JWT_SECRET_ASSERTED } from "../../service/auth/shared";
import { resolveAuthNextStep, type AuthNextStep } from "./nextStep";

export interface AuthUserEnvelope {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar: string | null;
  role: string;
  isEmailVerified: boolean;
  isBanned: boolean;
  isVerifiedArtist: boolean;
  isVerifiedCreator: boolean;
  isVerifiedChurch?: boolean;
  isVerifiedVendor?: boolean;
  isProfileComplete?: boolean;
  isMasterAdmin?: boolean;
  createdAt?: string;
  nextStep?: AuthNextStep;
}

export interface IssuedAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: "Bearer";
  user: AuthUserEnvelope;
}

export interface SessionUserLike {
  _id: { toString(): string };
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string | null;
  role?: string;
  isEmailVerified?: boolean;
  isBanned?: boolean;
  isVerifiedArtist?: boolean;
  isVerifiedCreator?: boolean;
  isVerifiedChurch?: boolean;
  isVerifiedVendor?: boolean;
  isProfileComplete?: boolean;
  createdAt?: Date | string;
  signupSource?: string | null;
}

export function shapeAuthUser(
  user: SessionUserLike,
  extras: {
    artistStatus?: "pending" | "active" | "suspended" | "rejected" | null;
  } = {}
): AuthUserEnvelope {
  const createdAt =
    user.createdAt instanceof Date
      ? user.createdAt.toISOString()
      : user.createdAt;

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatar: user.avatar || null,
    role: user.role || "learner",
    isEmailVerified: Boolean(user.isEmailVerified),
    isBanned: Boolean(user.isBanned),
    isVerifiedArtist: Boolean(user.isVerifiedArtist),
    isVerifiedCreator: Boolean(user.isVerifiedCreator),
    isVerifiedChurch: Boolean(user.isVerifiedChurch),
    isVerifiedVendor: Boolean(user.isVerifiedVendor),
    isProfileComplete: Boolean(user.isProfileComplete),
    isMasterAdmin: isMasterAdminEmail(user.email),
    createdAt,
    nextStep: resolveAuthNextStep({
      isEmailVerified: Boolean(user.isEmailVerified),
      isBanned: Boolean(user.isBanned),
      isVerifiedArtist: Boolean(user.isVerifiedArtist),
      isVerifiedCreator: Boolean(user.isVerifiedCreator),
      role: user.role,
      artistStatus: extras.artistStatus ?? null,
      source: user.signupSource,
    }),
  };
}

export async function issueAuthSession(
  user: SessionUserLike,
  options: {
    rememberMe?: boolean;
    deviceInfo?: string;
    ipAddress?: string;
    userAgent?: string;
    artistStatus?: "pending" | "active" | "suspended" | "rejected" | null;
  } = {}
): Promise<IssuedAuthSession> {
  const rememberMe = Boolean(options.rememberMe);
  const expiresIn = rememberMe
    ? TOKEN_EXPIRATION.REMEMBER_ME
    : TOKEN_EXPIRATION.STANDARD;

  const accessToken = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      rememberMe,
    },
    JWT_SECRET_ASSERTED,
    { expiresIn, algorithm: "HS256" }
  );

  let refreshToken: string | undefined;
  if (rememberMe) {
    const { RefreshToken } = await import("../../models/refreshToken.model");
    refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    await RefreshToken.create({
      token: refreshToken,
      userId: user._id,
      deviceInfo: options.deviceInfo,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      expiresAt,
      isRevoked: false,
    });
  }

  return {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: "Bearer",
    user: shapeAuthUser(user, { artistStatus: options.artistStatus }),
  };
}

export function publicWebOrigin(): string {
  return (process.env.FRONTEND_URL || "https://www.jevahapp.com").replace(
    /\/$/,
    ""
  );
}

export function publicApiOrigin(): string {
  return (
    process.env.API_PUBLIC_URL ||
    process.env.BACKEND_URL ||
    "https://api.jevahapp.com"
  ).replace(/\/$/, "");
}

export function signEmailVerifyLinkToken(userId: string): string {
  return jwt.sign(
    { purpose: "email_verify", userId },
    JWT_SECRET_ASSERTED,
    { expiresIn: "15m", algorithm: "HS256" }
  );
}

export function readEmailVerifyLinkToken(
  token: string
): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_ASSERTED) as {
      purpose?: string;
      userId?: string;
    };
    if (decoded.purpose !== "email_verify" || !decoded.userId) return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export function signPasswordResetLinkToken(email: string, code: string): string {
  return jwt.sign(
    { purpose: "password_reset", email, code },
    JWT_SECRET_ASSERTED,
    { expiresIn: "15m", algorithm: "HS256" }
  );
}

export function readPasswordResetLinkToken(
  token: string
): { email: string; code: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_ASSERTED) as {
      purpose?: string;
      email?: string;
      code?: string;
    };
    if (
      decoded.purpose !== "password_reset" ||
      !decoded.email ||
      !decoded.code
    ) {
      return null;
    }
    return { email: decoded.email, code: decoded.code };
  } catch {
    return null;
  }
}
