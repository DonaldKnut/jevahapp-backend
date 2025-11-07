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
exports.mediaService = exports.MediaService = void 0;
const media_model_1 = require("../models/media.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const bookmark_model_1 = require("../models/bookmark.model");
const user_model_1 = require("../models/user.model");
const userViewedMedia_model_1 = require("../models/userViewedMedia.model");
const mediaUserAction_model_1 = require("../models/mediaUserAction.model");
const mongoose_1 = require("mongoose");
const fileUpload_service_1 = __importDefault(require("./fileUpload.service"));
const email_config_1 = require("../config/email.config");
const enhancedMedia_service_1 = __importDefault(require("./enhancedMedia.service"));
const recommendationEngine_service_1 = require("./recommendationEngine.service");
class MediaService {
    uploadMedia(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const validMimeTypes = {
                videos: [
                    "video/mp4",
                    "video/webm",
                    "video/ogg",
                    "video/avi",
                    "video/mov",
                ],
                music: [
                    "audio/mpeg",
                    "audio/mp3",
                    "audio/wav",
                    "audio/ogg",
                    "audio/aac",
                    "audio/flac",
                ],
                books: ["application/pdf", "application/epub+zip"],
                live: [],
            };
            const validThumbnailMimeTypes = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/jpg",
            ];
            if (!["music", "videos", "books", "live"].includes(data.contentType)) {
                throw new Error(`Invalid content type: ${data.contentType}. Must be 'music', 'videos', 'books', or 'live'`);
            }
            if (data.contentType !== "live") {
                if (!data.file || !data.fileMimeType) {
                    throw new Error(`File and file MIME type are required for ${data.contentType} content type`);
                }
                if (!validMimeTypes[data.contentType].includes(data.fileMimeType)) {
                    throw new Error(`Invalid file MIME type for ${data.contentType}: ${data.fileMimeType}`);
                }
                if (!data.thumbnail || !data.thumbnailMimeType) {
                    throw new Error(`Thumbnail and thumbnail MIME type are required for ${data.contentType} content type`);
                }
                if (!validThumbnailMimeTypes.includes(data.thumbnailMimeType)) {
                    throw new Error(`Invalid thumbnail MIME type: ${data.thumbnailMimeType}. Must be JPEG, PNG, or WebP`);
                }
                if (data.thumbnail.length > 5 * 1024 * 1024) {
                    throw new Error("Thumbnail size must be less than 5MB");
                }
            }
            let fileUrl;
            let thumbnailUrl;
            let fileObjectKey;
            let thumbnailObjectKey;
            try {
                if (data.contentType !== "live" && data.file && data.fileMimeType) {
                    const uploadResult = yield fileUpload_service_1.default.uploadMedia(data.file, `media-${data.contentType}`, data.fileMimeType);
                    fileUrl = uploadResult.secure_url;
                    fileObjectKey = uploadResult.objectKey;
                }
                if (data.contentType !== "live" &&
                    data.thumbnail &&
                    data.thumbnailMimeType) {
                    const thumbnailResult = yield fileUpload_service_1.default.uploadMedia(data.thumbnail, "media-thumbnails", data.thumbnailMimeType);
                    thumbnailUrl = thumbnailResult.secure_url;
                    thumbnailObjectKey = thumbnailResult.objectKey;
                }
                const uploader = yield user_model_1.User.findById(data.uploadedBy);
                if (!uploader) {
                    throw new Error("Uploader not found");
                }
                const isArtist = uploader.role === "artist" && uploader.isVerifiedArtist;
                const isDownloadable = data.isDownloadable && isArtist;
                const shareUrl = `${process.env.FRONTEND_URL || "https://example.com"}/media/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                let downloadUrl;
                if (isDownloadable && fileUrl) {
                    downloadUrl = `${process.env.API_URL || "https://api.example.com"}/media/download/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }
                const mediaData = {
                    title: data.title,
                    description: data.description,
                    contentType: data.contentType,
                    category: data.category,
                    fileUrl,
                    fileMimeType: data.fileMimeType,
                    fileObjectKey,
                    thumbnailUrl,
                    thumbnailObjectKey,
                    topics: data.topics,
                    uploadedBy: new mongoose_1.Types.ObjectId(data.uploadedBy),
                    duration: data.duration,
                    isLive: data.isLive || false,
                    liveStreamStatus: data.liveStreamStatus,
                    streamKey: data.streamKey,
                    rtmpUrl: data.rtmpUrl,
                    playbackUrl: data.playbackUrl,
                    isDownloadable,
                    downloadUrl,
                    shareUrl,
                    viewThreshold: data.viewThreshold || 30,
                };
                const media = yield media_model_1.Media.create(mediaData);
                return media;
            }
            catch (error) {
                if (fileObjectKey) {
                    try {
                        yield fileUpload_service_1.default.deleteMedia(fileObjectKey);
                    }
                    catch (deleteError) {
                        console.error("Failed to delete uploaded file from R2:", deleteError);
                    }
                }
                if (thumbnailObjectKey) {
                    try {
                        yield fileUpload_service_1.default.deleteMedia(thumbnailObjectKey);
                    }
                    catch (deleteError) {
                        console.error("Failed to delete uploaded thumbnail from R2:", deleteError);
                    }
                }
                throw error;
            }
        });
    }
    getAllMedia() {
        return __awaiter(this, arguments, void 0, function* (filters = {}) {
            const query = {};
            if (filters.search) {
                query.title = { $regex: filters.search, $options: "i" };
            }
            if (filters.contentType) {
                query.contentType = filters.contentType;
            }
            if (filters.category) {
                query.category = { $regex: filters.category, $options: "i" };
            }
            if (filters.topics) {
                const topicsArray = Array.isArray(filters.topics)
                    ? filters.topics
                    : filters.topics.split(",");
                query.topics = {
                    $in: topicsArray.map((topic) => new RegExp(topic, "i")),
                };
            }
            if (filters.creator) {
                const user = yield user_model_1.User.findOne({ username: filters.creator });
                if (user) {
                    query.uploadedBy = user._id;
                }
                else {
                    query.uploadedBy = null;
                }
            }
            const durationRanges = {
                short: { $lte: 5 * 60 },
                medium: { $gte: 5 * 60, $lte: 15 * 60 },
                long: { $gt: 15 * 60 },
            };
            if (filters.duration) {
                const durationKey = filters.duration;
                if (durationRanges[durationKey]) {
                    query.duration = durationRanges[durationKey];
                }
            }
            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) {
                    query.createdAt.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.createdAt.$lte = new Date(filters.endDate);
                }
            }
            let sort = filters.sort || "-createdAt";
            if (filters.sort === "trending") {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                query.createdAt = { $gte: sevenDaysAgo };
                sort = "-viewCount -listenCount -readCount";
            }
            const page = parseInt(filters.page) || 1;
            const limit = parseInt(filters.limit) || 10;
            const skip = (page - 1) * limit;
            const mediaList = yield media_model_1.Media.find(query)
                .select("title description contentType category thumbnailUrl uploadedBy createdAt viewCount likeCount shareCount duration topics")
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate("uploadedBy", "firstName lastName avatar")
                .lean();
            const total = yield media_model_1.Media.countDocuments(query);
            return {
                media: mediaList,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            };
        });
    }
    getAllContentForAllTab() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Aggregate media with author information and engagement metrics
                const mediaList = yield media_model_1.Media.aggregate([
                    {
                        $lookup: {
                            from: "users",
                            localField: "uploadedBy",
                            foreignField: "_id",
                            as: "author",
                        },
                    },
                    {
                        $unwind: "$author",
                    },
                    {
                        $lookup: {
                            from: "mediauseractions",
                            localField: "_id",
                            foreignField: "media",
                            as: "userActions",
                        },
                    },
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
                            // Calculate engagement metrics
                            totalLikes: {
                                $size: {
                                    $filter: {
                                        input: "$userActions",
                                        as: "action",
                                        cond: { $eq: ["$$action.actionType", "like"] },
                                    },
                                },
                            },
                            totalShares: {
                                $size: {
                                    $filter: {
                                        input: "$userActions",
                                        as: "action",
                                        cond: { $eq: ["$$action.actionType", "share"] },
                                    },
                                },
                            },
                            totalViews: {
                                $size: {
                                    $filter: {
                                        input: "$interactions",
                                        as: "interaction",
                                        cond: { $eq: ["$$interaction.interactionType", "view"] },
                                    },
                                },
                            },
                            // Author information
                            authorInfo: {
                                _id: "$author._id",
                                firstName: "$author.firstName",
                                lastName: "$author.lastName",
                                fullName: {
                                    $concat: [
                                        { $ifNull: ["$author.firstName", ""] },
                                        " ",
                                        { $ifNull: ["$author.lastName", ""] },
                                    ],
                                },
                                avatar: "$author.avatar",
                                section: "$author.section",
                            },
                            // Format creation date
                            formattedCreatedAt: {
                                $dateToString: {
                                    format: "%Y-%m-%dT%H:%M:%S.%LZ",
                                    date: "$createdAt",
                                },
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            description: 1,
                            contentType: 1,
                            category: 1,
                            fileUrl: 1,
                            thumbnailUrl: 1,
                            topics: 1,
                            duration: 1,
                            authorInfo: 1,
                            totalLikes: 1,
                            totalShares: 1,
                            totalViews: 1,
                            likeCount: 1,
                            shareCount: 1,
                            viewCount: 1,
                            commentCount: 1,
                            createdAt: 1,
                            formattedCreatedAt: 1,
                            updatedAt: 1,
                            // Ensure thumbnail is always included
                            thumbnail: "$thumbnailUrl",
                        },
                    },
                    {
                        $sort: { createdAt: -1 },
                    },
                ]);
                return {
                    media: mediaList,
                    total: mediaList.length,
                };
            }
            catch (error) {
                console.error("Error fetching all content:", error);
                throw new Error("Failed to retrieve all content");
            }
        });
    }
    /**
     * Build a reusable aggregation pipeline that mirrors getAllContentForAllTab's projection
     */
    buildAggregationPipeline(matchStage, options) {
        const pipeline = [];
        if (matchStage && Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }
        pipeline.push({
            $lookup: {
                from: "users",
                localField: "uploadedBy",
                foreignField: "_id",
                as: "author",
            },
        }, { $unwind: "$author" }, {
            $lookup: {
                from: "mediauseractions",
                localField: "_id",
                foreignField: "media",
                as: "userActions",
            },
        }, {
            $lookup: {
                from: "mediainteractions",
                localField: "_id",
                foreignField: "media",
                as: "interactions",
            },
        }, {
            $addFields: {
                totalLikes: {
                    $size: {
                        $filter: {
                            input: "$userActions",
                            as: "action",
                            cond: { $eq: ["$$action.actionType", "like"] },
                        },
                    },
                },
                totalShares: {
                    $size: {
                        $filter: {
                            input: "$userActions",
                            as: "action",
                            cond: { $eq: ["$$action.actionType", "share"] },
                        },
                    },
                },
                totalViews: {
                    $size: {
                        $filter: {
                            input: "$interactions",
                            as: "interaction",
                            cond: { $eq: ["$$interaction.interactionType", "view"] },
                        },
                    },
                },
                authorInfo: {
                    _id: "$author._id",
                    firstName: "$author.firstName",
                    lastName: "$author.lastName",
                    fullName: {
                        $concat: [
                            { $ifNull: ["$author.firstName", ""] },
                            " ",
                            { $ifNull: ["$author.lastName", ""] },
                        ],
                    },
                    avatar: "$author.avatar",
                    section: "$author.section",
                },
                formattedCreatedAt: {
                    $dateToString: {
                        format: "%Y-%m-%dT%H:%M:%S.%LZ",
                        date: "$createdAt",
                    },
                },
                thumbnail: "$thumbnailUrl",
            },
        }, {
            $project: {
                _id: 1,
                title: 1,
                description: 1,
                contentType: 1,
                category: 1,
                fileUrl: 1,
                thumbnailUrl: 1,
                topics: 1,
                duration: 1,
                authorInfo: 1,
                totalLikes: 1,
                totalShares: 1,
                totalViews: 1,
                likeCount: 1,
                shareCount: 1,
                viewCount: 1,
                commentCount: 1,
                createdAt: 1,
                formattedCreatedAt: 1,
                updatedAt: 1,
                thumbnail: 1,
            },
        });
        if (options === null || options === void 0 ? void 0 : options.sort) {
            pipeline.push({ $sort: options.sort });
        }
        if ((options === null || options === void 0 ? void 0 : options.sampleSize) && options.sampleSize > 0) {
            pipeline.push({ $sample: { size: options.sampleSize } });
        }
        if ((options === null || options === void 0 ? void 0 : options.limit) && options.limit > 0) {
            pipeline.push({ $limit: options.limit });
        }
        return pipeline;
    }
    /**
     * Generate dynamic recommendations to accompany the all-content feed.
     * Includes seeded default content, personalized picks, trending, and random explores.
     * Enhanced with collaborative filtering, topic embeddings, and A/B testing.
     */
    getRecommendationsForAllContent(userId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const limitPerSection = (options === null || options === void 0 ? void 0 : options.limitPerSection) || 12;
            // Track media already seen by the user to de-duplicate recommendations
            const seenMediaIds = new Set();
            let lastViewedMedia = null;
            let userProfile = null;
            if (userId && mongoose_1.Types.ObjectId.isValid(userId)) {
                try {
                    // Build comprehensive user profile with all signals
                    userProfile =
                        yield recommendationEngine_service_1.recommendationEngineService.buildUserProfile(userId);
                    // Get recently viewed for "because you watched" section
                    const viewed = (yield userViewedMedia_model_1.UserViewedMedia.findOne({
                        user: new mongoose_1.Types.ObjectId(userId),
                    })
                        .populate({
                        path: "viewedMedia.media",
                        select: "title topics category contentType uploadedBy createdAt thumbnailUrl fileUrl",
                        populate: {
                            path: "uploadedBy",
                            select: "firstName lastName avatar",
                        },
                    })
                        .lean());
                    const viewedList = (viewed === null || viewed === void 0 ? void 0 : viewed.viewedMedia) || [];
                    if (viewedList.length > 0) {
                        lastViewedMedia = ((_a = viewedList[viewedList.length - 1]) === null || _a === void 0 ? void 0 : _a.media) || null;
                    }
                    // Add all user's media to seen set
                    [
                        ...userProfile.viewedMedia,
                        ...userProfile.favoriteMedia,
                        ...userProfile.sharedMedia,
                        ...userProfile.bookmarkedMedia,
                    ].forEach(m => seenMediaIds.add(m.mediaId));
                }
                catch (err) {
                    console.error("Personalization bootstrap failed:", err);
                }
            }
            // Helper to exclude seen ids
            const excludeSeen = (match = {}) => {
                if (seenMediaIds.size > 0) {
                    return Object.assign(Object.assign({}, match), { _id: {
                            $nin: Array.from(seenMediaIds).map(id => new mongoose_1.Types.ObjectId(id)),
                        } });
                }
                return match;
            };
            // Get A/B test variant for section ordering
            const abTestVariant = userId
                ? recommendationEngine_service_1.recommendationEngineService.generateABTestVariant(userId)
                : "control";
            const sectionOrdering = recommendationEngine_service_1.recommendationEngineService.getSectionOrdering(userId);
            const sections = [];
            // 1) Editorial picks (ensure seeded default content shows)
            try {
                const editorial = yield media_model_1.Media.aggregate(this.buildAggregationPipeline(excludeSeen({ isDefaultContent: true }), {
                    sampleSize: limitPerSection,
                }));
                if (editorial.length > 0) {
                    editorial.forEach((m) => seenMediaIds.add(String(m._id)));
                    sections.push({
                        key: "editorial",
                        title: "Jevah Picks",
                        media: editorial,
                        metadata: { abTestVariant },
                    });
                }
            }
            catch (_b) { }
            // 2) Enhanced personalized For You with collaborative filtering
            try {
                let match = {};
                if (userProfile) {
                    const topTopics = Object.keys(userProfile.topTopics).slice(0, 10);
                    const topCategories = Object.keys(userProfile.topCategories).slice(0, 5);
                    const topTypes = Object.keys(userProfile.topContentTypes).slice(0, 3);
                    const orClauses = [];
                    if (topTopics.length > 0)
                        orClauses.push({ topics: { $in: topTopics } });
                    if (topCategories.length > 0)
                        orClauses.push({ category: { $in: topCategories } });
                    if (topTypes.length > 0)
                        orClauses.push({ contentType: { $in: topTypes } });
                    if (orClauses.length > 0)
                        match = { $or: orClauses };
                }
                const personalized = yield media_model_1.Media.aggregate(this.buildAggregationPipeline(excludeSeen(match), {
                    sampleSize: limitPerSection,
                }));
                if (personalized.length > 0) {
                    // Enhance with collaborative filtering scores
                    const enhancedPersonalized = yield Promise.all(personalized.map((media) => __awaiter(this, void 0, void 0, function* () {
                        const collaborativeSignals = yield recommendationEngine_service_1.recommendationEngineService.getCollaborativeSignals(media._id, userId);
                        const qualityScore = recommendationEngine_service_1.recommendationEngineService.calculateContentQualityScore(media);
                        const collaborativeScore = collaborativeSignals.length > 0
                            ? collaborativeSignals[0].predictedScore
                            : 0;
                        return Object.assign(Object.assign({}, media), { _collaborativeScore: collaborativeScore, _qualityScore: qualityScore });
                    })));
                    // Sort by combined score
                    enhancedPersonalized.sort((a, b) => b._collaborativeScore +
                        b._qualityScore -
                        (a._collaborativeScore + a._qualityScore));
                    enhancedPersonalized.forEach((m) => seenMediaIds.add(String(m._id)));
                    sections.push({
                        key: "for_you",
                        title: "For You",
                        media: enhancedPersonalized,
                        reason: "Based on your activity and similar users",
                        metadata: {
                            abTestVariant,
                            qualityScore: enhancedPersonalized.reduce((sum, m) => sum + m._qualityScore, 0) / enhancedPersonalized.length,
                            collaborativeScore: enhancedPersonalized.reduce((sum, m) => sum + m._collaborativeScore, 0) / enhancedPersonalized.length,
                        },
                    });
                }
            }
            catch (_c) { }
            // 3) Because you watched/listened/read (similar to last item with topic embeddings)
            try {
                if (lastViewedMedia && lastViewedMedia._id) {
                    const lv = lastViewedMedia;
                    const similarMatch = {
                        _id: { $ne: new mongoose_1.Types.ObjectId(String(lv._id)) },
                    };
                    const or = [];
                    if (Array.isArray(lv.topics) && lv.topics.length > 0) {
                        or.push({ topics: { $in: lv.topics } });
                    }
                    if (lv.category) {
                        or.push({ category: lv.category });
                    }
                    if (lv.contentType) {
                        or.push({ contentType: lv.contentType });
                    }
                    if (or.length > 0)
                        similarMatch.$or = or;
                    const similar = yield media_model_1.Media.aggregate(this.buildAggregationPipeline(excludeSeen(similarMatch), {
                        sampleSize: limitPerSection,
                    }));
                    if (similar.length > 0) {
                        // Enhance with topic similarity scoring
                        const enhancedSimilar = similar.map((media) => {
                            const topicSimilarity = userProfile
                                ? recommendationEngine_service_1.recommendationEngineService["calculateTopicSimilarity"](lv.topics || [], media.topics || [])
                                : 0;
                            return Object.assign(Object.assign({}, media), { _topicSimilarity: topicSimilarity });
                        });
                        enhancedSimilar.sort((a, b) => b._topicSimilarity - a._topicSimilarity);
                        enhancedSimilar.forEach((m) => seenMediaIds.add(String(m._id)));
                        sections.push({
                            key: "because_you_watched",
                            title: "Because you watched",
                            media: enhancedSimilar,
                            metadata: { abTestVariant },
                        });
                    }
                }
            }
            catch (_d) { }
            // 4) Trending now (recent window)
            try {
                const trending = yield enhancedMedia_service_1.default.getTrendingMedia(undefined, limitPerSection, 14);
                if (Array.isArray(trending) && trending.length > 0) {
                    const trendingProjected = yield media_model_1.Media.aggregate(this.buildAggregationPipeline(excludeSeen({
                        _id: {
                            $in: trending.map((t) => new mongoose_1.Types.ObjectId(String(t._id))),
                        },
                    }), { limit: limitPerSection }));
                    if (trendingProjected.length > 0) {
                        trendingProjected.forEach((m) => seenMediaIds.add(String(m._id)));
                        sections.push({
                            key: "trending",
                            title: "Trending",
                            media: trendingProjected,
                            metadata: { abTestVariant },
                        });
                    }
                }
            }
            catch (_e) { }
            // 5) Quick picks (random explore with light filtering by mood/type when provided)
            try {
                const mood = ((options === null || options === void 0 ? void 0 : options.mood) || "").toLowerCase();
                const moodFilters = {};
                if (["worship", "praise", "inspiration"].includes(mood)) {
                    moodFilters.category = mood;
                }
                const quickPicks = yield media_model_1.Media.aggregate(this.buildAggregationPipeline(excludeSeen(moodFilters), {
                    sampleSize: limitPerSection,
                }));
                if (quickPicks.length > 0) {
                    quickPicks.forEach((m) => seenMediaIds.add(String(m._id)));
                    sections.push({
                        key: "quick_picks",
                        title: "Explore",
                        media: quickPicks,
                        metadata: { abTestVariant },
                    });
                }
            }
            catch (_f) { }
            // Reorder sections based on A/B test variant
            const orderedSections = sectionOrdering
                .map(key => sections.find(s => s.key === key))
                .filter(Boolean);
            return { sections: orderedSections };
        });
    }
    getMediaByIdentifier(mediaIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(mediaIdentifier)) {
                throw new Error("Invalid media identifier");
            }
            const media = yield media_model_1.Media.findById(mediaIdentifier)
                .select("title contentType category fileUrl thumbnailUrl topics uploadedBy duration createdAt updatedAt isDownloadable downloadUrl shareUrl viewThreshold")
                .populate("uploadedBy", "firstName lastName avatar");
            if (!media) {
                throw new Error("Media not found");
            }
            return media;
        });
    }
    deleteMedia(mediaIdentifier, userIdentifier, userRole) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(mediaIdentifier)) {
                throw new Error("Invalid media identifier");
            }
            const media = yield media_model_1.Media.findById(mediaIdentifier);
            if (!media) {
                throw new Error("Media not found");
            }
            if (media.uploadedBy.toString() !== userIdentifier &&
                userRole !== "admin") {
                throw new Error("Unauthorized to delete this media");
            }
            if (media.fileObjectKey) {
                try {
                    yield fileUpload_service_1.default.deleteMedia(media.fileObjectKey);
                }
                catch (error) {
                    console.error("Error deleting media file from R2:", error);
                }
            }
            if (media.thumbnailObjectKey) {
                try {
                    yield fileUpload_service_1.default.deleteMedia(media.thumbnailObjectKey);
                }
                catch (error) {
                    console.error("Error deleting thumbnail file from R2:", error);
                }
            }
            yield media_model_1.Media.findByIdAndDelete(mediaIdentifier);
            return true;
        });
    }
    recordInteraction(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(data.userIdentifier) ||
                !mongoose_1.Types.ObjectId.isValid(data.mediaIdentifier)) {
                throw new Error("Invalid user or media identifier");
            }
            const media = yield media_model_1.Media.findById(data.mediaIdentifier);
            if (!media) {
                throw new Error("Media not found");
            }
            if ((media.contentType === "videos" && data.interactionType !== "view") ||
                (media.contentType === "music" && data.interactionType !== "listen") ||
                (media.contentType === "books" &&
                    !["read", "download"].includes(data.interactionType))) {
                throw new Error(`Invalid interaction type ${data.interactionType} for ${media.contentType} media`);
            }
            const session = yield media_model_1.Media.startSession();
            try {
                const interaction = yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    const existingInteraction = yield mediaInteraction_model_1.MediaInteraction.findOne({
                        user: new mongoose_1.Types.ObjectId(data.userIdentifier),
                        media: new mongoose_1.Types.ObjectId(data.mediaIdentifier),
                        interactionType: data.interactionType,
                    }).session(session);
                    if (existingInteraction) {
                        throw new Error(`User has already ${data.interactionType} this media`);
                    }
                    const interaction = yield mediaInteraction_model_1.MediaInteraction.create([
                        {
                            user: new mongoose_1.Types.ObjectId(data.userIdentifier),
                            media: new mongoose_1.Types.ObjectId(data.mediaIdentifier),
                            interactionType: data.interactionType,
                            lastInteraction: new Date(),
                            count: 1,
                            interactions: data.duration
                                ? [
                                    {
                                        timestamp: new Date(),
                                        duration: data.duration,
                                        isComplete: false,
                                    },
                                ]
                                : [],
                        },
                    ], { session });
                    const updateField = {};
                    if (data.interactionType === "view")
                        updateField.viewCount = 1;
                    if (data.interactionType === "listen")
                        updateField.listenCount = 1;
                    if (data.interactionType === "read")
                        updateField.readCount = 1;
                    if (data.interactionType === "download")
                        updateField.downloadCount = 1;
                    yield media_model_1.Media.findByIdAndUpdate(data.mediaIdentifier, { $inc: updateField }, { session });
                    return interaction[0];
                }));
                return interaction;
            }
            finally {
                session.endSession();
            }
        });
    }
    getInteractionCounts(mediaIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(mediaIdentifier)) {
                throw new Error("Invalid media identifier");
            }
            const media = yield media_model_1.Media.findById(mediaIdentifier).select("contentType viewCount listenCount readCount downloadCount favoriteCount shareCount");
            if (!media) {
                throw new Error("Media not found");
            }
            const result = {};
            if (media.contentType === "videos")
                result.viewCount = media.viewCount;
            if (media.contentType === "music")
                result.listenCount = media.listenCount;
            if (media.contentType === "books") {
                result.readCount = media.readCount;
                result.downloadCount = media.downloadCount;
            }
            result.favoriteCount = media.favoriteCount;
            result.shareCount = media.shareCount;
            return result;
        });
    }
    recordUserAction(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.userIdentifier || !data.mediaIdentifier || !data.actionType) {
                throw new Error("User identifier, media identifier, and action type are required");
            }
            if (!["favorite", "share"].includes(data.actionType)) {
                throw new Error("Invalid action type. Must be 'favorite' or 'share'");
            }
            const media = yield media_model_1.Media.findById(data.mediaIdentifier);
            if (!media) {
                throw new Error("Media not found");
            }
            const user = yield user_model_1.User.findById(data.userIdentifier);
            if (!user) {
                throw new Error("User not found");
            }
            if (media.uploadedBy.toString() === data.userIdentifier) {
                throw new Error("You cannot favorite or share your own content");
            }
            const session = yield media_model_1.Media.startSession();
            try {
                const action = yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    const existingAction = yield mediaUserAction_model_1.MediaUserAction.findOne({
                        user: new mongoose_1.Types.ObjectId(data.userIdentifier),
                        media: new mongoose_1.Types.ObjectId(data.mediaIdentifier),
                        actionType: data.actionType,
                    }).session(session);
                    let resultAction;
                    const updateField = {};
                    if (existingAction) {
                        yield mediaUserAction_model_1.MediaUserAction.findByIdAndDelete(existingAction._id).session(session);
                        if (data.actionType === "favorite")
                            updateField.favoriteCount = -1;
                        if (data.actionType === "share")
                            updateField.shareCount = -1;
                        resultAction = Object.assign(Object.assign({}, existingAction.toObject()), { _id: existingAction._id, removed: true });
                    }
                    else {
                        const newAction = yield mediaUserAction_model_1.MediaUserAction.create([
                            {
                                user: new mongoose_1.Types.ObjectId(data.userIdentifier),
                                media: new mongoose_1.Types.ObjectId(data.mediaIdentifier),
                                actionType: data.actionType,
                                createdAt: new Date(),
                            },
                        ], { session });
                        if (data.actionType === "favorite")
                            updateField.favoriteCount = 1;
                        if (data.actionType === "share")
                            updateField.shareCount = 1;
                        resultAction = newAction[0];
                    }
                    yield media_model_1.Media.findByIdAndUpdate(data.mediaIdentifier, { $inc: updateField }, { session });
                    if (data.actionType === "favorite" && !resultAction.removed) {
                        try {
                            const artist = yield user_model_1.User.findById(media.uploadedBy);
                            if (artist &&
                                artist.email &&
                                ((_a = artist.emailNotifications) === null || _a === void 0 ? void 0 : _a.mediaLikes)) {
                                yield email_config_1.EmailService.sendMediaLikedEmail(artist.email, media.title, artist.firstName || ((_b = artist.artistProfile) === null || _b === void 0 ? void 0 : _b.artistName) || "Artist");
                            }
                        }
                        catch (emailError) {
                            console.error("Failed to send like notification email:", emailError);
                        }
                    }
                    return resultAction;
                }));
                return action;
            }
            finally {
                session.endSession();
            }
        });
    }
    getUserActionStatus(userIdentifier, mediaIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier) ||
                !mongoose_1.Types.ObjectId.isValid(mediaIdentifier)) {
                throw new Error("Invalid user or media identifier");
            }
            const actions = yield mediaUserAction_model_1.MediaUserAction.find({
                user: new mongoose_1.Types.ObjectId(userIdentifier),
                media: new mongoose_1.Types.ObjectId(mediaIdentifier),
            }).select("actionType");
            const status = { isFavorited: false, isShared: false };
            actions.forEach(action => {
                if (action.actionType === "favorite")
                    status.isFavorited = true;
                if (action.actionType === "share")
                    status.isShared = true;
            });
            return status;
        });
    }
    addToViewedMedia(userIdentifier, mediaIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier) ||
                !mongoose_1.Types.ObjectId.isValid(mediaIdentifier)) {
                throw new Error("Invalid user or media identifier");
            }
            const media = yield media_model_1.Media.findById(mediaIdentifier);
            if (!media) {
                throw new Error("Media not found");
            }
            const session = yield userViewedMedia_model_1.UserViewedMedia.startSession();
            try {
                const result = yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    const update = yield userViewedMedia_model_1.UserViewedMedia.findOneAndUpdate({ user: new mongoose_1.Types.ObjectId(userIdentifier) }, {
                        $push: {
                            viewedMedia: {
                                $each: [
                                    {
                                        media: new mongoose_1.Types.ObjectId(mediaIdentifier),
                                        viewedAt: new Date(),
                                    },
                                ],
                                $slice: -50,
                            },
                        },
                    }, { upsert: true, new: true, session });
                    return update;
                }));
                return result;
            }
            finally {
                session.endSession();
            }
        });
    }
    getViewedMedia(userIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier)) {
                throw new Error("Invalid user identifier");
            }
            const viewedMedia = yield userViewedMedia_model_1.UserViewedMedia.findOne({
                user: new mongoose_1.Types.ObjectId(userIdentifier),
            })
                .populate({
                path: "viewedMedia.media",
                select: "title contentType category createdAt thumbnailUrl fileUrl topics duration uploadedBy",
                populate: { path: "uploadedBy", select: "firstName lastName avatar" },
            })
                .lean();
            return viewedMedia ? viewedMedia.viewedMedia : [];
        });
    }
    getMediaCountByContentType() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield media_model_1.Media.aggregate([
                { $group: { _id: "$contentType", count: { $sum: 1 } } },
                { $project: { contentType: "$_id", count: 1, _id: 0 } },
            ]);
            const counts = {
                music: 0,
                videos: 0,
                books: 0,
                live: 0,
            };
            result.forEach(item => {
                counts[item.contentType] = item.count;
            });
            return counts;
        });
    }
    getTotalInteractionCounts() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const result = yield media_model_1.Media.aggregate([
                {
                    $group: {
                        _id: null,
                        totalViews: { $sum: "$viewCount" },
                        totalListens: { $sum: "$listenCount" },
                        totalReads: { $sum: "$readCount" },
                        totalDownloads: { $sum: "$downloadCount" },
                        totalFavorites: { $sum: "$favoriteCount" },
                        totalShares: { $sum: "$shareCount" },
                    },
                },
            ]);
            return {
                totalViews: ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.totalViews) || 0,
                totalListens: ((_b = result[0]) === null || _b === void 0 ? void 0 : _b.totalListens) || 0,
                totalReads: ((_c = result[0]) === null || _c === void 0 ? void 0 : _c.totalReads) || 0,
                totalDownloads: ((_d = result[0]) === null || _d === void 0 ? void 0 : _d.totalDownloads) || 0,
                totalFavorites: ((_e = result[0]) === null || _e === void 0 ? void 0 : _e.totalFavorites) || 0,
                totalShares: ((_f = result[0]) === null || _f === void 0 ? void 0 : _f.totalShares) || 0,
            };
        });
    }
    getRecentMedia(limit) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield media_model_1.Media.find()
                .sort({ createdAt: -1 })
                .limit(limit)
                .select("title contentType category createdAt thumbnailUrl fileUrl duration")
                .populate("uploadedBy", "firstName lastName avatar")
                .lean();
        });
    }
    getMediaCountSinceDate(since) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield media_model_1.Media.countDocuments({ createdAt: { $gte: since } });
        });
    }
    getInteractionCountSinceDate(since) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield mediaInteraction_model_1.MediaInteraction.countDocuments({
                createdAt: { $gte: since },
            });
        });
    }
    getUserMediaCountByContentType(userIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier)) {
                throw new Error("Invalid user identifier");
            }
            const result = yield media_model_1.Media.aggregate([
                { $match: { uploadedBy: new mongoose_1.Types.ObjectId(userIdentifier) } },
                { $group: { _id: "$contentType", count: { $sum: 1 } } },
                { $project: { contentType: "$_id", count: 1, _id: 0 } },
            ]);
            const counts = {
                music: 0,
                videos: 0,
                books: 0,
                live: 0,
            };
            result.forEach(item => {
                counts[item.contentType] = item.count;
            });
            return counts;
        });
    }
    getUserInteractionCounts(userIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier)) {
                throw new Error("Invalid user identifier");
            }
            const result = yield mediaInteraction_model_1.MediaInteraction.aggregate([
                { $match: { user: new mongoose_1.Types.ObjectId(userIdentifier) } },
                { $group: { _id: "$interactionType", count: { $sum: "$count" } } },
                { $project: { interactionType: "$_id", count: 1, _id: 0 } },
            ]);
            const counts = {
                totalViews: 0,
                totalListens: 0,
                totalReads: 0,
                totalDownloads: 0,
            };
            result.forEach(item => {
                if (item.interactionType === "view")
                    counts.totalViews = item.count;
                if (item.interactionType === "listen")
                    counts.totalListens = item.count;
                if (item.interactionType === "read")
                    counts.totalReads = item.count;
                if (item.interactionType === "download")
                    counts.totalDownloads = item.count;
            });
            return counts;
        });
    }
    getUserBookmarkCount(userIdentifier) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier)) {
                throw new Error("Invalid user identifier");
            }
            return yield bookmark_model_1.Bookmark.countDocuments({
                user: new mongoose_1.Types.ObjectId(userIdentifier),
            });
        });
    }
    getUserRecentMedia(userIdentifier, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier)) {
                throw new Error("Invalid user identifier");
            }
            return yield media_model_1.Media.find({ uploadedBy: new mongoose_1.Types.ObjectId(userIdentifier) })
                .sort({ createdAt: -1 })
                .limit(limit)
                .select("title contentType category createdAt thumbnailUrl fileUrl duration")
                .populate("uploadedBy", "firstName lastName avatar")
                .lean();
        });
    }
    getUserMediaCountSinceDate(userIdentifier, since) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier)) {
                throw new Error("Invalid user identifier");
            }
            return yield media_model_1.Media.countDocuments({
                uploadedBy: new mongoose_1.Types.ObjectId(userIdentifier),
                createdAt: { $gte: since },
            });
        });
    }
    getUserInteractionCountSinceDate(userIdentifier, since) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!mongoose_1.Types.ObjectId.isValid(userIdentifier)) {
                throw new Error("Invalid user identifier");
            }
            return yield mediaInteraction_model_1.MediaInteraction.countDocuments({
                user: new mongoose_1.Types.ObjectId(userIdentifier),
                createdAt: { $gte: since },
            });
        });
    }
    trackViewWithDuration(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userIdentifier, mediaIdentifier, duration, isComplete = false, } = data;
            if (!userIdentifier || !mediaIdentifier) {
                throw new Error("User identifier and media identifier are required");
            }
            if (duration < 0) {
                throw new Error("Duration must be a positive number");
            }
            const media = yield media_model_1.Media.findById(mediaIdentifier);
            if (!media) {
                throw new Error("Media not found");
            }
            const user = yield user_model_1.User.findById(userIdentifier);
            if (!user) {
                throw new Error("User not found");
            }
            let shouldCountAsView = false;
            const session = yield media_model_1.Media.startSession();
            try {
                const result = yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    const viewThreshold = media.viewThreshold || 30;
                    shouldCountAsView = duration >= viewThreshold;
                    if (shouldCountAsView) {
                        yield media_model_1.Media.findByIdAndUpdate(mediaIdentifier, { $inc: { viewCount: 1 } }, { session });
                        yield mediaInteraction_model_1.MediaInteraction.findOneAndUpdate({
                            user: new mongoose_1.Types.ObjectId(userIdentifier),
                            media: new mongoose_1.Types.ObjectId(mediaIdentifier),
                            interactionType: "view",
                        }, {
                            $inc: { count: 1 },
                            $set: { lastInteraction: new Date() },
                            $push: {
                                interactions: {
                                    timestamp: new Date(),
                                    duration,
                                    isComplete,
                                },
                            },
                        }, { upsert: true, session });
                        yield this.addToViewedMedia(userIdentifier, mediaIdentifier);
                        if (media.uploadedBy.toString() !== userIdentifier) {
                            try {
                                const artist = yield user_model_1.User.findById(media.uploadedBy);
                                if (artist &&
                                    artist.email &&
                                    ((_a = artist.emailNotifications) === null || _a === void 0 ? void 0 : _a.mediaLikes)) {
                                    yield email_config_1.EmailService.sendMediaLikedEmail(artist.email, media.title, artist.firstName ||
                                        ((_b = artist.artistProfile) === null || _b === void 0 ? void 0 : _b.artistName) ||
                                        "Artist");
                                }
                            }
                            catch (emailError) {
                                console.error("Failed to send view notification email:", emailError);
                            }
                        }
                    }
                    return { success: true, countedAsView: shouldCountAsView };
                }));
                return result;
            }
            finally {
                session.endSession();
            }
        });
    }
    getMediaWithEngagement(mediaId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const media = yield media_model_1.Media.findById(mediaId).populate("uploadedBy", "firstName lastName avatar");
                if (!media) {
                    throw new Error("Media not found");
                }
                // Get user's interaction status
                const userAction = yield mediaUserAction_model_1.MediaUserAction.findOne({
                    user: userId,
                    media: mediaId,
                });
                return Object.assign(Object.assign({}, media.toObject()), { userAction: userAction
                        ? {
                            isFavorited: userAction.actionType === "favorite",
                            isShared: userAction.actionType === "share",
                        }
                        : {
                            isFavorited: false,
                            isShared: false,
                        } });
            }
            catch (error) {
                throw error;
            }
        });
    }
    downloadMedia(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { mediaId, userId, fileSize } = data;
                const media = yield media_model_1.Media.findById(mediaId);
                if (!media) {
                    throw new Error("Media not found");
                }
                // Check if media is available for download
                if (!media.fileUrl) {
                    throw new Error("Media file not available for download");
                }
                // Record download interaction
                yield this.recordInteraction({
                    userIdentifier: userId,
                    mediaIdentifier: mediaId,
                    interactionType: "download",
                    duration: 0,
                });
                // Generate signed download URL from Cloudflare R2
                const { default: fileUploadService } = yield Promise.resolve().then(() => __importStar(require("./fileUpload.service")));
                // Extract object key from fileUrl
                const objectKey = this.extractObjectKeyFromUrl(media.fileUrl);
                if (!objectKey) {
                    throw new Error("Invalid media file URL");
                }
                // Use direct public URL instead of signed URL
                const downloadUrl = media.fileUrl;
                // Add to user's offline downloads
                yield this.addToOfflineDownloads(userId, mediaId, {
                    fileName: media.title || "Untitled",
                    fileSize: media.fileSize || fileSize,
                    contentType: media.contentType,
                    downloadUrl,
                });
                return {
                    success: true,
                    downloadUrl,
                    fileName: media.title || "Untitled",
                    fileSize: media.fileSize || fileSize,
                    contentType: media.contentType,
                    message: "Download initiated successfully",
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     * Extract object key from Cloudflare R2 URL
     */
    extractObjectKeyFromUrl(url) {
        try {
            // Handle different URL formats
            if (url.includes("/")) {
                const parts = url.split("/");
                return parts[parts.length - 1];
            }
            return url;
        }
        catch (error) {
            console.error("Error extracting object key from URL:", error);
            return null;
        }
    }
    /**
     * Add media to user's offline downloads
     */
    addToOfflineDownloads(userId, mediaId, downloadInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = yield Promise.resolve().then(() => __importStar(require("../models/user.model")));
                const offlineDownload = {
                    mediaId: new mongoose_1.Types.ObjectId(mediaId),
                    downloadDate: new Date(),
                    fileName: downloadInfo.fileName,
                    fileSize: downloadInfo.fileSize,
                    contentType: downloadInfo.contentType,
                    downloadUrl: downloadInfo.downloadUrl,
                    isDownloaded: false, // Will be updated by frontend
                };
                yield User.findByIdAndUpdate(userId, {
                    $push: { offlineDownloads: offlineDownload },
                    $inc: { totalDownloads: 1 },
                }, { upsert: true });
                console.log("Added to offline downloads:", {
                    userId,
                    mediaId,
                    fileName: downloadInfo.fileName,
                });
            }
            catch (error) {
                console.error("Error adding to offline downloads:", error);
                // Don't throw error as this is not critical
            }
        });
    }
    /**
     * Get user's offline downloads
     */
    getUserOfflineDownloads(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 20) {
            try {
                const { User } = yield Promise.resolve().then(() => __importStar(require("../models/user.model")));
                const user = yield User.findById(userId)
                    .populate("offlineDownloads.mediaId", "title description thumbnailUrl contentType duration")
                    .lean();
                if (!user) {
                    throw new Error("User not found");
                }
                const downloads = user.offlineDownloads || [];
                const skip = (page - 1) * limit;
                const paginatedDownloads = downloads
                    .sort((a, b) => new Date(b.downloadDate).getTime() -
                    new Date(a.downloadDate).getTime())
                    .slice(skip, skip + limit);
                return {
                    downloads: paginatedDownloads,
                    pagination: {
                        page,
                        limit,
                        total: downloads.length,
                        pages: Math.ceil(downloads.length / limit),
                    },
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     * Remove media from user's offline downloads
     */
    removeFromOfflineDownloads(userId, mediaId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { User } = yield Promise.resolve().then(() => __importStar(require("../models/user.model")));
                yield User.findByIdAndUpdate(userId, {
                    $pull: { offlineDownloads: { mediaId: new mongoose_1.Types.ObjectId(mediaId) } },
                    $inc: { totalDownloads: -1 },
                });
                console.log("Removed from offline downloads:", { userId, mediaId });
            }
            catch (error) {
                console.error("Error removing from offline downloads:", error);
                throw error;
            }
        });
    }
    /**
     * Download media file directly (for UI components)
     */
    downloadMediaFile(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { mediaId, userId } = data;
                const media = yield media_model_1.Media.findById(mediaId);
                if (!media) {
                    throw new Error("Media not found");
                }
                // Check if media is available for download
                if (!media.fileUrl) {
                    throw new Error("Media file not available for download");
                }
                // Record download interaction
                yield this.recordInteraction({
                    userIdentifier: userId,
                    mediaIdentifier: mediaId,
                    interactionType: "download",
                    duration: 0,
                });
                // Fetch the file from the URL
                const fileResponse = yield fetch(media.fileUrl);
                if (!fileResponse.ok) {
                    throw new Error("Failed to fetch media file");
                }
                const fileBuffer = yield fileResponse.arrayBuffer();
                const buffer = Buffer.from(fileBuffer);
                // Add to user's offline downloads
                yield this.addToOfflineDownloads(userId, mediaId, {
                    fileName: media.title || "Untitled",
                    fileSize: media.fileSize || buffer.length,
                    contentType: media.contentType,
                    downloadUrl: media.fileUrl,
                });
                return {
                    success: true,
                    fileBuffer: buffer,
                    fileName: media.title || "Untitled",
                    fileSize: media.fileSize || buffer.length,
                    contentType: media.contentType,
                    message: "File downloaded successfully",
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    shareMedia(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { mediaId, userId, platform } = data;
                const media = yield media_model_1.Media.findById(mediaId);
                if (!media) {
                    throw new Error("Media not found");
                }
                // Record share interaction
                yield this.recordUserAction({
                    userIdentifier: userId,
                    mediaIdentifier: mediaId,
                    actionType: "share",
                    metadata: { platform },
                });
                // Generate share URL
                const shareUrl = `${process.env.FRONTEND_URL}/media/${mediaId}`;
                return {
                    success: true,
                    shareUrl,
                    message: "Media shared successfully",
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.MediaService = MediaService;
exports.mediaService = new MediaService();
