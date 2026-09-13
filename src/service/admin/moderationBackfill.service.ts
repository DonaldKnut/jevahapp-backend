import cacheService from "../cache.service";
import { Media } from "../../models/media.model";
import logger from "../../utils/logger";
import { invalidateFeedCaches } from "../../lib/invalidateFeedCaches";
import {
  MODERATION_STATUSES,
  type ModerationStatus,
} from "./moderationActions.service";

export const BACKFILL_FILTERS = ["missing_or_empty"] as const;
export type BackfillFilter = (typeof BACKFILL_FILTERS)[number];

const SEED_REASON = "backfill_missing_status_2026_09";

/** Media missing / null / empty moderationStatus (never touch explicit statuses). */
export function missingModerationStatusFilter(): Record<string, unknown> {
  return {
    $and: [
      {
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
      {
        $or: [
          { fileUrl: /^https?:\/\//i },
          { playbackUrl: /^https?:\/\//i },
          { hlsUrl: /^https?:\/\//i },
        ],
      },
      {
        $or: [
          {
            $and: [
              {
                $or: [
                  { moderationStatus: { $exists: false } },
                  { moderationStatus: null },
                  { moderationStatus: "" },
                ],
              },
              { isHidden: { $ne: true } },
            ],
          },
          {
            isDefaultContent: true,
            moderationStatus: { $nin: ["rejected", "under_review", "approved"] },
          },
        ],
      },
    ],
  };
}

export function buildBackfillFilter(
  filter: BackfillFilter
): Record<string, unknown> {
  if (filter === "missing_or_empty") {
    return missingModerationStatusFilter();
  }
  throw Object.assign(new Error(`Unsupported filter: ${filter}`), {
    code: "INVALID_FILTER",
  });
}

export async function backfillMissingModerationStatus(params: {
  filter?: BackfillFilter;
  setTo?: ModerationStatus;
  dryRun?: boolean;
  adminId?: string;
}): Promise<{
  filter: BackfillFilter;
  setTo: ModerationStatus;
  dryRun: boolean;
  matched: number;
  modified: number;
  countsBefore: Record<string, number>;
  sampleIds: string[];
}> {
  const filterName = params.filter || "missing_or_empty";
  const setTo = params.setTo || "approved";
  const dryRun = params.dryRun !== false; // default safe: dry-run

  if (!(MODERATION_STATUSES as readonly string[]).includes(setTo)) {
    throw Object.assign(new Error(`Invalid setTo: ${setTo}`), {
      code: "INVALID_STATUS",
    });
  }
  if (setTo !== "approved") {
    throw Object.assign(
      new Error('Backfill currently only supports setTo: "approved"'),
      { code: "INVALID_STATUS" }
    );
  }

  const match = buildBackfillFilter(filterName);

  const [
    missingCount,
    approvedCount,
    pendingCount,
    underReviewCount,
    rejectedCount,
  ] = await Promise.all([
    Media.countDocuments(match),
    Media.countDocuments({ moderationStatus: "approved" }),
    Media.countDocuments({ moderationStatus: "pending" }),
    Media.countDocuments({ moderationStatus: "under_review" }),
    Media.countDocuments({ moderationStatus: "rejected" }),
  ]);

  const sample = await Media.find(match)
    .select("_id title contentType")
    .limit(25)
    .lean();
  const sampleIds = sample.map(d => String(d._id));

  let modified = 0;
  if (!dryRun && missingCount > 0) {
    const now = new Date();
    const result = await Media.updateMany(match, {
      $set: {
        moderationStatus: setTo,
        isHidden: false,
        publicationState: "live",
        publishedAt: now,
        "processing.status": "ready",
        "moderationResult.isApproved": true,
        "moderationResult.reason": SEED_REASON,
      },
    });
    modified = result.modifiedCount || 0;

    try {
      await invalidateFeedCaches("moderation-backfill", params.adminId || "");
      await cacheService.delPattern("media:public:*");
    } catch (err: any) {
      logger.warn("Failed to invalidate feed cache after backfill", {
        error: err?.message,
      });
    }

    logger.info("Moderation status backfill applied", {
      filter: filterName,
      setTo,
      matched: missingCount,
      modified,
      adminId: params.adminId,
    });
  }

  return {
    filter: filterName,
    setTo,
    dryRun,
    matched: missingCount,
    modified,
    countsBefore: {
      missingOrEmptyPlayable: missingCount,
      approved: approvedCount,
      pending: pendingCount,
      under_review: underReviewCount,
      rejected: rejectedCount,
    },
    sampleIds,
  };
}
