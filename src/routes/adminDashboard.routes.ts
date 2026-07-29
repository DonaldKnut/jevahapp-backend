import { Router } from "express";
import {
  getPlatformAnalytics,
  getUsers,
  getUserDetails,
  banUser,
  unbanUser,
  warnUser,
  updateUserRole,
  getModerationQueue,
  updateModerationStatus,
  bulkUpdateModerationStatus,
  getAdminActivityLog,
} from "../controllers/adminDashboard.controller";
import {
  listAdminReports,
  getAdminMediaReportDetail,
  reviewAdminMediaReport,
  deleteAdminReportedMedia,
  bulkReviewAdminMediaReports,
  listAdminCommentReports,
  getAdminCommentReportDetail,
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
  refreshAdminMediaPreview,
  rerunModeration,
  assignModeration,
  getModerationNotes,
  addModerationNote,
} from "../controllers/adminModeration.controller";
import {
  createChurch,
  updateChurch,
  deleteChurch,
  getChurchById,
  updateChurchBranch,
  deleteChurchBranch,
} from "../controllers/churches.admin.controller";
import {
  getUsersPresence,
  sendAdminEmail,
  listAdminEmailLog,
  getRecentUploads,
  getDashboardFeed,
  listAdminNotifications,
  markAdminNotificationsRead,
  listAdminCopyrightFreeAudio,
} from "../controllers/adminOps.controller";
import {
  listAdminTracks,
  getAdminTrack,
  createAdminTrackUploadIntent,
  finalizeAdminTrack,
  patchAdminTrack,
  deleteAdminTrack,
  replaceAdminTrackAudioIntent,
  finalizeAdminTrackAudioReplace,
  replaceAdminTrackCoverIntent,
  finalizeAdminTrackCoverReplace,
} from "../controllers/adminAudioTracks.controller";
import {
  listAdminArtists,
  createAdminArtist,
  patchAdminArtist,
  verifyAdminArtist,
} from "../controllers/adminArtists.controller";
import {
  listAdminAnnouncements,
  createAdminAnnouncement,
  patchAdminAnnouncement,
  listAdminCategories,
  upsertAdminCategory,
  deleteAdminCategory,
} from "../controllers/adminCatalog.controller";
import {
  getAdminConfig,
  patchAdminConfig,
  searchAdminMedia,
  getDashboardTimeseries,
  getAdminSystemHealth,
} from "../controllers/adminPlatform.controller";
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

router.get(
  "/dashboard/timeseries",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getDashboardTimeseries
);

router.get(
  "/config",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getAdminConfig
);

router.patch(
  "/config",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  patchAdminConfig
);

router.get(
  "/system/health",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getAdminSystemHealth
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

router.post(
  "/users/:id/warn",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  warnUser
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

router.get(
  "/churches/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getChurchById
);

router.patch(
  "/churches/:id/branches/:branchId",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateChurchBranch
);

router.delete(
  "/churches/:id/branches/:branchId",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  deleteChurchBranch
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

/** Re-sign private/staged preview URLs for admin player (~3600s TTL) */
router.post(
  "/media/:id/preview-refresh",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  refreshAdminMediaPreview
);

router.get(
  "/media/search",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  searchAdminMedia
);

router.get(
  "/media/recent",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getRecentUploads
);

router.get(
  "/audio/copyright-free",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminCopyrightFreeAudio
);

/** Phase-1 Track catalog (presigned upload) — keep static paths before :id */
router.get(
  "/audio/tracks",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminTracks
);

router.post(
  "/audio/tracks/upload-intent",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  createAdminTrackUploadIntent
);

router.post(
  "/audio/tracks/:trackId/finalize",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  finalizeAdminTrack
);

router.post(
  "/audio/tracks/:id/replace-audio/intent",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  replaceAdminTrackAudioIntent
);

router.post(
  "/audio/tracks/:id/replace-audio/finalize",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  finalizeAdminTrackAudioReplace
);

router.post(
  "/audio/tracks/:id/replace-cover/intent",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  replaceAdminTrackCoverIntent
);

router.post(
  "/audio/tracks/:id/replace-cover/finalize",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  finalizeAdminTrackCoverReplace
);

router.get(
  "/audio/tracks/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getAdminTrack
);

router.patch(
  "/audio/tracks/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  patchAdminTrack
);

router.delete(
  "/audio/tracks/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  deleteAdminTrack
);

router.get(
  "/artists",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminArtists
);

router.post(
  "/artists",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  createAdminArtist
);

router.patch(
  "/artists/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  patchAdminArtist
);

router.patch(
  "/artists/:id/verification",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  verifyAdminArtist
);

router.get(
  "/announcements",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminAnnouncements
);

router.post(
  "/announcements",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  createAdminAnnouncement
);

router.patch(
  "/announcements/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  patchAdminAnnouncement
);

router.get(
  "/categories",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminCategories
);

router.post(
  "/categories",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  upsertAdminCategory
);

router.delete(
  "/categories/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  deleteAdminCategory
);

router.get(
  "/notifications",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminNotifications
);

router.post(
  "/notifications/read",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  markAdminNotificationsRead
);

router.post(
  "/email",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  sendAdminEmail
);

router.get(
  "/email/log",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  listAdminEmailLog
);

router.get("/reports", verifyToken, requireAdmin, apiRateLimiter, listAdminReports);
router.post(
  "/reports/media/bulk-review",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  bulkReviewAdminMediaReports
);
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
router.get(
  "/reports/comments/:commentId",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getAdminCommentReportDetail
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

router.post(
  "/moderation/bulk",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  bulkUpdateModerationStatus
);

router.post(
  "/moderation/:id/rerun",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  rerunModeration
);

router.patch(
  "/moderation/:id/assign",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  assignModeration
);

router.get(
  "/moderation/:id/notes",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getModerationNotes
);

router.post(
  "/moderation/:id/notes",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  addModerationNote
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
