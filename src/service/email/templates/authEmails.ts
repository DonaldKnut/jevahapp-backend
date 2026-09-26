import { renderEmailTemplate } from "../../../emails/render";

export type WelcomeEmailVariant = "default" | "artist";

const WEB_ORIGIN = (
  process.env.FRONTEND_URL || "https://www.jevahapp.com"
).replace(/\/$/, "");

export function generateVerificationEmail(
  firstName: string,
  code: string,
  verifyLink?: string
): string {
  return renderEmailTemplate("verify", {
    firstName,
    code,
    verifyUrl: verifyLink || `${WEB_ORIGIN}/creators/verify`,
  });
}

export function generatePasswordResetEmail(
  firstName: string,
  resetCode: string,
  resetUrl?: string
): string {
  return renderEmailTemplate("reset", {
    firstName,
    resetCode,
    resetUrl: resetUrl || `${WEB_ORIGIN}/creators/reset`,
  });
}

export function generateWelcomeEmail(
  firstName: string,
  variant: WelcomeEmailVariant = "default"
): string {
  if (variant === "artist") {
    const base = (process.env.FRONTEND_URL || "https://www.jevahapp.com").replace(
      /\/$/,
      ""
    );
    return renderEmailTemplate("welcome-artist", {
      firstName,
      studioUrl: `${base}/creators/apply`,
    });
  }
  return renderEmailTemplate("welcome", { firstName });
}
