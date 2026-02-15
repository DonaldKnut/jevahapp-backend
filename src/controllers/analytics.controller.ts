import { Request, Response } from "express";
import { AnalyticsService } from "../service/analytics.service";
import { verifyToken } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimiter";

// Rate limiters
const analyticsRateLimiter = rateLimiter(20, 60000); // 20 requests per minute

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get comprehensive analytics dashboard
 * @access  Protected (Admin or User)
 * @query   { startDate?: string, endDate?: string, timeRange?: string }
 * @returns { success: boolean, data: AnalyticsDashboard }
 */
export const getAnalyticsDashboard = async (
  req: Request,
  res: Response
): Promise<void> => {
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
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };
    } else if (timeRange) {
      const now = new Date();
      const days = parseInt(timeRange as string) || 30;
      timeRangeData = {
        startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
        endDate: now,
      };
    }

    const analyticsData = await AnalyticsService.getAnalyticsDashboard(
      userId,
      userRole || "user",
      timeRangeData
    );

    res.status(200).json({
      success: true,
      message: "Analytics dashboard data retrieved successfully",
      data: analyticsData,
    });
  } catch (error: any) {
    console.error("Analytics dashboard error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch analytics dashboard",
    });
  }
};

/**
 * @route   GET /api/analytics/user-engagement
 * @desc    Get user engagement metrics
 * @access  Protected
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: UserEngagementMetrics }
 */
export const getUserEngagementMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
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
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };
    }

    const engagementMetrics = await AnalyticsService.getUserEngagementMetrics(
      userId,
      timeRangeData
    );

    res.status(200).json({
      success: true,
      message: "User engagement metrics retrieved successfully",
      data: engagementMetrics,
    });
  } catch (error: any) {
    console.error("User engagement metrics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user engagement metrics",
    });
  }
};

/**
 * @route   GET /api/analytics/content-performance
 * @desc    Get content performance metrics
 * @access  Protected
 * @query   { startDate?: string, endDate?: string, userId?: string }
 * @returns { success: boolean, data: ContentPerformanceMetrics }
 */
export const getContentPerformanceMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
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
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };
    }

    // For non-admin users, only show their own content
    const targetUserId =
      (userRole || "user") === "admin" && queryUserId
        ? (queryUserId as string)
        : userId;

    const contentMetrics = await AnalyticsService.getContentPerformanceMetrics(
      targetUserId,
      timeRangeData
    );

    res.status(200).json({
      success: true,
      message: "Content performance metrics retrieved successfully",
      data: contentMetrics,
    });
  } catch (error: any) {
    console.error("Content performance metrics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch content performance metrics",
    });
  }
};

/**
 * @route   GET /api/analytics/user-activity
 * @desc    Get user activity analytics (Admin only)
 * @access  Protected (Admin only)
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: UserActivityAnalytics }
 */
export const getUserActivityAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
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
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };
    }

    const activityAnalytics =
      await AnalyticsService.getUserActivityAnalytics(timeRangeData);

    res.status(200).json({
      success: true,
      message: "User activity analytics retrieved successfully",
      data: activityAnalytics,
    });
  } catch (error: any) {
    console.error("User activity analytics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user activity analytics",
    });
  }
};

/**
 * @route   GET /api/analytics/advanced
 * @desc    Get advanced analytics (Admin only)
 * @access  Protected (Admin only)
 * @query   { startDate?: string, endDate?: string }
 * @returns { success: boolean, data: AdvancedAnalytics }
 */
export const getAdvancedAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
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
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };
    }

    const advancedAnalytics = await AnalyticsService.getAdvancedAnalytics(
      userId,
      timeRangeData
    );

    res.status(200).json({
      success: true,
      message: "Advanced analytics retrieved successfully",
      data: advancedAnalytics,
    });
  } catch (error: any) {
    console.error("Advanced analytics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch advanced analytics",
    });
  }
};

/**
 * @route   GET /api/analytics/real-time
 * @desc    Get real-time analytics metrics
 * @access  Protected
 * @returns { success: boolean, data: RealTimeMetrics }
 */
export const getRealTimeAnalytics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const realTimeMetrics = await AnalyticsService.getAdvancedAnalytics(userId);
    const { realTimeMetrics: metrics } = realTimeMetrics;

    res.status(200).json({
      success: true,
      message: "Real-time analytics retrieved successfully",
      data: metrics,
    });
  } catch (error: any) {
    console.error("Real-time analytics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch real-time analytics",
    });
  }
};

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data (Admin only)
 * @access  Protected (Admin only)
 * @query   { format?: string, startDate?: string, endDate?: string }
 * @returns { success: boolean, data: ExportData }
 */
export const exportAnalyticsData = async (
  req: Request,
  res: Response
): Promise<void> => {
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
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      };
    }

    const analyticsData = await AnalyticsService.getAnalyticsDashboard(
      userId,
      userRole || "user",
      timeRangeData
    );

    if (format === "csv") {
      // Convert to CSV format (simplified)
      const csvData = convertToCSV(analyticsData);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=analytics.csv"
      );
      res.status(200).send(csvData);
    } else {
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
  } catch (error: any) {
    console.error("Export analytics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export analytics data",
    });
  }
};

// Helper function to convert analytics data to CSV
function convertToCSV(data: any): string {
  // This is a simplified CSV conversion
  // In a real implementation, you'd want to flatten the nested objects
  const headers = ["metric", "value", "timestamp"];
  const rows = [
    ["totalUsers", data.summary?.totalUsers || 0, new Date().toISOString()],
    ["totalContent", data.summary?.totalContent || 0, new Date().toISOString()],
    [
      "totalInteractions",
      data.summary?.totalInteractions || 0,
      new Date().toISOString(),
    ],
    [
      "engagementRate",
      data.summary?.engagementRate || 0,
      new Date().toISOString(),
    ],
  ];

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}
