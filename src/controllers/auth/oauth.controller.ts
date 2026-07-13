import { Request, Response, NextFunction } from "express";
import authService from "../../service/auth.service";

export async function clerkLogin(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { token, userInfo } = request.body;

    if (!token) {
      return response.status(400).json({
        success: false,
        message: "Clerk authentication token is required",
      });
    }

    if (!userInfo || typeof userInfo !== "object") {
      return response.status(400).json({
        success: false,
        message: "User information object is required",
      });
    }

    const result = await authService.clerkLogin(token, userInfo);

    return response.status(200).json({
      success: true,
      message: "Clerk login successful",
      user: result.user,
      needsAgeSelection: result.needsAgeSelection,
      isNewUser: result.isNewUser,
    });
  } catch (error: any) {
    console.error("Clerk login error:", error);

    if (error.message.includes("Token")) {
      return response.status(401).json({
        success: false,
        message: "Invalid or expired Clerk token",
      });
    }

    if (error.message.includes("email")) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return response.status(500).json({
      success: false,
      message: "Authentication failed. Please try again.",
    });
  }
}

export async function oauthLogin(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { provider, token, userInfo } = request.body;

    if (!provider) {
      return response.status(400).json({
        success: false,
        message: "OAuth provider is required (e.g., 'google', 'facebook')",
      });
    }

    if (!token) {
      return response.status(400).json({
        success: false,
        message: "OAuth authentication token is required",
      });
    }

    if (!userInfo || typeof userInfo !== "object") {
      return response.status(400).json({
        success: false,
        message: "User information object is required",
      });
    }

    const result = await authService.oauthLogin(provider, token, userInfo);

    return response.status(200).json({
      success: true,
      message: `${provider} login successful`,
      token: result.token,
      user: result.user,
      isNewUser: result.isNewUser,
    });
  } catch (error: any) {
    console.error("OAuth login error:", error);

    if (error.message.includes("Token")) {
      return response.status(401).json({
        success: false,
        message: "Invalid or expired OAuth token",
      });
    }

    if (error.message.includes("email")) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("Provider")) {
      return response.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return response.status(500).json({
      success: false,
      message: "OAuth authentication failed. Please try again.",
    });
  }
}
