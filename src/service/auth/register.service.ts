import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../../models/user.model";
import emailService from "../email.service";
import fileUploadService from "../fileUpload.service";
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
  avatarMimeType?: string
) {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error("Email address is already registered");
  }

  const role = "learner";

  const verificationCode = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();
  const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
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
      isEmailVerified: false,
      isProfileComplete: false,
      age: 0,
      isKid: false,
      section: "adults",
      role,
      hasConsentedToPrivacyPolicy: false,
      ...verificationFlags,
    });
  } catch (error) {
    // Concurrent registration with the same email can slip past the
    // existence check above; the unique index catches it here.
    if (isDuplicateKeyError(error)) {
      throw new Error("Email address is already registered");
    }
    throw error;
  }

  // Fire-and-forget: registration must not fail because the email provider is
  // down. The user can use /resend-verification-email if this doesn't arrive.
  emailService
    .sendVerificationEmail(normalizedEmail, firstName, verificationCode)
    .catch(emailError => {
      console.error("Failed to send verification email:", emailError);
    });

  return {
    id: newUser._id,
    email: newUser.email,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    avatar: newUser.avatar,
    role: newUser.role,
  };
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
    throw new Error("Email address is already registered");
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

  const hashedPassword = await bcrypt.hash(password, 10);
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
      throw new Error("Email address is already registered");
    }
    throw error;
  }

  emailService
    .sendWelcomeEmail(normalizedEmail, firstName || "Artist")
    .catch(emailError => {
      console.error("Failed to send welcome email:", emailError);
    });

  return {
    id: newArtist._id,
    email: newArtist.email,
    firstName: newArtist.firstName,
    lastName: newArtist.lastName,
    avatar: newArtist.avatar,
    role: newArtist.role,
    artistProfile: newArtist.artistProfile,
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

export async function verifyEmail(email: string, code: string) {
  const normalizedCode = normalizeAuthCode(code);
  if (!normalizedCode) {
    throw new Error("Invalid email or code");
  }

  const user = await User.findOne({
    email: normalizeEmail(email),
    verificationCode: normalizedCode,
  });
  if (!user) {
    throw new Error("Invalid email or code");
  }

  if (
    user.verificationCodeExpires &&
    user.verificationCodeExpires < new Date()
  ) {
    throw new Error("Verification code expired");
  }

  user.isEmailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  // Non-blocking: verification already succeeded; a failed welcome email
  // must not turn this into an error response.
  emailService
    .sendWelcomeEmail(user.email, user.firstName || "User")
    .catch(emailError => {
      console.error("Failed to send welcome email:", emailError);
    });

  return user;
}

export async function resendVerificationEmail(email: string) {
  const user = await User.findOne({
    email: normalizeEmail(email),
    provider: "email",
  });
  if (!user) {
    throw new Error("User not found");
  }

  if (user.isEmailVerified) {
    throw new Error("Email already verified");
  }

  const verificationCode = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();
  const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

  user.verificationCode = verificationCode;
  user.verificationCodeExpires = verificationCodeExpires;
  await user.save();

  await emailService.sendVerificationEmail(
    user.email,
    user.firstName || "User",
    verificationCode
  );

  return user;
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
