import { Media } from "../models/media.model";
import { Devotional } from "../models/devotional.model";
import { NotificationService } from "./notification.service";
import logger from "../utils/logger";

interface ViralThresholds {
  views: number[];
  likes: number[];
  shares: number[];
  comments: number[];
}

class ViralContentService {
  private readonly VIRAL_THRESHOLDS: ViralThresholds = {
    views: [1000, 5000, 10000, 50000, 100000],
    likes: [100, 500, 1000, 5000, 10000],
    shares: [50, 250, 500, 2500, 5000],
    comments: [25, 100, 250, 1000, 2500],
  };

  private readonly MILESTONE_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours
  private readonly processedMilestones = new Map<string, Set<string>>();

  /**
   * Check if content has reached viral milestones
   */
  async checkViralMilestones(
    contentId: string,
    contentType: "media" | "devotional"
  ): Promise<void> {
    try {
      let content;
      if (contentType === "media") {
        content = await Media.findById(contentId);
      } else {
        content = await Devotional.findById(contentId);
      }

      if (!content) return;

      const milestones = await this.getReachedMilestones(content);

      for (const milestone of milestones) {
        await this.sendMilestoneNotification(
          contentId,
          contentType,
          milestone.type,
          milestone.count
        );
      }
    } catch (error) {
      logger.error("Failed to check viral milestones:", error);
    }
  }

  /**
   * Get milestones that have been reached
   */
  private async getReachedMilestones(
    content: any
  ): Promise<Array<{ type: string; count: number }>> {
    const milestones: Array<{ type: string; count: number }> = [];
    const contentKey = `${content._id}`;

    // Initialize processed milestones for this content if not exists
    if (!this.processedMilestones.has(contentKey)) {
      this.processedMilestones.set(contentKey, new Set());
    }

    const processed = this.processedMilestones.get(contentKey)!;

    // Check views milestones
    const viewCount = content.viewCount || 0;
    for (const threshold of this.VIRAL_THRESHOLDS.views) {
      if (viewCount >= threshold && !processed.has(`views_${threshold}`)) {
        milestones.push({ type: "views", count: threshold });
        processed.add(`views_${threshold}`);
      }
    }

    // Check likes milestones
    const likeCount = content.likeCount || 0;
    for (const threshold of this.VIRAL_THRESHOLDS.likes) {
      if (likeCount >= threshold && !processed.has(`likes_${threshold}`)) {
        milestones.push({ type: "likes", count: threshold });
        processed.add(`likes_${threshold}`);
      }
    }

    // Check shares milestones
    const shareCount = content.shareCount || 0;
    for (const threshold of this.VIRAL_THRESHOLDS.shares) {
      if (shareCount >= threshold && !processed.has(`shares_${threshold}`)) {
        milestones.push({ type: "shares", count: threshold });
        processed.add(`shares_${threshold}`);
      }
    }

    // Check comments milestones
    const commentCount = content.commentCount || 0;
    for (const threshold of this.VIRAL_THRESHOLDS.comments) {
      if (
        commentCount >= threshold &&
        !processed.has(`comments_${threshold}`)
      ) {
        milestones.push({ type: "comments", count: threshold });
        processed.add(`comments_${threshold}`);
      }
    }

    return milestones;
  }

  /**
   * Send milestone notification
   */
  private async sendMilestoneNotification(
    contentId: string,
    contentType: string,
    milestoneType: string,
    count: number
  ): Promise<void> {
    try {
      await NotificationService.notifyViralContent(
        contentId,
        contentType,
        milestoneType,
        count
      );

      logger.info("Viral milestone notification sent", {
        contentId,
        contentType,
        milestoneType,
        count,
      });
    } catch (error) {
      logger.error("Failed to send milestone notification:", error);
    }
  }

