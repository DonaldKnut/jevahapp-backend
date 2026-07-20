import { NextFunction, Request, Response } from "express";
import { releaseIdempotencyReservation } from "./idempotency.middleware";
import { normalizeContentType } from "../modules/engagement/shared/contentType.resolver";
import { checkCommentRateLimit } from "../modules/engagement/comments/comment.rateLimit";

/**
 * Distributed comment create rate limiter (Redis). Skips on idempotency replay.
 */
export async function commentRateLimiter(
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

  const contentId = (req.params.contentId || req.params.mediaId || "").toString();
  const contentType = normalizeContentType(
    (req.params.contentType || "media").toString()
  );

  const result = await checkCommentRateLimit({ userId, contentType, contentId });

  if (!result.allowed) {
    await releaseIdempotencyReservation(req);
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "COMMENT_RATE_LIMITED",
      message: "Too many comments. Please wait a moment.",
      data: { retryAfterSeconds: result.retryAfterSeconds },
    });
    return;
  }

  next();
}
