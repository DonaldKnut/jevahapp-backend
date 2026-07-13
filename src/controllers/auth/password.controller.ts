import { Request, Response, NextFunction } from "express";
import authService from "../../service/auth.service";

export async function resetPassword(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { email, token, newPassword } = request.body;

    if (!email || !token || !newPassword) {
      return response.status(400).json({
        success: false,
        message: "Email, token, and new password are required",
      });
    }

    await authService.resetPassword(email, token, newPassword);

    return response.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid or expired reset token"
    ) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

export async function initiatePasswordReset(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { email } = request.body;

    if (!email) {
      return response.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    await authService.initiatePasswordReset(email);

    return response.status(200).json({
      success: true,
      message: "Password reset code sent to your email",
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

export async function verifyResetCode(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { email, code } = request.body;

    if (!email || !code) {
      return response.status(400).json({
        success: false,
        message: "Email and verification code are required",
      });
    }

    await authService.verifyResetCode(email, code);

    return response.status(200).json({
      success: true,
      message: "Reset code verified successfully",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid or expired reset code"
    ) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

export async function resetPasswordWithCode(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { email, code, newPassword } = request.body;

    if (!email || !code || !newPassword) {
      return response.status(400).json({
        success: false,
        message: "Email, verification code, and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return response.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    await authService.resetPasswordWithCode(email, code, newPassword);

    return response.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid or expired reset code"
    ) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}
