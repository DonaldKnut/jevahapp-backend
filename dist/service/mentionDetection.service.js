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
const notification_service_1 = require("./notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class MentionDetectionService {
    /**
     * Detect mentions in comment text and send notifications
     */
    detectAndNotifyMentions(commenterId, contentId, contentType, commentText) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const mentions = this.extractMentions(commentText);
                if (mentions.length === 0)
                    return;
                // Get mentioned users
                const mentionedUsers = yield user_model_1.User.find({
                    $or: [
                        { firstName: { $in: mentions } },
                        { lastName: { $in: mentions } },
                        { email: { $in: mentions } },
                    ],
                });
                // Send notifications to mentioned users
                for (const user of mentionedUsers) {
                    // Skip if user is the commenter
                    if (user._id.toString() === commenterId)
                        continue;
                    yield notification_service_1.NotificationService.notifyContentMention(commenterId, user._id.toString(), contentId, contentType, commentText);
                }
                logger_1.default.info("Mention notifications sent", {
                    commenterId,
                    contentId,
                    contentType,
                    mentionCount: mentionedUsers.length,
                    mentions,
                });
            }
            catch (error) {
                logger_1.default.error("Failed to detect and notify mentions:", error);
            }
        });
    }
    /**
     * Extract mentions from text using various patterns
     */
    extractMentions(text) {
        const mentions = [];
        // Pattern 1: @username format
        const atMentions = text.match(/@(\w+)/g);
        if (atMentions) {
            mentions.push(...atMentions.map(m => m.substring(1)));
        }
        // Pattern 2: "Hey John" or "Thanks Sarah" format
        const nameMentions = text.match(/\b(?:hey|hi|hello|thanks|thank you|@)\s+([A-Z][a-z]+)\b/gi);
        if (nameMentions) {
            mentions.push(...nameMentions
                .map(m => {
                const match = m.match(/\b([A-Z][a-z]+)\b/);
                return match ? match[1] : "";
            })
                .filter(Boolean));
        }
        // Pattern 3: Direct name mentions (capitalized words that could be names)
        const directMentions = text.match(/\b[A-Z][a-z]+\b/g);
        if (directMentions) {
            // Filter out common words that aren't names
            const commonWords = new Set([
                "The",
                "This",
                "That",
                "These",
                "Those",
                "There",
                "Here",
                "Where",
                "When",
                "Why",
                "How",
                "What",
                "Who",
                "Which",
                "But",
                "And",
                "Or",
                "So",
                "Because",
                "If",
                "Then",
                "Now",
                "Today",
                "Tomorrow",
                "Yesterday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
                "God",
                "Jesus",
                "Christ",
                "Lord",
                "Father",
                "Son",
                "Holy",
                "Spirit",
                "Bible",
                "Church",
                "Faith",
                "Hope",
                "Love",
                "Peace",
                "Joy",
                "Grace",
                "Mercy",
                "Truth",
                "Light",
                "Life",
                "Death",
                "Heaven",
                "Hell",
                "Prayer",
                "Worship",
                "Praise",
                "Gospel",
                "Ministry",
                "Pastor",
                "Reverend",
                "Brother",
                "Sister",
                "Amen",
                "Hallelujah",
                "Praise",
                "Glory",
                "Honor",
                "Blessed",
                "Blessing",
                "Miracle",
                "Wonderful",
                "Amazing",
                "Great",
                "Good",
                "Beautiful",
                "Awesome",
                "Fantastic",
                "Incredible",
                "Perfect",
                "Excellent",
                "Outstanding",
                "Magnificent",
                "Spectacular",
                "Marvelous",
                "Wonderful",
                "Amazing",
                "Inspiring",
                "Uplifting",
                "Encouraging",
                "Motivating",
                "Empowering",
                "Transforming",
                "Life-changing",
                "Powerful",
                "Strong",
                "Mighty",
                "Victorious",
                "Triumphant",
                "Successful",
                "Prosperous",
                "Abundant",
                "Rich",
                "Wealthy",
                "Healthy",
                "Strong",
                "Fit",
                "Active",
                "Energetic",
                "Vibrant",
                "Alive",
                "Living",
                "Breathing",
                "Moving",
                "Growing",
                "Developing",
                "Progressing",
                "Advancing",
                "Improving",
                "Better",
                "Best",
                "Perfect",
                "Complete",
                "Whole",
                "Full",
                "Total",
                "Entire",
                "All",
                "Every",
                "Each",
                "Some",
                "Many",
                "Few",
                "Several",
                "Most",
                "More",
                "Less",
                "Much",
                "Little",
                "Big",
                "Small",
                "Large",
                "Huge",
                "Tiny",
                "Massive",
                "Giant",
                "Mini",
                "Micro",
                "Macro",
                "Super",
                "Ultra",
                "Mega",
                "Giga",
                "Tera",
                "Peta",
                "Exa",
                "Zetta",
                "Yotta",
            ]);
            mentions.push(...directMentions.filter(name => !commonWords.has(name) && name.length > 2 && name.length < 20));
        }
        // Remove duplicates and return
        return [...new Set(mentions)];
    }
    /**
     * Validate if a mention is likely a real user
     */
    validateMention(mention) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = yield user_model_1.User.findOne({
                    $or: [
                        { firstName: { $regex: new RegExp(`^${mention}$`, "i") } },
                        { lastName: { $regex: new RegExp(`^${mention}$`, "i") } },
                        { email: { $regex: new RegExp(`^${mention}$`, "i") } },
                    ],
                });
                return !!user;
            }
            catch (error) {
                logger_1.default.error("Failed to validate mention:", error);
                return false;
            }
        });
    }
    /**
     * Get mention suggestions for autocomplete
     */
    getMentionSuggestions(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, limit = 10) {
            try {
                const suggestions = yield user_model_1.User.find({
                    $or: [
                        { firstName: { $regex: new RegExp(`^${query}`, "i") } },
                        { lastName: { $regex: new RegExp(`^${query}`, "i") } },
                        { email: { $regex: new RegExp(`^${query}`, "i") } },
                    ],
                })
                    .select("firstName lastName email avatar")
                    .limit(limit);
                return suggestions.map(user => ({
                    id: user._id,
                    name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
                    email: user.email,
                    avatar: user.avatar,
                }));
            }
            catch (error) {
                logger_1.default.error("Failed to get mention suggestions:", error);
                return [];
            }
        });
    }
    /**
     * Process comment text to highlight mentions
     */
    processCommentText(text) {
        // Replace @mentions with clickable links
        return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    }
    /**
     * Get mention statistics
     */
    getMentionStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would require a more sophisticated implementation
                // For now, return basic stats
                return {
                    totalMentions: 0,
                    topMentionedUsers: [],
                    mentionTrends: [],
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get mention stats:", error);
                return {
                    totalMentions: 0,
                    topMentionedUsers: [],
                    mentionTrends: [],
                };
            }
        });
    }
}
exports.default = new MentionDetectionService();
