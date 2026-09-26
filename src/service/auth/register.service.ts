import bcrypt from "bcrypt";
import { User } from "../../models/user.model";
import emailService from "../email.service";
import fileUploadService from "../fileUpload.service";
import { AuthError } from "../../modules/auth/authErrors";
import {
  generateNumericOtp,
  isOtpLocked,
  OTP_MAX_ATTEMPTS,
  otpExpiresAt,
  RESEND_COOLDOWN_SEC,
  resendRetryAfterSec,
} from "../../modules/auth/otp";
import { assertPasswordPolicy } from "../../modules/auth/passwordPolicy";
import { isCreatorWebSource } from "../../modules/auth/signupSource";
import {
  publicApiOrigin,
  signEmailVerifyLinkToken,
} from "../../modules/auth/sessionIssue";
import { normalizeAuthCode, setVerificationFlags } from "./shared";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export async function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  avatarBuffer?: Buffer,
  avatarMimeType?: string,
  options: { signupSource?: string } = {}
) {
  const normalizedEmail = normalizeEmail(email);
  assertPasswordPolicy(password, normalizedEmail);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.isBanned) {
      throw new AuthError(
        "BANNED",
        "This account cannot be used. Contact support.",
        403
      );
    }
    throw new AuthError(
      "EMAIL_TAKEN",
      "That email already has a Jevah account. Sign in instead.",
      409,
      { email: "That email already has a Jevah account." }
    );
  }

  const role = "learner";
  const autoVerify = process.env.AUTH_AUTO_VERIFY_EMAIL === "true";
  const verificationCode = autoVerify ? undefined : generateNumericOtp();
  const verificationCodeExpires = autoVerify ? undefined : otpExpiresAt();
  const hashedPassword = await bcrypt.hash(password, 10);

  const verificationFlags = setVerificationFlags(role);
  let avatarUrl: string | undefined;

  if (avatarBuffer && avatarMimeType) {
    const validImageMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validImageMimeTypes.includes(avatarMimeType)) {
      throw new Error(`Invalid image type: ${avatarMimeType}`);
    }
    const uploadResult = await fileUploadService.uploadMedia(
      avatarBuffer,
      "user-avatars",
      avatarMimeType
    );
    console.log("Avatar Upload Result:", uploadResult);
    avatarUrl = uploadResult.secure_url;
  }

  let newUser;
  try {
    newUser = await User.create({
      email: normalizedEmail,
      firstName,
      lastName,
      avatar: avatarUrl,
      provider: "email",
      password: hashedPassword,
      verificationCode,
      verificationCodeExpires,
      isEmailVerified: autoVerify,
      isProfileComplete: false,
      age: 0,
      isKid: false,
      section: "adults",
      role,
      hasConsentedToPrivacyPolicy: false,
      signupSource: options.signupSource,
      verificationAttempts: 0,
      verificationResendAt: autoVerify ? undefined : new Date(),
      ...verificationFlags,
    });
  } catch (error) {
    // Concurrent registration with the same email can slip past the
    // existence check above; the unique index catches it here.
    if (isDuplicateKeyError(error)) {
      throw new AuthError(
        "EMAIL_TAKEN",
        "That email already has a Jevah account. Sign in instead.",
        409,
        { email: "That email already has a Jevah account." }
      );
    }
    throw error;
  }

  // Fire-and-forget: registration must not fail because the email provider is
  // down. The user can use /resend-verification if this doesn't arrive.
  if (!autoVerify && verificationCode) {
    const verifyLink = `${publicApiOrigin()}/api/auth/verify-email?token=${signEmailVerifyLinkToken(newUser._id.toString())}`;
    emailService
      .sendVerificationEmail(
        normalizedEmail,
        firstName,
        verificationCode,
        verifyLink
      )
      .catch(emailError => {
        console.error("Failed to send verification email:", emailError);
      });
  }

  return newUser;
}

