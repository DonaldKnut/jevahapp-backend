import { Types } from "mongoose";
import { Media } from "../models/media.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { User } from "../models/user.model";
import logger from "../utils/logger";

export interface MediaAnalyticsTimeRange {
  startDate: Date;
  endDate: Date;
}

export interface PerMediaAnalytics {
  mediaId: string;
  title: string;
  contentType: string;
  thumbnailUrl?: string;
  
  // Engagement metrics
  views: number;
  uniqueViews: number;
  likes: number;
  shares: number;
  comments: number;
  downloads: number;
  bookmarks: number;
  
  // Calculated metrics
  engagementRate: number; // (likes + shares + comments) / views * 100
  averageWatchTime?: number; // Average duration viewed/listened
  completionRate?: number; // Percentage of users who watched/listened to completion
  
  // Time-based metrics
  viewsLast24h: number;
  viewsLast7d: number;
  viewsLast30d: number;
  likesLast24h: number;
  likesLast7d: number;
  likesLast30d: number;
  
  // Trends
  viewsTrend: number; // Percentage change from previous period
  likesTrend: number;
  sharesTrend: number;
  
  // Timestamps
  createdAt: Date;
  publishedAt: Date;
}

export interface CreatorMediaAnalytics {
  totalMedia: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  totalDownloads: number;
  averageEngagementRate: number;
  
  // Time-based totals
  viewsLast24h: number;
  viewsLast7d: number;
  viewsLast30d: number;
  likesLast24h: number;
  likesLast7d: number;
  likesLast30d: number;
  
  // Top performing content
  topPerformingMedia: PerMediaAnalytics[];
  
  // Content type breakdown
  byContentType: {
    [contentType: string]: {
      count: number;
      totalViews: number;
      totalLikes: number;
      averageEngagementRate: number;
    };
  };
  
  // Engagement over time (daily for last 30 days)
  engagementOverTime: {
    date: string;
    views: number;
    likes: number;
    shares: number;
    comments: number;
  }[];
}

export class MediaAnalyticsService {
  /**
   * Get comprehensive analytics for a specific media item
   * Similar to Twitter/X post analytics
   */
  static async getMediaAnalytics(
    mediaId: string,
    userId: string,
    timeRange?: MediaAnalyticsTimeRange
  ): Promise<PerMediaAnalytics> {
    // Verify user owns the media
    const media = await Media.findById(mediaId);
    if (!media) {
      throw new Error("Media not found");
    }

    if (media.uploadedBy.toString() !== userId) {
      throw new Error("Unauthorized: You can only view analytics for your own content");
    }

    const defaultTimeRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: new Date(),
    };

    const range = timeRange || defaultTimeRange;

    // Get all interactions for this media
    const [allInteractions, interactionsInRange] = await Promise.all([
      MediaInteraction.find({
        media: new Types.ObjectId(mediaId),
        isRemoved: { $ne: true },
      }),
      MediaInteraction.find({
        media: new Types.ObjectId(mediaId),
        createdAt: { $gte: range.startDate, $lte: range.endDate },
        isRemoved: { $ne: true },
      }),
    ]);

    // Calculate basic metrics
    const views = media.viewCount || 0;
    const likes = media.likeCount || 0;
    const shares = media.shareCount || 0;
    const comments = media.commentCount || 0;
    const downloads = media.downloadCount || 0;

    // Get unique views (unique users who viewed)
    const uniqueViewers = new Set(
      allInteractions
        .filter(i => i.interactionType === "view")
        .map(i => i.user.toString())
    );
    const uniqueViews = uniqueViewers.size;

    // Get bookmarks count
    const { Bookmark } = await import("../models/bookmark.model");
    const bookmarks = await Bookmark.countDocuments({
      media: new Types.ObjectId(mediaId),
    });

    // Calculate engagement rate
    const engagementRate = views > 0 
      ? ((likes + shares + comments) / views) * 100 
      : 0;

    // Calculate time-based metrics
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const viewsLast24h = interactionsInRange.filter(
      i => i.interactionType === "view" && i.createdAt >= last24h
    ).length;

    const viewsLast7d = interactionsInRange.filter(
      i => i.interactionType === "view" && i.createdAt >= last7d
    ).length;

    const viewsLast30d = interactionsInRange.filter(
      i => i.interactionType === "view" && i.createdAt >= last30d
    ).length;

    const likesLast24h = interactionsInRange.filter(
      i => i.interactionType === "like" && i.createdAt >= last24h
    ).length;

    const likesLast7d = interactionsInRange.filter(
      i => i.interactionType === "like" && i.createdAt >= last7d
    ).length;

    const likesLast30d = interactionsInRange.filter(
      i => i.interactionType === "like" && i.createdAt >= last30d
    ).length;

