/**
 * Auth module: login, register, password reset, verification, avatar
 * Also mounts Next-compatible aliases: POST /api/register
 */
import { Router } from "express";
import authRoutes from "../../routes/auth.route";
import authController from "../../controllers/auth.controller";
import { asyncHandler } from "../../utils/asyncHandler";
import { authRateLimiter } from "../../middleware/rateLimiter";
import { requireRegistrationEnabled } from "../../middleware/platformGate.middleware";

export interface Mount {
  path: string;
  router: Router;
}

/** Next web handoff uses POST /api/register (not /api/auth/register). */
const registerAliasRouter = Router();
registerAliasRouter.post(
  "/",
  authRateLimiter,
  requireRegistrationEnabled,
  asyncHandler(authController.registerUser)
);

export const mounts: Mount[] = [
  { path: "/api/auth", router: authRoutes },
  { path: "/api/register", router: registerAliasRouter },
];

export default { mounts };
