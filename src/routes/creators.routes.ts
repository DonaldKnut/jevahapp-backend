import { Router } from "express";
import {
  applyAsCreator,
  getMyCreatorProfile,
} from "../controllers/adminArtists.controller";
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
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/apply", verifyToken, apiRateLimiter, applyAsCreator);
router.get("/me", verifyToken, apiRateLimiter, getMyCreatorProfile);
router.get("/me/tracks", verifyToken, apiRateLimiter, listMyCreatorTracks);

router.get("/releases", verifyToken, apiRateLimiter, listCreatorReleasesHandler);
router.post("/releases", verifyToken, apiRateLimiter, createCreatorRelease);
router.get("/releases/:id", verifyToken, apiRateLimiter, getCreatorRelease);
router.patch("/releases/:id", verifyToken, apiRateLimiter, patchCreatorRelease);
router.delete("/releases/:id", verifyToken, apiRateLimiter, deleteCreatorRelease);
router.post(
  "/releases/:id/cover/upload-intent",
  verifyToken,
  apiRateLimiter,
  creatorReleaseCoverIntent
);
router.post(
  "/releases/:id/cover/finalize",
  verifyToken,
  apiRateLimiter,
  creatorReleaseCoverFinalize
);
router.post(
  "/releases/:id/tracks/reorder",
  verifyToken,
  apiRateLimiter,
  reorderCreatorReleaseTracks
);
router.delete(
  "/releases/:id/tracks/:trackId",
  verifyToken,
  apiRateLimiter,
  unlinkCreatorReleaseTrack
);
router.post(
  "/releases/:id/publish",
  verifyToken,
  apiRateLimiter,
  publishCreatorRelease
);

router.post(
  "/tracks/upload-intent",
  verifyToken,
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
  apiRateLimiter,
  signCreatorTrackMultipartParts
);
router.post(
  "/tracks/:trackId/multipart/complete",
  verifyToken,
  apiRateLimiter,
  completeCreatorTrackMultipart
);
router.post(
  "/tracks/:trackId/multipart/abort",
  verifyToken,
  apiRateLimiter,
  abortCreatorTrackMultipart
);
router.post(
  "/tracks/:trackId/finalize",
  verifyToken,
  apiRateLimiter,
  finalizeCreatorTrack
);
router.post(
  "/tracks/:trackId/replace-upload-intent",
  verifyToken,
  apiRateLimiter,
  replaceCreatorTrackUploadIntent
);
router.patch("/tracks/:id", verifyToken, apiRateLimiter, patchCreatorTrack);
router.delete("/tracks/:id", verifyToken, apiRateLimiter, deleteCreatorTrack);
// FE alias param name
router.patch("/tracks/:trackId", verifyToken, apiRateLimiter, (req, res, next) => {
  (req.params as any).id = req.params.trackId;
  return patchCreatorTrack(req, res);
});
router.delete("/tracks/:trackId", verifyToken, apiRateLimiter, (req, res, next) => {
  (req.params as any).id = req.params.trackId;
  return deleteCreatorTrack(req, res);
});

export default router;

/** Public announcements (optional mount under /api/app) */
export const publicAnnouncementsRouter = Router();
publicAnnouncementsRouter.get(
  "/announcements",
  apiRateLimiter,
  listPublicAnnouncements
);