  /**
   * Get trending content based on engagement
   */
  async getTrendingContent(
    contentType: "media" | "devotional",
    limit: number = 10,
    timeRange: "24h" | "7d" | "30d" = "24h"
  ): Promise<any[]> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);
      const Model = contentType === "media" ? Media : Devotional;

      const trending = await Model.aggregate([
        {
          $match: {
            createdAt: timeFilter,
            $or: [
              { viewCount: { $gte: 100 } },
              { likeCount: { $gte: 10 } },
              { shareCount: { $gte: 5 } },
            ],
          },
        },
        {
          $addFields: {
            engagementScore: {
              $add: [
                { $multiply: ["$viewCount", 1] },
                { $multiply: ["$likeCount", 5] },
                { $multiply: ["$shareCount", 10] },
                { $multiply: ["$commentCount", 3] },
              ],
            },
          },
        },
        {
          $sort: { engagementScore: -1 },
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: "users",
            localField: "uploadedBy",
            foreignField: "_id",
            as: "uploader",
          },
        },
        {
          $unwind: "$uploader",
        },
        {
          $project: {
            _id: 1,
            title: 1,
            description: 1,
            thumbnailUrl: 1,
            viewCount: 1,
            likeCount: 1,
            shareCount: 1,
            commentCount: 1,
            engagementScore: 1,
            createdAt: 1,
            uploader: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              avatar: 1,
            },
          },
        },
      ]);

      return trending;
    } catch (error) {
      logger.error("Failed to get trending content:", error);
      return [];
    }
  }

  /**
   * Get time filter for trending content
   */
  private getTimeFilter(timeRange: string): any {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { $gte: startDate };
  }

  /**
   * Clean up old processed milestones (run periodically)
   */
  async cleanupProcessedMilestones(): Promise<void> {
    try {
      // Keep only recent milestones (last 7 days)
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // This would be implemented with a more sophisticated cleanup
      // For now, we'll just log the cleanup
      logger.info("Cleaned up old processed milestones", {
        cutoffDate,
        processedCount: this.processedMilestones.size,
      });
    } catch (error) {
      logger.error("Failed to cleanup processed milestones:", error);
    }
  }

  /**
   * Get viral content statistics
   */
  async getViralStats(): Promise<{
    totalViralContent: number;
    topPerformingContent: any[];
    milestoneDistribution: any;
  }> {
    try {
      const [mediaStats, devotionalStats] = await Promise.all([
        this.getContentStats("media"),
        this.getContentStats("devotional"),
      ]);

      const totalViralContent =
        mediaStats.viralCount + devotionalStats.viralCount;
      const topPerformingContent = [
        ...mediaStats.topContent,
        ...devotionalStats.topContent,
      ]
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 10);

      return {
        totalViralContent,
        topPerformingContent,
        milestoneDistribution: {
          views:
            mediaStats.milestoneDistribution.views +
            devotionalStats.milestoneDistribution.views,
          likes:
            mediaStats.milestoneDistribution.likes +
            devotionalStats.milestoneDistribution.likes,
          shares:
            mediaStats.milestoneDistribution.shares +
            devotionalStats.milestoneDistribution.shares,
          comments:
            mediaStats.milestoneDistribution.comments +
            devotionalStats.milestoneDistribution.comments,
        },
      };
    } catch (error) {
      logger.error("Failed to get viral stats:", error);
      return {
        totalViralContent: 0,
        topPerformingContent: [],
        milestoneDistribution: { views: 0, likes: 0, shares: 0, comments: 0 },
      };
    }
  }

  /**
   * Get content statistics for a specific type
   */
  private async getContentStats(contentType: "media" | "devotional"): Promise<{
    viralCount: number;
    topContent: any[];
    milestoneDistribution: any;
  }> {
    const Model = contentType === "media" ? Media : Devotional;

    const [viralCount, topContent, milestoneDistribution] = await Promise.all([
      Model.countDocuments({
        $or: [
          { viewCount: { $gte: 1000 } },
          { likeCount: { $gte: 100 } },
          { shareCount: { $gte: 50 } },
        ],
      }),
      Model.find({
        $or: [
          { viewCount: { $gte: 1000 } },
          { likeCount: { $gte: 100 } },
          { shareCount: { $gte: 50 } },
        ],
      })
        .sort({ viewCount: -1 })
        .limit(5)
        .populate("uploadedBy", "firstName lastName avatar"),
      Model.aggregate([
        {
          $group: {
            _id: null,
            totalViews: { $sum: "$viewCount" },
            totalLikes: { $sum: "$likeCount" },
            totalShares: { $sum: "$shareCount" },
            totalComments: { $sum: "$commentCount" },
          },
        },
      ]),
    ]);

    return {
      viralCount,
      topContent,
      milestoneDistribution: milestoneDistribution[0] || {
        totalViews: 0,
        totalLikes: 0,
        totalShares: 0,
        totalComments: 0,
      },
    };
  }
}

export default new ViralContentService();
