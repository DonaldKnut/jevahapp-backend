import { Router, Request, Response } from "express";
import cacheService from "../service/cache.service";
import { asyncHandler } from "../utils/asyncHandler";
import { analyticsQueue, mediaProcessingQueue } from "../queues/queues";

const router = Router();

/**
 * Basic metrics endpoint (lightweight).
 * Intended for internal monitoring, not public exposure.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const stats = await cacheService.getStats();
    let queues: any = undefined;

    try {
      const [analyticsCounts, mediaCounts] = await Promise.all([
        analyticsQueue.getJobCounts("waiting", "active", "delayed", "failed"),
        mediaProcessingQueue.getJobCounts("waiting", "active", "delayed", "failed"),
      ]);

      queues = {
        analytics: analyticsCounts,
        mediaProcessing: mediaCounts,
      };
    } catch {
      queues = { error: "Queue stats unavailable" };
    }

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
      queues,
    });
  })
);

export default router;

