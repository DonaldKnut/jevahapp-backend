/**
 * Policy blocklist for Jevah: sexual, profane, and non-gospel secular slang
 * common in Nigeria (Pidgin, code-switching, and local languages in Latin script).
 * Used in addition to AI moderation — catches terms models often miss or downplay.
 *
 * Hard matches → immediate reject.
 * Soft matches → signals for AI / manual review (ambiguous English tokens / name collisions).
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

/** Unambiguous severe English / policy regex — hard reject */
export const MODERATION_HARD_REGEX: RegExp[] = [
  /\b(?:fuck(?:ing|er|ed|s)?|f\*ck|fck)\b/i,
  /\b(?:shit|bullshit)\b/i,
  /\b(?:bitch|bitches)\b/i,
  /\b(?:nigga|niggas)\b/i,
  /\b(?:porn|porno|xxx)\b/i,
  /\bcunt\b/i,
  /\b(?:pussy|pussies)\b/i,
  /\b(?:blow ?job)\b/i,
];

/**
 * Ambiguous tokens that can appear as names, Bible quotes, or quoted rebuke —
 * soft signal only (never auto-approve offline; AI/review decides).
 */
export const MODERATION_SOFT_REGEX: RegExp[] = [
  /\b(?:slut|hoe|whore)\b/i,
  /\b(?:dick|dicks)\b/i,
  /\b(?:cock|cocks)\b/i,
  /\b(?:cum|cumshot)\b/i,
];

/** @deprecated alias — prefer MODERATION_HARD_REGEX + MODERATION_SOFT_REGEX */
export const MODERATION_BLOCKED_REGEX: RegExp[] = [
  ...MODERATION_HARD_REGEX,
  ...MODERATION_SOFT_REGEX,
];

export interface BlocklistMatch {
  matched: true;
  phrase?: string;
  pattern?: string;
  /** soft = signal only (AI / review); hard = immediate reject */
  severity: "hard" | "soft";
}

export function matchModerationBlocklist(text: string): BlocklistMatch | null {
  if (!text || typeof text !== "string") {
    return null;
  }
  const normalized = text.toLowerCase().normalize("NFKC");

  for (const phrase of MODERATION_BLOCKED_PHRASES) {
    const p = phrase.toLowerCase();
    if (normalized.includes(p)) {
      return { matched: true, phrase, severity: "hard" };
    }
  }

  for (const re of MODERATION_HARD_REGEX) {
    if (re.test(normalized)) {
      return { matched: true, pattern: re.source, severity: "hard" };
    }
  }

  for (const re of MODERATION_SOFT_REGEX) {
    if (re.test(normalized)) {
      return { matched: true, pattern: re.source, severity: "soft" };
    }
  }

  return null;
}
