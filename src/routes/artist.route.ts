import { Router } from "express";
import {
  followArtist,
  unfollowArtist,
  getArtistFollowers,
  getUserFollowing,
  addMerchItem,
  updateMerchItem,
  removeMerchItem,
  getArtistMerch,
  purchaseMerch,
  getArtistDownloadableSongs,
  getUserOfflineDownloads,
} from "../controllers/artist.controller";
import { verifyToken } from "../middleware/auth.middleware";
import {
  apiRateLimiter,
  followRateLimiter,
  mediaInteractionRateLimiter,
} from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = Router();

/**



 */
router.post("/follow", verifyToken, followRateLimiter, followArtist);

/**



 */
router.post("/unfollow", verifyToken, followRateLimiter, unfollowArtist);

/**



 */
router.get(
  "/:artistId/followers",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getArtistFollowers
);

/**



 */
router.get(
  "/following",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(60, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserFollowing
);

/**



 */
router.post("/merch", verifyToken, mediaInteractionRateLimiter, addMerchItem);

/**



 */
router.put(
  "/merch/:merchItemId",
  verifyToken,
  mediaInteractionRateLimiter,
  updateMerchItem
);

/**



 */
router.delete(
  "/merch/:merchItemId",
  verifyToken,
  mediaInteractionRateLimiter,
  removeMerchItem
);

/**



 */
router.get(
  "/:artistId/merch",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getArtistMerch
);

/**



 */
router.post(
  "/:artistId/merch/purchase",
  verifyToken,
  mediaInteractionRateLimiter,
  purchaseMerch
);

/**



 */
router.get(
  "/:artistId/songs",
  verifyToken,
  apiRateLimiter,
  getArtistDownloadableSongs
);

/**



 */
router.get(
  "/downloads",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(60, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserOfflineDownloads
);

export default router;
