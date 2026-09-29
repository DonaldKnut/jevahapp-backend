/**
 * Creator trust / fast-lane for pastors with clean publish history.
 * Trusted creators skip gray-zone more often — never bypass safety rejects.
 */
import mongoose from "mongoose";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";

export type CreatorTrustTier = "new" | "rising" | "trusted";

export interface CreatorTrustProfile {
  tier: CreatorTrustTier;
  approved: number;
  rejected: number;
  underReview: number;
  /** True when gray-zone Christian content may auto-publish */
  fastLane: boolean;
  reason: string;
}

function envInt(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getTrustThresholds() {
  return {
    trustedMinApproved: envInt("MODERATION_TRUST_MIN_APPROVED", 5),
    risingMinApproved: envInt("MODERATION_TRUST_RISING_APPROVED", 2),
    lookbackDays: envInt("MODERATION_TRUST_LOOKBACK_DAYS", 120),
    maxRejectedTrusted: envInt("MODERATION_TRUST_MAX_REJECTED", 0),
  };
}

/**
 * Load publish history for a creator. Fail-soft → "new" (no fast lane).
 */
export async function getCreatorTrustProfile(
  userId?: string | null
): Promise<CreatorTrustProfile> {
  const empty: CreatorTrustProfile = {
    tier: "new",
    approved: 0,
    rejected: 0,
    underReview: 0,
    fastLane: false,
    reason: "no_user",
  };
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return empty;

  if (process.env.MODERATION_TRUST_FAST_LANE === "false") {
    return { ...empty, reason: "fast_lane_disabled" };
  }

  const t = getTrustThresholds();
  const since = new Date(
    Date.now() - Math.max(7, t.lookbackDays) * 24 * 60 * 60 * 1000
  );

  try {
    const rows = await Media.aggregate<{
      _id: string;
      count: number;
    }>([
      {
        $match: {
          uploadedBy: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: since },
          moderationStatus: {
            $in: ["approved", "rejected", "under_review"],
          },
        },
      },
      { $group: { _id: "$moderationStatus", count: { $sum: 1 } } },
    ]);

    let approved = 0;
    let rejected = 0;
    let underReview = 0;
    for (const row of rows) {
      if (row._id === "approved") approved = row.count;
      else if (row._id === "rejected") rejected = row.count;
      else if (row._id === "under_review") underReview = row.count;
    }

    if (
      approved >= t.trustedMinApproved &&
      rejected <= t.maxRejectedTrusted
    ) {
      return {
        tier: "trusted",
        approved,
        rejected,
        underReview,
        fastLane: true,
        reason: "clean_publish_history",
      };
    }

    if (approved >= t.risingMinApproved && rejected === 0) {
      return {
        tier: "rising",
        approved,
        rejected,
        underReview,
        fastLane: true,
        reason: "rising_clean_creator",
      };
    }

    return {
      tier: "new",
      approved,
      rejected,
      underReview,
      fastLane: false,
      reason: rejected > 0 ? "has_recent_rejects" : "insufficient_history",
    };
  } catch (err: any) {
    logger.warn("getCreatorTrustProfile failed", {
      userId,
      error: err?.message,
    });
    return { ...empty, reason: "trust_lookup_error" };
  }
}
