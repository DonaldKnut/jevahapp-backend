import logger from "../../../utils/logger";
import { engagementRedisSafe, bumpEngagementMetric } from "../../../lib/engagementRedis";

/**
 * Emit like updates after a committed DB mutation.
 * Global/room events carry global count only; private liked state goes to the actor room.
 */
export function emitLikeSocket(
  contentId: string,
  contentType: string,
  likeCount: number,
  userLiked: boolean,
  userId: string
): void {
  try {
    const io = require("../../../socket/socketManager").getIO();
    if (!io) return;

    const updatedAt = new Date().toISOString();
    const countPayload = {
      contentId,
      contentType,
      likeCount,
      updatedAt,
      timestamp: updatedAt,
    };

    // Global count (no private liked flag)
    io.emit("content-like-count-updated", countPayload);
    // Legacy global event — keep for older clients; omit userLiked so it is not treated as global truth
    io.emit("content-like-update", {
      ...countPayload,
      userId,
    });

    io.to(`content:${contentType}:${contentId}`).emit("like-updated", countPayload);

    // Actor-private liked state
    io.to(`user:${userId}`).emit("content-like-state-updated", {
      contentId,
      contentType,
      liked: userLiked,
      likeCount,
      updatedAt,
    });
  } catch {
    // non-blocking
  }
}

export async function invalidateFeedCaches(contentId: string, userId: string): Promise<void> {
  try {
    await engagementRedisSafe(
      "feedInvalidate",
      async r => {
        const userKeys = await r.keys(`feed:user:${userId}:*`);
        if (userKeys.length > 0) await r.del(...userKeys);
        const globalKeys = await r.keys("feed:global:*");
        if (globalKeys.length > 0) await r.del(...globalKeys);
      },
      undefined
    );
  } catch (error: any) {
    bumpEngagementMetric("cacheFailures");
    logger.warn("Failed to invalidate feed caches", { contentId, userId, error: error.message });
  }
}

export function fireLikeNotifications(
  userId: string,
  contentId: string,
  normalized: string,
  liked: boolean,
  likeId?: string
): void {
  if (!liked) return;

  void (async () => {
    const { NotificationService } = await import("../../../service/notification.service");
    const viralContentService = (await import("../../../service/viralContent.service")).default;

    await Promise.all([
      normalized === "artist"
        ? NotificationService.notifyUserFollow(userId, contentId)
        : NotificationService.notifyContentLike(userId, contentId, normalized, likeId),
      NotificationService.notifyPublicActivity(userId, "like", contentId, normalized, undefined),
      normalized === "media"
        ? viralContentService.checkViralMilestones(contentId, "media")
        : Promise.resolve(),
    ]);
  })().catch(err => {
    logger.error("Background like notification failed", { error: (err as Error).message });
  });
}
