import { Router } from "express";
import {
  applyAsCreator,
  getMyCreatorProfile,
} from "../controllers/adminArtists.controller";
import { listPublicAnnouncements } from "../controllers/adminCatalog.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/apply", verifyToken, apiRateLimiter, applyAsCreator);
router.get("/me", verifyToken, apiRateLimiter, getMyCreatorProfile);

export default router;

/** Public announcements (optional mount under /api/app) */
export const publicAnnouncementsRouter = Router();
publicAnnouncementsRouter.get(
  "/announcements",
  apiRateLimiter,
  listPublicAnnouncements
);
