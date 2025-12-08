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
exports.UnifiedSearchService = void 0;
const mongoose_1 = require("mongoose");
const media_model_1 = require("../models/media.model");
const copyrightFreeSong_model_1 = require("../models/copyrightFreeSong.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const copyrightFreeSongInteraction_service_1 = require("./copyrightFreeSongInteraction.service");
const unifiedBookmark_service_1 = require("./unifiedBookmark.service");
const logger_1 = __importDefault(require("../utils/logger"));
class UnifiedSearchService {
    constructor() {
        this.interactionService = new copyrightFreeSongInteraction_service_1.CopyrightFreeSongInteractionService();
    }
    /**
     * Unified search across all content types
     */
    search(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, options = {}) {
            const startTime = Date.now();
            const { page = 1, limit = 20, contentType = "all", mediaType, category, sort = "relevance", userId, } = options;
            const searchTerm = query.trim().toLowerCase();
            if (!searchTerm) {
                throw new Error("Search query is required");
            }
            const skip = (page - 1) * limit;
            const searchRegex = new RegExp(searchTerm, "i");
            // Build search queries for each content type
            const mediaQuery = {
                $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { speaker: searchRegex },
                ],
                isHidden: { $ne: true }, // Exclude hidden content
            };
            // Filter by media contentType if specified
            if (mediaType) {
                mediaQuery.contentType = mediaType;
            }
            // Filter by category if specified
            if (category) {
                mediaQuery.category = { $regex: category, $options: "i" };
            }
            const copyrightFreeQuery = {
                $or: [
                    { title: searchRegex },
                    { singer: searchRegex },
                ],
            };
            // Determine which content types to search
            const searchMedia = contentType === "all" || contentType === "media";
            const searchCopyrightFree = contentType === "all" || contentType === "copyright-free";
            // Build sort objects
            const mediaSort = this.buildSortObject(sort, "media");
            const copyrightFreeSort = this.buildSortObject(sort, "copyright-free");
            // Execute searches in parallel
            const searchPromises = [];
            if (searchMedia) {
                searchPromises.push(Promise.all([
                    media_model_1.Media.find(mediaQuery)
                        .sort(mediaSort)
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    media_model_1.Media.countDocuments(mediaQuery),
                ]));
            }
            else {
                searchPromises.push(Promise.resolve([[], 0]));
            }
            if (searchCopyrightFree) {
                searchPromises.push(Promise.all([
                    copyrightFreeSong_model_1.CopyrightFreeSong.find(copyrightFreeQuery)
                        .populate("uploadedBy", "firstName lastName avatar")
                        .sort(copyrightFreeSort)
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    copyrightFreeSong_model_1.CopyrightFreeSong.countDocuments(copyrightFreeQuery),
                ]));
            }
            else {
                searchPromises.push(Promise.resolve([[], 0]));
            }
            const [[mediaResults, mediaTotal], [copyrightFreeResults, copyrightFreeTotal]] = yield Promise.all(searchPromises);
            // Combine and sort results
            const allResults = this.combineAndSortResults(mediaResults, copyrightFreeResults, searchTerm, sort, limit);
            // Enrich with user-specific data if authenticated
            let enrichedResults = allResults;
            if (userId) {
                enrichedResults = yield this.enrichWithUserData(allResults, userId);
            }
            else {
                // Add default values for non-authenticated users
                enrichedResults = allResults.map((item) => (Object.assign(Object.assign({}, item), { isLiked: false, isInLibrary: false })));
            }
            const total = mediaTotal + copyrightFreeTotal;
            const totalPages = Math.ceil(total / limit);
            const hasMore = skip + enrichedResults.length < total;
            const searchTime = Date.now() - startTime;
            logger_1.default.debug("Unified search completed", {
                query: searchTerm,
                total,
                mediaTotal,
                copyrightFreeTotal,
                resultsCount: enrichedResults.length,
                searchTime,
            });
            return {
                results: enrichedResults.slice(0, limit),
                total,
                page,
                totalPages,
                hasMore,
                breakdown: {
                    media: mediaTotal,
                    copyrightFree: copyrightFreeTotal,
                },
            };
        });
    }
    /**
     * Build sort object based on sort option and content type
     */
    buildSortObject(sort, contentType) {
        switch (sort) {
            case "relevance":
                // For relevance, prioritize by viewCount/listenCount/readCount
                if (contentType === "media") {
                    return { viewCount: -1, listenCount: -1, readCount: -1, likeCount: -1, createdAt: -1 };
                }
                return { viewCount: -1, likeCount: -1, createdAt: -1 };
            case "popular":
                if (contentType === "media") {
                    return { viewCount: -1, listenCount: -1, readCount: -1, likeCount: -1 };
                }
                return { viewCount: -1, likeCount: -1 };
            case "newest":
                return { createdAt: -1 };
            case "oldest":
                return { createdAt: 1 };
            case "title":
                return { title: 1 };
            default:
                return { createdAt: -1 };
        }
    }
    /**
     * Combine results from different sources and sort by relevance
     */
    combineAndSortResults(mediaResults, copyrightFreeResults, searchTerm, sort, limit) {
        const combined = [];
        // Transform media results
        mediaResults.forEach((item) => {
            var _a, _b;
            combined.push({
                id: ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || item.id,
                _id: (_b = item._id) === null || _b === void 0 ? void 0 : _b.toString(),
                type: "media",
                contentType: item.contentType || "media",
                title: item.title,
                description: item.description,
                speaker: item.speaker,
                category: item.category,
                thumbnailUrl: item.thumbnailUrl,
                fileUrl: item.fileUrl,
                audioUrl: item.fileUrl, // For audio/music content
                duration: item.duration,
                viewCount: item.viewCount || 0,
                views: item.viewCount || 0,
                likeCount: item.likeCount || 0,
                likes: item.likeCount || 0,
                listenCount: item.listenCount || 0,
                readCount: item.readCount || 0,
                createdAt: item.createdAt,
                year: item.year,
                isPublicDomain: item.isPublicDomain || false,
                uploadedBy: item.uploadedBy,
            });
        });
        // Transform copyright-free song results
        copyrightFreeResults.forEach((item) => {
            var _a, _b, _c, _d;
            combined.push({
                id: ((_a = item._id) === null || _a === void 0 ? void 0 : _a.toString()) || item.id,
                _id: (_b = item._id) === null || _b === void 0 ? void 0 : _b.toString(),
                type: "copyright-free",
                contentType: "copyright-free-music",
                title: item.title,
                artist: item.singer,
                thumbnailUrl: item.thumbnailUrl,
                audioUrl: item.fileUrl,
                fileUrl: item.fileUrl,
                duration: item.duration,
                viewCount: item.viewCount || 0,
                views: item.viewCount || 0,
                likeCount: item.likeCount || 0,
                likes: item.likeCount || 0,
                createdAt: item.createdAt,
                uploadedBy: ((_d = (_c = item.uploadedBy) === null || _c === void 0 ? void 0 : _c._id) === null || _d === void 0 ? void 0 : _d.toString()) || item.uploadedBy || "system",
                isPublicDomain: true,
            });
        });
        // Sort by relevance if needed
        if (sort === "relevance") {
            combined.sort((a, b) => {
                // Prioritize title matches
                const aTitleMatch = a.title.toLowerCase().includes(searchTerm) ? 1 : 0;
                const bTitleMatch = b.title.toLowerCase().includes(searchTerm) ? 1 : 0;
                if (aTitleMatch !== bTitleMatch) {
                    return bTitleMatch - aTitleMatch;
                }
                // Then by popularity
                const aPopularity = (a.viewCount || 0) + (a.likeCount || 0);
                const bPopularity = (b.viewCount || 0) + (b.likeCount || 0);
                return bPopularity - aPopularity;
            });
        }
        return combined;
    }
    /**
     * Enrich results with user-specific data (isLiked, isInLibrary)
     */
    enrichWithUserData(results, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const enriched = yield Promise.all(results.map((item) => __awaiter(this, void 0, void 0, function* () {
                let isLiked = false;
                let isInLibrary = false;
                try {
                    if (item.type === "copyright-free") {
                        // Check like status for copyright-free songs
                        isLiked = yield this.interactionService.isLiked(userId, item.id);
                    }
                    else {
                        // For media, check if liked using MediaInteraction
                        if (mongoose_1.Types.ObjectId.isValid(item.id) && mongoose_1.Types.ObjectId.isValid(userId)) {
                            const mediaLike = yield mediaInteraction_model_1.MediaInteraction.findOne({
                                user: new mongoose_1.Types.ObjectId(userId),
                                media: new mongoose_1.Types.ObjectId(item.id),
                                interactionType: "like",
                                isRemoved: { $ne: true },
                            });
                            isLiked = !!mediaLike;
                        }
                    }
                    // Check bookmark status for all content types
                    isInLibrary = yield unifiedBookmark_service_1.UnifiedBookmarkService.isBookmarked(userId, item.id);
                }
                catch (error) {
                    logger_1.default.warn("Error enriching user data", {
                        error: error === null || error === void 0 ? void 0 : error.message,
                        userId,
                        itemId: item.id,
                    });
                }
                return Object.assign(Object.assign({}, item), { isLiked,
                    isInLibrary });
            })));
            return enriched;
        });
    }
    /**
     * Get search suggestions across all content types
     */
    getSuggestions(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, limit = 10) {
            const searchTerm = query.trim().toLowerCase();
            if (!searchTerm) {
                return [];
            }
            const searchRegex = new RegExp(`^${searchTerm}`, "i");
            const suggestions = new Set();
            try {
                // Get suggestions from media titles and speakers
                const mediaResults = yield media_model_1.Media.find({
                    $or: [
                        { title: searchRegex },
                        { speaker: searchRegex },
                    ],
                    isHidden: { $ne: true },
                })
                    .select("title speaker")
                    .limit(limit * 2)
                    .lean();
                mediaResults.forEach((item) => {
                    if (item.title && item.title.toLowerCase().includes(searchTerm)) {
                        suggestions.add(item.title.toLowerCase());
                    }
                    if (item.speaker && item.speaker.toLowerCase().includes(searchTerm)) {
                        suggestions.add(item.speaker.toLowerCase());
                    }
                });
                // Get suggestions from copyright-free songs
                const songResults = yield copyrightFreeSong_model_1.CopyrightFreeSong.find({
                    $or: [
                        { title: searchRegex },
                        { singer: searchRegex },
                    ],
                })
                    .select("title singer")
                    .limit(limit * 2)
                    .lean();
                songResults.forEach((item) => {
                    if (item.title && item.title.toLowerCase().includes(searchTerm)) {
                        suggestions.add(item.title.toLowerCase());
                    }
                    if (item.singer && item.singer.toLowerCase().includes(searchTerm)) {
                        suggestions.add(item.singer.toLowerCase());
                    }
                });
            }
            catch (error) {
                logger_1.default.error("Error getting search suggestions:", error);
            }
            return Array.from(suggestions).slice(0, limit);
        });
    }
    /**
     * Get trending searches across all content types
     */
    getTrending() {
        return __awaiter(this, arguments, void 0, function* (limit = 10, period = "week") {
            try {
                // Get most viewed media and songs as trending
                const [trendingMedia, trendingSongs] = yield Promise.all([
                    media_model_1.Media.find({ isHidden: { $ne: true } })
                        .sort({ viewCount: -1, listenCount: -1, readCount: -1 })
                        .limit(limit)
                        .select("title viewCount category")
                        .lean(),
                    copyrightFreeSong_model_1.CopyrightFreeSong.find()
                        .sort({ viewCount: -1 })
                        .limit(limit)
                        .select("title viewCount")
                        .lean(),
                ]);
                const trending = [
                    ...trendingMedia.map((item) => ({
                        query: item.title,
                        count: (item.viewCount || 0) + (item.listenCount || 0) + (item.readCount || 0),
                        category: item.category || "Media",
                    })),
                    ...trendingSongs.map((item) => ({
                        query: item.title,
                        count: item.viewCount || 0,
                        category: "Gospel Music",
                    })),
                ]
                    .sort((a, b) => b.count - a.count)
                    .slice(0, limit);
                return trending;
            }
            catch (error) {
                logger_1.default.error("Error getting trending searches:", error);
                return [];
            }
        });
    }
}
exports.UnifiedSearchService = UnifiedSearchService;
exports.default = new UnifiedSearchService();
