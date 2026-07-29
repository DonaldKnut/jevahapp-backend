import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../../models/user.model";
import emailService from "../email.service";
import { normalizeEmail } from "./register.service";
import { normalizeAuthCode } from "./shared";

export async function initiatePasswordReset(email: string) {
  const user = await User.findOne({ email: normalizeEmail(email) });
  if (!user) {
    throw new Error("User not found");
  }

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

  return { message: "Password reset code sent to your email" };
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

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.resetCodeVerified = undefined;
  await user.save();

  return user;
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

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.resetCodeVerified = undefined;
  await user.save();

  return user;
}
