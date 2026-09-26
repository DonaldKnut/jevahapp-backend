import ejs from "ejs";
import fs from "fs";
import path from "path";

const TEMPLATES_DIR = path.join(__dirname, "templates");

export const DEFAULT_EMAIL_LOGO_URL =
  "https://res.cloudinary.com/bt01nio6/image/upload/v1790381597/jevahha-removebg-preview.png";

export function emailLogoUrl(): string {
  return (process.env.JEVAH_EMAIL_LOGO_URL || DEFAULT_EMAIL_LOGO_URL).trim();
}

/**
 * Synchronously render an email EJS template by name (e.g. "verify").
 * Partials resolve relative to src/emails/templates (copied to dist on build).
 */
export function renderEmailTemplate(
  name: string,
  data: Record<string, unknown> = {}
): string {
  const templatePath = path.join(TEMPLATES_DIR, `${name}.ejs`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templatePath}`);
  }

  const source = fs.readFileSync(templatePath, "utf8");

  try {
    return ejs.render(
      source,
      { logoUrl: emailLogoUrl(), ...data },
      {
        filename: templatePath,
        cache: process.env.NODE_ENV === "production",
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render email template "${name}": ${message}`);
  }
}
