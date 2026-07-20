import { ModerationCase } from "../../models/moderationCase.model";
import type { ModerationResult } from "../contentModeration.service";
import {
  MODERATION_POLICY_VERSION,
  MODERATION_PROMPT_VERSION,
} from "./geminiConfig";
import { createHash } from "crypto";
import logger from "../../utils/logger";

/** Persist a ModerationCase after Media.create when moderation ran without mediaId. */
export async function persistModerationDecision(params: {
  mediaId: string;
  contentHash?: string;
  result: ModerationResult;
  title?: string;
  description?: string;
  transcript?: string;
  frameCount?: number;
  hasThumbnail?: boolean;
}): Promise<void> {
  try {
    const evidenceHashes = [
      createHash("sha256")
        .update(
          `${params.title || ""} ${params.description || ""} ${params.transcript || ""}`.slice(
            0,
            8000
          )
        )
        .digest("hex")
        .slice(0, 32),
    ];
    await ModerationCase.create({
      mediaId: params.mediaId,
      contentHash: params.contentHash,
      provider: params.result.modelId ? "google-gemini" : "offline",
      modelId: params.result.modelId,
      promptVersion: MODERATION_PROMPT_VERSION,
      policyVersion: MODERATION_POLICY_VERSION,
      evidenceHashes,
      modalityCoverage: {
        title: !!params.title,
        description: !!params.description,
        transcript: !!params.transcript,
        thumbnail: !!params.hasThumbnail,
        frames: (params.frameCount || 0) > 0,
        frameCount: params.frameCount || 0,
      },
      languageCandidates: params.result.languageCandidates || [],
      decision: {
        isApproved: params.result.isApproved,
        confidence: params.result.confidence,
        reason: params.result.reason,
        flags: params.result.flags || [],
        requiresReview: params.result.requiresReview,
      },
    });
  } catch (err: any) {
    logger.warn("persistModerationDecision failed", { error: err?.message });
  }
}
