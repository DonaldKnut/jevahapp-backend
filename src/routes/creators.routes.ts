import { Router } from "express";
import {
  applyAsCreator,
  getMyCreatorProfile,
} from "../controllers/adminArtists.controller";
import { getMyCreatorAnalytics } from "../controllers/creatorAnalytics.controller";
import {
  listMyCreatorTracks,
  createCreatorTrackUploadIntent,
  finalizeCreatorTrack,
  getCreatorTrackStatus,
  signCreatorTrackMultipartParts,
  completeCreatorTrackMultipart,
  abortCreatorTrackMultipart,
  replaceCreatorTrackUploadIntent,
  patchCreatorTrack,
  deleteCreatorTrack,
} from "../controllers/publicMusic.controller";
import {
  createCreatorRelease,
  listCreatorReleasesHandler,
  getCreatorRelease,
  patchCreatorRelease,
  creatorReleaseCoverIntent,
  creatorReleaseCoverFinalize,
  reorderCreatorReleaseTracks,
  publishCreatorRelease,
  unlinkCreatorReleaseTrack,
  deleteCreatorRelease,
} from "../controllers/creatorReleases.controller";
import { listPublicAnnouncements } from "../controllers/adminCatalog.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { requireEmailVerified } from "../middleware/requireEmailVerified.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post(
  "/apply",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  applyAsCreator
);
router.get("/me", verifyToken, apiRateLimiter, getMyCreatorProfile);
router.get("/me/analytics", verifyToken, apiRateLimiter, getMyCreatorAnalytics);
router.get("/me/tracks", verifyToken, apiRateLimiter, listMyCreatorTracks);

router.get("/releases", verifyToken, apiRateLimiter, listCreatorReleasesHandler);
router.post(
  "/releases",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  createCreatorRelease
);
router.get("/releases/:id", verifyToken, apiRateLimiter, getCreatorRelease);
router.patch(
  "/releases/:id",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  patchCreatorRelease
);
router.delete(
  "/releases/:id",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  deleteCreatorRelease
);
router.post(
  "/releases/:id/cover/upload-intent",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  creatorReleaseCoverIntent
);
router.post(
  "/releases/:id/cover/finalize",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  creatorReleaseCoverFinalize
);
router.post(
  "/releases/:id/tracks/reorder",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  reorderCreatorReleaseTracks
);
router.delete(
  "/releases/:id/tracks/:trackId",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  unlinkCreatorReleaseTrack
);
router.post(
  "/releases/:id/publish",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  publishCreatorRelease
);

router.post(
  "/tracks/upload-intent",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  createCreatorTrackUploadIntent
);
router.get(
  "/tracks/:trackId/status",
  verifyToken,
  apiRateLimiter,
  getCreatorTrackStatus
);
router.post(
  "/tracks/:trackId/multipart/sign-parts",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  signCreatorTrackMultipartParts
);
router.post(
  "/tracks/:trackId/multipart/complete",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  completeCreatorTrackMultipart
);
router.post(
  "/tracks/:trackId/multipart/abort",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  abortCreatorTrackMultipart
);
router.post(
  "/tracks/:trackId/finalize",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  finalizeCreatorTrack
);
router.post(
  "/tracks/:trackId/replace-upload-intent",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  replaceCreatorTrackUploadIntent
);
router.patch(
  "/tracks/:id",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  patchCreatorTrack
);
router.delete(
  "/tracks/:id",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  deleteCreatorTrack
);
router.patch(
  "/tracks/:trackId",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  (req, res) => {
    (req.params as any).id = req.params.trackId;
    return patchCreatorTrack(req, res);
  }
);
router.delete(
  "/tracks/:trackId",
  verifyToken,
  requireEmailVerified,
  apiRateLimiter,
  (req, res) => {
    (req.params as any).id = req.params.trackId;
    return deleteCreatorTrack(req, res);
  }
);

export default router;

/** Public announcements (optional mount under /api/app) */
export const publicAnnouncementsRouter = Router();
publicAnnouncementsRouter.get(
  "/announcements",
  apiRateLimiter,
  listPublicAnnouncements
);
