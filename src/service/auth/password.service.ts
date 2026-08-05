import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../../models/user.model";
import emailService from "../email.service";
import { normalizeEmail } from "./register.service";
import { normalizeAuthCode } from "./shared";
import { revokeAllUserRefreshTokens } from "./token.service";

const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, a password reset code has been sent.";

/**
 * Start password reset for any role (admin, content_creator, artist, learner, …).
 * Never reveals whether the email exists.
 */
export async function initiatePasswordReset(email: string) {
  const user = await User.findOne({ email: normalizeEmail(email) });

  if (!user) {
    return { message: GENERIC_RESET_MESSAGE, sent: false };
  }

  // Banned users still get a code so we don't leak ban+existence; reset is allowed
  // so they can recover after an admin unban (token still checked on login).
  const resetCode = crypto.randomBytes(3).toString("hex").toUpperCase();
  const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

  user.resetPasswordToken = resetCode;
  user.resetPasswordExpires = resetCodeExpires;
  await user.save();

  await emailService.sendPasswordResetEmail(
    user.email,
    user.firstName || "User",
    resetCode
  );

  return { message: GENERIC_RESET_MESSAGE, sent: true };
}

export async function verifyResetCode(email: string, code: string) {
  const normalizedCode = normalizeAuthCode(code);
  const user = await User.findOne({
    email: normalizeEmail(email),
    resetPasswordToken: normalizedCode,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new Error("Invalid or expired reset code");
  }

  user.resetCodeVerified = true;
  await user.save();

  return { message: "Reset code verified successfully" };
}

async function applyNewPassword(user: InstanceType<typeof User>, newPassword: string) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.resetCodeVerified = undefined;
  await user.save();
  await revokeAllUserRefreshTokens(user._id.toString());
  return user;
}

export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string
) {
  const normalizedCode = normalizeAuthCode(code);
  const user = await User.findOne({
    email: normalizeEmail(email),
    resetPasswordToken: normalizedCode,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new Error("Invalid or expired reset code");
  }

  return applyNewPassword(user, newPassword);
}

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string
) {
  const user = await User.findOne({
    email: normalizeEmail(email),
    resetPasswordToken: normalizeAuthCode(token),
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new Error("Invalid or expired reset token");
  }

  return applyNewPassword(user, newPassword);
}

/**
 * Authenticated change-password (admin, creators, artists, learners — any role).
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.password) {
    throw new Error(
      "This account has no password set. Use forgot-password or link an email login."
    );
  }

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) {
    throw new Error("Current password is incorrect");
  }

  return applyNewPassword(user, newPassword);
}

/**
 * Admin sets a user's password directly (support tool) and revokes their sessions.
 */
export async function adminSetUserPassword(userId: string, newPassword: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return applyNewPassword(user, newPassword);
}

/**
 * Admin triggers the same forgot-password email flow for a user (any role).
 */
export async function adminSendPasswordReset(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return initiatePasswordReset(user.email);
}
