"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.MediaAnalyticsService = void 0;
const mongoose_1 = require("mongoose");
const media_model_1 = require("../models/media.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const logger_1 = __importDefault(require("../utils/logger"));
class MediaAnalyticsService {
    /**
     * Get comprehensive analytics for a specific media item
     * Similar to Twitter/X post analytics
     */
    static getMediaAnalytics(mediaId, userId, timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            // Verify user owns the media
            const media = yield media_model_1.Media.findById(mediaId);
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
            const [allInteractions, interactionsInRange] = yield Promise.all([
                mediaInteraction_model_1.MediaInteraction.find({
                    media: new mongoose_1.Types.ObjectId(mediaId),
                    isRemoved: { $ne: true },
                }),
                mediaInteraction_model_1.MediaInteraction.find({
                    media: new mongoose_1.Types.ObjectId(mediaId),
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
            const uniqueViewers = new Set(allInteractions
                .filter(i => i.interactionType === "view")
                .map(i => i.user.toString()));
            const uniqueViews = uniqueViewers.size;
            // Get bookmarks count
            const { Bookmark } = yield Promise.resolve().then(() => __importStar(require("../models/bookmark.model")));
            const bookmarks = yield Bookmark.countDocuments({
                media: new mongoose_1.Types.ObjectId(mediaId),
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
            const viewsLast24h = interactionsInRange.filter(i => i.interactionType === "view" && i.createdAt >= last24h).length;
            const viewsLast7d = interactionsInRange.filter(i => i.interactionType === "view" && i.createdAt >= last7d).length;
            const viewsLast30d = interactionsInRange.filter(i => i.interactionType === "view" && i.createdAt >= last30d).length;
            const likesLast24h = interactionsInRange.filter(i => i.interactionType === "like" && i.createdAt >= last24h).length;
            const likesLast7d = interactionsInRange.filter(i => i.interactionType === "like" && i.createdAt >= last7d).length;
            const likesLast30d = interactionsInRange.filter(i => i.interactionType === "like" && i.createdAt >= last30d).length;
            // Calculate trends (compare current period vs previous period)
            const previousRangeStart = new Date(range.startDate.getTime() - (range.endDate.getTime() - range.startDate.getTime()));
            const [previousPeriodInteractions, currentPeriodInteractions] = yield Promise.all([
                mediaInteraction_model_1.MediaInteraction.find({
                    media: new mongoose_1.Types.ObjectId(mediaId),
                    createdAt: { $gte: previousRangeStart, $lt: range.startDate },
                    isRemoved: { $ne: true },
                }),
                mediaInteraction_model_1.MediaInteraction.find({
                    media: new mongoose_1.Types.ObjectId(mediaId),
                    createdAt: { $gte: range.startDate, $lte: range.endDate },
                    isRemoved: { $ne: true },
                }),
            ]);
            const previousViews = previousPeriodInteractions.filter(i => i.interactionType === "view").length;
            const currentViews = currentPeriodInteractions.filter(i => i.interactionType === "view").length;
            const viewsTrend = previousViews > 0
                ? ((currentViews - previousViews) / previousViews) * 100
                : currentViews > 0 ? 100 : 0;
            const previousLikes = previousPeriodInteractions.filter(i => i.interactionType === "like").length;
            const currentLikes = currentPeriodInteractions.filter(i => i.interactionType === "like").length;
            const likesTrend = previousLikes > 0
                ? ((currentLikes - previousLikes) / previousLikes) * 100
                : currentLikes > 0 ? 100 : 0;
            const previousShares = previousPeriodInteractions.filter(i => i.interactionType === "share").length;
            const currentShares = currentPeriodInteractions.filter(i => i.interactionType === "share").length;
            const sharesTrend = previousShares > 0
                ? ((currentShares - previousShares) / previousShares) * 100
                : currentShares > 0 ? 100 : 0;
            // Calculate average watch time from interaction data
            const viewInteractions = allInteractions.filter((i) => i.interactionType === "view" && i.interactions && i.interactions.length > 0);
            let averageWatchTime;
            if (viewInteractions.length > 0) {
                const totalWatchTime = viewInteractions.reduce((sum, interaction) => {
                    const durations = interaction.interactions
                        .filter((i) => i.duration)
                        .map((i) => i.duration);
                    return sum + durations.reduce((a, b) => a + b, 0);
                }, 0);
                const totalDurations = viewInteractions.reduce((sum, interaction) => {
                    return sum + interaction.interactions.filter((i) => i.duration).length;
                }, 0);
                averageWatchTime = totalDurations > 0 ? totalWatchTime / totalDurations : undefined;
            }
            // Calculate completion rate
            const completedViews = viewInteractions.filter((interaction) => interaction.interactions.some((i) => i.isComplete === true)).length;
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
        });
    }
    /**
     * Get comprehensive analytics for all media by a creator
     * Similar to Twitter/X creator analytics dashboard
     */
    static getCreatorAnalytics(userId, timeRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const defaultTimeRange = {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                endDate: new Date(),
            };
            const range = timeRange || defaultTimeRange;
            // Get all media by this creator
            const allMedia = yield media_model_1.Media.find({
                uploadedBy: new mongoose_1.Types.ObjectId(userId),
            });
            // Get all interactions for this creator's media
            const mediaIds = allMedia.map(m => m._id);
            const [allInteractions, interactionsInRange] = yield Promise.all([
                mediaInteraction_model_1.MediaInteraction.find({
                    media: { $in: mediaIds },
                    isRemoved: { $ne: true },
                }),
                mediaInteraction_model_1.MediaInteraction.find({
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
            const viewsLast24h = interactionsInRange.filter(i => i.interactionType === "view" && i.createdAt >= last24h).length;
            const viewsLast7d = interactionsInRange.filter(i => i.interactionType === "view" && i.createdAt >= last7d).length;
            const viewsLast30d = interactionsInRange.filter(i => i.interactionType === "view" && i.createdAt >= last30d).length;
            const likesLast24h = interactionsInRange.filter(i => i.interactionType === "like" && i.createdAt >= last24h).length;
            const likesLast7d = interactionsInRange.filter(i => i.interactionType === "like" && i.createdAt >= last7d).length;
            const likesLast30d = interactionsInRange.filter(i => i.interactionType === "like" && i.createdAt >= last30d).length;
            // Get top performing media (by total engagement)
            const mediaWithEngagement = yield Promise.all(allMedia.slice(0, 10).map((media) => __awaiter(this, void 0, void 0, function* () {
                try {
                    return yield this.getMediaAnalytics(media._id.toString(), userId, range);
                }
                catch (error) {
                    logger_1.default.error(`Error getting analytics for media ${media._id}:`, error);
                    return null;
                }
            })));
            const topPerformingMedia = mediaWithEngagement
                .filter((m) => m !== null)
                .sort((a, b) => {
                const aEngagement = a.likes + a.shares + a.comments;
                const bEngagement = b.likes + b.shares + b.comments;
                return bEngagement - aEngagement;
            })
                .slice(0, 10);
            // Content type breakdown
            const byContentType = {};
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
                const dayInteractions = interactionsInRange.filter(i => i.createdAt >= date && i.createdAt < nextDate);
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
        });
    }
}
exports.MediaAnalyticsService = MediaAnalyticsService;
exports.default = MediaAnalyticsService;
