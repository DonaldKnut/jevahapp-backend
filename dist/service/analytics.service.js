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
exports.AnalyticsService = void 0;
const mongoose_1 = require("mongoose");
const media_model_1 = require("../models/media.model");
const user_model_1 = require("../models/user.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const bookmark_model_1 = require("../models/bookmark.model");
class AnalyticsService {
    /**
     * Get comprehensive user engagement metrics
     */
    static getUserEngagementMetrics(userId, timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield user_model_1.User.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }
            const defaultTimeRange = {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                endDate: new Date(),
            };
            const range = timeRange || defaultTimeRange;
            // Get user interactions
            const interactions = yield mediaInteraction_model_1.MediaInteraction.find({
                user: new mongoose_1.Types.ObjectId(userId),
                createdAt: { $gte: range.startDate, $lte: range.endDate },
            });
            // Calculate metrics
            const totalViews = interactions.filter(i => i.interactionType === "view").length;
            const totalLikes = interactions.filter(i => i.interactionType === "like").length;
            const totalShares = interactions.filter(i => i.interactionType === "share").length;
            const totalDownloads = interactions.filter(i => i.interactionType === "download").length;
            // Get bookmarks and comments
            const bookmarks = yield bookmark_model_1.Bookmark.find({
                user: new mongoose_1.Types.ObjectId(userId),
                createdAt: { $gte: range.startDate, $lte: range.endDate },
            });
            // const comments = await Comment.find({
            //   user: new Types.ObjectId(userId),
            //   createdAt: { $gte: range.startDate, $lte: range.endDate },
            // });
            const comments = []; // Placeholder until Comment model is available
            // Calculate session duration from user activities
            const userActivities = user.userActivities || [];
            const recentActivities = userActivities.filter((activity) => new Date(activity.timestamp) >= range.startDate);
            const averageSessionDuration = this.calculateAverageSessionDuration(recentActivities);
            const mostActiveDay = this.getMostActiveDay(recentActivities);
            const mostActiveHour = this.getMostActiveHour(recentActivities);
            const engagementScore = this.calculateEngagementScore(interactions, bookmarks, comments);
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
        });
    }
    /**
     * Get content performance metrics
     */
    static getContentPerformanceMetrics(userId, timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultTimeRange = {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                endDate: new Date(),
            };
            const range = timeRange || defaultTimeRange;
            // Build query based on user role
            const mediaQuery = {
                createdAt: { $gte: range.startDate, $lte: range.endDate },
            };
            if (userId) {
                mediaQuery.uploadedBy = new mongoose_1.Types.ObjectId(userId);
            }
            const media = yield media_model_1.Media.find(mediaQuery);
            // Count content by type
            const contentByType = {
                videos: media.filter(m => m.contentType === "videos").length,
                audio: media.filter(m => m.contentType === "audio").length,
                books: media.filter(m => m.contentType === "books").length,
                music: media.filter(m => m.contentType === "music").length,
            };
            // Get top performing content
            const topPerformingContent = yield this.getTopPerformingContent(mediaQuery, 10);
            // Get content trends
            const contentTrends = yield this.getContentTrends(mediaQuery, range);
            return {
                totalContent: media.length,
                contentByType,
                topPerformingContent,
                contentTrends,
            };
        });
    }
    /**
     * Get user activity analytics
     */
    static getUserActivityAnalytics(timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultTimeRange = {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                endDate: new Date(),
            };
            const range = timeRange || defaultTimeRange;
            // Get user counts
            const totalUsers = yield user_model_1.User.countDocuments();
            const activeUsers = yield user_model_1.User.countDocuments({
                lastLoginAt: { $gte: range.startDate },
            });
            const newUsers = yield user_model_1.User.countDocuments({
                createdAt: { $gte: range.startDate, $lte: range.endDate },
            });
            // Calculate returning users
            const returningUsers = activeUsers - newUsers;
            // Calculate retention rate
            const userRetentionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
            // Get average session duration
            const averageSessionDuration = yield this.getAverageSessionDuration(range);
            // Get user engagement distribution
            const userEngagementDistribution = yield this.getUserEngagementDistribution(range);
            // Get activity timeline
            const userActivityTimeline = yield this.getUserActivityTimeline(range);
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
        });
    }
    /**
     * Get advanced analytics for dashboard
     */
    static getAdvancedAnalytics(userId, timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultTimeRange = {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                endDate: new Date(),
            };
            const range = timeRange || defaultTimeRange;
            // Get real-time metrics
            const realTimeMetrics = yield this.getRealTimeMetrics();
            // Get user behavior insights
            const userBehavior = yield this.getUserBehaviorInsights(range);
            // Get content insights
            const contentInsights = yield this.getContentInsights(range);
            // Get business metrics
            const businessMetrics = yield this.getBusinessMetrics(range);
            return {
                realTimeMetrics,
                userBehavior,
                contentInsights,
                businessMetrics,
            };
        });
    }
    /**
     * Get analytics dashboard data
     */
    static getAnalyticsDashboard(userId, userRole, timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultTimeRange = {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                endDate: new Date(),
            };
            const range = timeRange || defaultTimeRange;
            if (userRole === "admin") {
                // Admin dashboard - comprehensive analytics
                const [userEngagement, contentPerformance, userActivity, advancedAnalytics,] = yield Promise.all([
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
                        totalInteractions: userEngagement.totalViews +
                            userEngagement.totalLikes +
                            userEngagement.totalShares,
                        engagementRate: userEngagement.engagementScore,
                    },
                };
            }
            else {
                // User dashboard - personal analytics
                const [userEngagement, contentPerformance, userActivity] = yield Promise.all([
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
                        totalInteractions: userEngagement.totalViews +
                            userEngagement.totalLikes +
                            userEngagement.totalShares,
                        engagementRate: userEngagement.engagementScore,
                        rank: yield this.getUserRank(userId),
                    },
                };
            }
        });
    }
    // Helper methods
    static calculateAverageSessionDuration(activities) {
        if (activities.length === 0)
            return 0;
        // Group activities by session (assuming sessions are separated by 30+ minutes)
        const sessions = [];
        let currentSession = [];
        activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        for (let i = 0; i < activities.length; i++) {
            const activity = activities[i];
            const prevActivity = i > 0 ? activities[i - 1] : null;
            if (prevActivity) {
                const timeDiff = new Date(activity.timestamp).getTime() -
                    new Date(prevActivity.timestamp).getTime();
                if (timeDiff > 30 * 60 * 1000) {
                    // 30 minutes
                    sessions.push(currentSession);
                    currentSession = [activity];
                }
                else {
                    currentSession.push(activity);
                }
            }
            else {
                currentSession.push(activity);
            }
        }
        if (currentSession.length > 0) {
            sessions.push(currentSession);
        }
        // Calculate average session duration
        const sessionDurations = sessions.map(session => {
            if (session.length < 2)
                return 0;
            const start = new Date(session[0].timestamp).getTime();
            const end = new Date(session[session.length - 1].timestamp).getTime();
            return end - start;
        });
        return (sessionDurations.reduce((sum, duration) => sum + duration, 0) /
            sessionDurations.length);
    }
    static getMostActiveDay(activities) {
        if (activities.length === 0)
            return "Unknown";
        const dayCounts = {};
        activities.forEach(activity => {
            const day = new Date(activity.timestamp).toLocaleDateString("en-US", {
                weekday: "long",
            });
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        });
        return Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b);
    }
    static getMostActiveHour(activities) {
        if (activities.length === 0)
            return 0;
        const hourCounts = {};
        activities.forEach(activity => {
            const hour = new Date(activity.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        return parseInt(Object.keys(hourCounts).reduce((a, b) => hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b));
    }
    static calculateEngagementScore(interactions, bookmarks, comments) {
        const totalInteractions = interactions.length + bookmarks.length + comments.length;
        const uniqueContent = new Set([
            ...interactions.map(i => i.media.toString()),
            ...bookmarks.map(b => b.media.toString()),
            ...comments.map(c => { var _a; return (_a = c.media) === null || _a === void 0 ? void 0 : _a.toString(); }).filter(Boolean),
        ]).size;
        if (uniqueContent === 0)
            return 0;
        // Calculate engagement score based on interactions per unique content
        const engagementRate = totalInteractions / uniqueContent;
        return Math.min(100, Math.round(engagementRate * 10)); // Cap at 100
    }
    static getTopPerformingContent(query, limit) {
        return __awaiter(this, void 0, void 0, function* () {
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
                { $sort: { engagementRate: -1, views: -1 } },
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
            return yield media_model_1.Media.aggregate(pipeline);
        });
    }
    static getContentTrends(query, range) {
        return __awaiter(this, void 0, void 0, function* () {
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
                { $sort: { "_id.date": 1 } },
            ];
            const uploadTrends = yield media_model_1.Media.aggregate(pipeline);
            // Get interaction trends
            const interactionTrends = yield mediaInteraction_model_1.MediaInteraction.aggregate([
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
            return Array.from(trendsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        });
    }
    static getAverageSessionDuration(range) {
        return __awaiter(this, void 0, void 0, function* () {
            // This would require more sophisticated session tracking
            // For now, return a placeholder
            return 1800000; // 30 minutes in milliseconds
        });
    }
    static getUserEngagementDistribution(range) {
        return __awaiter(this, void 0, void 0, function* () {
            // Calculate engagement distribution based on user activity
            const users = yield user_model_1.User.find({
                lastLoginAt: { $gte: range.startDate },
            });
            const engagementScores = yield Promise.all(users.map((user) => __awaiter(this, void 0, void 0, function* () {
                const metrics = yield this.getUserEngagementMetrics(user._id.toString(), range);
                return metrics.engagementScore;
            })));
            const high = engagementScores.filter(score => score >= 70).length;
            const medium = engagementScores.filter(score => score >= 30 && score < 70).length;
            const low = engagementScores.filter(score => score < 30).length;
            return { high, medium, low };
        });
    }
    static getUserActivityTimeline(range) {
        return __awaiter(this, void 0, void 0, function* () {
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
                { $sort: { "_id.date": 1 } },
            ];
            return yield user_model_1.User.aggregate(pipeline);
        });
    }
    static getRealTimeMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const [currentActiveUsers, currentSessions, currentUploads, currentInteractions,] = yield Promise.all([
                user_model_1.User.countDocuments({ lastLoginAt: { $gte: oneHourAgo } }),
                user_model_1.User.countDocuments({ lastLoginAt: { $gte: oneHourAgo } }), // Simplified
                media_model_1.Media.countDocuments({ createdAt: { $gte: oneHourAgo } }),
                mediaInteraction_model_1.MediaInteraction.countDocuments({ createdAt: { $gte: oneHourAgo } }),
            ]);
            return {
                currentActiveUsers,
                currentSessions,
                currentUploads,
                currentInteractions,
            };
        });
    }
    static getUserBehaviorInsights(range) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get most popular content types
            const contentTypes = yield media_model_1.Media.aggregate([
                { $match: { createdAt: { $gte: range.startDate, $lte: range.endDate } } },
                { $group: { _id: "$contentType", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]);
            const totalContent = contentTypes.reduce((sum, type) => sum + type.count, 0);
            const mostPopularContentTypes = contentTypes.map(type => ({
                type: type._id,
                count: type.count,
                percentage: Math.round((type.count / totalContent) * 100),
            }));
            // User journey funnel (simplified)
            const userJourneyFunnel = {
                registered: yield user_model_1.User.countDocuments({
                    createdAt: { $gte: range.startDate },
                }),
                firstContent: yield user_model_1.User.countDocuments({
                    createdAt: { $gte: range.startDate },
                    "userActivities.action": "media_upload",
                }),
                firstInteraction: yield user_model_1.User.countDocuments({
                    createdAt: { $gte: range.startDate },
                    "userActivities.action": { $in: ["media_like", "media_view"] },
                }),
                firstShare: yield user_model_1.User.countDocuments({
                    createdAt: { $gte: range.startDate },
                    "userActivities.action": "media_share",
                }),
                firstDownload: yield user_model_1.User.countDocuments({
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
        });
    }
    static getContentInsights(range) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get viral content
            const viralContent = yield this.getTopPerformingContent({ createdAt: { $gte: range.startDate, $lte: range.endDate } }, 5);
            // Get trending topics (simplified)
            const trendingTopics = [
                { topic: "gospel", count: 150, growth: 25 },
                { topic: "worship", count: 120, growth: 15 },
                { topic: "prayer", count: 100, growth: 30 },
            ];
            return {
                viralContent: viralContent.map(content => (Object.assign(Object.assign({}, content), { viralScore: Math.round(content.engagementRate * 100) }))),
                trendingTopics,
                contentQualityScore: 85, // Placeholder
                averageContentEngagement: 75, // Placeholder
            };
        });
    }
    static getBusinessMetrics(range) {
        return __awaiter(this, void 0, void 0, function* () {
            // These would typically come from payment/subscription data
            return {
                revenue: 0, // Placeholder
                conversionRate: 15, // Placeholder percentage
                userLifetimeValue: 25, // Placeholder
                churnRate: 5, // Placeholder percentage
                growthRate: 20, // Placeholder percentage
            };
        });
    }
    static getUserRank(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Calculate user rank based on engagement
            const userMetrics = yield this.getUserEngagementMetrics(userId);
            const allUsers = yield user_model_1.User.find({});
            const userScores = yield Promise.all(allUsers.map((user) => __awaiter(this, void 0, void 0, function* () {
                const metrics = yield this.getUserEngagementMetrics(user._id.toString());
                return { userId: user._id.toString(), score: metrics.engagementScore };
            })));
            userScores.sort((a, b) => b.score - a.score);
            const userIndex = userScores.findIndex(u => u.userId === userId);
            return userIndex + 1; // Rank (1-based)
        });
    }
}
exports.AnalyticsService = AnalyticsService;
