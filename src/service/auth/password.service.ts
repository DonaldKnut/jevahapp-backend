import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../../models/user.model";
import emailService from "../email.service";

export async function initiatePasswordReset(email: string) {
  const user = await User.findOne({ email });
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
  const user = await User.findOne({
    email,
    resetPasswordToken: code,
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
  const user = await User.findOne({
    email,
    resetPasswordToken: code,
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
    email,
    resetPasswordToken: token,
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
