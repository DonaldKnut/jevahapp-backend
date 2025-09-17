"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportAnalyticsData = exports.getRealTimeAnalytics = exports.getAdvancedAnalytics = exports.getUserActivityAnalytics = exports.getContentPerformanceMetrics = exports.getUserEngagementMetrics = exports.getAnalyticsDashboard = void 0;
const analytics_service_1 = require("../service/analytics.service");
const rateLimiter_1 = require("../middleware/rateLimiter");
// Rate limiters
const analyticsRateLimiter = (0, rateLimiter_1.rateLimiter)(20, 60000); // 20 requests per minute
/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get comprehensive analytics dashboard
 * @access  Protected (Admin or User)
 * @query   { startDate?: string, endDate?: string, timeRange?: string }
 * @returns { success: boolean, data: AnalyticsDashboard }
 */
const getAnalyticsDashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        // Parse time range from query parameters
        const { startDate, endDate, timeRange } = req.query;
        let timeRangeData;
        if (startDate && endDate) {
            timeRangeData = {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            };
        }
        else if (timeRange) {
            const now = new Date();
            const days = parseInt(timeRange) || 30;
            timeRangeData = {
                startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
                endDate: now,
            };
        }
        const analyticsData = yield analytics_service_1.AnalyticsService.getAnalyticsDashboard(userId, userRole || "user", timeRangeData);
        res.status(200).json({
            success: true,
            message: "Analytics dashboard data retrieved successfully",
            data: analyticsData,
        });
    }
    catch (error) {
        console.error("Analytics dashboard error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch analytics dashboard",
        });
    }
});
exports.getAnalyticsDashboard = getAnalyticsDashboard;
/**
 * @route   GET /api/analytics/user-engagement
 * @desc    Get user engagement metrics
 * @access  Protected
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: UserEngagementMetrics }
 */
const getUserEngagementMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { startDate, endDate } = req.query;
        let timeRangeData;
        if (startDate && endDate) {
            timeRangeData = {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            };
        }
        const engagementMetrics = yield analytics_service_1.AnalyticsService.getUserEngagementMetrics(userId, timeRangeData);
        res.status(200).json({
            success: true,
            message: "User engagement metrics retrieved successfully",
            data: engagementMetrics,
        });
    }
    catch (error) {
        console.error("User engagement metrics error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user engagement metrics",
        });
    }
});
exports.getUserEngagementMetrics = getUserEngagementMetrics;
/**
 * @route   GET /api/analytics/content-performance
 * @desc    Get content performance metrics
 * @access  Protected
 * @query   { startDate?: string, endDate?: string, userId?: string }
 * @returns { success: boolean, data: ContentPerformanceMetrics }
 */
const getContentPerformanceMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { startDate, endDate, userId: queryUserId } = req.query;
        let timeRangeData;
        if (startDate && endDate) {
            timeRangeData = {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            };
        }
        // For non-admin users, only show their own content
        const targetUserId = (userRole || "user") === "admin" && queryUserId
            ? queryUserId
            : userId;
        const contentMetrics = yield analytics_service_1.AnalyticsService.getContentPerformanceMetrics(targetUserId, timeRangeData);
        res.status(200).json({
            success: true,
            message: "Content performance metrics retrieved successfully",
            data: contentMetrics,
        });
    }
    catch (error) {
        console.error("Content performance metrics error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch content performance metrics",
        });
    }
});
exports.getContentPerformanceMetrics = getContentPerformanceMetrics;
/**
 * @route   GET /api/analytics/user-activity
 * @desc    Get user activity analytics (Admin only)
 * @access  Protected (Admin only)
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: UserActivityAnalytics }
 */
const getUserActivityAnalytics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if ((userRole || "user") !== "admin") {
            res.status(403).json({
                success: false,
                message: "Forbidden: Admin access required",
            });
            return;
        }
        const { startDate, endDate } = req.query;
        let timeRangeData;
        if (startDate && endDate) {
            timeRangeData = {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            };
        }
        const activityAnalytics = yield analytics_service_1.AnalyticsService.getUserActivityAnalytics(timeRangeData);
        res.status(200).json({
            success: true,
            message: "User activity analytics retrieved successfully",
            data: activityAnalytics,
        });
    }
    catch (error) {
        console.error("User activity analytics error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user activity analytics",
        });
    }
});
exports.getUserActivityAnalytics = getUserActivityAnalytics;
/**
 * @route   GET /api/analytics/advanced
 * @desc    Get advanced analytics (Admin only)
 * @access  Protected (Admin only)
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: AdvancedAnalytics }
 */
