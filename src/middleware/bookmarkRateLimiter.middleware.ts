import { NextFunction, Request, Response } from "express";
import { redisRateLimit } from "../lib/redisRateLimit";
import { bumpEngagementMetric, logEngagementMetric } from "../lib/engagementRedis";
import { releaseIdempotencyReservation } from "./idempotency.middleware";

const PER_CONTENT_LIMIT = Number(process.env.BOOKMARK_RATE_LIMIT_PER_CONTENT || 4);
const PER_CONTENT_WINDOW_SECONDS = Number(
  process.env.BOOKMARK_RATE_WINDOW_PER_CONTENT_SECONDS || 10
);
const PER_USER_LIMIT = Number(process.env.BOOKMARK_RATE_LIMIT_PER_USER || 60);
const PER_USER_WINDOW_SECONDS = Number(
  process.env.BOOKMARK_RATE_WINDOW_PER_USER_SECONDS || 60
);

/**
 * Distributed bookmark rate limiter (Redis). Skips on idempotency replay.
 */
export async function bookmarkRateLimiter(
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

  const mediaId = (req.params.mediaId || req.params.contentId || req.params.id || "").toString();

  const perContent = await redisRateLimit({
    key: `bookmark:${userId}:${mediaId}`,
    limit: PER_CONTENT_LIMIT,
    windowSeconds: PER_CONTENT_WINDOW_SECONDS,
  });

  if (!perContent.allowed) {
    await releaseIdempotencyReservation(req);
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("bookmark_rate_limited", {
      userId,
      mediaId,
      scope: "per_content",
      retryAfterSeconds: perContent.retryAfterSeconds,
    });
    res.setHeader("Retry-After", String(perContent.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "BOOKMARK_RATE_LIMITED",
      message: "Too many requests. Please wait a moment before saving again.",
      data: { retryAfterSeconds: perContent.retryAfterSeconds },
    });
    return;
  }

  const perUser = await redisRateLimit({
    key: `bookmark:${userId}`,
    limit: PER_USER_LIMIT,
    windowSeconds: PER_USER_WINDOW_SECONDS,
  });

  if (!perUser.allowed) {
    await releaseIdempotencyReservation(req);
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("bookmark_rate_limited", {
      userId,
      mediaId,
      scope: "per_user",
      retryAfterSeconds: perUser.retryAfterSeconds,
    });
    res.setHeader("Retry-After", String(perUser.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "BOOKMARK_RATE_LIMITED",
      message: "Too many requests. Please wait a moment before saving again.",
      data: { retryAfterSeconds: perUser.retryAfterSeconds },
    });
    return;
  }

  next();
}
