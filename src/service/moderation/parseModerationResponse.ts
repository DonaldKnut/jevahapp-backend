import logger from "../../utils/logger";
import type { ModerationInput, ModerationResult } from "./types";

export function parseModerationResponse(
  aiResponse: string,
  _input: ModerationInput
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
      const requiresReview =
        isApproved && (confidence >= 0.8 || isClearGospel)
          ? false
          : parsed.requiresReview === true;
      return {
        isApproved,
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
