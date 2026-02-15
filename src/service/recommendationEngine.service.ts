import { Media } from "../models/media.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import { MediaUserAction } from "../models/mediaUserAction.model";
import { UserViewedMedia } from "../models/userViewedMedia.model";
import { Bookmark } from "../models/bookmark.model";
import { Types } from "mongoose";

interface UserProfile {
  userId: string;
  viewedMedia: Array<{
    mediaId: string;
    contentType: string;
    category?: string;
    topics: string[];
    completionRate: number;
    lastViewed: Date;
  }>;
  favoriteMedia: Array<{
    mediaId: string;
    contentType: string;
    category?: string;
    topics: string[];
  }>;
  sharedMedia: Array<{
    mediaId: string;
    contentType: string;
    category?: string;
    topics: string[];
  }>;
  bookmarkedMedia: Array<{
    mediaId: string;
    contentType: string;
    category?: string;
    topics: string[];
  }>;
  topTopics: Record<string, number>;
  topCategories: Record<string, number>;
  topContentTypes: Record<string, number>;
}

interface CollaborativeSignal {
  mediaId: string;
  similarUsers: Array<{
    userId: string;
    similarityScore: number;
    sharedInteractions: number;
  }>;
  predictedScore: number;
}

interface TopicEmbedding {
  topic: string;
  vector: number[];
  relatedTopics: string[];
}

class RecommendationEngineService {
  private topicEmbeddings: Map<string, TopicEmbedding> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private collaborativeCache: Map<string, CollaborativeSignal[]> = new Map();

  constructor() {
    this.initializeTopicEmbeddings();
  }

  /**
   * Initialize topic embeddings for similarity calculations
   */
  private initializeTopicEmbeddings() {
    // Pre-defined topic clusters for gospel content
    const topicClusters = {
      worship: {
        topics: ["worship", "praise", "music", "hymns", "chorus", "adoration"],
        related: ["prayer", "spiritual growth", "faith"],
        vector: [0.8, 0.6, 0.9, 0.7, 0.5, 0.4],
      },
      teaching: {
        topics: ["sermon", "teaching", "bible study", "preaching", "doctrine"],
        related: ["discipleship", "spiritual growth", "faith"],
        vector: [0.7, 0.9, 0.8, 0.6, 0.5],
      },
      prayer: {
        topics: ["prayer", "intercession", "fasting", "spiritual warfare"],
        related: ["faith", "spiritual growth", "worship"],
        vector: [0.9, 0.8, 0.7, 0.6],
      },
      inspiration: {
        topics: ["inspiration", "motivation", "encouragement", "testimony"],
        related: ["faith", "hope", "spiritual growth"],
        vector: [0.6, 0.7, 0.8, 0.5],
      },
      youth: {
        topics: ["youth", "young adults", "teens", "college"],
        related: ["inspiration", "teaching", "worship"],
        vector: [0.8, 0.7, 0.6, 0.5],
      },
      family: {
        topics: ["family", "marriage", "children", "relationships"],
        related: ["teaching", "inspiration", "prayer"],
        vector: [0.7, 0.8, 0.6, 0.5],
      },
    };

    Object.entries(topicClusters).forEach(([cluster, data]) => {
      data.topics.forEach(topic => {
        this.topicEmbeddings.set(topic.toLowerCase(), {
          topic,
          vector: data.vector,
          relatedTopics: data.related,
        });
      });
    });
  }

