import { Media } from "../models/media.model";
import { AnalyticsEvent } from "../models/analyticsEvent.model";
import { clampCount } from "./redisCounters";

/** Shared handler for BullMQ analytics jobs and Kafka consumer */
export async function processEngagementEvent(
  name: string,
  payload: Record<string, unknown>
): Promise<void> {
  await AnalyticsEvent.create({
    name,
    payload,
    requestId: payload.requestId as string | undefined,
    createdAt: new Date(),
  });

  const p = payload as Record<string, any>;

  if (name === "media_interaction" && p.mediaId) {
    if (p.interactionType === "view") {
      await Media.findByIdAndUpdate(p.mediaId, { $inc: { totalViews: 1 } });
    }
    if (p.interactionType === "download") {
      await Media.findByIdAndUpdate(p.mediaId, { $inc: { totalDownloads: 1 } });
    }
  }

  const likeNames = ["content_like_toggled", "content.like_toggled"];
  if (likeNames.includes(name) && p.contentType === "media" && p.contentId) {
    if (typeof p.likeCount === "number") {
      const safeCount = clampCount(p.likeCount);
      // Only sync non-negative counts; stale queue jobs must not corrupt Media
      await Media.findByIdAndUpdate(p.contentId, { $set: { totalLikes: safeCount } });
    }
  }

  const shareNames = ["content_shared", "content.shared"];
  if (shareNames.includes(name) && p.contentType === "media" && p.contentId) {
    if (typeof p.shareCount === "number") {
      await Media.findByIdAndUpdate(p.contentId, {
        $set: { totalShares: clampCount(p.shareCount) },
      });
    }
  }
}
