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

const QUALIFY_DURATION_MS = 3000; // 3s for video/audio
const QUALIFY_PROGRESS = 25; // 25% for video/audio
const EBOOK_QUALIFY_DURATION_MS = 5000; // 5s for ebook/PDF

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

    // Require authentication - views are user-scoped
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new Error("Authentication required for view tracking");
    }

    if (!Types.ObjectId.isValid(contentId)) {
      throw new Error("Invalid content ID");
    }
    const exists = await verifyContentExists(contentId, contentType);
    if (!exists) throw new Error("Content not found");

    // Determine qualification thresholds based on content type
    const qualifies =
      isComplete ||
      durationMs >= (contentType === "ebook" ? EBOOK_QUALIFY_DURATION_MS : QUALIFY_DURATION_MS) ||
      progressPct >= QUALIFY_PROGRESS;

    const now = new Date();
    const userIdObj = new Types.ObjectId(userId);
    const contentIdObj = new Types.ObjectId(contentId);

    // Check if user already viewed this content (ONE view per user per content)
    const existingView = await MediaInteraction.findOne({
      user: userIdObj,
      media: contentIdObj,
      interactionType: "view",
      isRemoved: { $ne: true },
    });

    let hasViewed = false;
    let shouldIncrement = false;

    if (!existingView) {
      // First view - create record and increment count if qualifies
      if (qualifies) {
        try {
          // Create view record with engagement metrics
          await MediaInteraction.create({
            user: userIdObj,
            media: contentIdObj,
            interactionType: "view",
            lastInteraction: now,
            count: 1, // Track number of times this user viewed (for analytics)
            interactions: [
              { 
                timestamp: now, 
                duration: durationMs, 
                isComplete, 
                progressPct 
              },
            ],
          });

          // Increment content view count (one-time per user)
          await incrementViewCount(contentId, contentType);
          hasViewed = true;
        } catch (error: any) {
          // Handle race condition - view might have been created by concurrent request
          if (error.code === 11000 || error.message.includes("duplicate")) {
            // View already exists - fetch it and update engagement metrics only
            const existing = await MediaInteraction.findOne({
              user: userIdObj,
              media: contentIdObj,
              interactionType: "view",
              isRemoved: { $ne: true },
            });

            if (existing) {
              hasViewed = true;
              // Update engagement metrics but don't increment count
              await MediaInteraction.findByIdAndUpdate(existing._id, {
                $set: { lastInteraction: now },
                $inc: { count: 1 },
                $push: {
                  interactions: {
                    timestamp: now,
                    duration: durationMs,
                    isComplete,
                    progressPct,
                  },
                },
              });
            } else {
              // Re-throw if it's a different error
              throw error;
            }
          } else {
            throw error;
          }
        }
      } else {
        // View doesn't qualify yet - don't record or increment
        // Frontend will call again when thresholds are met
        const viewCount = await getViewCount(contentId, contentType);
        return { viewCount, hasViewed: false };
      }
    } else {
      // User already viewed - update engagement metrics but DON'T increment count
      hasViewed = true;

      // Get existing metrics to update to maximum values
      const existingInteractions = existingView.interactions || [];
      const maxDuration = Math.max(
        durationMs,
        ...existingInteractions.map((i: any) => i.duration || 0)
      );
      const maxProgress = Math.max(
        progressPct,
        ...existingInteractions.map((i: any) => i.progressPct || 0)
      );
      const wasComplete = existingInteractions.some((i: any) => i.isComplete) || isComplete;

      // Update engagement metrics (duration, progress, completion)
      await MediaInteraction.findByIdAndUpdate(existingView._id, {
        $set: { 
          lastInteraction: now,
        },
        $inc: { count: 1 }, // Increment user's personal view count (analytics)
        $push: {
          interactions: {
            timestamp: now,
            duration: durationMs,
            isComplete,
            progressPct,
          },
        },
      });
    }

    const viewCount = await getViewCount(contentId, contentType);

    // Emit real-time update via socket
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
