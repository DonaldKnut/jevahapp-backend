import mongoose, { Types } from "mongoose";
import { Media } from "../models/media.model";
import { User } from "../models/user.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { Bookmark } from "../models/bookmark.model";
// import { Comment } from "../models/comment.model";
import { GameSession } from "../models/game.model";
import { AuditService } from "./audit.service";

export interface AnalyticsTimeRange {
  startDate: Date;
  endDate: Date;
}

export interface UserEngagementMetrics {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalDownloads: number;
  totalBookmarks: number;
  totalComments: number;
  averageSessionDuration: number;
  mostActiveDay: string;
  mostActiveHour: number;
  engagementScore: number;
}

export interface ContentPerformanceMetrics {
  totalContent: number;
  contentByType: {
    videos: number;
    audio: number;
    books: number;
    music: number;
  };
  topPerformingContent: Array<{
    id: string;
    title: string;
    contentType: string;
    views: number;
    likes: number;
    shares: number;
    engagementRate: number;
  }>;
  contentTrends: Array<{
    date: string;
    uploads: number;
    views: number;
    likes: number;
  }>;
}

export interface UserActivityAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  userRetentionRate: number;
  averageSessionDuration: number;
  userEngagementDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  userActivityTimeline: Array<{
    date: string;
    activeUsers: number;
    newUsers: number;
    sessions: number;
  }>;
}

export interface AdvancedAnalytics {
  realTimeMetrics: {
    currentActiveUsers: number;
    currentSessions: number;
    currentUploads: number;
    currentInteractions: number;
  };
  userBehavior: {
    averageTimeOnApp: number;
    mostPopularContentTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    userJourneyFunnel: {
      registered: number;
      firstContent: number;
      firstInteraction: number;
      firstShare: number;
      firstDownload: number;
    };
    deviceUsage: {
      mobile: number;
      desktop: number;
      tablet: number;
    };
  };
  contentInsights: {
    viralContent: Array<{
      id: string;
      title: string;
      contentType: string;
      viralScore: number;
      shares: number;
      views: number;
    }>;
    trendingTopics: Array<{
      topic: string;
      count: number;
      growth: number;
    }>;
    contentQualityScore: number;
    averageContentEngagement: number;
  };
  businessMetrics: {
    revenue: number;
    conversionRate: number;
    userLifetimeValue: number;
    churnRate: number;
    growthRate: number;
  };
}

export class AnalyticsService {
  /**
   * Get comprehensive user engagement metrics
   */
  static async getUserEngagementMetrics(
    userId: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<UserEngagementMetrics> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const defaultTimeRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: new Date(),
    };

    const range = timeRange || defaultTimeRange;

    // Get user interactions
    const interactions = await MediaInteraction.find({
      user: new Types.ObjectId(userId),
      createdAt: { $gte: range.startDate, $lte: range.endDate },
    });

    // Calculate metrics
    const totalViews = interactions.filter(
      i => i.interactionType === "view"
    ).length;
    const totalLikes = interactions.filter(
      i => i.interactionType === "like"
    ).length;
    const totalShares = interactions.filter(
      i => i.interactionType === "share"
    ).length;
    const totalDownloads = interactions.filter(
      i => i.interactionType === "download"
    ).length;

    // Get bookmarks and comments
    const bookmarks = await Bookmark.find({
      user: new Types.ObjectId(userId),
      createdAt: { $gte: range.startDate, $lte: range.endDate },
    });

    // const comments = await Comment.find({
    //   user: new Types.ObjectId(userId),
    //   createdAt: { $gte: range.startDate, $lte: range.endDate },
    // });
    const comments: any[] = []; // Placeholder until Comment model is available

    // Calculate session duration from user activities
    const userActivities = user.userActivities || [];
    const recentActivities = userActivities.filter(
      (activity: any) => new Date(activity.timestamp) >= range.startDate
    );

