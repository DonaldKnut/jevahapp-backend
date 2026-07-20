import { Types } from "mongoose";
import { ModerationCase } from "../../models/moderationCase.model";
import logger from "../../utils/logger";

/** Persist human reviewer outcome onto the latest ModerationCase (best-effort). */
export async function recordReviewerOutcome(
  mediaId: string,
  adminId: string,
  status: "approved" | "rejected" | "pending",
  note?: string
): Promise<void> {
  try {
    const latest = await ModerationCase.findOne({ mediaId }).sort({
      createdAt: -1,
    });
    if (!latest) return;
    latest.reviewerOutcome = {
      status,
      reviewerId: new Types.ObjectId(adminId),
      note: note || undefined,
      reviewedAt: new Date(),
    };
    await latest.save();
  } catch (error: any) {
    logger.warn("Failed to record reviewerOutcome on ModerationCase", {
      mediaId,
      error: error?.message,
    });
  }
}
