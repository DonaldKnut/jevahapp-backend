import { Request, Response, NextFunction } from "express";
import authService from "../../service/auth.service";
import { AccountBannedError } from "../../service/auth/shared";

export async function loginUser(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const {
      email,
      password,
      rememberMe = false,
    } = request.body;

    if (!email || !password) {
      return response.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const deviceInfo = request.headers["user-agent"] || "Unknown";
    const ipAddress = request.ip || request.socket.remoteAddress || "Unknown";
    const userAgent = request.headers["user-agent"] || "";

    const result = await authService.loginUser(
      email,
      password,
      rememberMe,
      deviceInfo,
      ipAddress,
      userAgent
    );

    if (rememberMe && result.refreshToken) {
      const isProduction = process.env.NODE_ENV === "production";

      response.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "strict" : "lax",
        maxAge: 90 * 24 * 60 * 60 * 1000,
        path: "/",
      });
    }

    return response.status(200).json({
      success: true,
      message: "Login successful",
      token: result.accessToken,
      accessToken: result.accessToken,
      user: result.user,
      expiresIn: result.expiresIn,
      tokenType: "bearer",
      rememberMe: rememberMe,
    });
  } catch (error) {
    if (error instanceof AccountBannedError) {
      return response.status(403).json({
        success: false,
        message: error.message,
        banReason: error.banReason,
        banUntil: error.banUntil,
      });
    }
    if (error instanceof Error) {
      if (error.message === "Invalid email or password") {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message === "Please verify your email before logging in") {
        return response.status(403).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}

export async function verifyEmail(
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

    const user = await authService.verifyEmail(email, code);

    return response.status(200).json({
      success: true,
      message: "Email verified successfully",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Invalid email or code") {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message === "Verification code expired") {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}

export async function resendVerificationEmail(
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

    await authService.resendVerificationEmail(email);

    return response.status(200).json({
      success: true,
      message: "Verification email resent successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "User not found") {
        return response.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message === "Email already verified") {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}