    const averageSessionDuration =
      this.calculateAverageSessionDuration(recentActivities);
    const mostActiveDay = this.getMostActiveDay(recentActivities);
    const mostActiveHour = this.getMostActiveHour(recentActivities);
    const engagementScore = this.calculateEngagementScore(
      interactions,
      bookmarks,
      comments
    );

    return {
      totalViews,
      totalLikes,
      totalShares,
      totalDownloads,
      totalBookmarks: bookmarks.length,
      totalComments: comments.length,
      averageSessionDuration,
      mostActiveDay,
      mostActiveHour,
      engagementScore,
    };
  }

  /**
   * Get content performance metrics
   */
  static async getContentPerformanceMetrics(
    userId?: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<ContentPerformanceMetrics> {
    const defaultTimeRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    const range = timeRange || defaultTimeRange;

    // Build query based on user role
    const mediaQuery: any = {
      createdAt: { $gte: range.startDate, $lte: range.endDate },
    };

    if (userId) {
      mediaQuery.uploadedBy = new Types.ObjectId(userId);
    }

    const media = await Media.find(mediaQuery);

    // Count content by type
    const contentByType = {
      videos: media.filter(m => m.contentType === "videos").length,
      audio: media.filter(m => m.contentType === "audio").length,
      books: media.filter(m => m.contentType === "books").length,
      music: media.filter(m => m.contentType === "music").length,
    };

    // Get top performing content
    const topPerformingContent = await this.getTopPerformingContent(
      mediaQuery,
      10
    );

    // Get content trends
    const contentTrends = await this.getContentTrends(mediaQuery, range);

    return {
      totalContent: media.length,
      contentByType,
      topPerformingContent,
      contentTrends,
    };
  }

  /**
   * Get user activity analytics
   */
  static async getUserActivityAnalytics(
    timeRange?: AnalyticsTimeRange
  ): Promise<UserActivityAnalytics> {
    const defaultTimeRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    const range = timeRange || defaultTimeRange;

    // Get user counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastLoginAt: { $gte: range.startDate },
    });
    const newUsers = await User.countDocuments({
      createdAt: { $gte: range.startDate, $lte: range.endDate },
    });

    // Calculate returning users
    const returningUsers = activeUsers - newUsers;

    // Calculate retention rate
    const userRetentionRate =
      totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    // Get average session duration
    const averageSessionDuration = await this.getAverageSessionDuration(range);

    // Get user engagement distribution
    const userEngagementDistribution =
      await this.getUserEngagementDistribution(range);

    // Get activity timeline
    const userActivityTimeline = await this.getUserActivityTimeline(range);

    return {
      totalUsers,
      activeUsers,
      newUsers,
      returningUsers,
      userRetentionRate,
      averageSessionDuration,
      userEngagementDistribution,
      userActivityTimeline,
    };
  }

  /**
   * Get advanced analytics for dashboard
   */
  static async getAdvancedAnalytics(
    userId?: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<AdvancedAnalytics> {
    const defaultTimeRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    const range = timeRange || defaultTimeRange;

    // Get real-time metrics
    const realTimeMetrics = await this.getRealTimeMetrics();

    // Get user behavior insights
    const userBehavior = await this.getUserBehaviorInsights(range);

    // Get content insights
    const contentInsights = await this.getContentInsights(range);

    // Get business metrics
    const businessMetrics = await this.getBusinessMetrics(range);

    return {
      realTimeMetrics,
      userBehavior,
      contentInsights,
      businessMetrics,
    };
  }

  /**
   * Get analytics dashboard data
   */
  static async getAnalyticsDashboard(
    userId: string,
    userRole: string,
    timeRange?: AnalyticsTimeRange
  ): Promise<any> {
    const defaultTimeRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    const range = timeRange || defaultTimeRange;

    if (userRole === "admin") {
      // Admin dashboard - comprehensive analytics
      const [
        userEngagement,
        contentPerformance,
        userActivity,
        advancedAnalytics,
      ] = await Promise.all([
        this.getUserEngagementMetrics(userId, range),
        this.getContentPerformanceMetrics(undefined, range),
        this.getUserActivityAnalytics(range),
        this.getAdvancedAnalytics(undefined, range),
      ]);

      return {
        isAdmin: true,
        timeRange: range,
        userEngagement,
        contentPerformance,
        userActivity,
        advancedAnalytics,
        summary: {
          totalUsers: userActivity.totalUsers,
          totalContent: contentPerformance.totalContent,
          totalInteractions:
            userEngagement.totalViews +
            userEngagement.totalLikes +
            userEngagement.totalShares,
          engagementRate: userEngagement.engagementScore,
        },
      };
    } else {
      // User dashboard - personal analytics
      const [userEngagement, contentPerformance, userActivity] =
        await Promise.all([
          this.getUserEngagementMetrics(userId, range),
          this.getContentPerformanceMetrics(userId, range),
          this.getUserActivityAnalytics(range),
        ]);

      return {
        isAdmin: false,
        timeRange: range,
        userEngagement,
        contentPerformance,
        userActivity,
        summary: {
          totalContent: contentPerformance.totalContent,
          totalInteractions:
            userEngagement.totalViews +
            userEngagement.totalLikes +
            userEngagement.totalShares,
          engagementRate: userEngagement.engagementScore,
          rank: await this.getUserRank(userId),
        },
      };
    }
  }

  // Helper methods
  private static calculateAverageSessionDuration(activities: any[]): number {
    if (activities.length === 0) return 0;

    // Group activities by session (assuming sessions are separated by 30+ minutes)
    const sessions: any[][] = [];
    let currentSession: any[] = [];

    activities.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      const prevActivity = i > 0 ? activities[i - 1] : null;

      if (prevActivity) {
        const timeDiff =
          new Date(activity.timestamp).getTime() -
          new Date(prevActivity.timestamp).getTime();
        if (timeDiff > 30 * 60 * 1000) {
          // 30 minutes
          sessions.push(currentSession);
          currentSession = [activity];
        } else {
          currentSession.push(activity);
        }
      } else {
        currentSession.push(activity);
      }
    }

    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }

    // Calculate average session duration
    const sessionDurations = sessions.map(session => {
      if (session.length < 2) return 0;
      const start = new Date(session[0].timestamp).getTime();
      const end = new Date(session[session.length - 1].timestamp).getTime();
      return end - start;
    });

    return (
      sessionDurations.reduce((sum, duration) => sum + duration, 0) /
      sessionDurations.length
    );
  }

  private static getMostActiveDay(activities: any[]): string {
    if (activities.length === 0) return "Unknown";

    const dayCounts: { [key: string]: number } = {};
    activities.forEach(activity => {
      const day = new Date(activity.timestamp).toLocaleDateString("en-US", {
        weekday: "long",
      });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    return Object.keys(dayCounts).reduce((a, b) =>
      dayCounts[a] > dayCounts[b] ? a : b
    );
  }

  private static getMostActiveHour(activities: any[]): number {
    if (activities.length === 0) return 0;

    const hourCounts: { [key: number]: number } = {};
    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return parseInt(
      Object.keys(hourCounts).reduce((a, b) =>
        hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b
      )
    );
  }

  private static calculateEngagementScore(
    interactions: any[],
    bookmarks: any[],
    comments: any[]
  ): number {
    const totalInteractions =
      interactions.length + bookmarks.length + comments.length;
    const uniqueContent = new Set([
      ...interactions.map(i => i.media.toString()),
      ...bookmarks.map(b => b.media.toString()),
      ...comments.map(c => c.media?.toString()).filter(Boolean),
    ]).size;

    if (uniqueContent === 0) return 0;

    // Calculate engagement score based on interactions per unique content
    const engagementRate = totalInteractions / uniqueContent;
    return Math.min(100, Math.round(engagementRate * 10)); // Cap at 100
  }

  private static async getTopPerformingContent(
    query: any,
    limit: number
  ): Promise<any[]> {
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "mediainteractions",
          localField: "_id",
          foreignField: "media",
          as: "interactions",
        },
      },
      {
        $addFields: {
          views: {
            $size: {
              $filter: {
                input: "$interactions",
                cond: { $eq: ["$$this.interactionType", "view"] },
              },
            },
          },
          likes: {
            $size: {
              $filter: {
                input: "$interactions",
                cond: { $eq: ["$$this.interactionType", "like"] },
              },
            },
          },
          shares: {
            $size: {
              $filter: {
                input: "$interactions",
                cond: { $eq: ["$$this.interactionType", "share"] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          engagementRate: {
            $cond: {
              if: { $gt: ["$views", 0] },
              then: { $divide: [{ $add: ["$likes", "$shares"] }, "$views"] },
              else: 0,
            },
          },
        },
      },
      { $sort: { engagementRate: -1 as const, views: -1 as const } },
      { $limit: limit },
      {
        $project: {
          id: "$_id",
          title: 1,
          contentType: 1,
          views: 1,
          likes: 1,
          shares: 1,
          engagementRate: 1,
        },
      },
    ];

    return await Media.aggregate(pipeline);
  }

  private static async getContentTrends(
    query: any,
    range: AnalyticsTimeRange
  ): Promise<any[]> {
    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
          uploads: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 as const } },
    ];

    const uploadTrends = await Media.aggregate(pipeline);

    // Get interaction trends
    const interactionTrends = await MediaInteraction.aggregate([
      {
        $match: {
          createdAt: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$interactionType",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          views: {
            $sum: { $cond: [{ $eq: ["$_id.type", "view"] }, "$count", 0] },
          },
          likes: {
            $sum: { $cond: [{ $eq: ["$_id.type", "like"] }, "$count", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Combine trends
    const trendsMap = new Map();

    uploadTrends.forEach(trend => {
      trendsMap.set(trend._id.date, {
        date: trend._id.date,
        uploads: trend.uploads,
        views: 0,
        likes: 0,
      });
    });

    interactionTrends.forEach(trend => {
      const existing = trendsMap.get(trend._id) || {
        date: trend._id,
        uploads: 0,
        views: 0,
        likes: 0,
      };
      existing.views = trend.views;
      existing.likes = trend.likes;
      trendsMap.set(trend._id, existing);
    });

    return Array.from(trendsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  private static async getAverageSessionDuration(
    range: AnalyticsTimeRange
  ): Promise<number> {
    // This would require more sophisticated session tracking
    // For now, return a placeholder
    return 1800000; // 30 minutes in milliseconds
  }

  private static async getUserEngagementDistribution(
    range: AnalyticsTimeRange
  ): Promise<any> {
    // Calculate engagement distribution based on user activity
    const users = await User.find({
      lastLoginAt: { $gte: range.startDate },
    });

    const engagementScores = await Promise.all(
      users.map(async user => {
        const metrics = await this.getUserEngagementMetrics(
          user._id.toString(),
          range
        );
        return metrics.engagementScore;
      })
    );

    const high = engagementScores.filter(score => score >= 70).length;
    const medium = engagementScores.filter(
      score => score >= 30 && score < 70
    ).length;
    const low = engagementScores.filter(score => score < 30).length;

    return { high, medium, low };
  }

  private static async getUserActivityTimeline(
    range: AnalyticsTimeRange
  ): Promise<any[]> {
    const pipeline = [
      {
        $match: {
          lastLoginAt: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$lastLoginAt" },
            },
          },
          activeUsers: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 as const } },
    ];

    return await User.aggregate(pipeline);
  }

  private static async getRealTimeMetrics(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      currentActiveUsers,
      currentSessions,
      currentUploads,
      currentInteractions,
    ] = await Promise.all([
      User.countDocuments({ lastLoginAt: { $gte: oneHourAgo } }),
      User.countDocuments({ lastLoginAt: { $gte: oneHourAgo } }), // Simplified
      Media.countDocuments({ createdAt: { $gte: oneHourAgo } }),
      MediaInteraction.countDocuments({ createdAt: { $gte: oneHourAgo } }),
    ]);

    return {
      currentActiveUsers,
      currentSessions,
      currentUploads,
      currentInteractions,
    };
  }

  private static async getUserBehaviorInsights(
    range: AnalyticsTimeRange
  ): Promise<any> {
    // Get most popular content types
    const contentTypes = await Media.aggregate([
      { $match: { createdAt: { $gte: range.startDate, $lte: range.endDate } } },
      { $group: { _id: "$contentType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const totalContent = contentTypes.reduce(
      (sum, type) => sum + type.count,
      0
    );
    const mostPopularContentTypes = contentTypes.map(type => ({
      type: type._id,
      count: type.count,
      percentage: Math.round((type.count / totalContent) * 100),
    }));

    // User journey funnel (simplified)
    const userJourneyFunnel = {
      registered: await User.countDocuments({
        createdAt: { $gte: range.startDate },
      }),
      firstContent: await User.countDocuments({
        createdAt: { $gte: range.startDate },
        "userActivities.action": "media_upload",
      }),
      firstInteraction: await User.countDocuments({
        createdAt: { $gte: range.startDate },
        "userActivities.action": { $in: ["media_like", "media_view"] },
      }),
      firstShare: await User.countDocuments({
        createdAt: { $gte: range.startDate },
        "userActivities.action": "media_share",
      }),
      firstDownload: await User.countDocuments({
        createdAt: { $gte: range.startDate },
        "userActivities.action": "media_download",
      }),
    };

    return {
      averageTimeOnApp: 1800000, // 30 minutes placeholder
      mostPopularContentTypes,
      userJourneyFunnel,
      deviceUsage: {
        mobile: 70, // Placeholder percentages
        desktop: 25,
        tablet: 5,
      },
    };
  }

  private static async getContentInsights(
    range: AnalyticsTimeRange
  ): Promise<any> {
    // Get viral content
    const viralContent = await this.getTopPerformingContent(
      { createdAt: { $gte: range.startDate, $lte: range.endDate } },
      5
    );

    // Get trending topics (simplified)
    const trendingTopics = [
      { topic: "gospel", count: 150, growth: 25 },
      { topic: "worship", count: 120, growth: 15 },
      { topic: "prayer", count: 100, growth: 30 },
    ];

    return {
      viralContent: viralContent.map(content => ({
        ...content,
        viralScore: Math.round(content.engagementRate * 100),
      })),
      trendingTopics,
      contentQualityScore: 85, // Placeholder
      averageContentEngagement: 75, // Placeholder
    };
  }

  private static async getBusinessMetrics(
    range: AnalyticsTimeRange
  ): Promise<any> {
    // These would typically come from payment/subscription data
    return {
      revenue: 0, // Placeholder
      conversionRate: 15, // Placeholder percentage
      userLifetimeValue: 25, // Placeholder
      churnRate: 5, // Placeholder percentage
      growthRate: 20, // Placeholder percentage
    };
  }

  private static async getUserRank(userId: string): Promise<number> {
    // Calculate user rank based on engagement
    const userMetrics = await this.getUserEngagementMetrics(userId);
    const allUsers = await User.find({});

    const userScores = await Promise.all(
      allUsers.map(async user => {
        const metrics = await this.getUserEngagementMetrics(
          user._id.toString()
        );
        return { userId: user._id.toString(), score: metrics.engagementScore };
      })
    );

    userScores.sort((a, b) => b.score - a.score);
    const userIndex = userScores.findIndex(u => u.userId === userId);

    return userIndex + 1; // Rank (1-based)
  }
}