export async function registerArtist(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  artistName: string,
  genre: string[],
  bio?: string,
  socialMedia?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
    youtube?: string;
    spotify?: string;
  },
  recordLabel?: string,
  yearsActive?: number,
  avatarBuffer?: Buffer,
  avatarMimeType?: string
) {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.isBanned) {
      throw new AuthError(
        "BANNED",
        "This account cannot be used. Contact support.",
        403
      );
    }
    throw new AuthError(
      "EMAIL_TAKEN",
      "That email already has a Jevah account. Sign in instead.",
      409,
      { email: "That email already has a Jevah account." }
    );
  }

  if (!artistName || artistName.trim().length < 2) {
    throw new Error("Artist name must be at least 2 characters long");
  }

  if (!genre || genre.length === 0) {
    throw new Error("At least one genre must be specified");
  }

  const validGenres = [
    "gospel",
    "worship",
    "praise",
    "christian rock",
    "christian hip hop",
    "contemporary christian",
    "traditional gospel",
    "southern gospel",
    "urban gospel",
    "christian pop",
    "christian country",
    "christian jazz",
    "christian blues",
    "christian reggae",
    "christian electronic",
  ];

  const invalidGenres = genre.filter(
    g => !validGenres.includes(g.toLowerCase())
  );
  if (invalidGenres.length > 0) {
    throw new Error(
      `Invalid genres: ${invalidGenres.join(", ")}. Valid genres: ${validGenres.join(", ")}`
    );
  }

  assertPasswordPolicy(password, normalizedEmail);
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationCode = generateNumericOtp();
  const verificationCodeExpires = otpExpiresAt();
  let avatarUrl: string | undefined;

  if (avatarBuffer && avatarMimeType) {
    const validImageMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validImageMimeTypes.includes(avatarMimeType)) {
      throw new Error(`Invalid image type: ${avatarMimeType}`);
    }
    const uploadResult = await fileUploadService.uploadMedia(
      avatarBuffer,
      "artist-avatars",
      avatarMimeType
    );
    avatarUrl = uploadResult.secure_url;
  }

  let newArtist;
  try {
    newArtist = await User.create({
      email: normalizedEmail,
      firstName,
      lastName,
      avatar: avatarUrl,
      provider: "email",
      password: hashedPassword,
      verificationCode,
      verificationCodeExpires,
      isEmailVerified: false,
      isProfileComplete: false,
      age: 0,
      isKid: false,
      section: "adults",
      role: "artist",
      hasConsentedToPrivacyPolicy: false,
      isVerifiedArtist: false,
      artistProfile: {
        artistName: artistName.trim(),
        genre: genre.map(g => g.toLowerCase()),
        bio: bio?.trim(),
        socialMedia,
        recordLabel: recordLabel?.trim(),
        yearsActive,
        verificationDocuments: [],
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AuthError(
        "EMAIL_TAKEN",
        "That email already has a Jevah account. Sign in instead.",
        409,
        { email: "That email already has a Jevah account." }
      );
    }
    throw error;
  }

  // Same as learner register: verify first, welcome after POST /verify-email.
  const artistVerifyLink = `${publicApiOrigin()}/api/auth/verify-email?token=${signEmailVerifyLinkToken(newArtist._id.toString())}`;
  emailService
    .sendVerificationEmail(
      normalizedEmail,
      firstName || "Artist",
      verificationCode,
      artistVerifyLink
    )
    .catch(emailError => {
      console.error("Failed to send artist verification email:", emailError);
    });

  return {
    id: newArtist._id,
    email: newArtist.email,
    firstName: newArtist.firstName,
    lastName: newArtist.lastName,
    avatar: newArtist.avatar,
    role: newArtist.role,
    artistProfile: newArtist.artistProfile,
    needsEmailVerification: true,
  };
}

export async function verifyArtist(
  userId: string,
  verificationDocuments: string[]
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "artist") {
    throw new Error("User is not an artist");
  }

  if (!user.artistProfile) {
    throw new Error("Artist profile not found");
  }

  user.artistProfile.verificationDocuments = verificationDocuments;
  user.isVerifiedArtist = true;
  await user.save();

  return {
    id: user._id,
    email: user.email,
    artistName: user.artistProfile.artistName,
    isVerifiedArtist: user.isVerifiedArtist,
  };
}

export async function updateArtistProfile(
  userId: string,
  updates: {
    artistName?: string;
    genre?: string[];
    bio?: string;
    socialMedia?: {
      instagram?: string;
      twitter?: string;
      facebook?: string;
      youtube?: string;
      spotify?: string;
    };
    recordLabel?: string;
    yearsActive?: number;
  }
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "artist") {
    throw new Error("User is not an artist");
  }

  if (!user.artistProfile) {
    throw new Error("Artist profile not found");
  }

  if (updates.artistName && updates.artistName.trim().length < 2) {
    throw new Error("Artist name must be at least 2 characters long");
  }

  if (updates.genre && updates.genre.length === 0) {
    throw new Error("At least one genre must be specified");
  }

  const updatedProfile = {
    ...user.artistProfile,
    ...updates,
    artistName: updates.artistName?.trim() || user.artistProfile.artistName,
    genre:
      updates.genre?.map(g => g.toLowerCase()) || user.artistProfile.genre,
    bio: updates.bio?.trim() || user.artistProfile.bio,
    recordLabel:
      updates.recordLabel?.trim() || user.artistProfile.recordLabel,
  };

  user.artistProfile = updatedProfile;
  await user.save();

  return {
    id: user._id,
    email: user.email,
    artistProfile: user.artistProfile,
  };
}

async function markEmailVerified(user: InstanceType<typeof User>) {
  if (user.isEmailVerified) {
    throw new AuthError(
      "ALREADY_VERIFIED",
      "This email is already verified. Sign in to continue.",
      409
    );
  }

  user.isEmailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  user.verificationAttempts = 0;
  user.verificationLockedUntil = undefined;
  await user.save();

  const welcomeVariant =
    user.role === "artist" || isCreatorWebSource(user.signupSource)
      ? "artist"
      : "default";
  emailService
    .sendWelcomeEmail(
      user.email,
      user.firstName || (user.role === "artist" ? "Artist" : "User"),
      welcomeVariant
    )
    .catch(emailError => {
      console.error("Failed to send welcome email:", emailError);
    });

  return user;
}

