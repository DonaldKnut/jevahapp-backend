import { createHash } from "crypto";
import { Media } from "../../models/media.model";
import { ModerationCase } from "../../models/moderationCase.model";
import {
  MODERATION_POLICY_VERSION,
  MODERATION_PROMPT_VERSION,
  getActiveModerationModelId,
} from "./geminiConfig";
import type { ModerationResult } from "../contentModeration.service";
import logger from "../../utils/logger";

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256HexFromString(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

const NON_REUSABLE_FLAGS = [
  "insufficient_evidence",
  "moderation_service_error",
  "moderation_parse_error",
  "provider_unavailable",
  "ai_budget_exhausted",
];

/**
 * Decision-only reuse: same file bytes + same policy/prompt versions.
 * Never reuses storage objects across users.
 */
export async function findReusableModerationDecision(
  contentHash: string
): Promise<ModerationResult | null> {
  if (!contentHash || contentHash.length < 32) return null;

  const priorMedia = (await Media.findOne({
    contentHash,
    moderationStatus: { $in: ["approved", "rejected", "under_review"] },
    "moderationResult.moderatedAt": { $exists: true },
  })
    .sort({ "moderationResult.moderatedAt": -1 })
    .select("moderationStatus moderationResult")
    .lean()) as {
    moderationStatus?: string;
    moderationResult?: any;
  } | null;

  if (!priorMedia?.moderationResult) return null;

  const priorCase = (await ModerationCase.findOne({
    contentHash,
    promptVersion: MODERATION_PROMPT_VERSION,
    policyVersion: MODERATION_POLICY_VERSION,
    modelId: getActiveModerationModelId(),
  })
    .sort({ createdAt: -1 })
    .lean()) as {
    decision?: {
      isApproved: boolean;
      confidence: number;
      reason?: string;
      flags?: string[];
      requiresReview?: boolean;
    };
  } | null;

  if (!priorCase) {
    // Allow reuse from media.moderationResult only when versions unknown but
    // decision was hard reject / clear approve without error flags — still require case when possible.
    logger.info("contentHash hit without matching ModerationCase; skipping reuse", {
      contentHash: contentHash.slice(0, 12),
    });
    return null;
  }

  const flags = priorCase.decision?.flags || [];
  if (flags.some((f: string) => NON_REUSABLE_FLAGS.includes(f))) {
    return null;
  }

  const d = priorCase.decision!;
  return {
    isApproved: d.isApproved === true && !d.requiresReview,
    confidence: d.confidence,
    reason: `Reused prior moderation decision (${contentHash.slice(0, 12)}…) — ${d.reason || ""}`.trim(),
    flags: [...flags, "content_hash_dedup"],
    requiresReview:
      d.requiresReview === true ||
      (!d.isApproved && priorMedia.moderationStatus === "under_review"),
  };
}

export async function applyReusedDecisionToMedia(
  mediaId: string,
  result: ModerationResult
): Promise<void> {
  const status = result.requiresReview
    ? "under_review"
    : result.isApproved
      ? "approved"
      : "rejected";
  await Media.findByIdAndUpdate(mediaId, {
    moderationStatus: status,
    // Approved still stays hidden until derivatives are published
    isHidden: true,
    publicationState:
      status === "approved"
        ? "publishing"
        : status === "rejected"
          ? "tombstoned"
          : "staged",
    moderationResult: {
      isApproved: result.isApproved,
      confidence: result.confidence,
      reason: result.reason,
      flags: result.flags,
      requiresReview: result.requiresReview,
      moderatedAt: new Date(),
    },
  });
}
