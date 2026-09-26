import crypto from "crypto";

export const OTP_TTL_MS = 12 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SEC = 60;

/** 6-digit numeric OTP for the web waiting UI and mobile verify screens. */
export function generateNumericOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function otpExpiresAt(now = Date.now()): Date {
  return new Date(now + OTP_TTL_MS);
}

export function secondsUntil(date?: Date | null, now = Date.now()): number {
  if (!date) return 0;
  return Math.max(0, Math.ceil((new Date(date).getTime() - now) / 1000));
}

export function resendRetryAfterSec(
  lastSentAt?: Date | null,
  now = Date.now()
): number {
  if (!lastSentAt) return 0;
  const elapsed = Math.floor((now - new Date(lastSentAt).getTime()) / 1000);
  return Math.max(0, RESEND_COOLDOWN_SEC - elapsed);
}

export function isOtpLocked(
  lockedUntil?: Date | null,
  now = Date.now()
): boolean {
  return Boolean(lockedUntil && new Date(lockedUntil).getTime() > now);
}