    // Calculate trends (compare current period vs previous period)
    const previousRangeStart = new Date(
      range.startDate.getTime() - (range.endDate.getTime() - range.startDate.getTime())
    );

    const [previousPeriodInteractions, currentPeriodInteractions] = await Promise.all([
      MediaInteraction.find({
        media: new Types.ObjectId(mediaId),
        createdAt: { $gte: previousRangeStart, $lt: range.startDate },
        isRemoved: { $ne: true },
      }),
      MediaInteraction.find({
        media: new Types.ObjectId(mediaId),
        createdAt: { $gte: range.startDate, $lte: range.endDate },
        isRemoved: { $ne: true },
      }),
    ]);

    const previousViews = previousPeriodInteractions.filter(
      i => i.interactionType === "view"
    ).length;
    const currentViews = currentPeriodInteractions.filter(
      i => i.interactionType === "view"
    ).length;
    const viewsTrend = previousViews > 0 
      ? ((currentViews - previousViews) / previousViews) * 100 
      : currentViews > 0 ? 100 : 0;

    const previousLikes = previousPeriodInteractions.filter(
      i => i.interactionType === "like"
    ).length;
    const currentLikes = currentPeriodInteractions.filter(
      i => i.interactionType === "like"
    ).length;
    const likesTrend = previousLikes > 0 
      ? ((currentLikes - previousLikes) / previousLikes) * 100 
      : currentLikes > 0 ? 100 : 0;

    const previousShares = previousPeriodInteractions.filter(
      i => i.interactionType === "share"
    ).length;
    const currentShares = currentPeriodInteractions.filter(
      i => i.interactionType === "share"
    ).length;
    const sharesTrend = previousShares > 0 
      ? ((currentShares - previousShares) / previousShares) * 100 
      : currentShares > 0 ? 100 : 0;

    // Calculate average watch time from interaction data
    const viewInteractions = allInteractions.filter(
      (i: any) => i.interactionType === "view" && i.interactions && i.interactions.length > 0
    );
    
    let averageWatchTime: number | undefined;
    if (viewInteractions.length > 0) {
      const totalWatchTime = viewInteractions.reduce((sum: number, interaction: any) => {
        const durations = interaction.interactions
          .filter((i: any) => i.duration)
          .map((i: any) => i.duration!);
        return sum + durations.reduce((a: number, b: number) => a + b, 0);
      }, 0);
      
      const totalDurations = viewInteractions.reduce((sum: number, interaction: any) => {
        return sum + interaction.interactions.filter((i: any) => i.duration).length;
      }, 0);
      
      averageWatchTime = totalDurations > 0 ? totalWatchTime / totalDurations : undefined;
    }

    // Calculate completion rate
    const completedViews = viewInteractions.filter((interaction: any) => 
      interaction.interactions.some((i: any) => i.isComplete === true)
    ).length;
    const completionRate = viewInteractions.length > 0 
      ? (completedViews / viewInteractions.length) * 100 
      : undefined;

