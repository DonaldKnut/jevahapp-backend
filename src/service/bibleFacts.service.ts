import {
  BibleFact,
  IBibleFact,
  BibleFactCategory,
} from "../models/bibleFact.model";
import { User } from "../models/user.model";
import logger from "../utils/logger";

export interface PersonalizedBibleFact {
  fact: IBibleFact;
  reason: string;
  relevance: number; // 0-100
}

export interface UserBiblePreferences {
  favoriteCategories: BibleFactCategory[];
  difficulty: "beginner" | "intermediate" | "advanced";
  recentFacts: string[];
  interests: string[];
}

class BibleFactsService {
  /**
   * Get a random Bible fact
   */
  async getRandomBibleFact(): Promise<IBibleFact | null> {
    try {
      const fact = await BibleFact.aggregate([
        { $match: { isActive: true } },
        { $sample: { size: 1 } },
      ]);

      return fact.length > 0 ? fact[0] : null;
    } catch (error) {
      logger.error("Failed to get random Bible fact:", error);
      return null;
    }
  }

  /**
   * Get Bible fact by category
   */
  async getBibleFactByCategory(
    category: BibleFactCategory
  ): Promise<IBibleFact | null> {
    try {
      const fact = await BibleFact.aggregate([
        { $match: { category, isActive: true } },
        { $sample: { size: 1 } },
      ]);

      return fact.length > 0 ? fact[0] : null;
    } catch (error) {
      logger.error("Failed to get Bible fact by category:", error);
      return null;
    }
  }

