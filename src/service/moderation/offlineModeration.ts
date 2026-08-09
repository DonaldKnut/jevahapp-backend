/**
 * Offline / AI-down moderation: blocklist, profanity, gospel heuristics.
 * Used when Gemini is unavailable or returns API errors.
 * Content Guardian is preferred when available; this is the last-resort brain.
 */
import { matchModerationBlocklist } from "../../config/moderationBlocklist";
import {
  ModerationInput,
  ModerationResult,
  detectLanguageCandidates,
  policyText,
} from "./types";

const GOSPEL_STRONG =
  /\b(?:jesus|christ|gospel|bible|scripture|worship|hallelujah|hosanna|sermon|pastor|holy\s+spirit|kingdom\s+of\s+god|word\s+of\s+god|oluwa|chukwu|chineke|yesu|jesu|prayer|amen|salvation|redemption|repentance|born\s+again|halleluyah|holy\s+ghost|blood\s+of\s+jesus|testimony|congregation|choir|ministry)\b/i;

const ANTI_GOSPEL =
  /\b(?:porn|porno|xxx|nude|nudity|strip\s+club|nightclub|onlyfans|ashawo|olosho|twerk|blaspheme|blasphemy)\b/i;

export function hasStrongGospelSignal(input: ModerationInput): boolean {
  const text = policyText(input).toLowerCase();
  const title = (input.title || "").toLowerCase();
  const titleHit = GOSPEL_STRONG.test(title);
  const bodyHit = GOSPEL_STRONG.test(text);
  if (ANTI_GOSPEL.test(text) && !titleHit) {
    return false;
  }
  if (
    titleHit &&
    (input.thumbnail ||
      (input.videoFrames && input.videoFrames.length > 0) ||
      bodyHit)
  ) {
    return true;
  }
  if (
    bodyHit &&
    (input.thumbnail || (input.transcript && input.transcript.length > 40))
  ) {
    return true;
  }
  return false;
}

export function hasAntiGospelSignal(input: ModerationInput): boolean {
  return ANTI_GOSPEL.test(policyText(input));
}

/**
 * Hard-reject severe signals; soft gospel → quarantine candidate.
 */
export function basicModeration(input: ModerationInput): ModerationResult {
  const block = matchModerationBlocklist(policyText(input));
  if (block && block.severity !== "soft") {
    return {
      isApproved: false,
      confidence: 0.9,
      reason: "Policy blocklist (offline moderation)",
      flags: ["policy_blocklist", "inappropriate_content"],
      requiresReview: false,
    };
  }

  const text = policyText(input).toLowerCase();
  const strongProfanityPattern =
    /\b(?:fuck|fucking|fucker|motherfucker|shit|bullshit|bitch|bitches|nigga|niggas|pussy|cunt|slut|whore)\b/i;
  const severeThemes =
    /\b(?:porn|porno|xxx|nude|nudity|blaspheme|blasphemy|strip\s+club)\b/i;

  if (strongProfanityPattern.test(text) || severeThemes.test(text)) {
    return {
      isApproved: false,
      confidence: 0.85,
      reason: "Severe policy terms detected (offline moderation)",
      flags: ["inappropriate_content"],
      requiresReview: false,
    };
  }

  if (GOSPEL_STRONG.test(text)) {
    return {
      isApproved: false,
      confidence: 0.4,
      reason:
        "Possible Christian content detected offline — queued for manual review (AI unavailable)",
      flags: ["possible_gospel", "requires_human_review"],
      requiresReview: true,
    };
  }

  return {
    isApproved: false,
    confidence: 0.2,
    reason: "Insufficient offline evidence — queued for manual review",
    flags: ["insufficient_evidence", "requires_human_review"],
    requiresReview: true,
  };
}

/**
 * Full offline path when AI is down:
 * hard-reject → provisional gospel approve → else quarantine.
 */
export function offlineModeration(
  input: ModerationInput,
  opts?: { reasonTag?: string; aiError?: string; modelId?: string | null }
): ModerationResult {
  const languages = detectLanguageCandidates(policyText(input));
  const base = basicModeration(input);
  const tag = opts?.reasonTag || "offline_moderation";
  const flags = [...(base.flags || []), tag];
  if (opts?.aiError) flags.push("ai_error");

  if (!base.isApproved && !base.requiresReview) {
    return {
      ...base,
      flags,
      languageCandidates: languages,
      modelId: opts?.modelId || undefined,
    };
  }

  if (flags.includes("possible_gospel") || hasStrongGospelSignal(input)) {
    // Opt-in only — default is quarantine until AI/human reviews (safer for Contabo ops)
    const allowOfflineApprove =
      process.env.MODERATION_OFFLINE_PROVISIONAL_APPROVE === "true";
    if (
      allowOfflineApprove &&
      hasStrongGospelSignal(input) &&
      !hasAntiGospelSignal(input)
    ) {
      return {
        isApproved: true,
        confidence: 0.55,
        reason:
          "Provisionally approved offline (strong gospel signals). Flagged needs_ai_recheck — keep MODERATION_OFFLINE_PROVISIONAL_APPROVE=true only if ops re-scan the queue.",
        flags: [
          ...flags.filter(f => f !== "requires_human_review"),
          "offline_provisional_approve",
          "needs_ai_recheck",
        ],
        requiresReview: false,
        languageCandidates: languages,
        modelId: opts?.modelId || undefined,
      };
    }
  }

  return {
    isApproved: false,
    confidence: base.confidence || 0.2,
    reason:
      base.reason ||
      "AI moderation unavailable — queued for manual review (offline checks passed)",
    flags: [...new Set([...flags, "requires_human_review"])],
    requiresReview: true,
    languageCandidates: languages,
    modelId: opts?.modelId || undefined,
  };
}
