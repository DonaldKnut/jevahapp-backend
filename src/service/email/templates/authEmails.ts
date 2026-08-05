import { renderEmailTemplate } from "../../../emails/render";

export function generateVerificationEmail(firstName: string, code: string): string {
  return renderEmailTemplate("verify", { firstName, code });
}

export function generatePasswordResetEmail(firstName: string, resetCode: string): string {
  return renderEmailTemplate("reset", { firstName, resetCode });
}

export function generateWelcomeEmail(firstName: string): string {
  return renderEmailTemplate("welcome", { firstName });
}
