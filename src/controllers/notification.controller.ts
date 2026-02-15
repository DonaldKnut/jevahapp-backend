import { Request, Response } from "express";
import { NotificationService } from "../service/notification.service";
import viralContentService from "../service/viralContent.service";
import mentionDetectionService from "../service/mentionDetection.service";
import contentInteractionService from "../service/contentInteraction.service";
import logger from "../utils/logger";

export class NotificationController {
  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || (req as any).user?.id;
      const { page = 1, limit = 20, type, unreadOnly } = req.query;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const notifications = await NotificationService.getUserNotifications(
        userId,
        Number(page),
        Number(limit),
        type as string
      );

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error: any) {
      logger.error("Failed to get user notifications:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get notifications",
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || (req as any).user?.id;
      const { notificationId } = req.params;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const success = await NotificationService.markAsRead(
        notificationId,
        userId
      );

      if (success) {
        res.json({ success: true, message: "Notification marked as read" });
      } else {
        res.status(404).json({
          success: false,
          error: "Notification not found",
        });
      }
    } catch (error: any) {
      logger.error("Failed to mark notification as read:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark notification as read",
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const count = await NotificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: `Marked ${count} notifications as read`,
        count,
      });
    } catch (error: any) {
      logger.error("Failed to mark all notifications as read:", error);
      res.status(500).json({
        success: false,
        error: "Failed to mark all notifications as read",
      });
    }
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const preferences =
        await NotificationService.getNotificationPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error: any) {
      logger.error("Failed to get notification preferences:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get notification preferences",
      });
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = (req as any).userId || (req as any).user?.id;
      const preferences = req.body;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const updatedPreferences =
        await NotificationService.updateNotificationPreferences(
          userId,
          preferences
        );

      res.json({
        success: true,
        data: updatedPreferences,
        message: "Notification preferences updated",
      });
    } catch (error: any) {
      logger.error("Failed to update notification preferences:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update notification preferences",
      });
    }
  }

  /**
   * Share content
   */
  async shareContent(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || (req as any).user?.id;
      const { contentId, contentType, sharePlatform } = req.body;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!contentId || !contentType) {
        res.status(400).json({
          error: "Content ID and type are required",
        });
        return;
      }

      const result = await contentInteractionService.shareContent(
        userId,
        contentId,
        contentType,
        sharePlatform
      );

      res.json({
        success: true,
        data: result,
        message: "Content shared successfully",
      });
    } catch (error: any) {
      logger.error("Failed to share content:", error);
      res.status(500).json({
        success: false,
        error: "Failed to share content",
      });
    }
  }

  /**
   * Get trending content
   */
  async getTrendingContent(req: Request, res: Response): Promise<void> {
    try {
      const {
        contentType = "media",
        limit = 10,
        timeRange = "24h",
      } = req.query;

      const trending = await viralContentService.getTrendingContent(
        contentType as "media" | "devotional",
        Number(limit),
        timeRange as "24h" | "7d" | "30d"
      );

      res.json({
        success: true,
        data: trending,
      });
    } catch (error: any) {
      logger.error("Failed to get trending content:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get trending content",
      });
    }
  }

  /**
   * Get mention suggestions
   */
  async getMentionSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || typeof query !== "string") {
        res.status(400).json({
          error: "Query parameter is required",
        });
        return;
      }

      const suggestions = await mentionDetectionService.getMentionSuggestions(
        query,
        Number(limit)
      );

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error: any) {
      logger.error("Failed to get mention suggestions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get mention suggestions",
      });
    }
  }

  /**
   * Get viral content statistics
   */
  async getViralStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await viralContentService.getViralStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error("Failed to get viral stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get viral statistics",
      });
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId || (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const stats = await NotificationService.getNotificationStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error("Failed to get notification stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get notification statistics",
      });
    }
  }
}

export default new NotificationController();
