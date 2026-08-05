import { NextFunction, Request, Response } from "express";
import { redisRateLimit } from "../lib/redisRateLimit";
import { bumpEngagementMetric, logEngagementMetric } from "../lib/engagementRedis";
import { releaseIdempotencyReservation } from "./idempotency.middleware";
import { normalizeContentType } from "../modules/engagement/shared/contentType.resolver";

const PER_CONTENT_LIMIT = Number(process.env.SHARE_RATE_LIMIT_PER_CONTENT || 10);
const PER_CONTENT_WINDOW_SECONDS = Number(
  process.env.SHARE_RATE_WINDOW_PER_CONTENT_SECONDS || 60
);
const PER_USER_LIMIT = Number(process.env.SHARE_RATE_LIMIT_PER_USER || 30);
const PER_USER_WINDOW_SECONDS = Number(
  process.env.SHARE_RATE_WINDOW_PER_USER_SECONDS || 60
);

export async function shareRateLimiter(
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

  const contentId = (
    req.params.contentId ||
    req.params.songId ||
    req.params.mediaId ||
    ""
  ).toString();
  const contentType = req.params.songId
    ? "copyright_free_song"
    : normalizeContentType((req.params.contentType || "media").toString());

  const perContent = await redisRateLimit({
    key: `share:${userId}:${contentType}:${contentId}`,
    limit: PER_CONTENT_LIMIT,
    windowSeconds: PER_CONTENT_WINDOW_SECONDS,
  });

  if (!perContent.allowed) {
    await releaseIdempotencyReservation(req);
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("share_rate_limited", {
      userId,
      contentType,
      contentId,
      scope: "per_content",
      retryAfterSeconds: perContent.retryAfterSeconds,
    });
    res.setHeader("Retry-After", String(perContent.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "SHARE_RATE_LIMITED",
      message: "Too many shares. Please wait a moment.",
      data: { retryAfterSeconds: perContent.retryAfterSeconds },
    });
    return;
  }

  const perUser = await redisRateLimit({
    key: `share:${userId}`,
    limit: PER_USER_LIMIT,
    windowSeconds: PER_USER_WINDOW_SECONDS,
  });

  if (!perUser.allowed) {
    await releaseIdempotencyReservation(req);
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("share_rate_limited", {
      userId,
      contentType,
      contentId,
      scope: "per_user",
      retryAfterSeconds: perUser.retryAfterSeconds,
    });
    res.setHeader("Retry-After", String(perUser.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "SHARE_RATE_LIMITED",
      message: "Too many shares. Please wait a moment.",
      data: { retryAfterSeconds: perUser.retryAfterSeconds },
    });
    return;
  }

  next();
}
