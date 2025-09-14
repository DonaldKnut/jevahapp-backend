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
const user_model_1 = require("../models/user.model");
const media_model_1 = require("../models/media.model");
const devotional_model_1 = require("../models/devotional.model");
const notification_model_1 = require("../models/notification.model");
const pushNotification_service_1 = __importDefault(require("./pushNotification.service"));
const bibleFacts_service_1 = __importDefault(require("./bibleFacts.service"));
const logger_1 = __importDefault(require("../utils/logger"));
class AIReEngagementService {
    constructor() {
        this.REENGAGEMENT_DELAYS = {
            first: 24 * 60 * 60 * 1000, // 24 hours
            second: 3 * 24 * 60 * 60 * 1000, // 3 days
            third: 7 * 24 * 60 * 60 * 1000, // 1 week
            fourth: 14 * 24 * 60 * 60 * 1000, // 2 weeks
            final: 30 * 24 * 60 * 60 * 1000, // 1 month
        };
        this.MESSAGE_CATEGORIES = {
            NEW_CONTENT: "new_content",
            LIVE_STREAM: "live_stream",
            COMMUNITY: "community",
            PERSONALIZED: "personalized",
            MILESTONE: "milestone",
            SOCIAL: "social",
            SPIRITUAL: "spiritual",
            BIBLE_FACT: "bible_fact",
        };
    }
    /**
     * Track user signout and initiate re-engagement
     */
    trackUserSignout(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user)
                    return;
                // Update user's last signout time
                yield user_model_1.User.findByIdAndUpdate(userId, {
                    lastSignOutAt: new Date(),
                    $inc: { totalSessions: 1 },
                });
                // Create user activity profile
                const activityProfile = yield this.createUserActivityProfile(userId);
                // Schedule re-engagement campaign
                yield this.scheduleReEngagementCampaign(activityProfile);
                logger_1.default.info("User signout tracked and re-engagement scheduled", {
                    userId,
                    engagementScore: activityProfile.engagementScore,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to track user signout:", error);
            }
        });
    }
    /**
     * Create comprehensive user activity profile
     */
    createUserActivityProfile(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user)
                    throw new Error("User not found");
                // Get user's recent activity
                const recentMedia = yield media_model_1.Media.find({
                    $or: [{ uploadedBy: userId }, { "interactions.user": userId }],
                })
                    .sort({ createdAt: -1 })
                    .limit(50);
                const recentDevotionals = yield devotional_model_1.Devotional.find({
                    $or: [{ uploadedBy: userId }, { "interactions.user": userId }],
                })
                    .sort({ createdAt: -1 })
                    .limit(50);
                // Calculate engagement score
                const engagementScore = yield this.calculateEngagementScore(userId);
                // Get favorite content types
                const favoriteContentTypes = this.extractFavoriteContentTypes(recentMedia, recentDevotionals);
                // Get favorite artists
                const favoriteArtists = yield this.getFavoriteArtists(userId);
                // Get recent interactions
                const recentInteractions = yield this.getRecentInteractions(userId);
                // Determine preferred notification times
                const preferredNotificationTimes = this.determinePreferredTimes(user);
                return {
                    userId,
                    lastActiveAt: user.lastLoginAt || new Date(),
                    signOutAt: new Date(),
                    totalSessions: user.totalSessions || 1,
                    averageSessionDuration: yield this.calculateAverageSessionDuration(userId),
                    favoriteContentTypes,
                    favoriteArtists,
                    recentInteractions,
                    engagementScore,
                    preferredNotificationTimes,
                    timezone: user.timezone || "UTC",
                };
            }
            catch (error) {
                logger_1.default.error("Failed to create user activity profile:", error);
                throw error;
            }
        });
    }
    /**
     * Calculate user engagement score (0-100)
     */
    calculateEngagementScore(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const user = yield user_model_1.User.findById(userId);
                if (!user)
                    return 0;
                let score = 0;
                // Base score for account age
                const accountAge = Date.now() - user.createdAt.getTime();
                const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
                score += Math.min(daysSinceCreation * 0.5, 20); // Max 20 points
                // Library items
                score += (((_a = user.library) === null || _a === void 0 ? void 0 : _a.length) || 0) * 2; // 2 points per saved item
                // Offline downloads
                score += (((_b = user.offlineDownloads) === null || _b === void 0 ? void 0 : _b.length) || 0) * 3; // 3 points per download
                // Following artists
                score += (((_c = user.following) === null || _c === void 0 ? void 0 : _c.length) || 0) * 5; // 5 points per follow
                // Content interactions
                const mediaInteractions = yield media_model_1.Media.countDocuments({
                    "interactions.user": userId,
                });
                score += mediaInteractions * 1; // 1 point per interaction
                // Recent activity bonus
                const recentActivity = yield this.getRecentActivityScore(userId);
                score += recentActivity;
                return Math.min(Math.max(score, 0), 100);
            }
            catch (error) {
                logger_1.default.error("Failed to calculate engagement score:", error);
                return 50; // Default moderate engagement
            }
        });
    }
    /**
     * Get recent activity score
     */
    getRecentActivityScore(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const recentMedia = yield media_model_1.Media.countDocuments({
                    "interactions.user": userId,
                    "interactions.createdAt": { $gte: sevenDaysAgo },
                });
                const recentDevotionals = yield devotional_model_1.Devotional.countDocuments({
                    "interactions.user": userId,
                    "interactions.createdAt": { $gte: sevenDaysAgo },
                });
                return (recentMedia + recentDevotionals) * 2; // 2 points per recent interaction
            }
            catch (error) {
                return 0;
            }
        });
    }
    /**
     * Extract favorite content types
     */
    extractFavoriteContentTypes(media, devotionals) {
        const types = new Map();
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
    getFavoriteArtists(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const user = yield user_model_1.User.findById(userId);
                return ((_a = user === null || user === void 0 ? void 0 : user.following) === null || _a === void 0 ? void 0 : _a.map((id) => id.toString())) || [];
            }
            catch (error) {
                return [];
            }
        });
    }
    /**
     * Get recent user interactions
     */
    getRecentInteractions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const recentInteractions = yield notification_model_1.Notification.find({
                    user: userId,
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select("type");
                return recentInteractions.map(interaction => interaction.type);
            }
            catch (error) {
                return [];
            }
        });
    }
    /**
     * Determine preferred notification times
     */
    determinePreferredTimes(user) {
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
    calculateAverageSessionDuration(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would require session tracking implementation
                // For now, return a default value
                return 15; // 15 minutes average
            }
            catch (error) {
                return 15;
            }
        });
    }
    /**
     * Schedule re-engagement campaign
     */
    scheduleReEngagementCampaign(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const campaign = {
                    userId: profile.userId,
                    messages: [],
                    status: "active",
                    createdAt: new Date(),
                    nextScheduledAt: new Date(Date.now() + this.REENGAGEMENT_DELAYS.first),
                };
                // Generate personalized messages
                campaign.messages = yield this.generateReEngagementMessages(profile);
                // Store campaign (you might want to create a separate model for this)
                yield this.storeReEngagementCampaign(campaign);
                // Schedule first message
                yield this.scheduleNextMessage(campaign);
                logger_1.default.info("Re-engagement campaign scheduled", {
                    userId: profile.userId,
                    messageCount: campaign.messages.length,
                    nextScheduledAt: campaign.nextScheduledAt,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to schedule re-engagement campaign:", error);
            }
        });
    }
    /**
     * Generate personalized re-engagement messages
     */
    generateReEngagementMessages(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            const messages = [];
            // Message 1: New content from favorite artists
            if (profile.favoriteArtists.length > 0) {
                const artistContent = yield this.getNewContentFromArtists(profile.favoriteArtists);
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
            const liveStream = yield this.getUpcomingLiveStream();
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
            const spiritualContent = yield this.getPersonalizedSpiritualContent(profile);
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
            const bibleFact = yield this.getPersonalizedBibleFact(profile);
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
                    scheduledFor: new Date(Date.now() + this.REENGAGEMENT_DELAYS.fourth + 2 * 24 * 60 * 60 * 1000), // 2 weeks + 2 days
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
        });
    }
    /**
     * Get new content from user's favorite artists
     */
    getNewContentFromArtists(artistIds) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const recentContent = yield media_model_1.Media.findOne({
                    uploadedBy: { $in: artistIds },
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                })
                    .populate("uploadedBy", "firstName lastName artistProfile")
                    .sort({ createdAt: -1 });
                if (recentContent) {
                    return Object.assign(Object.assign({}, recentContent.toObject()), { artistName: ((_b = (_a = recentContent.uploadedBy) === null || _a === void 0 ? void 0 : _a.artistProfile) === null || _b === void 0 ? void 0 : _b.artistName) ||
                            `${(_c = recentContent.uploadedBy) === null || _c === void 0 ? void 0 : _c.firstName} ${(_d = recentContent.uploadedBy) === null || _d === void 0 ? void 0 : _d.lastName}` });
                }
                return null;
            }
            catch (error) {
                return null;
            }
        });
    }
    /**
     * Get upcoming live stream
     */
    getUpcomingLiveStream() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const upcomingStream = yield media_model_1.Media.findOne({
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
                    return Object.assign(Object.assign({}, upcomingStream.toObject()), { artistName: ((_b = (_a = upcomingStream.uploadedBy) === null || _a === void 0 ? void 0 : _a.artistProfile) === null || _b === void 0 ? void 0 : _b.artistName) ||
                            `${(_c = upcomingStream.uploadedBy) === null || _c === void 0 ? void 0 : _c.firstName} ${(_d = upcomingStream.uploadedBy) === null || _d === void 0 ? void 0 : _d.lastName}` });
                }
                return null;
            }
            catch (error) {
                return null;
            }
        });
    }
    /**
     * Get personalized spiritual content
     */
    getPersonalizedSpiritualContent(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find devotional content based on user's interests
                const spiritualContent = yield devotional_model_1.Devotional.findOne({
                    tags: { $in: profile.favoriteContentTypes },
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                }).sort({ createdAt: -1 });
                return spiritualContent;
            }
            catch (error) {
                return null;
            }
        });
    }
    /**
     * Get personalized Bible fact for re-engagement
     */
    getPersonalizedBibleFact(profile) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const personalizedFact = yield bibleFacts_service_1.default.getPersonalizedBibleFact(profile.userId);
                if (personalizedFact) {
                    return {
                        fact: personalizedFact.fact,
                        reason: personalizedFact.reason,
                        relevance: personalizedFact.relevance,
                    };
                }
                // Fallback to random Bible fact
                const randomFact = yield bibleFacts_service_1.default.getRandomBibleFact();
                if (randomFact) {
                    return {
                        fact: randomFact,
                        reason: "A beautiful truth from God's Word",
                        relevance: 60,
                    };
                }
                return null;
            }
            catch (error) {
                logger_1.default.error("Failed to get personalized Bible fact:", error);
                return null;
            }
        });
    }
    /**
     * Store re-engagement campaign
     */
    storeReEngagementCampaign(campaign) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Store in user's activity log or create a separate collection
                yield user_model_1.User.findByIdAndUpdate(campaign.userId, {
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
            }
            catch (error) {
                logger_1.default.error("Failed to store re-engagement campaign:", error);
            }
        });
    }
    /**
     * Schedule next message
     */
    scheduleNextMessage(campaign) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would integrate with a job scheduler like Bull or Agenda
                // For now, we'll use setTimeout (not recommended for production)
                const nextMessage = campaign.messages.find(msg => msg.scheduledFor > new Date());
                if (nextMessage) {
                    const delay = nextMessage.scheduledFor.getTime() - Date.now();
                    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                        yield this.sendReEngagementMessage(campaign.userId, nextMessage);
                    }), delay);
                    logger_1.default.info("Re-engagement message scheduled", {
                        userId: campaign.userId,
                        scheduledFor: nextMessage.scheduledFor,
                        messageTitle: nextMessage.title,
                    });
                }
            }
            catch (error) {
                logger_1.default.error("Failed to schedule next message:", error);
            }
        });
    }
    /**
     * Send re-engagement message
     */
    sendReEngagementMessage(userId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Send push notification
                yield pushNotification_service_1.default.sendToUser(userId, {
                    title: message.title,
                    body: message.body,
                    data: message.data,
                    priority: message.priority === "low"
                        ? "default"
                        : message.priority === "medium"
                            ? "normal"
                            : message.priority,
                }, "newFollowers");
                // Create in-app notification
                yield notification_model_1.Notification.create({
                    user: userId,
                    type: "reengagement",
                    title: message.title,
                    message: message.body,
                    metadata: message.data,
                    priority: message.priority,
                });
                // Update campaign status
                yield this.updateCampaignStatus(userId, message);
                logger_1.default.info("Re-engagement message sent", {
                    userId,
                    messageTitle: message.title,
                    category: message.data.category,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to send re-engagement message:", error);
            }
        });
    }
    /**
     * Update campaign status
     */
    updateCampaignStatus(userId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield user_model_1.User.findByIdAndUpdate(userId, {
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
            }
            catch (error) {
                logger_1.default.error("Failed to update campaign status:", error);
            }
        });
    }
    /**
     * Track user return (when they come back)
     */
    trackUserReturn(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield user_model_1.User.findByIdAndUpdate(userId, {
                    lastReturnAt: new Date(),
                    $inc: { returnCount: 1 },
                });
                // Cancel any pending re-engagement messages
                yield this.cancelPendingReEngagement(userId);
                logger_1.default.info("User return tracked", { userId });
            }
            catch (error) {
                logger_1.default.error("Failed to track user return:", error);
            }
        });
    }
    /**
     * Cancel pending re-engagement messages
     */
    cancelPendingReEngagement(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would cancel scheduled jobs in a proper job scheduler
                // For now, we'll just log it
                logger_1.default.info("Pending re-engagement messages cancelled", { userId });
            }
            catch (error) {
                logger_1.default.error("Failed to cancel pending re-engagement:", error);
            }
        });
    }
    /**
     * Get re-engagement analytics
     */
    getReEngagementAnalytics() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const totalUsers = yield user_model_1.User.countDocuments();
                const usersWithReEngagement = yield user_model_1.User.countDocuments({
                    "userActivities.action": "reengagement_campaign_created",
                });
                const usersWhoReturned = yield user_model_1.User.countDocuments({
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
            }
            catch (error) {
                logger_1.default.error("Failed to get re-engagement analytics:", error);
                return null;
            }
        });
    }
}
exports.default = new AIReEngagementService();
