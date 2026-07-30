import { Router } from "express";
import {
  applyAsCreator,
  getMyCreatorProfile,
} from "../controllers/adminArtists.controller";
import {
  listMyCreatorTracks,
  createCreatorTrackUploadIntent,
  finalizeCreatorTrack,
  patchCreatorTrack,
  deleteCreatorTrack,
} from "../controllers/publicMusic.controller";
import { listPublicAnnouncements } from "../controllers/adminCatalog.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/apply", verifyToken, apiRateLimiter, applyAsCreator);
router.get("/me", verifyToken, apiRateLimiter, getMyCreatorProfile);
router.get("/me/tracks", verifyToken, apiRateLimiter, listMyCreatorTracks);

router.post(
  "/tracks/upload-intent",
  verifyToken,
  apiRateLimiter,
  createCreatorTrackUploadIntent
);
router.post(
  "/tracks/:trackId/finalize",
  verifyToken,
  apiRateLimiter,
  finalizeCreatorTrack
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
