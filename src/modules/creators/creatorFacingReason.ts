/**
 * Creator-facing moderation copy. Internal AI flags/reasons stay off emails
 * and inbox — creators get a plain sentence they can act on.
 */
export const JEVAH_GOSPEL_STANDARD =
  "Jevah publishes worship, Scripture, and teaching centered on Jesus Christ.";

export type CreatorFacingOutcome =
  | "approved"
  | "rejected"
  | "under_review"
  | "pending";

const SAFETY_FLAG_PARTS = [
  "nsfw",
  "sexual_scene",
  "violence",
  "gore",
  "weapons",
  "drugs",
  "inappropriate_content",
  "policy_blocklist",
  "off_theme_or_unsafe",
];

const INTERNAL_REASON =
  /content guardian|gemini|gospel:\d|gray-zone|gray zone|offline moderation|fusion_|requires_human|checksum|ai budget|provider_unavailable|insufficient evidence|content_hash|spoken_word_of_god|church_scene/i;

function isSafety(flags: string[] = [], internalReason?: string): boolean {
  const blob = flags.join(" ").toLowerCase();
  if (SAFETY_FLAG_PARTS.some(part => blob.includes(part))) return true;
  return /nsfw|nudity|nude|porn|violence|gore|weapon|drugs|sexual|inappropriate|blocklist/i.test(
    internalReason || ""
  );
}

function looksInternal(text: string): boolean {
  return INTERNAL_REASON.test(text);
}

function withStandard(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return JEVAH_GOSPEL_STANDARD;
  if (trimmed.includes(JEVAH_GOSPEL_STANDARD)) return trimmed;
  return `${trimmed} ${JEVAH_GOSPEL_STANDARD}`;
}

/**
 * Sentence shown in email, inbox, and Studio when an upload is held or rejected.
 * Admin notes win when they are written for a person, not an internal log.
 */
export function creatorFacingModerationReason(input: {
  outcome: CreatorFacingOutcome;
  adminNotes?: string;
  flags?: string[];
  internalReason?: string;
}): string {
  if (input.outcome === "approved") return "";

  const notes = input.adminNotes?.trim();
  if (notes && !looksInternal(notes)) {
    return withStandard(notes);
  }

  const flags = input.flags || [];
  if (flags.includes("checksum_mismatch")) {
    return "This upload couldn’t be published because the file didn’t match what was sent. Please try uploading again.";
  }

  if (input.outcome === "rejected") {
    if (isSafety(flags, input.internalReason)) {
      return `This upload couldn’t be published because it didn’t meet Jevah’s safety standards. ${JEVAH_GOSPEL_STANDARD}`;
    }
    return `This upload wasn’t published. ${JEVAH_GOSPEL_STANDARD} General motivation or videos that aren’t Christ-centered don’t go on the platform.`;
  }

  return `We’re reviewing this upload before it can go live. ${JEVAH_GOSPEL_STANDARD}`;
}

export function isHoldOrRejectOutcome(
  status: string
): status is "rejected" | "under_review" | "pending" {
  return (
    status === "rejected" || status === "under_review" || status === "pending"
  );
}
