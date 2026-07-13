import logger from "../../../utils/logger";
import { redisSafe } from "../../../lib/redis";

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
    const payload = {
      contentId,
      contentType,
      likeCount,
      userLiked,
      userId,
      timestamp: new Date().toISOString(),
    };
    io.emit("content-like-update", payload);
    io.to(`content:${contentType}:${contentId}`).emit("like-updated", payload);
  } catch {
    // non-blocking
  }
}

export async function invalidateFeedCaches(contentId: string, userId: string): Promise<void> {
  try {
    await redisSafe(
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
    logger.warn("Failed to invalidate feed caches", { contentId, userId, error: error.message });
  }
}

export function fireLikeNotifications(
  userId: string,
  contentId: string,
  normalized: string,
  liked: boolean
): void {
  if (!liked) return;

  void (async () => {
    const { NotificationService } = await import("../../../service/notification.service");
    const viralContentService = (await import("../../../service/viralContent.service")).default;

    await Promise.all([
      normalized === "artist"
        ? NotificationService.notifyUserFollow(userId, contentId)
        : NotificationService.notifyContentLike(userId, contentId, normalized),
      NotificationService.notifyPublicActivity(userId, "like", contentId, normalized, undefined),
      normalized === "media"
        ? viralContentService.checkViralMilestones(contentId, "media")
        : Promise.resolve(),
    ]);
  })().catch(err => {
    logger.error("Background like notification failed", { error: (err as Error).message });
  });
}
