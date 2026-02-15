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
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

/**
 * @route   GET /api/admin/dashboard/analytics
 * @desc    Get platform-wide analytics and statistics
 * @access  Protected (Admin only)
 * @returns { success: boolean, data: PlatformAnalytics }
 */
router.get(
  "/dashboard/analytics",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getPlatformAnalytics
);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filtering and pagination
 * @access  Protected (Admin only)
 * @query   { page?: number, limit?: number, search?: string, role?: string, isBanned?: boolean, isEmailVerified?: boolean }
 * @returns { success: boolean, data: { users: User[], pagination: Pagination } }
 */
router.get(
  "/users",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getUsers
);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get detailed user information
 * @access  Protected (Admin only)
 * @param   { id: string } - User ID
 * @returns { success: boolean, data: { user: User, stats: UserStats } }
 */
router.get(
  "/users/:id",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getUserDetails
);

/**
 * @route   POST /api/admin/users/:id/ban
 * @desc    Ban a user
 * @access  Protected (Admin only)
 * @param   { id: string } - User ID
 * @body    { reason?: string, duration?: number } - Duration in days (optional, permanent if not provided)
 * @returns { success: boolean, message: string }
 */
router.post(
  "/users/:id/ban",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  banUser
);

/**
 * @route   POST /api/admin/users/:id/unban
 * @desc    Unban a user
 * @access  Protected (Admin only)
 * @param   { id: string } - User ID
 * @returns { success: boolean, message: string }
 */
router.post(
  "/users/:id/unban",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  unbanUser
);

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update user role
 * @access  Protected (Admin only)
 * @param   { id: string } - User ID
 * @body    { role: UserRole }
 * @returns { success: boolean, message: string, data: { userId: string, oldRole: string, newRole: string } }
 */
router.patch(
  "/users/:id/role",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateUserRole
);

/**
 * @route   GET /api/admin/moderation/queue
 * @desc    Get moderation queue
 * @access  Protected (Admin only)
 * @query   { page?: number, limit?: number, status?: string }
 * @returns { success: boolean, data: { media: Media[], pagination: Pagination } }
 */
router.get(
  "/moderation/queue",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getModerationQueue
);

/**
 * @route   PATCH /api/admin/moderation/:id/status
 * @desc    Update moderation status (admin override)
 * @access  Protected (Admin only)
 * @param   { id: string } - Media ID
 * @body    { status: "approved" | "rejected" | "under_review", adminNotes?: string }
 * @returns { success: boolean, message: string }
 */
router.patch(
  "/moderation/:id/status",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateModerationStatus
);

/**
 * @route   GET /api/admin/activity
 * @desc    Get admin activity log
 * @access  Protected (Admin only)
 * @query   { page?: number, limit?: number, adminId?: string }
 * @returns { success: boolean, data: ActivityLog }
 */
router.get(
  "/activity",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  getAdminActivityLog
);

export default router;


