import { Router, Request, Response } from "express";
import cacheService from "../service/cache.service";
import { asyncHandler } from "../utils/asyncHandler";
import {
  analyticsQueue,
  mediaProcessingQueue,
  notificationsQueue,
} from "../queues/queues";
import { getEngagementMetrics, isRedisConnected } from "../lib/engagementRedis";
import { getAiBudgetSnapshot } from "../service/moderation/aiBudget.service";
import { contentModerationService } from "../service/contentModeration.service";
import {
  guardianHealth,
  isGuardianConfigured,
  isGuardianCircuitOpen,
} from "../service/moderation/guardianClient";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const router = Router();

async function hasBinary(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(cmd, ["-version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Internal metrics — admin JWT required (do not expose publicly).
 */
router.get(
  "/",
  verifyToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const stats = await cacheService.getStats();
    let queues: any = undefined;

    try {
      const [analyticsCounts, mediaCounts, notifyCounts] = await Promise.all([
        analyticsQueue.getJobCounts("waiting", "active", "delayed", "failed"),
        mediaProcessingQueue.getJobCounts(
          "waiting",
          "active",
          "delayed",
          "failed"
        ),
        notificationsQueue.getJobCounts(
          "waiting",
          "active",
          "delayed",
          "failed"
        ),
      ]);

      queues = {
        analytics: analyticsCounts,
        mediaProcessing: mediaCounts,
        notifications: notifyCounts,
      };
    } catch {
      queues = { error: "Queue stats unavailable" };
    }

    const [ffmpeg, ffprobe] = await Promise.all([
      hasBinary("ffmpeg"),
      hasBinary("ffprobe"),
    ]);

    const guardian = isGuardianConfigured()
      ? await guardianHealth()
      : { ok: false, detail: { reason: "not_configured" } };

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      requestId: (req as any).requestId,
      process: {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024),
      },
      redisCache: stats,
      engagementRedis: {
        connected: isRedisConnected(),
        metrics: getEngagementMetrics(),
      },
      moderation: {
        providerAvailable: contentModerationService.isAvailable(),
        guardianConfigured: isGuardianConfigured(),
        guardianOk: guardian.ok,
        guardianCircuitOpen: isGuardianCircuitOpen(),
        guardian: guardian.detail,
        /** Ops: if vision false while configured, uploads should quarantine not auto-approve */
        visionHint:
          guardian.ok && guardian.detail?.vision
            ? {
                nudenet: Boolean(guardian.detail.vision.nudenet),
                clip: Boolean(guardian.detail.vision.clip),
                softFailRisk:
                  !guardian.detail.vision.nudenet && !guardian.detail.vision.clip,
              }
            : null,
        fusionMode: process.env.MODERATION_FUSION_MODE || "guardian_first",
        offlineProvisionalApprove:
          process.env.MODERATION_OFFLINE_PROVISIONAL_APPROVE === "true",
        aiBudget: await getAiBudgetSnapshot(),
      },
      mediaTools: { ffmpeg, ffprobe },
      env: {
        hasExpoToken: Boolean(process.env.EXPO_ACCESS_TOKEN),
        hasR2CustomDomain: Boolean(process.env.R2_CUSTOM_DOMAIN),
        nodeEnv: process.env.NODE_ENV,
      },
      queues,
    });
  })
);

export default router;
