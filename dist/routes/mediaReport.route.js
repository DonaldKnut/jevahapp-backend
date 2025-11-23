"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mediaReport_controller_1 = require("../controllers/mediaReport.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
/**
 * @route   POST /api/media/:id/report
 * @desc    Report inappropriate media content
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @body    { reason: ReportReason, description?: string }
 * @returns { success: boolean, message: string, report: object }
 */
router.post("/:id/report", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, mediaReport_controller_1.reportMedia);
/**
 * @route   GET /api/media/:id/reports
 * @desc    Get all reports for a specific media (admin only)
 * @access  Protected (Admin only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, reports: object[], count: number }
 */
router.get("/:id/reports", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, mediaReport_controller_1.getMediaReports);
/**
 * @route   GET /api/media/reports/pending
 * @desc    Get all pending reports (admin only)
 * @access  Protected (Admin only)
 * @query   { page?: number, limit?: number }
 * @returns { success: boolean, reports: object[], pagination: object }
 */
router.get("/reports/pending", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, mediaReport_controller_1.getAllPendingReports);
/**
 * @route   POST /api/media/reports/:reportId/review
 * @desc    Review a report (admin only)
 * @access  Protected (Admin only)
 * @param   { reportId: string } - MongoDB ObjectId of the report
 * @body    { status: "reviewed" | "resolved" | "dismissed", adminNotes?: string }
 * @returns { success: boolean, message: string, report: object }
 */
router.post("/reports/:reportId/review", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, mediaReport_controller_1.reviewReport);
exports.default = router;