async function consumeVerificationCode(
  user: InstanceType<typeof User>,
  code: string
) {
  if (user.isEmailVerified) {
    throw new AuthError(
      "ALREADY_VERIFIED",
      "This email is already verified. Sign in to continue.",
      409
    );
  }

  if (isOtpLocked(user.verificationLockedUntil)) {
    throw new AuthError(
      "RATE_LIMITED",
      "Too many verification attempts. Request a new code.",
      429,
      undefined,
      { retryAfterSec: 60 }
    );
  }

  const normalizedCode = normalizeAuthCode(code);
  if (!normalizedCode) {
    throw new AuthError("INVALID_CODE", "That code is incorrect.", 400);
  }

  if (
    user.verificationCodeExpires &&
    user.verificationCodeExpires < new Date()
  ) {
    throw new AuthError(
      "CODE_EXPIRED",
      "That code has expired. Resend a new code.",
      400
    );
  }

  if (!user.verificationCode || user.verificationCode !== normalizedCode) {
    const attempts = (user.verificationAttempts || 0) + 1;
    user.verificationAttempts = attempts;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      user.verificationLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
    }
    await user.save();
    throw new AuthError("INVALID_CODE", "That code is incorrect.", 400);
  }

  return markEmailVerified(user);
}

export async function verifyEmail(email: string, code: string) {
  const user = await User.findOne({ email: normalizeEmail(email) });
  if (!user) {
    throw new AuthError("INVALID_CODE", "That code is incorrect.", 400);
  }
  return consumeVerificationCode(user, code);
}

export async function verifyEmailForUserId(userId: string, code: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AuthError("INVALID_CODE", "That code is incorrect.", 400);
  }
  return consumeVerificationCode(user, code);
}

export async function verifyEmailByLinkToken(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AuthError(
      "CODE_EXPIRED",
      "This verification link is invalid or expired.",
      400
    );
  }
  if (user.isEmailVerified) {
    return user;
  }
  return markEmailVerified(user);
}

export async function resendVerificationEmail(email: string) {
  const generic = {
    retryAfterSec: RESEND_COOLDOWN_SEC,
    sent: false as boolean,
  };

  const user = await User.findOne({
    email: normalizeEmail(email),
    provider: "email",
  });
  if (!user || user.isEmailVerified) {
    return generic;
  }

  const wait = resendRetryAfterSec(user.verificationResendAt);
  if (wait > 0) {
    return { retryAfterSec: wait, sent: false };
  }

  const verificationCode = generateNumericOtp();
  user.verificationCode = verificationCode;
  user.verificationCodeExpires = otpExpiresAt();
  user.verificationAttempts = 0;
  user.verificationLockedUntil = undefined;
  user.verificationResendAt = new Date();
  await user.save();

  const verifyLink = `${publicApiOrigin()}/api/auth/verify-email?token=${signEmailVerifyLinkToken(user._id.toString())}`;
  emailService
    .sendVerificationEmail(
      user.email,
      user.firstName || "User",
      verificationCode,
      verifyLink
    )
    .catch(emailError => {
      console.error("Failed to resend verification email:", emailError);
    });

  return { retryAfterSec: RESEND_COOLDOWN_SEC, sent: true };
}

export async function completeUserProfile(
  userId: string,
  age: number,
  location: string | undefined,
  hasConsentedToPrivacyPolicy: boolean,
  desiredRole?: string,
  interests?: string[],
  section?: string
) {
  const currentUser = await User.findById(userId);
  if (!currentUser) {
    throw new Error("User not found");
  }

  let userSection = section;
  let isKid: boolean;

  if (age < 18) {
    userSection = "kids";
    isKid = true;
  } else {
    userSection = "adults";
    isKid = false;
  }

  if (section && section !== userSection) {
    throw new Error(
      `Provided section '${section}' is invalid for age ${age}. Age ${age} requires section '${userSection}'.`
    );
  }

  let role = currentUser.role;
  if (currentUser.role === "learner" && desiredRole) {
    const allowedRoles = [
      "learner",
      "parent",
      "educator",
      "content_creator",
      "vendor",
      "church_admin",
    ];
    if (allowedRoles.includes(desiredRole)) {
      role = desiredRole;
    }
  }

  const verificationFlags =
    role !== currentUser.role ? setVerificationFlags(role) : {};

  const updateData: any = {
    age,
    location,
    section: userSection,
    isKid,
    role,
    hasConsentedToPrivacyPolicy,
    isProfileComplete: true,
    ...verificationFlags,
  };

  if (interests && Array.isArray(interests)) {
    updateData.interests = interests;
  }

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