const getAdvancedAnalytics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if ((userRole || "user") !== "admin") {
            res.status(403).json({
                success: false,
                message: "Forbidden: Admin access required",
            });
            return;
        }
        const { startDate, endDate } = req.query;
        let timeRangeData;
        if (startDate && endDate) {
            timeRangeData = {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            };
        }
        const advancedAnalytics = yield analytics_service_1.AnalyticsService.getAdvancedAnalytics(userId, timeRangeData);
        res.status(200).json({
            success: true,
            message: "Advanced analytics retrieved successfully",
            data: advancedAnalytics,
        });
    }
    catch (error) {
        console.error("Advanced analytics error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch advanced analytics",
        });
    }
});
exports.getAdvancedAnalytics = getAdvancedAnalytics;
/**
 * @route   GET /api/analytics/real-time
 * @desc    Get real-time analytics metrics
 * @access  Protected
 * @returns { success: boolean, data: RealTimeMetrics }
 */
const getRealTimeAnalytics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const realTimeMetrics = yield analytics_service_1.AnalyticsService.getAdvancedAnalytics(userId);
        const { realTimeMetrics: metrics } = realTimeMetrics;
        res.status(200).json({
            success: true,
            message: "Real-time analytics retrieved successfully",
            data: metrics,
        });
    }
    catch (error) {
        console.error("Real-time analytics error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch real-time analytics",
        });
    }
});
exports.getRealTimeAnalytics = getRealTimeAnalytics;
/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data (Admin only)
 * @access  Protected (Admin only)
 * @query   { format?: string, startDate?: string, endDate?: string }
 * @returns { success: boolean, data: ExportData }
 */
const exportAnalyticsData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const userRole = req.userRole;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if ((userRole || "user") !== "admin") {
            res.status(403).json({
                success: false,
                message: "Forbidden: Admin access required",
            });
            return;
        }
        const { format = "json", startDate, endDate } = req.query;
        let timeRangeData;
        if (startDate && endDate) {
            timeRangeData = {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            };
        }
        const analyticsData = yield analytics_service_1.AnalyticsService.getAnalyticsDashboard(userId, userRole || "user", timeRangeData);
        if (format === "csv") {
            // Convert to CSV format (simplified)
            const csvData = convertToCSV(analyticsData);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=analytics.csv");
            res.status(200).send(csvData);
        }
        else {
            res.status(200).json({
                success: true,
                message: "Analytics data exported successfully",
                data: analyticsData,
                exportInfo: {
                    format: "json",
                    timestamp: new Date().toISOString(),
                    timeRange: timeRangeData,
                },
            });
        }
    }
    catch (error) {
        console.error("Export analytics error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to export analytics data",
        });
    }
});
exports.exportAnalyticsData = exportAnalyticsData;
// Helper function to convert analytics data to CSV
function convertToCSV(data) {
    var _a, _b, _c, _d;
    // This is a simplified CSV conversion
    // In a real implementation, you'd want to flatten the nested objects
    const headers = ["metric", "value", "timestamp"];
    const rows = [
        ["totalUsers", ((_a = data.summary) === null || _a === void 0 ? void 0 : _a.totalUsers) || 0, new Date().toISOString()],
        ["totalContent", ((_b = data.summary) === null || _b === void 0 ? void 0 : _b.totalContent) || 0, new Date().toISOString()],
        [
            "totalInteractions",
            ((_c = data.summary) === null || _c === void 0 ? void 0 : _c.totalInteractions) || 0,
            new Date().toISOString(),
        ],
        [
            "engagementRate",
            ((_d = data.summary) === null || _d === void 0 ? void 0 : _d.engagementRate) || 0,
            new Date().toISOString(),
        ],
    ];
    return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}