  /**
   * Build comprehensive user profile from all interaction signals
   */
  async buildUserProfile(userId: string): Promise<UserProfile> {
    const profile: UserProfile = {
      userId,
      viewedMedia: [],
      favoriteMedia: [],
      sharedMedia: [],
      bookmarkedMedia: [],
      topTopics: {},
      topCategories: {},
      topContentTypes: {},
    };

    try {
      // Get viewed media with completion rates
      const viewed = await UserViewedMedia.findOne({
        user: new Types.ObjectId(userId),
      })
        .populate({
          path: "viewedMedia.media",
          select: "title contentType category topics",
        })
        .lean();

      if (viewed && (viewed as any).viewedMedia) {
        const viewedMediaList = (viewed as any).viewedMedia;
        for (const item of viewedMediaList) {
          const media = item.media as any;
          if (media) {
            // Calculate completion rate from interactions
            const interaction = await MediaInteraction.findOne({
              user: new Types.ObjectId(userId),
              media: media._id,
              interactionType: "view",
            });

            let completionRate = 0;
            if (interaction?.interactions?.length > 0) {
              const totalDuration = interaction.interactions.reduce(
                (sum: number, i: any) => sum + (i.duration || 0),
                0
              );
              const avgProgress =
                interaction.interactions.reduce(
                  (sum: number, i: any) => sum + (i.progressPct || 0),
                  0
                ) / interaction.interactions.length;
              completionRate = avgProgress / 100; // Normalize to 0-1
            }

            profile.viewedMedia.push({
              mediaId: String(media._id),
              contentType: media.contentType,
              category: media.category,
              topics: media.topics || [],
              completionRate,
              lastViewed: item.viewedAt,
            });

            // Update topic/category counts
            if (media.topics) {
              media.topics.forEach((topic: string) => {
                profile.topTopics[topic.toLowerCase()] =
                  (profile.topTopics[topic.toLowerCase()] || 0) +
                  (completionRate + 0.1);
              });
            }
            if (media.category) {
              profile.topCategories[media.category.toLowerCase()] =
                (profile.topCategories[media.category.toLowerCase()] || 0) +
                (completionRate + 0.1);
            }
            profile.topContentTypes[media.contentType.toLowerCase()] =
              (profile.topContentTypes[media.contentType.toLowerCase()] || 0) +
              (completionRate + 0.1);
          }
        }
      }

      // Get favorites
      const favorites = await MediaUserAction.find({
        user: new Types.ObjectId(userId),
        actionType: "favorite",
      })
        .populate("media", "title contentType category topics")
        .lean();

      for (const fav of favorites) {
        const media = (fav as any).media;
        if (media) {
          profile.favoriteMedia.push({
            mediaId: String(media._id),
            contentType: media.contentType,
            category: media.category,
            topics: media.topics || [],
          });

          // Weight favorites higher
          if (media.topics) {
            media.topics.forEach((topic: string) => {
              profile.topTopics[topic.toLowerCase()] =
                (profile.topTopics[topic.toLowerCase()] || 0) + 2;
            });
          }
          if (media.category) {
            profile.topCategories[media.category.toLowerCase()] =
              (profile.topCategories[media.category.toLowerCase()] || 0) + 2;
          }
          profile.topContentTypes[media.contentType.toLowerCase()] =
            (profile.topContentTypes[media.contentType.toLowerCase()] || 0) + 2;
        }
      }

      // Get shares
      const shares = await MediaUserAction.find({
        user: new Types.ObjectId(userId),
        actionType: "share",
      })
        .populate("media", "title contentType category topics")
        .lean();

      for (const share of shares) {
        const media = (share as any).media;
        if (media) {
          profile.sharedMedia.push({
            mediaId: String(media._id),
            contentType: media.contentType,
            category: media.category,
            topics: media.topics || [],
          });

          // Weight shares even higher
          if (media.topics) {
            media.topics.forEach((topic: string) => {
              profile.topTopics[topic.toLowerCase()] =
                (profile.topTopics[topic.toLowerCase()] || 0) + 3;
            });
          }
          if (media.category) {
            profile.topCategories[media.category.toLowerCase()] =
              (profile.topCategories[media.category.toLowerCase()] || 0) + 3;
          }
          profile.topContentTypes[media.contentType.toLowerCase()] =
            (profile.topContentTypes[media.contentType.toLowerCase()] || 0) + 3;
        }
      }

      // Get bookmarks
      const bookmarks = await Bookmark.find({
        user: new Types.ObjectId(userId),
      })
        .populate("media", "title contentType category topics")
        .lean();

      for (const bookmark of bookmarks) {
        const media = (bookmark as any).media;
        if (media) {
          profile.bookmarkedMedia.push({
            mediaId: String(media._id),
            contentType: media.contentType,
            category: media.category,
            topics: media.topics || [],
          });

          // Weight bookmarks
          if (media.topics) {
            media.topics.forEach((topic: string) => {
              profile.topTopics[topic.toLowerCase()] =
                (profile.topTopics[topic.toLowerCase()] || 0) + 1.5;
            });
          }
          if (media.category) {
            profile.topCategories[media.category.toLowerCase()] =
              (profile.topCategories[media.category.toLowerCase()] || 0) + 1.5;
          }
          profile.topContentTypes[media.contentType.toLowerCase()] =
            (profile.topContentTypes[media.contentType.toLowerCase()] || 0) +
            1.5;
        }
      }

      this.userProfiles.set(userId, profile);
      return profile;
    } catch (error) {
      console.error("Error building user profile:", error);
      return profile;
    }
  }

