import { Request, Response, NextFunction } from "express";
import authService from "../../service/auth.service";
import { AccountBannedError } from "../../service/auth/shared";
import { isAuthError, sendAuthError } from "../../modules/auth/authErrors";
import { maybeSetRefreshCookie } from "../../modules/auth/refreshCookie";
import { registerNextStep } from "../../modules/auth/nextStep";
import {
  issueAuthSession,
  publicWebOrigin,
  readEmailVerifyLinkToken,
} from "../../modules/auth/sessionIssue";
import { RESEND_COOLDOWN_SEC } from "../../modules/auth/otp";
import { normalizeEmail } from "../../service/auth/register.service";

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

    maybeSetRefreshCookie(response, rememberMe, result.refreshToken);

    return response.status(200).json({
      success: true,
      message: "Login successful",
      token: result.accessToken,
      accessToken: result.accessToken,
      user: result.user,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType || "Bearer",
      rememberMe: rememberMe,
      nextStep: result.user.nextStep,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return sendAuthError(response, error);
    }
    if (error instanceof AccountBannedError) {
      return response.status(403).json({
        success: false,
        code: "BANNED",
        message: error.message,
        banReason: error.banReason,
        banUntil: error.banUntil,
      });
    }
    if (error instanceof Error) {
      if (error.message === "Invalid email or password") {
        return response.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          message: error.message,
        });
      }
      if (error.message === "Please verify your email before logging in") {
        return response.status(422).json({
          success: false,
          code: "EMAIL_NOT_VERIFIED",
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
    const code = request.body?.code;
    const email = request.body?.email;
    const rememberMe = Boolean(request.body?.rememberMe);
    const sessionUserId = request.userId;

    if (!code) {
      return response.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Verification code is required.",
        fields: { code: "Enter the 6-digit code." },
      });
    }

    if (!email && !sessionUserId) {
      return response.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Email and verification code are required.",
        fields: { email: "Email is required unless you are signed in." },
      });
    }

    const user = sessionUserId && !email
      ? await authService.verifyEmailForUserId(sessionUserId, code)
      : await authService.verifyEmail(String(email || ""), code);

    const session = await issueAuthSession(user, {
      rememberMe: rememberMe || true,
      deviceInfo: request.headers["user-agent"] || "Unknown",
      ipAddress: request.ip || request.socket.remoteAddress || "Unknown",
      userAgent: request.headers["user-agent"] || "",
    });
    maybeSetRefreshCookie(response, true, session.refreshToken);

    return response.status(200).json({
      success: true,
      message: "Email verified successfully",
      accessToken: session.accessToken,
      token: session.accessToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
      user: session.user,
      nextStep: session.user.nextStep || registerNextStep(true),
    });
  } catch (error) {
    if (isAuthError(error)) {
      return sendAuthError(response, error);
    }
    if (error instanceof Error) {
      if (error.message === "Invalid email or code") {
        return response.status(400).json({
          success: false,
          code: "INVALID_CODE",
          message: "That code is incorrect.",
        });
      }
      if (error.message === "Verification code expired") {
        return response.status(400).json({
          success: false,
          code: "CODE_EXPIRED",
          message: "That code has expired. Resend a new code.",
        });
      }
    }
    return next(error);
  }
}

export async function verifyEmailLink(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const token = String(request.query.token || "");
    const web = publicWebOrigin();
    const parsed = readEmailVerifyLinkToken(token);
    if (!parsed) {
      return response.redirect(`${web}/creators/verify?status=expired`);
    }

    const user = await authService.verifyEmailByLinkToken(parsed.userId);
    const session = await issueAuthSession(user, { rememberMe: true });
    maybeSetRefreshCookie(response, true, session.refreshToken);
    return response.redirect(`${web}/creators/verify?status=ok`);
  } catch (error) {
    if (isAuthError(error) && error.code === "ALREADY_VERIFIED") {
      return response.redirect(
        `${publicWebOrigin()}/creators/verify?status=ok`
      );
    }
    if (isAuthError(error)) {
      return response.redirect(
        `${publicWebOrigin()}/creators/verify?status=expired`
      );
    }
    return next(error);
  }
}

export async function resendVerificationEmail(
  request: Request,
  response: Response,
  _next: NextFunction
) {
  const rawEmail = request.body?.email || "";
  const email = rawEmail ? normalizeEmail(String(rawEmail)) : "";

  if (!email) {
    return response.status(200).json({
      success: true,
      message: "If an account needs verification, we sent a new code.",
      retryAfterSec: RESEND_COOLDOWN_SEC,
    });
  }

  try {
    const result = await authService.resendVerificationEmail(email);
    if (result.retryAfterSec > 0 && !result.sent) {
      response.setHeader("Retry-After", String(result.retryAfterSec));
    }
    return response.status(200).json({
      success: true,
      message: "If an account needs verification, we sent a new code.",
      retryAfterSec: result.retryAfterSec || RESEND_COOLDOWN_SEC,
    });
  } catch {
    return response.status(200).json({
      success: true,
      message: "If an account needs verification, we sent a new code.",
      retryAfterSec: RESEND_COOLDOWN_SEC,
    });
  }
}