    return {
      mediaId: media._id.toString(),
      title: media.title,
      contentType: media.contentType,
      thumbnailUrl: media.thumbnailUrl,
      views,
      uniqueViews,
      likes,
      shares,
      comments,
      downloads,
      bookmarks,
      engagementRate: Math.round(engagementRate * 100) / 100,
      averageWatchTime: averageWatchTime ? Math.round(averageWatchTime / 1000) : undefined, // Convert to seconds
      completionRate: completionRate ? Math.round(completionRate * 100) / 100 : undefined,
      viewsLast24h,
      viewsLast7d,
      viewsLast30d,
      likesLast24h,
      likesLast7d,
      likesLast30d,
      viewsTrend: Math.round(viewsTrend * 100) / 100,
      likesTrend: Math.round(likesTrend * 100) / 100,
      sharesTrend: Math.round(sharesTrend * 100) / 100,
      createdAt: media.createdAt,
      publishedAt: media.createdAt,
    };
  }

  /**
   * Get comprehensive analytics for all media by a creator
   * Similar to Twitter/X creator analytics dashboard
   */
  static async getCreatorAnalytics(
    userId: string,
    timeRange?: MediaAnalyticsTimeRange
  ): Promise<CreatorMediaAnalytics> {
    const defaultTimeRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    const range = timeRange || defaultTimeRange;

    // Get all media by this creator
    const allMedia = await Media.find({
      uploadedBy: new Types.ObjectId(userId),
    });

    // Get all interactions for this creator's media
    const mediaIds = allMedia.map(m => m._id);
    
    const [allInteractions, interactionsInRange] = await Promise.all([
      MediaInteraction.find({
        media: { $in: mediaIds },
        isRemoved: { $ne: true },
      }),
      MediaInteraction.find({
        media: { $in: mediaIds },
        createdAt: { $gte: range.startDate, $lte: range.endDate },
        isRemoved: { $ne: true },
      }),
    ]);

    // Calculate totals
    const totalViews = allMedia.reduce((sum, m) => sum + (m.viewCount || 0), 0);
    const totalLikes = allMedia.reduce((sum, m) => sum + (m.likeCount || 0), 0);
    const totalShares = allMedia.reduce((sum, m) => sum + (m.shareCount || 0), 0);
    const totalComments = allMedia.reduce((sum, m) => sum + (m.commentCount || 0), 0);
    const totalDownloads = allMedia.reduce((sum, m) => sum + (m.downloadCount || 0), 0);

    // Calculate average engagement rate across all media
    const totalEngagement = allMedia.reduce((sum, m) => {
      const views = m.viewCount || 0;
      const likes = m.likeCount || 0;
      const shares = m.shareCount || 0;
      const comments = m.commentCount || 0;
      const rate = views > 0 ? ((likes + shares + comments) / views) * 100 : 0;
      return sum + rate;
    }, 0);
    const averageEngagementRate = allMedia.length > 0 
      ? totalEngagement / allMedia.length 
      : 0;

    // Calculate time-based metrics
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const viewsLast24h = interactionsInRange.filter(
      i => i.interactionType === "view" && i.createdAt >= last24h
    ).length;

    const viewsLast7d = interactionsInRange.filter(
      i => i.interactionType === "view" && i.createdAt >= last7d
    ).length;

    const viewsLast30d = interactionsInRange.filter(
      i => i.interactionType === "view" && i.createdAt >= last30d
    ).length;

    const likesLast24h = interactionsInRange.filter(
      i => i.interactionType === "like" && i.createdAt >= last24h
    ).length;

    const likesLast7d = interactionsInRange.filter(
      i => i.interactionType === "like" && i.createdAt >= last7d
    ).length;

    const likesLast30d = interactionsInRange.filter(
      i => i.interactionType === "like" && i.createdAt >= last30d
    ).length;

    // Get top performing media (by total engagement)
    const mediaWithEngagement = await Promise.all(
      allMedia.slice(0, 10).map(async (media) => {
        try {
          return await this.getMediaAnalytics(media._id.toString(), userId, range);
        } catch (error) {
          logger.error(`Error getting analytics for media ${media._id}:`, error);
          return null;
        }
      })
    );

    const topPerformingMedia = mediaWithEngagement
      .filter((m): m is PerMediaAnalytics => m !== null)
      .sort((a, b) => {
        const aEngagement = a.likes + a.shares + a.comments;
        const bEngagement = b.likes + b.shares + b.comments;
        return bEngagement - aEngagement;
      })
      .slice(0, 10);

    // Content type breakdown
    const byContentType: { [key: string]: any } = {};
    for (const contentType of [...new Set(allMedia.map(m => m.contentType))]) {
      const mediaOfType = allMedia.filter(m => m.contentType === contentType);
      const views = mediaOfType.reduce((sum, m) => sum + (m.viewCount || 0), 0);
      const likes = mediaOfType.reduce((sum, m) => sum + (m.likeCount || 0), 0);
      const totalEng = mediaOfType.reduce((sum, m) => {
        const v = m.viewCount || 0;
        const l = m.likeCount || 0;
        const s = m.shareCount || 0;
        const c = m.commentCount || 0;
        return sum + (v > 0 ? ((l + s + c) / v) * 100 : 0);
      }, 0);
      
      byContentType[contentType] = {
        count: mediaOfType.length,
        totalViews: views,
        totalLikes: likes,
        averageEngagementRate: mediaOfType.length > 0 ? totalEng / mediaOfType.length : 0,
      };
    }

    // Engagement over time (daily for last 30 days)
    const engagementOverTime = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      
      const dayInteractions = interactionsInRange.filter(
        i => i.createdAt >= date && i.createdAt < nextDate
      );

      engagementOverTime.push({
        date: date.toISOString().split('T')[0],
        views: dayInteractions.filter(i => i.interactionType === "view").length,
        likes: dayInteractions.filter(i => i.interactionType === "like").length,
        shares: dayInteractions.filter(i => i.interactionType === "share").length,
        comments: dayInteractions.filter(i => i.interactionType === "comment").length,
      });
    }

    return {
      totalMedia: allMedia.length,
      totalViews,
      totalLikes,
      totalShares,
      totalComments,
      totalDownloads,
      averageEngagementRate: Math.round(averageEngagementRate * 100) / 100,
      viewsLast24h,
      viewsLast7d,
      viewsLast30d,
      likesLast24h,
      likesLast7d,
      likesLast30d,
      topPerformingMedia,
      byContentType,
      engagementOverTime,
    };
  }
}

export default MediaAnalyticsService;

