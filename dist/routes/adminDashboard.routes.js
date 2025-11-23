"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminDashboard_controller_1 = require("../controllers/adminDashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/admin/dashboard/analytics
 * @desc    Get platform-wide analytics and statistics
 * @access  Protected (Admin only)
 * @returns { success: boolean, data: PlatformAnalytics }
 */
router.get("/dashboard/analytics", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.getPlatformAnalytics);
/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filtering and pagination
 * @access  Protected (Admin only)
 * @query   { page?: number, limit?: number, search?: string, role?: string, isBanned?: boolean, isEmailVerified?: boolean }
 * @returns { success: boolean, data: { users: User[], pagination: Pagination } }
 */
router.get("/users", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.getUsers);
/**
 * @route   GET /api/admin/users/:id
 * @desc    Get detailed user information
 * @access  Protected (Admin only)
 * @param   { id: string } - User ID
 * @returns { success: boolean, data: { user: User, stats: UserStats } }
 */
router.get("/users/:id", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.getUserDetails);
/**
 * @route   POST /api/admin/users/:id/ban
 * @desc    Ban a user
 * @access  Protected (Admin only)
 * @param   { id: string } - User ID
 * @body    { reason?: string, duration?: number } - Duration in days (optional, permanent if not provided)
 * @returns { success: boolean, message: string }
 */
router.post("/users/:id/ban", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.banUser);
/**
 * @route   POST /api/admin/users/:id/unban
 * @desc    Unban a user
 * @access  Protected (Admin only)
 * @param   { id: string } - User ID
 * @returns { success: boolean, message: string }
 */
router.post("/users/:id/unban", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.unbanUser);
/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update user role
 * @access  Protected (Admin only)
 * @param   { id: string } - User ID
 * @body    { role: UserRole }
 * @returns { success: boolean, message: string, data: { userId: string, oldRole: string, newRole: string } }
 */
router.patch("/users/:id/role", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.updateUserRole);
/**
 * @route   GET /api/admin/moderation/queue
 * @desc    Get moderation queue
 * @access  Protected (Admin only)
 * @query   { page?: number, limit?: number, status?: string }
 * @returns { success: boolean, data: { media: Media[], pagination: Pagination } }
 */
router.get("/moderation/queue", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.getModerationQueue);
/**
 * @route   PATCH /api/admin/moderation/:id/status
 * @desc    Update moderation status (admin override)
 * @access  Protected (Admin only)
 * @param   { id: string } - Media ID
 * @body    { status: "approved" | "rejected" | "under_review", adminNotes?: string }
 * @returns { success: boolean, message: string }
 */
router.patch("/moderation/:id/status", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.updateModerationStatus);
/**
 * @route   GET /api/admin/activity
 * @desc    Get admin activity log
 * @access  Protected (Admin only)
 * @query   { page?: number, limit?: number, adminId?: string }
 * @returns { success: boolean, data: ActivityLog }
 */
router.get("/activity", auth_middleware_1.verifyToken, role_middleware_1.requireAdmin, rateLimiter_1.apiRateLimiter, adminDashboard_controller_1.getAdminActivityLog);
exports.default = router;
