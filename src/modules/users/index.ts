/**
 * Users module: user CRUD, profile settings, user profiles, user content, artists
 * Also mounts Next-compatible aliases: GET/PATCH /api/me, POST /api/me/avatar
 */
import { Router } from "express";
import multer from "multer";
import userRoutes from "../../routes/user.route";
import profileSettingsRoutes from "../../routes/profileSettings.routes";
import userProfileRoutes from "../../routes/userProfile.routes";
import userContentRoutes from "../../routes/userContent.routes";
import artistRoutes from "../../routes/artist.route";
import {
  getCurrentUser,
  updateMyProfile,
} from "../../controllers/user.controller";
import {
  getMyMarketingEmailPrefs,
  updateMyMarketingEmailPrefs,
  getPublicUnsubscribe,
  postPublicUnsubscribe,
} from "../../controllers/marketingEmail.controller";
import authController from "../../controllers/auth.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { apiRateLimiter } from "../../middleware/rateLimiter";
import { asyncHandler } from "../../utils/asyncHandler";

export interface Mount {
  path: string;
  router: Router;
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Next handoff: GET/PATCH /api/me, POST /api/me/avatar */
const meAliasRouter = Router();
meAliasRouter.get("/", verifyToken, apiRateLimiter, getCurrentUser);
meAliasRouter.patch("/", verifyToken, apiRateLimiter, updateMyProfile);
meAliasRouter.get(
  "/marketing-email",
  verifyToken,
  apiRateLimiter,
  getMyMarketingEmailPrefs
);
meAliasRouter.patch(
  "/marketing-email",
  verifyToken,
  apiRateLimiter,
  updateMyMarketingEmailPrefs
);
meAliasRouter.post(
  "/avatar",
  verifyToken,
  avatarUpload.single("avatar"),
  asyncHandler(authController.updateUserAvatar)
);

/** Public unsubscribe (no auth) */
const publicEmailRouter = Router();
publicEmailRouter.get("/unsubscribe", apiRateLimiter, getPublicUnsubscribe);
publicEmailRouter.post("/unsubscribe", apiRateLimiter, postPublicUnsubscribe);

export const mounts: Mount[] = [
  { path: "/api/users", router: userRoutes },
  { path: "/api/me", router: meAliasRouter },
  { path: "/api/email", router: publicEmailRouter },
  { path: "/api/user/profile", router: profileSettingsRoutes },
  { path: "/api/user-profiles", router: userProfileRoutes },
  { path: "/api/artists", router: artistRoutes },
  { path: "/api", router: userContentRoutes },
];

export default { mounts };
