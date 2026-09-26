import { Request, Response, NextFunction } from "express";
import authService from "../../service/auth.service";
import { isAuthError, sendAuthError } from "../../modules/auth/authErrors";
import { assertPasswordPolicy } from "../../modules/auth/passwordPolicy";

export async function resetPassword(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const token = request.body?.token;
    const newPassword =
      request.body?.password || request.body?.newPassword;
    const email = request.body?.email;

    if (!token || !newPassword) {
      return response.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Reset token and password are required.",
        fields: {
          ...(!token ? { token: "Reset token is required." } : {}),
          ...(!newPassword ? { password: "Password is required." } : {}),
        },
      });
    }

    assertPasswordPolicy(String(newPassword), email);

    await authService.resetPassword(email, token, String(newPassword));

    return response.status(200).json({
      success: true,
      message: "Password reset successfully. Please sign in again.",
    });
  } catch (error) {
    if (isAuthError(error)) {
      return sendAuthError(response, error);
    }
    if (
      error instanceof Error &&
      error.message === "Invalid or expired reset token"
    ) {
      return response.status(400).json({
        success: false,
        code: "RESET_TOKEN_INVALID",
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
      return response.status(200).json({
        success: true,
        message:
          "If an account exists for that email, a password reset code has been sent.",
      });
    }

    const result = await authService.initiatePasswordReset(email);

    // Same 200 for all roles (admin, content_creator, artist, learner) — no email enumeration
    return response.status(200).json({
      success: true,
      message: result.message,
    });
  } catch {
    return response.status(200).json({
      success: true,
      message:
        "If an account exists for that email, a password reset code has been sent.",
    });
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
    if (isAuthError(error)) {
      return sendAuthError(response, error);
    }
    if (
      error instanceof Error &&
      error.message === "Invalid or expired reset code"
    ) {
      return response.status(400).json({
        success: false,
        code: "RESET_TOKEN_INVALID",
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

    try {
      assertPasswordPolicy(String(newPassword), email);
    } catch (error) {
      if (isAuthError(error)) {
        return sendAuthError(response, error);
      }
    }

    await authService.resetPasswordWithCode(email, code, newPassword);

    return response.status(200).json({
      success: true,
      message: "Password reset successfully. Please sign in again.",
    });
  } catch (error) {
    if (isAuthError(error)) {
      return sendAuthError(response, error);
    }
    if (
      error instanceof Error &&
      error.message === "Invalid or expired reset code"
    ) {
      return response.status(400).json({
        success: false,
        code: "RESET_TOKEN_INVALID",
        message: error.message,
      });
    }
    return next(error);
  }
}

/**
 * POST /api/auth/change-password
 * Logged-in users (admin, creators, artists, …) change their own password.
 */
export async function changePassword(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const userId = request.userId;
    const { currentPassword, newPassword } = request.body || {};

    if (!userId) {
      return response.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!currentPassword || !newPassword) {
      return response.status(400).json({
        success: false,
        message: "currentPassword and newPassword are required",
      });
    }

    assertPasswordPolicy(String(newPassword));

    await authService.changePassword(userId, currentPassword, newPassword);

    return response.status(200).json({
      success: true,
      message: "Password changed successfully. Please sign in again.",
    });
  } catch (error) {
    if (isAuthError(error)) {
      return sendAuthError(response, error);
    }
    if (error instanceof Error) {
      if (
        error.message === "Current password is incorrect" ||
        error.message.includes("no password set")
      ) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message === "User not found") {
        return response.status(404).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}
