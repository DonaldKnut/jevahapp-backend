import { ClientSession, Types } from "mongoose";
import { Media } from "../models/media.model";
import { Devotional } from "../models/devotional.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import logger from "../utils/logger";

type ContentType =
  | "media"
  | "devotional"
  | "artist"
  | "merch"
  | "ebook"
  | "podcast";

interface RecordViewInput {
  userId?: string;
  contentId: string;
  contentType: ContentType;
  durationMs?: number;
  progressPct?: number;
  isComplete?: boolean;
  ip?: string;
  userAgent?: string;
}

const QUALIFY_DURATION_MS = 3000; // 3s
const QUALIFY_PROGRESS = 25; // 25%
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

async function verifyContentExists(
  contentId: string,
  contentType: ContentType
): Promise<boolean> {
  try {
    switch (contentType) {
      case "media":
      case "ebook":
      case "podcast":
      case "merch":
        return !!(await Media.findById(contentId).select("_id"));
      case "devotional":
        return !!(await Devotional.findById(contentId).select("_id"));
      default:
        return false;
    }
  } catch (e) {
    return false;
  }
}

async function incrementViewCount(
  contentId: string,
  contentType: ContentType,
  session?: ClientSession
) {
  if (
    contentType === "media" ||
    contentType === "ebook" ||
    contentType === "podcast" ||
    contentType === "merch"
  ) {
    await Media.findByIdAndUpdate(
      contentId,
      { $inc: { viewCount: 1 } },
      { session }
    );
  } else if (contentType === "devotional") {
    await Devotional.findByIdAndUpdate(
      contentId,
      { $inc: { viewCount: 1 } },
      { session }
    );
  }
}

async function getViewCount(
  contentId: string,
  contentType: ContentType
): Promise<number> {
  if (
    contentType === "media" ||
    contentType === "ebook" ||
    contentType === "podcast" ||
    contentType === "merch"
  ) {
    const m = await Media.findById(contentId).select("viewCount");
    return m?.viewCount || 0;
  } else if (contentType === "devotional") {
    const d = await Devotional.findById(contentId).select("viewCount");
    return (d as any)?.viewCount || 0;
  }
  return 0;
}

export default {
  async recordView(
    input: RecordViewInput
  ): Promise<{ viewCount: number; hasViewed: boolean }> {
    const {
      userId,
      contentId,
      contentType,
      durationMs = 0,
      progressPct = 0,
      isComplete = false,
    } = input;

    if (!Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid content ID");
    }
    const exists = await verifyContentExists(contentId, contentType);
    if (!exists) throw new Error("Content not found");

    const qualifies =
      isComplete ||
      durationMs >= QUALIFY_DURATION_MS ||
      progressPct >= QUALIFY_PROGRESS;

    const now = new Date();
    const windowStart = new Date(now.getTime() - DEDUPE_WINDOW_MS);

    let hasViewed = false;
    let shouldIncrement = false;

    // We only track per-user views for dedupe if we have a userId
    if (userId && Types.ObjectId.isValid(userId)) {
      const existing = await MediaInteraction.findOne({
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(contentId),
        interactionType: "view",
        isRemoved: { $ne: true },
      });

      if (!existing) {
        await MediaInteraction.create({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(contentId),
          interactionType: "view",
          lastInteraction: now,
          count: qualifies ? 1 : 0,
          interactions: [
            { timestamp: now, duration: durationMs, isComplete, progressPct },
          ],
        });
        hasViewed = qualifies;
        shouldIncrement = qualifies;
      } else {
        // Append interaction sample
        await MediaInteraction.findByIdAndUpdate(existing._id, {
          $set: { lastInteraction: now },
          $push: {
            interactions: {
              timestamp: now,
              duration: durationMs,
              isComplete,
              progressPct,
            },
          },
        });

        hasViewed = existing.count > 0 || qualifies;
        // Increment once per 24h if qualifies and last qualified older than window
        if (qualifies) {
          const lastQualified = existing.lastInteraction || existing.createdAt;
          if (!lastQualified || lastQualified < windowStart) {
            await MediaInteraction.findByIdAndUpdate(existing._id, {
              $inc: { count: 1 },
              $set: { lastInteraction: now },
            });
            shouldIncrement = true;
          }
        }
      }
    } else {
      // Anonymous: coarse increment if qualifies (no strong dedupe)
      shouldIncrement = qualifies;
    }

    if (shouldIncrement) {
      await incrementViewCount(contentId, contentType);
    }

    const viewCount = await getViewCount(contentId, contentType);

    try {
      const io = require("../socket/socketManager").getIO();
      if (io)
        io.to(`content:${contentId}`).emit("view-updated", {
          contentId,
          viewCount,
          timestamp: new Date().toISOString(),
        });
    } catch (e) {
      logger.warn("Failed to emit view-updated", {
        contentId,
        error: (e as any)?.message,
      });
    }

    return { viewCount, hasViewed };
  },
};
