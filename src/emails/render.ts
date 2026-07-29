import ejs from "ejs";
import fs from "fs";
import path from "path";

const TEMPLATES_DIR = path.join(__dirname, "templates");

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
    return ejs.render(source, data, {
      filename: templatePath,
      cache: process.env.NODE_ENV === "production",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render email template "${name}": ${message}`);
  }
}
