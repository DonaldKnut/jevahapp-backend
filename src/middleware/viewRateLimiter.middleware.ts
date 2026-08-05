import { NextFunction, Request, Response } from "express";
import { redisRateLimit } from "../lib/redisRateLimit";
import {
  bumpEngagementMetric,
  logEngagementMetric,
} from "../lib/engagementRedis";

/**
 * Anti-farming for CF / media view heartbeats.
 * Views are fire-and-forget from FE — still protect durable counters.
 *
 * Per song: 20 / minute / user (allows progress heartbeats)
 * Global: 120 / minute / user
 */
const PER_CONTENT_LIMIT = Number(process.env.VIEW_RATE_LIMIT_PER_CONTENT || 20);
const PER_CONTENT_WINDOW_SECONDS = Number(
  process.env.VIEW_RATE_WINDOW_PER_CONTENT_SECONDS || 60
);
const PER_USER_LIMIT = Number(process.env.VIEW_RATE_LIMIT_PER_USER || 120);
const PER_USER_WINDOW_SECONDS = Number(
  process.env.VIEW_RATE_WINDOW_PER_USER_SECONDS || 60
);

function resolveContentId(req: Request): string {
  return (
    req.params.songId ||
    req.params.contentId ||
    req.params.mediaId ||
    ""
  ).toString();
}

export async function viewRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    next();
    return;
  }

  const contentId = resolveContentId(req);
  const contentType = (req.params.contentType || "copyright_free_song").toString();

  const perContent = await redisRateLimit({
    key: `view:${userId}:${contentType}:${contentId}`,
    limit: PER_CONTENT_LIMIT,
    windowSeconds: PER_CONTENT_WINDOW_SECONDS,
  });

  if (!perContent.allowed) {
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("view_rate_limited", {
      userId,
      contentType,
      contentId,
      scope: "per_content",
      retryAfterSeconds: perContent.retryAfterSeconds,
    });
    res.setHeader("Retry-After", String(perContent.retryAfterSeconds));
    // Soft 429 — FE should ignore and not block playback UI
    res.status(429).json({
      success: false,
      code: "VIEW_RATE_LIMITED",
      message: "View reporting throttled. Playback continues.",
      data: {
        retryAfterSeconds: perContent.retryAfterSeconds,
        counted: false,
      },
    });
    return;
  }

  const perUser = await redisRateLimit({
    key: `view:${userId}`,
    limit: PER_USER_LIMIT,
    windowSeconds: PER_USER_WINDOW_SECONDS,
  });

  if (!perUser.allowed) {
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("view_rate_limited", {
      userId,
      contentType,
      contentId,
      scope: "per_user",
      retryAfterSeconds: perUser.retryAfterSeconds,
    });
    res.setHeader("Retry-After", String(perUser.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "VIEW_RATE_LIMITED",
      message: "View reporting throttled. Playback continues.",
      data: {
        retryAfterSeconds: perUser.retryAfterSeconds,
        counted: false,
      },
    });
    return;
  }

  next();
}
