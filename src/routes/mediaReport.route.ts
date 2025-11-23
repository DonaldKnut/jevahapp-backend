import { Router } from "express";
import {
  reportMedia,
  getMediaReports,
  getAllPendingReports,
  reviewReport,
} from "../controllers/mediaReport.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";

const router = Router();

/**
 * @route   POST /api/media/:id/report
 * @desc    Report inappropriate media content
 * @access  Protected (Authenticated users only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @body    { reason: ReportReason, description?: string }
 * @returns { success: boolean, message: string, report: object }
 */
router.post(
  "/:id/report",
  verifyToken,
  apiRateLimiter,
  reportMedia
);

/**
 * @route   GET /api/media/:id/reports
 * @desc    Get all reports for a specific media (admin only)
 * @access  Protected (Admin only)
 * @param   { id: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, reports: object[], count: number }
 */
router.get(
  "/:id/reports",
  verifyToken,
  apiRateLimiter,
  getMediaReports
);

/**
 * @route   GET /api/media/reports/pending
 * @desc    Get all pending reports (admin only)
 * @access  Protected (Admin only)
 * @query   { page?: number, limit?: number }
 * @returns { success: boolean, reports: object[], pagination: object }
 */
router.get(
  "/reports/pending",
  verifyToken,
  apiRateLimiter,
  getAllPendingReports
);

/**
 * @route   POST /api/media/reports/:reportId/review
 * @desc    Review a report (admin only)
 * @access  Protected (Admin only)
 * @param   { reportId: string } - MongoDB ObjectId of the report
 * @body    { status: "reviewed" | "resolved" | "dismissed", adminNotes?: string }
 * @returns { success: boolean, message: string, report: object }
 */
router.post(
  "/reports/:reportId/review",
  verifyToken,
  apiRateLimiter,
  reviewReport
);

export default router;


