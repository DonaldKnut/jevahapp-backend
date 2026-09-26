import { Request, Response, NextFunction } from "express";
import authService from "../../service/auth.service";
import { isAuthError, sendAuthError } from "../../modules/auth/authErrors";
import { assertPasswordPolicy } from "../../modules/auth/passwordPolicy";
import {
  normalizePersonName,
  normalizeRegisterEmail,
} from "../../modules/auth/registerFields";
import { maybeSetRefreshCookie } from "../../modules/auth/refreshCookie";
import { registerNextStep } from "../../modules/auth/nextStep";
import { issueAuthSession } from "../../modules/auth/sessionIssue";
import { normalizeSignupSource } from "../../modules/auth/signupSource";
import { getPlatformConfig } from "../../service/admin/platformConfig.service";

function requestDevice(request: Request) {
  return {
    deviceInfo: request.headers["user-agent"] || "Unknown",
    ipAddress: request.ip || request.socket.remoteAddress || "Unknown",
    userAgent: request.headers["user-agent"] || "",
  };
}

export async function getRegistrationStatus(
  _request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const cfg = await getPlatformConfig();
    const enabled = cfg.registrationEnabled !== false && !cfg.maintenanceMode;
    return response.status(200).json({
      success: true,
      registrationEnabled: enabled,
      message: enabled
        ? null
        : cfg.maintenanceMode
          ? cfg.maintenanceMessage ||
            "New accounts are paused. Sign in if you already have a Jevah account."
          : "New accounts are paused. Sign in if you already have a Jevah account.",
    });
  } catch (error) {
    return next(error);
  }
}

export async function registerUser(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const firstName = normalizePersonName(request.body?.firstName, "firstName");
    const lastName = normalizePersonName(request.body?.lastName, "lastName");
    const email = normalizeRegisterEmail(request.body?.email);
    const password = String(request.body?.password ?? "");
    const rememberMe = Boolean(request.body?.rememberMe);
    const signupSource = normalizeSignupSource(request.body?.source);

    if (!password) {
      return response.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Password is required.",
        fields: { password: "Password is required." },
      });
    }

    assertPasswordPolicy(password, email);

    const user = await authService.registerUser(
      email,
      password,
      firstName,
      lastName,
      undefined,
      undefined,
      { signupSource }
    );

    const session = await issueAuthSession(user, {
      rememberMe,
      ...requestDevice(request),
    });
    maybeSetRefreshCookie(response, rememberMe, session.refreshToken);

    const nextStep =
      session.user.nextStep ||
      registerNextStep(Boolean(user.isEmailVerified));

    return response.status(201).json({
      success: true,
      accessToken: session.accessToken,
      token: session.accessToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
      user: { ...session.user, nextStep },
      nextStep,
      message: user.isEmailVerified
        ? "Account created. You can apply as a creator."
        : "Account created. Check your email to verify.",
    });
  } catch (error) {
    if (isAuthError(error)) {
      return sendAuthError(response, error);
    }
    return next(error);
  }
}

export async function registerArtist(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      artistName,
      genre,
      bio,
      socialMedia,
      recordLabel,
      yearsActive,
    } = request.body;

    const avatarFile = request.file;

    if (!email || !password || !firstName || !artistName || !genre) {
      return response.status(400).json({
        success: false,
        message:
          "Email, password, first name, artist name, and genre are required fields",
      });
    }

    if (!Array.isArray(genre) || genre.length === 0) {
      return response.status(400).json({
        success: false,
        message: "Genre must be a non-empty array",
      });
    }

    const artist = await authService.registerArtist(
      email,
      password,
      firstName,
      lastName,
      artistName,
      genre,
      bio,
      socialMedia,
      recordLabel,
      yearsActive,
      avatarFile?.buffer,
      avatarFile?.mimetype
    );

    return response.status(201).json({
      success: true,
      message:
        "Artist registered successfully. Please verify your email — a code was sent to your inbox. Welcome email arrives after verification.",
      artist,
      needsEmailVerification: true,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return sendAuthError(response, error);
    }
    if (error instanceof Error) {
      if (error.message === "Email address is already registered") {
        return response.status(409).json({
          success: false,
          code: "EMAIL_TAKEN",
          message: "That email already has a Jevah account. Sign in instead.",
          fields: { email: "That email already has a Jevah account." },
        });
      }
      if (error.message.includes("Unable to send welcome email")) {
        return response.status(500).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("Invalid genres")) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("Artist name")) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}

export async function verifyArtist(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { userId } = request.params;
    const { verificationDocuments } = request.body;

    if (!verificationDocuments || !Array.isArray(verificationDocuments)) {
      return response.status(400).json({
        success: false,
        message: "Verification documents array is required",
      });
    }

    const artist = await authService.verifyArtist(
      userId,
      verificationDocuments
    );

    return response.status(200).json({
      success: true,
      message: "Artist verified successfully",
      artist,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return response.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("not an artist")) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}

export async function updateArtistProfile(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { userId } = request.params;
    const updates = request.body;

    if (request.userId !== userId) {
      return response.status(403).json({
        success: false,
        message: "You can only update your own artist profile",
      });
    }

    const artist = await authService.updateArtistProfile(userId, updates);

    return response.status(200).json({
      success: true,
      message: "Artist profile updated successfully",
      artist,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return response.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("not an artist")) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (
        error.message.includes("Artist name") ||
        error.message.includes("genre")
      ) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}
