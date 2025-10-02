import express from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import {
  bulkUpsert,
  createBranch,
  createChurch,
  reindex,
} from "../controllers/churches.admin.controller";

const router = express.Router();

router.post(
  "/churches",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  createChurch
);
router.post(
  "/churches/:id/branches",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  createBranch
);
router.post(
  "/churches/bulk",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  bulkUpsert
);
router.post(
  "/churches/reindex",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  reindex
);

export default router;