  /**
   * Calculate topic similarity using embeddings
   */
  private calculateTopicSimilarity(
    topics1: string[],
    topics2: string[]
  ): number {
    if (topics1.length === 0 || topics2.length === 0) return 0;

    let maxSimilarity = 0;
    for (const topic1 of topics1) {
      for (const topic2 of topics2) {
        const embedding1 = this.topicEmbeddings.get(topic1.toLowerCase());
        const embedding2 = this.topicEmbeddings.get(topic2.toLowerCase());

        if (embedding1 && embedding2) {
          // Cosine similarity
          const similarity = this.cosineSimilarity(
            embedding1.vector,
            embedding2.vector
          );
          maxSimilarity = Math.max(maxSimilarity, similarity);
        } else if (topic1.toLowerCase() === topic2.toLowerCase()) {
          maxSimilarity = Math.max(maxSimilarity, 1);
        }
      }
    }
    return maxSimilarity;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find collaborative filtering signals
   */
  async getCollaborativeSignals(
    mediaId: string,
    userId?: string
  ): Promise<CollaborativeSignal[]> {
    const cacheKey = `${mediaId}_${userId || "anonymous"}`;
    if (this.collaborativeCache.has(cacheKey)) {
      return this.collaborativeCache.get(cacheKey)!;
    }

    try {
      // Find users who interacted with this media
      const interactions = await MediaInteraction.find({
        media: new Types.ObjectId(mediaId),
        interactionType: { $in: ["view", "listen", "read"] },
      })
        .populate("user", "firstName lastName")
        .lean();

      const userIds = interactions.map(i => String((i as any).user._id));
      const signals: CollaborativeSignal[] = [];

      // For each user who interacted with this media
      for (const otherUserId of userIds) {
        if (userId && otherUserId === userId) continue;

        const otherUserProfile = await this.buildUserProfile(otherUserId);

        // Find media this user also interacted with
        const sharedMediaIds = new Set([
          ...otherUserProfile.viewedMedia.map(m => m.mediaId),
          ...otherUserProfile.favoriteMedia.map(m => m.mediaId),
          ...otherUserProfile.sharedMedia.map(m => m.mediaId),
        ]);

        const sharedInteractions = sharedMediaIds.size;

        if (sharedInteractions > 0) {
          // Calculate similarity score based on shared interests
          let similarityScore = 0;

          if (userId) {
            const currentUserProfile = await this.buildUserProfile(userId);

            // Topic similarity
            const currentTopics = Object.keys(currentUserProfile.topTopics);
            const otherTopics = Object.keys(otherUserProfile.topTopics);
            similarityScore +=
              this.calculateTopicSimilarity(currentTopics, otherTopics) * 0.4;

            // Category similarity
            const currentCategories = Object.keys(
              currentUserProfile.topCategories
            );
            const otherCategories = Object.keys(otherUserProfile.topCategories);
            const categoryOverlap = currentCategories.filter(c =>
              otherCategories.includes(c)
            ).length;
            similarityScore +=
              (categoryOverlap /
                Math.max(currentCategories.length, otherCategories.length)) *
              0.3;

            // Content type similarity
            const currentTypes = Object.keys(
              currentUserProfile.topContentTypes
            );
            const otherTypes = Object.keys(otherUserProfile.topContentTypes);
            const typeOverlap = currentTypes.filter(t =>
              otherTypes.includes(t)
            ).length;
            similarityScore +=
              (typeOverlap / Math.max(currentTypes.length, otherTypes.length)) *
              0.3;
          } else {
            // For anonymous users, use interaction strength
            similarityScore = Math.min(sharedInteractions / 10, 1);
          }

          // Predict score based on interaction quality
          const avgCompletion =
            otherUserProfile.viewedMedia
              .filter(m => m.mediaId === mediaId)
              .reduce((sum, m) => sum + m.completionRate, 0) /
            Math.max(
              otherUserProfile.viewedMedia.filter(m => m.mediaId === mediaId)
                .length,
              1
            );

          const predictedScore = similarityScore * (0.5 + avgCompletion * 0.5);

          signals.push({
            mediaId,
            similarUsers: [
              {
                userId: otherUserId,
                similarityScore,
                sharedInteractions,
              },
            ],
            predictedScore,
          });
        }
      }

      // Sort by predicted score and cache
      signals.sort((a, b) => b.predictedScore - a.predictedScore);
      this.collaborativeCache.set(cacheKey, signals.slice(0, 10));

      return signals.slice(0, 10);
    } catch (error) {
      console.error("Error getting collaborative signals:", error);
      return [];
    }
  }

  /**
   * Generate A/B test variants for section ordering
   */
  generateABTestVariant(
    userId: string,
    testName: string = "section_ordering"
  ): string {
    // Simple hash-based variant assignment for consistent user experience
    const hash = this.simpleHash(userId + testName);
    return hash % 2 === 0 ? "control" : "variant_a";
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get optimized section ordering based on A/B test
   */
  getSectionOrdering(userId?: string): string[] {
    if (!userId) {
      return [
        "editorial",
        "trending",
        "quick_picks",
        "for_you",
        "because_you_watched",
      ];
    }

    const variant = this.generateABTestVariant(userId);

    switch (variant) {
      case "variant_a":
        // Personalized first
        return [
          "for_you",
          "editorial",
          "trending",
          "because_you_watched",
          "quick_picks",
        ];
      case "variant_b":
        // Trending first
        return [
          "trending",
          "for_you",
          "editorial",
          "because_you_watched",
          "quick_picks",
        ];
      default:
        // Control: Editorial first
        return [
          "editorial",
          "for_you",
          "trending",
          "because_you_watched",
          "quick_picks",
        ];
    }
  }

  /**
   * Calculate content quality score based on engagement metrics
   */
  calculateContentQualityScore(media: any): number {
    const viewWeight = 0.3;
    const likeWeight = 0.25;
    const shareWeight = 0.2;
    const commentWeight = 0.15;
    const recencyWeight = 0.1;

    const now = new Date();
    const ageInDays =
      (now.getTime() - new Date(media.createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - ageInDays / 365); // Decay over a year

    const normalizedViews =
      Math.min(media.totalViews || media.viewCount || 0, 10000) / 10000;
    const normalizedLikes =
      Math.min(media.totalLikes || media.likeCount || 0, 1000) / 1000;
    const normalizedShares =
      Math.min(media.totalShares || media.shareCount || 0, 500) / 500;
    const normalizedComments = Math.min(media.commentCount || 0, 200) / 200;

    return (
      normalizedViews * viewWeight +
      normalizedLikes * likeWeight +
      normalizedShares * shareWeight +
      normalizedComments * commentWeight +
      recencyScore * recencyWeight
    );
  }
}

export const recommendationEngineService = new RecommendationEngineService();
