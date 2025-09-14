import { User } from "../models/user.model";
import { Media } from "../models/media.model";
import { Devotional } from "../models/devotional.model";
import { Notification } from "../models/notification.model";
import PushNotificationService from "./pushNotification.service";
import bibleFactsService from "./bibleFacts.service";
import logger from "../utils/logger";

export interface UserActivityProfile {
  userId: string;
  lastActiveAt: Date;
  signOutAt?: Date;
  totalSessions: number;
  averageSessionDuration: number;
  favoriteContentTypes: string[];
  favoriteArtists: string[];
  recentInteractions: string[];
  engagementScore: number; // 0-100
  preferredNotificationTimes: string[];
  timezone: string;
}

export interface ReEngagementMessage {
  title: string;
  body: string;
  data: {
    type: "reengagement";
    category: string;
    contentId?: string;
    artistId?: string;
    streamId?: string;
    personalized: boolean;
  };
  priority: "low" | "medium" | "high";
  scheduledFor: Date;
}

export interface ReEngagementCampaign {
  userId: string;
  messages: ReEngagementMessage[];
  status: "active" | "paused" | "completed";
  createdAt: Date;
  lastSentAt?: Date;
  nextScheduledAt?: Date;
  responseRate?: number;
}

class AIReEngagementService {
  private readonly REENGAGEMENT_DELAYS = {
    first: 24 * 60 * 60 * 1000, // 24 hours
    second: 3 * 24 * 60 * 60 * 1000, // 3 days
    third: 7 * 24 * 60 * 60 * 1000, // 1 week
    fourth: 14 * 24 * 60 * 60 * 1000, // 2 weeks
    final: 30 * 24 * 60 * 60 * 1000, // 1 month
  };

  private readonly MESSAGE_CATEGORIES = {
    NEW_CONTENT: "new_content",
    LIVE_STREAM: "live_stream",
    COMMUNITY: "community",
    PERSONALIZED: "personalized",
    MILESTONE: "milestone",
    SOCIAL: "social",
    SPIRITUAL: "spiritual",
    BIBLE_FACT: "bible_fact",
  };

