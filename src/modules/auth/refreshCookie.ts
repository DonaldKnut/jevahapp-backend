import type { CookieOptions, Response } from "express";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Cross-site cookie for api.jevahapp.com ← www.jevahapp.com.
 * SameSite=None requires Secure. Local Vite uses SameSite=Lax over HTTP.
 */
export function refreshCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: NINETY_DAYS_MS,
    path: "/",
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie("refreshToken", token, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  const { maxAge: _maxAge, ...opts } = refreshCookieOptions();
  res.clearCookie("refreshToken", opts);
}

export function maybeSetRefreshCookie(
  res: Response,
  rememberMe: boolean,
  refreshToken?: string
): void {
  if (rememberMe && refreshToken) {
    setRefreshCookie(res, refreshToken);
  }
}
