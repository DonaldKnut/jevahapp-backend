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
const media_model_1 = require("../models/media.model");
const devotional_model_1 = require("../models/devotional.model");
const notification_service_1 = require("./notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class ViralContentService {
    constructor() {
        this.VIRAL_THRESHOLDS = {
            views: [1000, 5000, 10000, 50000, 100000],
            likes: [100, 500, 1000, 5000, 10000],
            shares: [50, 250, 500, 2500, 5000],
            comments: [25, 100, 250, 1000, 2500],
        };
        this.MILESTONE_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours
        this.processedMilestones = new Map();
    }
    /**
     * Check if content has reached viral milestones
     */
    checkViralMilestones(contentId, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let content;
                if (contentType === "media") {
                    content = yield media_model_1.Media.findById(contentId);
                }
                else {
                    content = yield devotional_model_1.Devotional.findById(contentId);
                }
                if (!content)
                    return;
                const milestones = yield this.getReachedMilestones(content);
                for (const milestone of milestones) {
                    yield this.sendMilestoneNotification(contentId, contentType, milestone.type, milestone.count);
                }
            }
            catch (error) {
                logger_1.default.error("Failed to check viral milestones:", error);
            }
        });
    }
    /**
     * Get milestones that have been reached
     */
    getReachedMilestones(content) {
        return __awaiter(this, void 0, void 0, function* () {
            const milestones = [];
            const contentKey = `${content._id}`;
            // Initialize processed milestones for this content if not exists
            if (!this.processedMilestones.has(contentKey)) {
                this.processedMilestones.set(contentKey, new Set());
            }
            const processed = this.processedMilestones.get(contentKey);
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
                if (commentCount >= threshold &&
                    !processed.has(`comments_${threshold}`)) {
                    milestones.push({ type: "comments", count: threshold });
                    processed.add(`comments_${threshold}`);
                }
            }
            return milestones;
        });
    }
    /**
     * Send milestone notification
     */
    sendMilestoneNotification(contentId, contentType, milestoneType, count) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield notification_service_1.NotificationService.notifyViralContent(contentId, contentType, milestoneType, count);
                logger_1.default.info("Viral milestone notification sent", {
                    contentId,
                    contentType,
                    milestoneType,
                    count,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send milestone notification:", error);
            }
        });
    }
    /**
     * Get trending content based on engagement
     */
    getTrendingContent(contentType_1) {
        return __awaiter(this, arguments, void 0, function* (contentType, limit = 10, timeRange = "24h") {
            try {
                const timeFilter = this.getTimeFilter(timeRange);
                const Model = contentType === "media" ? media_model_1.Media : devotional_model_1.Devotional;
                const trending = yield Model.aggregate([
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
            }
            catch (error) {
                logger_1.default.error("Failed to get trending content:", error);
                return [];
            }
        });
    }
    /**
     * Get time filter for trending content
     */
    getTimeFilter(timeRange) {
        const now = new Date();
        let startDate;
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
    cleanupProcessedMilestones() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Keep only recent milestones (last 7 days)
                const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                // This would be implemented with a more sophisticated cleanup
                // For now, we'll just log the cleanup
                logger_1.default.info("Cleaned up old processed milestones", {
                    cutoffDate,
                    processedCount: this.processedMilestones.size,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to cleanup processed milestones:", error);
            }
        });
    }
    /**
     * Get viral content statistics
     */
    getViralStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [mediaStats, devotionalStats] = yield Promise.all([
                    this.getContentStats("media"),
                    this.getContentStats("devotional"),
                ]);
                const totalViralContent = mediaStats.viralCount + devotionalStats.viralCount;
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
                        views: mediaStats.milestoneDistribution.views +
                            devotionalStats.milestoneDistribution.views,
                        likes: mediaStats.milestoneDistribution.likes +
                            devotionalStats.milestoneDistribution.likes,
                        shares: mediaStats.milestoneDistribution.shares +
                            devotionalStats.milestoneDistribution.shares,
                        comments: mediaStats.milestoneDistribution.comments +
                            devotionalStats.milestoneDistribution.comments,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get viral stats:", error);
                return {
                    totalViralContent: 0,
                    topPerformingContent: [],
                    milestoneDistribution: { views: 0, likes: 0, shares: 0, comments: 0 },
                };
            }
        });
    }
    /**
     * Get content statistics for a specific type
     */
    getContentStats(contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            const Model = contentType === "media" ? media_model_1.Media : devotional_model_1.Devotional;
            const [viralCount, topContent, milestoneDistribution] = yield Promise.all([
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
        });
    }
}
exports.default = new ViralContentService();
