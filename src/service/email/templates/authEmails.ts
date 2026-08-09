import { renderEmailTemplate } from "../../../emails/render";

export type WelcomeEmailVariant = "default" | "artist";

export function generateVerificationEmail(firstName: string, code: string): string {
  return renderEmailTemplate("verify", { firstName, code });
}

export function generatePasswordResetEmail(firstName: string, resetCode: string): string {
  return renderEmailTemplate("reset", { firstName, resetCode });
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
      studioUrl: `${base}/creators`,
    });
  }
  return renderEmailTemplate("welcome", { firstName });
}
