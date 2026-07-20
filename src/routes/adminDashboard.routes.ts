import { Router } from "express";
import {
  getPlatformAnalytics,
  getUsers,
  getUserDetails,
  banUser,
  unbanUser,
  updateUserRole,
  getModerationQueue,
  updateModerationStatus,
  getAdminActivityLog,
} from "../controllers/adminDashboard.controller";
import {
  listAdminReports,
  getAdminMediaReportDetail,
  reviewAdminMediaReport,
  deleteAdminReportedMedia,
  listAdminCommentReports,
  hideAdminComment,
  unhideAdminComment,
  dismissAdminCommentReports,
} from "../controllers/adminReports.controller";
import {
  updateUserVerification,
  updateChurchVerification,
  adminDeleteMedia,
} from "../controllers/adminVerification.controller";
import {
  getModerationMediaDetail,
  getModerationCase,
  updateAdminMediaMetadata,
  listAdminChurches,
} from "../controllers/adminModeration.controller";
import {
  createChurch,
  updateChurch,
  deleteChurch,
} from "../controllers/churches.admin.controller";
import {
  getUsersPresence,
  sendAdminEmail,
  getRecentUploads,
  getDashboardFeed,
} from "../controllers/adminOps.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get(
  "/dashboard/analytics",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getPlatformAnalytics
);

router.get(
  "/dashboard/feed",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getDashboardFeed
);

router.get("/users", verifyToken, requireAdmin, apiRateLimiter, getUsers);

/** Must be before /users/:id */
router.get(
  "/users/presence",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getUsersPresence
);

router.get(
  "/users/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getUserDetails
);

router.post(
  "/users/:id/ban",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  banUser
);

router.post(
  "/users/:id/unban",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  unbanUser
);

router.patch(
  "/users/:id/role",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateUserRole
);

router.patch(
  "/users/:id/verification",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateUserVerification
);

router.patch(
  "/churches/:id/verification",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateChurchVerification
);

router.get(
  "/churches",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminChurches
);

router.post(
  "/churches",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  createChurch
);

router.patch(
  "/churches/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateChurch
);

router.delete(
  "/churches/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  deleteChurch
);

router.delete(
  "/media/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  adminDeleteMedia
);

router.patch(
  "/media/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateAdminMediaMetadata
);

router.get(
  "/media/recent",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getRecentUploads
);

router.post(
  "/email",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  sendAdminEmail
);

router.get("/reports", verifyToken, requireAdmin, apiRateLimiter, listAdminReports);
router.get(
  "/reports/media/:reportId",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getAdminMediaReportDetail
);
router.post(
  "/reports/media/:reportId/review",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  reviewAdminMediaReport
);
router.delete(
  "/reports/media/:mediaId/content",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  (req, res, next) => {
    (req.params as any).id = req.params.mediaId;
    next();
  },
  deleteAdminReportedMedia
);
router.get(
  "/reports/comments",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminCommentReports
);
router.post(
  "/reports/comments/:commentId/hide",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  hideAdminComment
);
router.post(
  "/reports/comments/:commentId/unhide",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  unhideAdminComment
);
router.post(
  "/reports/comments/:commentId/dismiss",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  dismissAdminCommentReports
);

router.get(
  "/moderation/queue",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getModerationQueue
);

router.get(
  "/moderation/:id/case",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getModerationCase
);

router.get(
  "/moderation/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getModerationMediaDetail
);

router.patch(
  "/moderation/:id/status",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateModerationStatus
);

router.get(
  "/activity",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getAdminActivityLog
);

export default router;