  /**
   * Track user signout and initiate re-engagement
   */
  async trackUserSignout(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Update user's last signout time
      await User.findByIdAndUpdate(userId, {
        lastSignOutAt: new Date(),
        $inc: { totalSessions: 1 },
      });

      // Create user activity profile
      const activityProfile = await this.createUserActivityProfile(userId);

      // Schedule re-engagement campaign
      await this.scheduleReEngagementCampaign(activityProfile);

      logger.info("User signout tracked and re-engagement scheduled", {
        userId,
        engagementScore: activityProfile.engagementScore,
      });
    } catch (error) {
      logger.error("Failed to track user signout:", error);
    }
  }

  /**
   * Create comprehensive user activity profile
   */
  private async createUserActivityProfile(
    userId: string
  ): Promise<UserActivityProfile> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      // Get user's recent activity
      const recentMedia = await Media.find({
        $or: [{ uploadedBy: userId }, { "interactions.user": userId }],
      })
        .sort({ createdAt: -1 })
        .limit(50);

      const recentDevotionals = await Devotional.find({
        $or: [{ uploadedBy: userId }, { "interactions.user": userId }],
      })
        .sort({ createdAt: -1 })
        .limit(50);

      // Calculate engagement score
      const engagementScore = await this.calculateEngagementScore(userId);

      // Get favorite content types
      const favoriteContentTypes = this.extractFavoriteContentTypes(
        recentMedia,
        recentDevotionals
      );

      // Get favorite artists
      const favoriteArtists = await this.getFavoriteArtists(userId);

      // Get recent interactions
      const recentInteractions = await this.getRecentInteractions(userId);

      // Determine preferred notification times
      const preferredNotificationTimes = this.determinePreferredTimes(user);

      return {
        userId,
        lastActiveAt: user.lastLoginAt || new Date(),
        signOutAt: new Date(),
        totalSessions: user.totalSessions || 1,
        averageSessionDuration:
          await this.calculateAverageSessionDuration(userId),
        favoriteContentTypes,
        favoriteArtists,
        recentInteractions,
        engagementScore,
        preferredNotificationTimes,
        timezone: user.timezone || "UTC",
      };
    } catch (error) {
      logger.error("Failed to create user activity profile:", error);
      throw error;
    }
  }

  /**
   * Calculate user engagement score (0-100)
   */
  private async calculateEngagementScore(userId: string): Promise<number> {
    try {
      const user = await User.findById(userId);
      if (!user) return 0;

      let score = 0;

      // Base score for account age
      const accountAge = Date.now() - user.createdAt.getTime();
      const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
      score += Math.min(daysSinceCreation * 0.5, 20); // Max 20 points

      // Library items
      score += (user.library?.length || 0) * 2; // 2 points per saved item

      // Offline downloads
      score += (user.offlineDownloads?.length || 0) * 3; // 3 points per download

      // Following artists
      score += (user.following?.length || 0) * 5; // 5 points per follow

      // Content interactions
      const mediaInteractions = await Media.countDocuments({
        "interactions.user": userId,
      });
      score += mediaInteractions * 1; // 1 point per interaction

      // Recent activity bonus
      const recentActivity = await this.getRecentActivityScore(userId);
      score += recentActivity;

      return Math.min(Math.max(score, 0), 100);
    } catch (error) {
      logger.error("Failed to calculate engagement score:", error);
      return 50; // Default moderate engagement
    }
  }

  /**
   * Get recent activity score
   */
  private async getRecentActivityScore(userId: string): Promise<number> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentMedia = await Media.countDocuments({
        "interactions.user": userId,
        "interactions.createdAt": { $gte: sevenDaysAgo },
      });

      const recentDevotionals = await Devotional.countDocuments({
        "interactions.user": userId,
        "interactions.createdAt": { $gte: sevenDaysAgo },
      });

      return (recentMedia + recentDevotionals) * 2; // 2 points per recent interaction
    } catch (error) {
      return 0;
    }
  }

  /**
   * Extract favorite content types
   */
  private extractFavoriteContentTypes(
    media: any[],
    devotionals: any[]
  ): string[] {
    const types = new Map<string, number>();

    media.forEach(item => {
      const type = item.contentType || "music";
      types.set(type, (types.get(type) || 0) + 1);
    });

    devotionals.forEach(item => {
      types.set("devotional", (types.get("devotional") || 0) + 1);
    });

    return Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
  }

  /**
   * Get user's favorite artists
   */
  private async getFavoriteArtists(userId: string): Promise<string[]> {
    try {
      const user = await User.findById(userId);
      return user?.following?.map((id: any) => id.toString()) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get recent user interactions
   */
  private async getRecentInteractions(userId: string): Promise<string[]> {
    try {
      const recentInteractions = await Notification.find({
        user: userId,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("type");

      return recentInteractions.map(interaction => interaction.type);
    } catch (error) {
      return [];
    }
  }

  /**
   * Determine preferred notification times
   */
  private determinePreferredTimes(user: any): string[] {
    // Default to common active times
    const defaultTimes = ["09:00", "12:00", "18:00", "21:00"];

    // If user has timezone preference, adjust times
    if (user.timezone) {
      // Convert to user's timezone
      return defaultTimes;
    }

    return defaultTimes;
  }

  /**
   * Calculate average session duration
   */
  private async calculateAverageSessionDuration(
    userId: string
  ): Promise<number> {
    try {
      // This would require session tracking implementation
      // For now, return a default value
      return 15; // 15 minutes average
    } catch (error) {
      return 15;
    }
  }

  /**
   * Schedule re-engagement campaign
   */
  private async scheduleReEngagementCampaign(
    profile: UserActivityProfile
  ): Promise<void> {
    try {
      const campaign: ReEngagementCampaign = {
        userId: profile.userId,
        messages: [],
        status: "active",
        createdAt: new Date(),
        nextScheduledAt: new Date(Date.now() + this.REENGAGEMENT_DELAYS.first),
      };

      // Generate personalized messages
      campaign.messages = await this.generateReEngagementMessages(profile);

      // Store campaign (you might want to create a separate model for this)
      await this.storeReEngagementCampaign(campaign);

      // Schedule first message
      await this.scheduleNextMessage(campaign);

      logger.info("Re-engagement campaign scheduled", {
        userId: profile.userId,
        messageCount: campaign.messages.length,
        nextScheduledAt: campaign.nextScheduledAt,
      });
    } catch (error) {
      logger.error("Failed to schedule re-engagement campaign:", error);
    }
  }

  /**
   * Generate personalized re-engagement messages
   */
  private async generateReEngagementMessages(
    profile: UserActivityProfile
  ): Promise<ReEngagementMessage[]> {
    const messages: ReEngagementMessage[] = [];

    // Message 1: New content from favorite artists
    if (profile.favoriteArtists.length > 0) {
      const artistContent = await this.getNewContentFromArtists(
        profile.favoriteArtists
      );
      if (artistContent) {
        messages.push({
          title: "🎵 New Music from Your Favorite Artists",
          body: `${artistContent.artistName} just released "${artistContent.title}" - don't miss it!`,
          data: {
            type: "reengagement",
            category: this.MESSAGE_CATEGORIES.NEW_CONTENT,
            contentId: artistContent._id,
            artistId: artistContent.uploadedBy,
            personalized: true,
          },
          priority: "high",
          scheduledFor: new Date(Date.now() + this.REENGAGEMENT_DELAYS.first),
        });
      }
    }

    // Message 2: Live stream notification
    const liveStream = await this.getUpcomingLiveStream();
    if (liveStream) {
      messages.push({
        title: "📺 Live Worship Session Starting Soon",
        body: `Join ${liveStream.artistName} for a live worship session in 30 minutes!`,
        data: {
          type: "reengagement",
          category: this.MESSAGE_CATEGORIES.LIVE_STREAM,
          streamId: liveStream._id,
          artistId: liveStream.uploadedBy,
          personalized: false,
        },
        priority: "high",
        scheduledFor: new Date(Date.now() + this.REENGAGEMENT_DELAYS.second),
      });
    }

    // Message 3: Community engagement
    if (profile.engagementScore > 70) {
      messages.push({
        title: "👥 Your Community Misses You",
        body: "Your fellow believers are sharing inspiring content. Come back and join the conversation!",
        data: {
          type: "reengagement",
          category: this.MESSAGE_CATEGORIES.COMMUNITY,
          personalized: true,
        },
        priority: "medium",
        scheduledFor: new Date(Date.now() + this.REENGAGEMENT_DELAYS.third),
      });
    }

    // Message 4: Personalized spiritual content
    const spiritualContent =
      await this.getPersonalizedSpiritualContent(profile);
    if (spiritualContent) {
      messages.push({
        title: "🙏 A Message Just for You",
        body: `Based on your interests, here's a devotional that might speak to your heart: "${spiritualContent.title}"`,
        data: {
          type: "reengagement",
          category: this.MESSAGE_CATEGORIES.SPIRITUAL,
          contentId: spiritualContent._id,
          personalized: true,
        },
        priority: "medium",
        scheduledFor: new Date(Date.now() + this.REENGAGEMENT_DELAYS.fourth),
      });
    }

    // Message 5: Bible fact
    const bibleFact = await this.getPersonalizedBibleFact(profile);
    if (bibleFact) {
      messages.push({
        title: "📖 A Beautiful Truth from God's Word",
        body: `${bibleFact.fact.title}: ${bibleFact.fact.fact}`,
        data: {
          type: "reengagement",
          category: this.MESSAGE_CATEGORIES.BIBLE_FACT,
          contentId: bibleFact.fact._id.toString(),
          personalized: true,
        },
        priority: "medium",
        scheduledFor: new Date(
          Date.now() + this.REENGAGEMENT_DELAYS.fourth + 2 * 24 * 60 * 60 * 1000
        ), // 2 weeks + 2 days
      });
    }

    // Message 6: Final re-engagement
    messages.push({
      title: "💝 We Miss You at Jevah",
      body: "Your spiritual journey is important to us. Come back and continue growing in faith with our community.",
      data: {
        type: "reengagement",
        category: this.MESSAGE_CATEGORIES.PERSONALIZED,
        personalized: true,
      },
      priority: "low",
      scheduledFor: new Date(Date.now() + this.REENGAGEMENT_DELAYS.final),
    });

    return messages;
  }

  /**
   * Get new content from user's favorite artists
   */
  private async getNewContentFromArtists(artistIds: string[]): Promise<any> {
    try {
      const recentContent = await Media.findOne({
        uploadedBy: { $in: artistIds },
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      })
        .populate("uploadedBy", "firstName lastName artistProfile")
        .sort({ createdAt: -1 });

      if (recentContent) {
        return {
          ...recentContent.toObject(),
          artistName:
            recentContent.uploadedBy?.artistProfile?.artistName ||
            `${recentContent.uploadedBy?.firstName} ${recentContent.uploadedBy?.lastName}`,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get upcoming live stream
   */
  private async getUpcomingLiveStream(): Promise<any> {
    try {
      const upcomingStream = await Media.findOne({
        contentType: "live_stream",
        status: "scheduled",
        scheduledStartTime: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 2 * 60 * 60 * 1000), // Next 2 hours
        },
      })
        .populate("uploadedBy", "firstName lastName artistProfile")
        .sort({ scheduledStartTime: 1 });

      if (upcomingStream) {
        return {
          ...upcomingStream.toObject(),
          artistName:
            upcomingStream.uploadedBy?.artistProfile?.artistName ||
            `${upcomingStream.uploadedBy?.firstName} ${upcomingStream.uploadedBy?.lastName}`,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get personalized spiritual content
   */
  private async getPersonalizedSpiritualContent(
    profile: UserActivityProfile
  ): Promise<any> {
    try {
      // Find devotional content based on user's interests
      const spiritualContent = await Devotional.findOne({
        tags: { $in: profile.favoriteContentTypes },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }).sort({ createdAt: -1 });

      return spiritualContent;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get personalized Bible fact for re-engagement
   */
  private async getPersonalizedBibleFact(
    profile: UserActivityProfile
  ): Promise<any> {
    try {
      const personalizedFact = await bibleFactsService.getPersonalizedBibleFact(
        profile.userId
      );

      if (personalizedFact) {
        return {
          fact: personalizedFact.fact,
          reason: personalizedFact.reason,
          relevance: personalizedFact.relevance,
        };
      }

      // Fallback to random Bible fact
      const randomFact = await bibleFactsService.getRandomBibleFact();
      if (randomFact) {
        return {
          fact: randomFact,
          reason: "A beautiful truth from God's Word",
          relevance: 60,
        };
      }

      return null;
    } catch (error) {
      logger.error("Failed to get personalized Bible fact:", error);
      return null;
    }
  }

  /**
   * Store re-engagement campaign
   */
  private async storeReEngagementCampaign(
    campaign: ReEngagementCampaign
  ): Promise<void> {
    try {
      // Store in user's activity log or create a separate collection
      await User.findByIdAndUpdate(campaign.userId, {
        $push: {
          userActivities: {
            action: "reengagement_campaign_created",
            resourceType: "campaign",
            resourceId: campaign.userId,
            metadata: {
              messageCount: campaign.messages.length,
              status: campaign.status,
            },
            timestamp: new Date(),
          },
        },
      });
    } catch (error) {
      logger.error("Failed to store re-engagement campaign:", error);
    }
  }

  /**
   * Schedule next message
   */
  private async scheduleNextMessage(
    campaign: ReEngagementCampaign
  ): Promise<void> {
    try {
      // This would integrate with a job scheduler like Bull or Agenda
      // For now, we'll use setTimeout (not recommended for production)

      const nextMessage = campaign.messages.find(
        msg => msg.scheduledFor > new Date()
      );

      if (nextMessage) {
        const delay = nextMessage.scheduledFor.getTime() - Date.now();

        setTimeout(async () => {
          await this.sendReEngagementMessage(campaign.userId, nextMessage);
        }, delay);

        logger.info("Re-engagement message scheduled", {
          userId: campaign.userId,
          scheduledFor: nextMessage.scheduledFor,
          messageTitle: nextMessage.title,
        });
      }
    } catch (error) {
      logger.error("Failed to schedule next message:", error);
    }
  }

  /**
   * Send re-engagement message
   */
  private async sendReEngagementMessage(
    userId: string,
    message: ReEngagementMessage
  ): Promise<void> {
    try {
      // Send push notification
      await PushNotificationService.sendToUser(
        userId,
        {
          title: message.title,
          body: message.body,
          data: message.data,
          priority:
            message.priority === "low"
              ? "default"
              : message.priority === "medium"
                ? "normal"
                : message.priority,
        },
        "newFollowers"
      );

      // Create in-app notification
      await Notification.create({
        user: userId,
        type: "reengagement",
        title: message.title,
        message: message.body,
        metadata: message.data,
        priority: message.priority,
      });

      // Update campaign status
      await this.updateCampaignStatus(userId, message);

      logger.info("Re-engagement message sent", {
        userId,
        messageTitle: message.title,
        category: message.data.category,
      });
    } catch (error) {
      logger.error("Failed to send re-engagement message:", error);
    }
  }

  /**
   * Update campaign status
   */
  private async updateCampaignStatus(
    userId: string,
    message: ReEngagementMessage
  ): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, {
        $push: {
          userActivities: {
            action: "reengagement_message_sent",
            resourceType: "notification",
            resourceId: userId,
            metadata: {
              messageTitle: message.title,
              category: message.data.category,
              personalized: message.data.personalized,
            },
            timestamp: new Date(),
          },
        },
      });
    } catch (error) {
      logger.error("Failed to update campaign status:", error);
    }
  }

  /**
   * Track user return (when they come back)
   */
  async trackUserReturn(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, {
        lastReturnAt: new Date(),
        $inc: { returnCount: 1 },
      });

      // Cancel any pending re-engagement messages
      await this.cancelPendingReEngagement(userId);

      logger.info("User return tracked", { userId });
    } catch (error) {
      logger.error("Failed to track user return:", error);
    }
  }

  /**
   * Cancel pending re-engagement messages
   */
  private async cancelPendingReEngagement(userId: string): Promise<void> {
    try {
      // This would cancel scheduled jobs in a proper job scheduler
      // For now, we'll just log it
      logger.info("Pending re-engagement messages cancelled", { userId });
    } catch (error) {
      logger.error("Failed to cancel pending re-engagement:", error);
    }
  }

  /**
   * Get re-engagement analytics
   */
  async getReEngagementAnalytics(): Promise<any> {
    try {
      const totalUsers = await User.countDocuments();
      const usersWithReEngagement = await User.countDocuments({
        "userActivities.action": "reengagement_campaign_created",
      });
      const usersWhoReturned = await User.countDocuments({
        "userActivities.action": "reengagement_message_sent",
        lastReturnAt: { $exists: true },
      });

      return {
        totalUsers,
        usersWithReEngagement,
        usersWhoReturned,
        reEngagementRate: usersWithReEngagement / totalUsers,
        returnRate: usersWhoReturned / usersWithReEngagement,
      };
    } catch (error) {
      logger.error("Failed to get re-engagement analytics:", error);
      return null;
    }
  }
}

export default new AIReEngagementService();
