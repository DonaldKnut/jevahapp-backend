import { redisRateLimit } from "../../../lib/redisRateLimit";
import { bumpEngagementMetric, logEngagementMetric } from "../../../lib/engagementRedis";

const PER_CONTENT_LIMIT = Number(process.env.COMMENT_RATE_LIMIT_PER_CONTENT || 5);
const PER_CONTENT_WINDOW_SECONDS = Number(
  process.env.COMMENT_RATE_WINDOW_PER_CONTENT_SECONDS || 60
);
const PER_USER_LIMIT = Number(process.env.COMMENT_RATE_LIMIT_PER_USER || 20);
const PER_USER_WINDOW_SECONDS = Number(
  process.env.COMMENT_RATE_WINDOW_PER_USER_SECONDS || 60
);

export async function checkCommentRateLimit(params: {
  userId: string;
  contentType: string;
  contentId: string;
}): Promise<{ allowed: boolean; retryAfterSeconds: number; scope?: string }> {
  const { userId, contentType, contentId } = params;

  const perContent = await redisRateLimit({
    key: `comment:${userId}:${contentType}:${contentId}`,
    limit: PER_CONTENT_LIMIT,
    windowSeconds: PER_CONTENT_WINDOW_SECONDS,
  });

  if (!perContent.allowed) {
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("comment_rate_limited", {
      userId,
      contentType,
      contentId,
      scope: "per_content",
      retryAfterSeconds: perContent.retryAfterSeconds,
    });
    return {
      allowed: false,
      retryAfterSeconds: perContent.retryAfterSeconds,
      scope: "per_content",
    };
  }

  const perUser = await redisRateLimit({
    key: `comment:${userId}`,
    limit: PER_USER_LIMIT,
    windowSeconds: PER_USER_WINDOW_SECONDS,
  });

  if (!perUser.allowed) {
    bumpEngagementMetric("rateLimitRejections");
    logEngagementMetric("comment_rate_limited", {
      userId,
      contentType,
      contentId,
      scope: "per_user",
      retryAfterSeconds: perUser.retryAfterSeconds,
    });
    return {
      allowed: false,
      retryAfterSeconds: perUser.retryAfterSeconds,
      scope: "per_user",
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
