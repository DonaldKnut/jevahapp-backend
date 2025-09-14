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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bibleFact_model_1 = require("../models/bibleFact.model");
const user_model_1 = require("../models/user.model");
const logger_1 = __importDefault(require("../utils/logger"));
class BibleFactsService {
    /**
     * Get a random Bible fact
     */
    getRandomBibleFact() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fact = yield bibleFact_model_1.BibleFact.aggregate([
                    { $match: { isActive: true } },
                    { $sample: { size: 1 } },
                ]);
                return fact.length > 0 ? fact[0] : null;
            }
            catch (error) {
                logger_1.default.error("Failed to get random Bible fact:", error);
                return null;
            }
        });
    }
    /**
     * Get Bible fact by category
     */
    getBibleFactByCategory(category) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fact = yield bibleFact_model_1.BibleFact.aggregate([
                    { $match: { category, isActive: true } },
                    { $sample: { size: 1 } },
                ]);
                return fact.length > 0 ? fact[0] : null;
            }
            catch (error) {
                logger_1.default.error("Failed to get Bible fact by category:", error);
                return null;
            }
        });
    }
    /**
     * Get personalized Bible fact for user
     */
    getPersonalizedBibleFact(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user)
                    return null;
                const preferences = yield this.getUserBiblePreferences(userId);
                const personalizedFact = yield this.selectPersonalizedFact(preferences);
                return personalizedFact;
            }
            catch (error) {
                logger_1.default.error("Failed to get personalized Bible fact:", error);
                return null;
            }
        });
    }
    /**
     * Get user's Bible preferences
     */
    getUserBiblePreferences(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findById(userId);
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
                const difficulty = yield this.determineUserDifficulty(userId);
                // Get recent facts (from user activity)
                const recentFacts = yield this.getRecentBibleFacts(userId);
                return {
                    favoriteCategories,
                    difficulty,
                    recentFacts,
                    interests,
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get user Bible preferences:", error);
                return {
                    favoriteCategories: ["faith", "love", "hope"],
                    difficulty: "beginner",
                    recentFacts: [],
                    interests: [],
                };
            }
        });
    }
    /**
     * Map user interests to Bible fact categories
     */
    mapInterestsToCategories(interests) {
        const interestToCategoryMap = {
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
        const categories = [];
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
    determineUserDifficulty(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user)
                    return "beginner";
                // Calculate based on user's engagement and activity
                const accountAge = Date.now() - user.createdAt.getTime();
                const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
                // Check user's library and interactions
                const libraryCount = ((_a = user.library) === null || _a === void 0 ? void 0 : _a.length) || 0;
                const offlineDownloads = ((_b = user.offlineDownloads) === null || _b === void 0 ? void 0 : _b.length) || 0;
                const followingCount = ((_c = user.following) === null || _c === void 0 ? void 0 : _c.length) || 0;
                // Calculate engagement score
                let engagementScore = 0;
                engagementScore += Math.min(daysSinceCreation * 0.1, 30); // Account age
                engagementScore += libraryCount * 2; // Saved content
                engagementScore += offlineDownloads * 3; // Downloads
                engagementScore += followingCount * 1; // Following artists
                if (engagementScore >= 50)
                    return "advanced";
                if (engagementScore >= 20)
                    return "intermediate";
                return "beginner";
            }
            catch (error) {
                return "beginner";
            }
        });
    }
    /**
     * Get recent Bible facts for user
     */
    getRecentBibleFacts(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would typically come from user's notification history
                // For now, return empty array
                return [];
            }
            catch (error) {
                return [];
            }
        });
    }
    /**
     * Select personalized Bible fact
     */
    selectPersonalizedFact(preferences) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to find fact based on user's favorite categories
                for (const category of preferences.favoriteCategories) {
                    const fact = yield bibleFact_model_1.BibleFact.findOne({
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
                const randomFact = yield bibleFact_model_1.BibleFact.aggregate([
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
                const anyFact = yield this.getRandomBibleFact();
                if (anyFact) {
                    return {
                        fact: anyFact,
                        reason: "A beautiful truth from God's Word",
                        relevance: 60,
                    };
                }
                return null;
            }
            catch (error) {
                logger_1.default.error("Failed to select personalized fact:", error);
                return null;
            }
        });
    }
    /**
     * Get Bible facts by multiple categories
     */
    getBibleFactsByCategories(categories_1) {
        return __awaiter(this, arguments, void 0, function* (categories, limit = 5) {
            try {
                const facts = yield bibleFact_model_1.BibleFact.find({
                    category: { $in: categories },
                    isActive: true,
                })
                    .limit(limit)
                    .sort({ createdAt: -1 });
                return facts;
            }
            catch (error) {
                logger_1.default.error("Failed to get Bible facts by categories:", error);
                return [];
            }
        });
    }
    /**
     * Get Bible facts by difficulty level
     */
    getBibleFactsByDifficulty(difficulty_1) {
        return __awaiter(this, arguments, void 0, function* (difficulty, limit = 10) {
            try {
                const facts = yield bibleFact_model_1.BibleFact.find({
                    difficulty,
                    isActive: true,
                })
                    .limit(limit)
                    .sort({ createdAt: -1 });
                return facts;
            }
            catch (error) {
                logger_1.default.error("Failed to get Bible facts by difficulty:", error);
                return [];
            }
        });
    }
    /**
     * Search Bible facts by tags
     */
    searchBibleFactsByTags(tags_1) {
        return __awaiter(this, arguments, void 0, function* (tags, limit = 10) {
            try {
                const facts = yield bibleFact_model_1.BibleFact.find({
                    tags: { $in: tags },
                    isActive: true,
                })
                    .limit(limit)
                    .sort({ createdAt: -1 });
                return facts;
            }
            catch (error) {
                logger_1.default.error("Failed to search Bible facts by tags:", error);
                return [];
            }
        });
    }
    /**
     * Get daily Bible fact
     */
    getDailyBibleFact() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                // Try to get a fact that hasn't been shown today
                const fact = yield bibleFact_model_1.BibleFact.aggregate([
                    { $match: { isActive: true } },
                    { $sample: { size: 1 } },
                ]);
                return fact.length > 0 ? fact[0] : null;
            }
            catch (error) {
                logger_1.default.error("Failed to get daily Bible fact:", error);
                return null;
            }
        });
    }
    /**
     * Create a new Bible fact (Admin only)
     */
    createBibleFact(factData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bibleFact = new bibleFact_model_1.BibleFact(Object.assign(Object.assign({}, factData), { language: "en", isActive: true }));
                yield bibleFact.save();
                return bibleFact;
            }
            catch (error) {
                logger_1.default.error("Failed to create Bible fact:", error);
                throw error;
            }
        });
    }
    /**
     * Get Bible fact statistics
     */
    getBibleFactStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [totalFacts, activeFacts, factsByCategory, factsByDifficulty] = yield Promise.all([
                    bibleFact_model_1.BibleFact.countDocuments(),
                    bibleFact_model_1.BibleFact.countDocuments({ isActive: true }),
                    bibleFact_model_1.BibleFact.aggregate([
                        { $match: { isActive: true } },
                        { $group: { _id: "$category", count: { $sum: 1 } } },
                    ]),
                    bibleFact_model_1.BibleFact.aggregate([
                        { $match: { isActive: true } },
                        { $group: { _id: "$difficulty", count: { $sum: 1 } } },
                    ]),
                ]);
                const categoryStats = {};
                factsByCategory.forEach((item) => {
                    categoryStats[item._id] = item.count;
                });
                const difficultyStats = {};
                factsByDifficulty.forEach((item) => {
                    difficultyStats[item._id] = item.count;
                });
                return {
                    totalFacts,
                    factsByCategory: categoryStats,
                    factsByDifficulty: difficultyStats,
                    activeFacts,
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get Bible fact stats:", error);
                return {
                    totalFacts: 0,
                    factsByCategory: {},
                    factsByDifficulty: {},
                    activeFacts: 0,
                };
            }
        });
    }
}
exports.default = new BibleFactsService();
