import logger from "../../utils/logger";
import type { ModerationInput, ModerationResult } from "./types";

export function parseModerationResponse(
  aiResponse: string,
  input: ModerationInput
): ModerationResult {
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const isApproved = parsed.isApproved === true;
      const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
      const flags: string[] = Array.isArray(parsed.flags) ? parsed.flags : [];
      const isClearGospel = flags.some(
        f =>
          typeof f === "string" &&
          /gospel|worship|biblical|christian|faith/i.test(f)
      );
      const ct = (input.contentType || "").toLowerCase();
      const isVideo = ["videos", "sermon", "live", "recording"].includes(ct);
      const hasFrameEvidence =
        !!(input.videoFrames && input.videoFrames.length > 0) ||
        !!input.thumbnail;

      let requiresReview: boolean;
      if (isVideo) {
        // Title / gospel flags must never force-publish a video.
        // Only allow auto-clear when frames exist, confidence is high, and the
        // model itself did not request review.
        if (!hasFrameEvidence) {
          requiresReview = true;
          flags.push("video_missing_visual_evidence");
        } else if (parsed.requiresReview === true) {
          requiresReview = true;
          flags.push("video_model_requested_review");
        } else if (!(isApproved && confidence >= 0.9)) {
          requiresReview = true;
          flags.push("video_low_confidence_review");
        } else {
          requiresReview = false;
        }
      } else {
        requiresReview =
          isApproved && (confidence >= 0.8 || isClearGospel)
            ? false
            : parsed.requiresReview === true;
      }

      return {
        isApproved: requiresReview && isVideo ? false : isApproved,
        confidence,
        reason: parsed.reason || "AI analysis completed",
        flags,
        requiresReview,
      };
    }

    logger.warn("Moderation response was not valid JSON; quarantining for review");
    return {
      isApproved: false,
      confidence: 0,
      reason: "Moderation response could not be parsed — queued for manual review",
      flags: ["moderation_parse_error"],
      requiresReview: true,
    };
  } catch (error) {
    logger.error("Error parsing moderation response:", error);
    return {
      isApproved: false,
      confidence: 0,
      reason: "Moderation parse error — queued for manual review",
      flags: ["moderation_parse_error"],
      requiresReview: true,
    };
  }
}