  /**
   * Get personalized Bible fact for user
   */
  async getPersonalizedBibleFact(
    userId: string
  ): Promise<PersonalizedBibleFact | null> {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      const preferences = await this.getUserBiblePreferences(userId);
      const personalizedFact = await this.selectPersonalizedFact(preferences);

      return personalizedFact;
    } catch (error) {
      logger.error("Failed to get personalized Bible fact:", error);
      return null;
    }
  }

  /**
   * Get user's Bible preferences
   */
  private async getUserBiblePreferences(
    userId: string
  ): Promise<UserBiblePreferences> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          favoriteCategories: ["faith", "love", "hope"],
          difficulty: "beginner",
          recentFacts: [],
          interests: [],
        };
      }

      // Analyze user's interests and content preferences
      const interests = user.interests || [];
      const favoriteCategories = this.mapInterestsToCategories(interests);

      // Determine difficulty based on user's engagement
      const difficulty = await this.determineUserDifficulty(userId);

      // Get recent facts (from user activity)
      const recentFacts = await this.getRecentBibleFacts(userId);

      return {
        favoriteCategories,
        difficulty,
        recentFacts,
        interests,
      };
    } catch (error) {
      logger.error("Failed to get user Bible preferences:", error);
      return {
        favoriteCategories: ["faith", "love", "hope"],
        difficulty: "beginner",
        recentFacts: [],
        interests: [],
      };
    }
  }

  /**
   * Map user interests to Bible fact categories
   */
  private mapInterestsToCategories(interests: string[]): BibleFactCategory[] {
    const interestToCategoryMap: Record<string, BibleFactCategory[]> = {
      music: ["worship", "ministry"],
      family: ["family", "relationships", "love"],
      prayer: ["prayer", "faith"],
      healing: ["miracles", "faith"],
      prophecy: ["prophecy", "end_times"],
      creation: ["creation", "nature", "science"],
      wisdom: ["wisdom"],
      salvation: ["salvation", "grace", "forgiveness"],
      church: ["church", "ministry"],
      angels: ["angels", "heaven"],
    };

    const categories: BibleFactCategory[] = [];

    interests.forEach(interest => {
      const mappedCategories = interestToCategoryMap[interest.toLowerCase()];
      if (mappedCategories) {
        categories.push(...mappedCategories);
      }
    });

    // Default categories if no mapping found
    if (categories.length === 0) {
      categories.push("faith", "love", "hope");
    }

    return [...new Set(categories)]; // Remove duplicates
  }

  /**
   * Determine user's Bible knowledge difficulty level
   */
  private async determineUserDifficulty(
    userId: string
  ): Promise<"beginner" | "intermediate" | "advanced"> {
    try {
      const user = await User.findById(userId);
      if (!user) return "beginner";

      // Calculate based on user's engagement and activity
      const accountAge = Date.now() - user.createdAt.getTime();
      const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

      // Check user's library and interactions
      const libraryCount = user.library?.length || 0;
      const offlineDownloads = user.offlineDownloads?.length || 0;
      const followingCount = user.following?.length || 0;

      // Calculate engagement score
      let engagementScore = 0;
      engagementScore += Math.min(daysSinceCreation * 0.1, 30); // Account age
      engagementScore += libraryCount * 2; // Saved content
      engagementScore += offlineDownloads * 3; // Downloads
      engagementScore += followingCount * 1; // Following artists

      if (engagementScore >= 50) return "advanced";
      if (engagementScore >= 20) return "intermediate";
      return "beginner";
    } catch (error) {
      return "beginner";
    }
  }

  /**
   * Get recent Bible facts for user
   */
  private async getRecentBibleFacts(userId: string): Promise<string[]> {
    try {
      // This would typically come from user's notification history
      // For now, return empty array
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Select personalized Bible fact
   */
  private async selectPersonalizedFact(
    preferences: UserBiblePreferences
  ): Promise<PersonalizedBibleFact | null> {
    try {
      // Try to find fact based on user's favorite categories
      for (const category of preferences.favoriteCategories) {
        const fact = await BibleFact.findOne({
          category,
          difficulty: preferences.difficulty,
          isActive: true,
          _id: { $nin: preferences.recentFacts }, // Exclude recent facts
        });

        if (fact) {
          return {
            fact,
            reason: `Based on your interest in ${category}`,
            relevance: 90,
          };
        }
      }

      // Fallback to random fact with user's difficulty level
      const randomFact = await BibleFact.aggregate([
        {
          $match: {
            difficulty: preferences.difficulty,
            isActive: true,
            _id: { $nin: preferences.recentFacts },
          },
        },
        { $sample: { size: 1 } },
      ]);

      if (randomFact.length > 0) {
        return {
          fact: randomFact[0],
          reason: "A spiritual truth to inspire you",
          relevance: 70,
        };
      }

      // Final fallback to any random fact
      const anyFact = await this.getRandomBibleFact();
      if (anyFact) {
        return {
          fact: anyFact,
          reason: "A beautiful truth from God's Word",
          relevance: 60,
        };
      }

      return null;
    } catch (error) {
      logger.error("Failed to select personalized fact:", error);
      return null;
    }
  }

  /**
   * Get Bible facts by multiple categories
   */
  async getBibleFactsByCategories(
    categories: BibleFactCategory[],
    limit: number = 5
  ): Promise<IBibleFact[]> {
    try {
      const facts = await BibleFact.find({
        category: { $in: categories },
        isActive: true,
      })
        .limit(limit)
        .sort({ createdAt: -1 });

      return facts;
    } catch (error) {
      logger.error("Failed to get Bible facts by categories:", error);
      return [];
    }
  }

  /**
   * Get Bible facts by difficulty level
   */
  async getBibleFactsByDifficulty(
    difficulty: "beginner" | "intermediate" | "advanced",
    limit: number = 10
  ): Promise<IBibleFact[]> {
    try {
      const facts = await BibleFact.find({
        difficulty,
        isActive: true,
      })
        .limit(limit)
        .sort({ createdAt: -1 });

      return facts;
    } catch (error) {
      logger.error("Failed to get Bible facts by difficulty:", error);
      return [];
    }
  }

  /**
   * Search Bible facts by tags
   */
  async searchBibleFactsByTags(
    tags: string[],
    limit: number = 10
  ): Promise<IBibleFact[]> {
    try {
      const facts = await BibleFact.find({
        tags: { $in: tags },
        isActive: true,
      })
        .limit(limit)
        .sort({ createdAt: -1 });

      return facts;
    } catch (error) {
      logger.error("Failed to search Bible facts by tags:", error);
      return [];
    }
  }

  /**
   * Get daily Bible fact
   */
  async getDailyBibleFact(): Promise<IBibleFact | null> {
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      // Try to get a fact that hasn't been shown today
      const fact = await BibleFact.aggregate([
        { $match: { isActive: true } },
        { $sample: { size: 1 } },
      ]);

      return fact.length > 0 ? fact[0] : null;
    } catch (error) {
      logger.error("Failed to get daily Bible fact:", error);
      return null;
    }
  }

  /**
   * Create a new Bible fact (Admin only)
   */
  async createBibleFact(factData: {
    title: string;
    fact: string;
    scripture: string;
    category: BibleFactCategory;
    tags?: string[];
    difficulty?: "beginner" | "intermediate" | "advanced";
  }): Promise<IBibleFact> {
    try {
      const bibleFact = new BibleFact({
        ...factData,
        language: "en",
        isActive: true,
      });

      await bibleFact.save();
      return bibleFact;
    } catch (error) {
      logger.error("Failed to create Bible fact:", error);
      throw error;
    }
  }

  /**
   * Get Bible fact statistics
   */
  async getBibleFactStats(): Promise<{
    totalFacts: number;
    factsByCategory: Record<string, number>;
    factsByDifficulty: Record<string, number>;
    activeFacts: number;
  }> {
    try {
      const [totalFacts, activeFacts, factsByCategory, factsByDifficulty] =
        await Promise.all([
          BibleFact.countDocuments(),
          BibleFact.countDocuments({ isActive: true }),
          BibleFact.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
          ]),
          BibleFact.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: "$difficulty", count: { $sum: 1 } } },
          ]),
        ]);

      const categoryStats: Record<string, number> = {};
      factsByCategory.forEach((item: any) => {
        categoryStats[item._id] = item.count;
      });

      const difficultyStats: Record<string, number> = {};
      factsByDifficulty.forEach((item: any) => {
        difficultyStats[item._id] = item.count;
      });

      return {
        totalFacts,
        factsByCategory: categoryStats,
        factsByDifficulty: difficultyStats,
        activeFacts,
      };
    } catch (error) {
      logger.error("Failed to get Bible fact stats:", error);
      return {
        totalFacts: 0,
        factsByCategory: {},
        factsByDifficulty: {},
        activeFacts: 0,
      };
    }
  }
}

export default new BibleFactsService();
