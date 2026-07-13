import { Router } from "express";
import {
  createDevotional,
  listDevotionals,
  likeDevotional,
} from "../controllers/devotionals.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdminOrCreator } from "../middleware/role.middleware";
import { cacheMiddleware } from "../middleware/cache.middleware";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();
const interactionRateLimiter = rateLimiter(10, 60000);

// Create a new devotional (admin or creator only)
router.post(
  "/create-devotional",
  verifyToken,
  requireAdminOrCreator,
  createDevotional
);

// List all devotionals (authenticated users)
router.get(
  "/devotionals",
  verifyToken,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  listDevotionals
);

// Like or unlike a devotional
router.post(
  "/devotionals/:id/like",
  verifyToken,
  interactionRateLimiter,
  likeDevotional
);

export default router;
