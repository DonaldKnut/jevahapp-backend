/**
 * Admin → creator welcome (ops, not marketing opt-out).
 * Template id: creator_welcome_v1
 */
import { renderEmailTemplate } from "../../../emails/render";

export const CREATOR_WELCOME_TEMPLATE_ID = "creator_welcome_v1";
export const CREATOR_WELCOME_EJS = "creator-welcome";
export const DEFAULT_STUDIO_URL = "https://www.jevahapp.com/creators/studio";
export const DEFAULT_ONBOARD_SUBJECT = "Welcome to Jevah, {{firstName}}";

export function creatorStudioUrl(): string {
  return (
    process.env.CREATOR_STUDIO_URL ||
    DEFAULT_STUDIO_URL
  ).trim();
}

/** Artist firstName, else first word of displayName / name, else friend. */
export function resolveCreatorFirstName(params: {
  firstName?: string | null;
  displayName?: string | null;
  artistName?: string | null;
  name?: string | null;
}): string {
  const direct = String(params.firstName || "").trim();
  if (direct) return direct.split(/\s+/)[0];
  const fromDisplay = String(
    params.displayName || params.artistName || params.name || ""
  ).trim();
  if (fromDisplay) return fromDisplay.split(/\s+/)[0];
  return "friend";
}

export function interpolateCreatorTokens(
  template: string,
  firstName: string
): string {
  return String(template || "").replace(/\{\{\s*firstName\s*\}\}/gi, firstName);
}

export function resolveCreatorWelcomeSubject(
  subject: string | undefined,
  firstName: string
): string {
  const raw = (subject && subject.trim()) || DEFAULT_ONBOARD_SUBJECT;
  return interpolateCreatorTokens(raw, firstName);
}

export function artistOnboardCtaUrl(): { url: string; label: string } {
  return { url: creatorStudioUrl(), label: "Open Studio" };
}

export function buildArtistOnboardEmailHtml(params: {
  artistName?: string;
  firstName?: string;
  displayName?: string;
  optionalNote?: string;
  /** @deprecated use optionalNote — kept so old callers still compile */
  customMessageHtml?: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const firstName = resolveCreatorFirstName(params);
  const optionalNote = String(
    params.optionalNote || ""
  ).trim();
  const studioUrl = params.ctaUrl || creatorStudioUrl();

  return renderEmailTemplate(CREATOR_WELCOME_EJS, {
    firstName,
    optionalNote,
    studioUrl,
  });
}

export function plainTextToHtmlParagraphs(message: string): string {
  return String(message || "").trim();
}
