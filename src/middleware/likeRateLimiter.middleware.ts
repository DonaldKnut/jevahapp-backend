import { NextFunction, Request, Response } from "express";
import { redisRateLimit } from "../lib/redisRateLimit";
import { bumpEngagementMetric, logEngagementMetric } from "../lib/engagementRedis";
import { normalizeContentType } from "../modules/engagement/shared/contentType.resolver";
import { releaseIdempotencyReservation } from "./idempotency.middleware";

/** Per content: 4 toggles / 10 seconds / user */
const PER_CONTENT_LIMIT = Number(process.env.LIKE_RATE_LIMIT_PER_CONTENT || 4);
const PER_CONTENT_WINDOW_SECONDS = Number(
  process.env.LIKE_RATE_WINDOW_PER_CONTENT_SECONDS || 10
);

/** Global likes: 60 requests / minute / user */
const PER_USER_LIMIT = Number(process.env.LIKE_RATE_LIMIT_PER_USER || 60);
const PER_USER_WINDOW_SECONDS = Number(
  process.env.LIKE_RATE_WINDOW_PER_USER_SECONDS || 60
);

/**
 * Distributed like rate limiter (Redis). Keys by userId, not IP.
 * Returns 429 LIKE_RATE_LIMITED with Retry-After when exceeded; no mutation occurs.
 * Skips when the request was already satisfied by idempotency replay.
 */
export async function likeRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if ((req as any).idempotencyReplayed) {
    next();
    return;
  }

  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    next();
    return;
  }

  const rawType = (req.params.contentType || "media").toString();
  const contentType =
    rawType.trim().toLowerCase() === "devotional"
      ? "devotional"
      : req.params.songId
        ? "copyright_free_song"
        : normalizeContentType(rawType);
  // CF routes use :songId; media engagement uses :contentId
  const contentId = (
    req.params.contentId ||
    req.params.songId ||
    req.params.mediaId ||
    ""
  ).toString();

  const perContent = await redisRateLimit({
    key: `like:${userId}:${contentType}:${contentId}`,
    limit: PER_CONTENT_LIMIT,
    windowSeconds: PER_CONTENT_WINDOW_SECONDS,
  });

  if (!perContent.allowed) {
    await releaseIdempotencyReservation(req);
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("like_rate_limited", {
      userId,
      contentType,
      contentId,
      scope: "per_content",
      retryAfterSeconds: perContent.retryAfterSeconds,
    });
    res.setHeader("Retry-After", String(perContent.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "LIKE_RATE_LIMITED",
      message: "Too many requests. Please wait a moment before liking again.",
      data: { retryAfterSeconds: perContent.retryAfterSeconds },
    });
    return;
  }

  const perUser = await redisRateLimit({
    key: `like:${userId}`,
    limit: PER_USER_LIMIT,
    windowSeconds: PER_USER_WINDOW_SECONDS,
  });

  if (!perUser.allowed) {
    await releaseIdempotencyReservation(req);
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("like_rate_limited", {
      userId,
      contentType,
      contentId,
      scope: "per_user",
      retryAfterSeconds: perUser.retryAfterSeconds,
    });
    res.setHeader("Retry-After", String(perUser.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "LIKE_RATE_LIMITED",
      message: "Too many requests. Please wait a moment before liking again.",
      data: { retryAfterSeconds: perUser.retryAfterSeconds },
    });
    return;
  }

  next();
}
