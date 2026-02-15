import { Router } from "express";
import {
  getTrendingUsers,
  getMostViewedUsers,
  getMostReadEbookUsers,
  getMostListenedAudioUsers,
  getMostHeardSermonUsers,
  getMostCheckedOutLiveUsers,
  getLiveStreamTiming,
  getTrendingAnalytics,
} from "../controllers/trending.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = Router();

// Rate limiters
const trendingRateLimiter = rateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 minutes

// Trending analytics routes
router.get(
  "/trending",
  verifyToken,
  trendingRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getTrendingUsers
);
router.get(
  "/most-viewed",
  verifyToken,
  trendingRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getMostViewedUsers
);
router.get(
  "/most-read-ebooks",
  verifyToken,
  trendingRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getMostReadEbookUsers
);
router.get(
  "/most-listened-audio",
  verifyToken,
  trendingRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getMostListenedAudioUsers
);
router.get(
  "/most-heard-sermons",
  verifyToken,
  trendingRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getMostHeardSermonUsers
);
router.get(
  "/most-checked-out-live",
  verifyToken,
  trendingRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getMostCheckedOutLiveUsers
);
router.get(
  "/live-stream-timing",
  verifyToken,
  trendingRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getLiveStreamTiming
);
router.get(
  "/analytics",
  verifyToken,
  trendingRateLimiter,
  cacheMiddleware(60, undefined, { allowAuthenticated: true }),
  getTrendingAnalytics
);

export default router;
