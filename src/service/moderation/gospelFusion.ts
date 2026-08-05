/**
 * Fusion business rules: map Guardian scores (+ optional hint) → ModerationResult.
 * Clear gospel → auto-approve (no admin). Clear off-theme/unsafe → reject.
 * Gray → review (caller may escalate to Gemini).
 */
import type { ModerationInput, ModerationResult } from "./types";
import type { GuardianScoreResult } from "./guardianClient";

function envFloat(name: string, fallback: number): number {
  const n = parseFloat(process.env[name] || "");
  return Number.isFinite(n) ? n : fallback;
}

export function getFusionThresholds() {
  return {
    nsfwReject: envFloat("FUSION_NSFW_REJECT", 0.65),
    nsfwSafe: envFloat("FUSION_NSFW_SAFE", 0.25),
    christianSceneApprove: envFloat("FUSION_CHRISTIAN_SCENE_APPROVE", 0.55),
    gospelSceneApprove: envFloat("FUSION_GOSPEL_SCENE_APPROVE", 0.55),
    gospelTextStrong: envFloat("FUSION_GOSPEL_TEXT_STRONG", 0.7),
    gospelTextWeak: envFloat("FUSION_GOSPEL_TEXT_WEAK", 0.3),
    secularSceneReject: envFloat("FUSION_SECULAR_SCENE_REJECT", 0.55),
    secularSceneSafe: envFloat("FUSION_SECULAR_SCENE_SAFE", 0.45),
    antiGospelReject: envFloat("FUSION_ANTI_GOSPEL_REJECT", 0.5),
  };
}

export type FusionDecision = "approve" | "reject" | "review";

export interface FusionOutcome {
  decision: FusionDecision;
  confidence: number;
  signals: string[];
  scores: {
    gospel_score: number;
    anti_gospel_score: number;
    secular_text_score: number;
    nsfw_score: number;
    christian_scene_score: number;
    secular_scene_score: number;
  };
}

export function fuseGuardianScores(
  scores: GuardianScoreResult,
  contentType?: string
): FusionOutcome {
  const t = getFusionThresholds();
  const gospel = scores.gospel_score ?? 0;
  const anti = scores.anti_gospel_score ?? 0;
  const secularText = scores.secular_text_score ?? 0;
  const nsfw = scores.nsfw_score ?? 0;
  const christian = scores.christian_scene_score ?? 0;
  const secularScene = scores.secular_scene_score ?? 0;
  const secularCombined = Math.max(secularScene, secularText * 0.85);
  const ct = (contentType || "").toLowerCase();
  const signals = [...(scores.signals || [])];

  const pack = (
    decision: FusionDecision,
    confidence: number,
    extra: string[]
  ): FusionOutcome => ({
    decision,
    confidence,
    signals: [...new Set([...signals, ...extra])],
    scores: {
      gospel_score: gospel,
      anti_gospel_score: anti,
      secular_text_score: secularText,
      nsfw_score: nsfw,
      christian_scene_score: christian,
      secular_scene_score: secularScene,
    },
  });

  if (nsfw >= t.nsfwReject) {
    return pack("reject", 0.92, ["nsfw_reject"]);
  }

  if (anti >= t.antiGospelReject && gospel < 0.45) {
    return pack("reject", 0.88, ["anti_gospel_reject"]);
  }

  if (
    gospel < t.gospelTextWeak &&
    (secularCombined >= t.secularSceneReject || anti >= t.antiGospelReject)
  ) {
    return pack("reject", 0.85, ["secular_off_theme"]);
  }

  if (
    christian >= t.christianSceneApprove &&
    gospel >= t.gospelSceneApprove &&
    nsfw < t.nsfwSafe
  ) {
    return pack("approve", 0.9, ["church_scene_gospel"]);
  }

  if (
    gospel >= t.gospelTextStrong &&
    nsfw < t.nsfwSafe &&
    secularCombined < t.secularSceneSafe
  ) {
    return pack("approve", 0.86, ["strong_gospel_text"]);
  }

  if (
    ["music", "audio", "podcast", "books", "ebook"].includes(ct) &&
    gospel >= t.gospelTextStrong &&
    anti < 0.35
  ) {
    return pack("approve", 0.84, ["audio_book_gospel"]);
  }

  if (gospel < 0.35 && secularText >= 0.5 && christian < 0.35) {
    return pack("reject", 0.8, ["secular_entertainment"]);
  }

  const hint = scores.decision_hint;
  if (hint === "approve" && (scores.confidence ?? 0) >= 0.8) {
    return pack("approve", scores.confidence ?? 0.8, ["guardian_hint_approve"]);
  }
  if (hint === "reject" && (scores.confidence ?? 0) >= 0.8) {
    return pack("reject", scores.confidence ?? 0.8, ["guardian_hint_reject"]);
  }

  return pack("review", Math.min(0.55, scores.confidence ?? 0.45), [
    "gray_zone",
  ]);
}

export function fusionToModerationResult(
  outcome: FusionOutcome,
  _input: ModerationInput
): ModerationResult {
  const flags = [
    ...outcome.signals,
    `gospel:${outcome.scores.gospel_score.toFixed(2)}`,
    `nsfw:${outcome.scores.nsfw_score.toFixed(2)}`,
  ];

  if (outcome.decision === "approve") {
    return {
      isApproved: true,
      confidence: outcome.confidence,
      reason:
        "Approved by Content Guardian (gospel-aligned, safe). No admin review required.",
      flags: [...flags, "content_guardian", "auto_publish"],
      requiresReview: false,
      modelId: "content-guardian",
    };
  }

  if (outcome.decision === "reject") {
    return {
      isApproved: false,
      confidence: outcome.confidence,
      reason:
        "Rejected by Content Guardian — content does not match Christian/gospel platform theme or failed safety checks.",
      flags: [...flags, "content_guardian", "off_theme_or_unsafe"],
      requiresReview: false,
      modelId: "content-guardian",
    };
  }

  return {
    isApproved: false,
    confidence: outcome.confidence,
    reason:
      "Borderline content — escalated for AI gray-zone review or human queue",
    flags: [...flags, "content_guardian", "requires_human_or_ai_review"],
    requiresReview: true,
    modelId: "content-guardian",
  };
}
