import {
  generateNumericOtp,
  isOtpLocked,
  otpExpiresAt,
  resendRetryAfterSec,
  OTP_TTL_MS,
  RESEND_COOLDOWN_SEC,
} from "../otp";

describe("otp helpers", () => {
  it("generates a 6-digit numeric code", () => {
    const code = generateNumericOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("sets expiry about 12 minutes out", () => {
    const now = Date.parse("2026-09-25T16:00:00.000Z");
    const expires = otpExpiresAt(now);
    expect(expires.getTime() - now).toBe(OTP_TTL_MS);
  });

  it("computes resend cooldown", () => {
    const now = Date.parse("2026-09-25T16:00:00.000Z");
    expect(resendRetryAfterSec(undefined, now)).toBe(0);
    expect(resendRetryAfterSec(new Date(now - 10_000), now)).toBe(
      RESEND_COOLDOWN_SEC - 10
    );
    expect(resendRetryAfterSec(new Date(now - 120_000), now)).toBe(0);
  });

  it("detects OTP lock windows", () => {
    const now = Date.parse("2026-09-25T16:00:00.000Z");
    expect(isOtpLocked(undefined, now)).toBe(false);
    expect(isOtpLocked(new Date(now + 60_000), now)).toBe(true);
    expect(isOtpLocked(new Date(now - 1_000), now)).toBe(false);
  });
});
