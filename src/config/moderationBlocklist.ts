/**
 * Policy blocklist for Jevah: sexual, profane, and non-gospel secular slang
 * common in Nigeria (Pidgin, code-switching, and local languages in Latin script).
 * Used in addition to AI moderation — catches terms models often miss or downplay.
 */

/** Phrase / token checks (case-insensitive substring after NFKC normalize).
 * NOTE: Do NOT list context-dependent slang (e.g. yansh/bumbum) here — pastors may quote
 * or condemn such language in sermons; the AI uses transcript + video frames for context.
 */
export const MODERATION_BLOCKED_PHRASES: string[] = [
  // Nigerian Pidgin — stronger signals of non-sermon sexual/transactional content
  "ashawo",
  "olosho",
  "oloshi",
  "runs girl",
  "runsgirl",
  "runs man",
  "tap that",
  "tap current",
  "doggy style",
  "quickie",
  "strip club",
  "masturbat",
  // Additional Pidgin / street slang (sexual or transactional)
  "knack me",
  "i go knack",
  "come knack",
];

/**
 * Regex patterns (case-insensitive) for English profanity and tokens needing word boundaries
 * (avoids false positives like "cocktail", "Essex", "benedick").
 */
export const MODERATION_BLOCKED_REGEX: RegExp[] = [
  /\b(?:fuck|f\*ck|fck)\b/i,
  /\b(?:shit|bullshit)\b/i,
  /\b(?:bitch|bitches)\b/i,
  /\b(?:nigga|niggas)\b/i,
  /\b(?:porn|porno|xxx)\b/i,
  /\b(?:slut|hoe|whore)\b/i,
  /\b(?:dick|dicks)\b/i,
  /\b(?:cock|cocks)\b/i,
  /\bcunt\b/i,
  /\b(?:pussy|pussies)\b/i,
  /\b(?:cum|cumshot)\b/i,
  /\b(?:blow ?job)\b/i,
];

export interface BlocklistMatch {
  matched: true;
  phrase?: string;
  pattern?: string;
}

export function matchModerationBlocklist(text: string): BlocklistMatch | null {
  if (!text || typeof text !== "string") {
    return null;
  }
  const normalized = text.toLowerCase().normalize("NFKC");

  for (const phrase of MODERATION_BLOCKED_PHRASES) {
    const p = phrase.toLowerCase();
    if (normalized.includes(p)) {
      return { matched: true, phrase };
    }
  }

  for (const re of MODERATION_BLOCKED_REGEX) {
    if (re.test(normalized)) {
      return { matched: true, pattern: re.source };
    }
  }

  return null;
}
