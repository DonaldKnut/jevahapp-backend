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
exports.AudioService = void 0;
const mongoose_1 = require("mongoose");
const media_model_1 = require("../models/media.model");
const media_service_1 = require("./media.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Service for managing copyright-free audio library (YouTube Audio Library style)
 * Admin-only uploads, public viewing
 */
class AudioService {
    constructor() {
        this.mediaService = new media_service_1.MediaService();
    }
    /**
     * Get all copyright-free songs with pagination and filters
     */
    getCopyrightFreeSongs() {
        return __awaiter(this, arguments, void 0, function* (filters = {}) {
            try {
                const { search, category, artist, year, minDuration, maxDuration, tags, sortBy = "newest", page = 1, limit = 20, } = filters;
                const query = {
                    isPublicDomain: true,
                    contentType: { $in: ["music", "audio"] },
                    isHidden: { $ne: true },
                    moderationStatus: { $ne: "rejected" },
                };
                // Search filter
                if (search) {
                    query.$or = [
                        { title: { $regex: search, $options: "i" } },
                        { description: { $regex: search, $options: "i" } },
                        { speaker: { $regex: search, $options: "i" } },
                    ];
                }
                // Category filter
                if (category) {
                    query.category = { $regex: category, $options: "i" };
                }
                // Artist/Speaker filter
                if (artist) {
                    query.$or = [
                        { speaker: { $regex: artist, $options: "i" } },
                        { "uploadedBy.firstName": { $regex: artist, $options: "i" } },
                    ];
                }
                // Year filter
                if (year) {
                    query.year = year;
                }
                // Duration filters
                if (minDuration !== undefined || maxDuration !== undefined) {
                    query.duration = {};
                    if (minDuration !== undefined) {
                        query.duration.$gte = minDuration;
                    }
                    if (maxDuration !== undefined) {
                        query.duration.$lte = maxDuration;
                    }
                }
                // Tags filter
                if (tags && tags.length > 0) {
                    query.tags = { $in: tags };
                }
                // Sort options
                let sort = {};
                switch (sortBy) {
                    case "newest":
                        sort = { createdAt: -1 };
                        break;
                    case "oldest":
                        sort = { createdAt: 1 };
                        break;
                    case "popular":
                        sort = { listenCount: -1, viewCount: -1 };
                        break;
                    case "duration":
                        sort = { duration: 1 };
                        break;
                    case "title":
                        sort = { title: 1 };
                        break;
                    default:
                        sort = { createdAt: -1 };
                }
                const skip = (page - 1) * limit;
                const [songs, total] = yield Promise.all([
                    media_model_1.Media.find(query)
                        .select("title description contentType category fileUrl thumbnailUrl topics uploadedBy createdAt updatedAt viewCount listenCount likeCount commentCount shareCount isPublicDomain speaker year duration tags")
                        .populate("uploadedBy", "firstName lastName avatar")
                        .sort(sort)
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    media_model_1.Media.countDocuments(query),
                ]);
                const totalPages = Math.ceil(total / limit);
                return {
                    songs: songs,
                    total,
                    page,
                    totalPages,
                };
            }
            catch (error) {
                logger_1.default.error("Error fetching copyright-free songs:", error);
                throw error;
            }
        });
    }
    /**
     * Get a single copyright-free song by ID
     */
    getCopyrightFreeSongById(songId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(songId)) {
                    throw new Error("Invalid song ID");
                }
                const song = yield media_model_1.Media.findOne({
                    _id: new mongoose_1.Types.ObjectId(songId),
                    isPublicDomain: true,
                    contentType: { $in: ["music", "audio"] },
                    isHidden: { $ne: true },
                })
                    .select("title description contentType category fileUrl thumbnailUrl topics uploadedBy createdAt updatedAt viewCount listenCount likeCount commentCount shareCount isPublicDomain speaker year duration tags")
                    .populate("uploadedBy", "firstName lastName avatar")
                    .lean();
                return song;
            }
            catch (error) {
                logger_1.default.error("Error fetching copyright-free song:", error);
                throw error;
            }
        });
    }
    /**
     * Search copyright-free songs
     */
    searchCopyrightFreeSongs(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, filters = {}) {
            return this.getCopyrightFreeSongs(Object.assign(Object.assign({}, filters), { search: query }));
        });
    }
    /**
     * Get distinct categories from copyright-free songs
     */
    getCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const categories = yield media_model_1.Media.distinct("category", {
                    isPublicDomain: true,
                    contentType: { $in: ["music", "audio"] },
                    category: { $exists: true, $ne: null },
                });
                return categories.filter(Boolean);
            }
            catch (error) {
                logger_1.default.error("Error fetching categories:", error);
                throw error;
            }
        });
    }
    /**
     * Get distinct artists/speakers from copyright-free songs
     */
    getArtists() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const speakers = yield media_model_1.Media.distinct("speaker", {
                    isPublicDomain: true,
                    contentType: { $in: ["music", "audio"] },
                    speaker: { $exists: true, $ne: null },
                });
                return speakers.filter(Boolean);
            }
            catch (error) {
                logger_1.default.error("Error fetching artists:", error);
                throw error;
            }
        });
    }
    /**
     * Upload a copyright-free song (Admin only)
     */
    uploadCopyrightFreeSong(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Validate required fields
                if (!data.title || !data.fileUrl) {
                    throw new Error("Title and fileUrl are required");
                }
                // Determine content type (music or audio)
                const contentType = ((_a = data.fileMimeType) === null || _a === void 0 ? void 0 : _a.startsWith("audio/"))
                    ? "music"
                    : "audio";
                // Prepare media input for MediaService
                const mediaInput = {
                    title: data.title,
                    description: data.description,
                    contentType,
                    category: data.category,
                    topics: data.topics || [],
                    duration: data.duration,
                    uploadedBy: data.uploadedBy,
                    file: data.file,
                    fileMimeType: data.fileMimeType,
                    thumbnail: data.thumbnail,
                    thumbnailMimeType: data.thumbnailMimeType,
                };
                // Upload media using existing MediaService
                const media = yield this.mediaService.uploadMedia(mediaInput);
                // Update media with copyright-free specific fields
                const updatedMedia = yield media_model_1.Media.findByIdAndUpdate(media._id, {
                    isPublicDomain: true,
                    speaker: data.speaker || data.artist,
                    year: data.year,
                    tags: data.tags || [],
                    moderationStatus: "approved", // Admin uploads are pre-approved
                    fileUrl: data.fileUrl || media.fileUrl,
                    thumbnailUrl: data.thumbnailUrl || media.thumbnailUrl,
                }, { new: true });
                if (!updatedMedia) {
                    throw new Error("Failed to update media with copyright-free fields");
                }
                logger_1.default.info("Copyright-free song uploaded", {
                    songId: updatedMedia._id,
                    title: updatedMedia.title,
                    uploadedBy: data.uploadedBy,
                });
                return updatedMedia;
            }
            catch (error) {
                logger_1.default.error("Error uploading copyright-free song:", error);
                throw error;
            }
        });
    }
    /**
     * Update a copyright-free song (Admin only)
     */
    updateCopyrightFreeSong(songId, updates, adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(songId)) {
                    throw new Error("Invalid song ID");
                }
                const song = yield media_model_1.Media.findOne({
                    _id: new mongoose_1.Types.ObjectId(songId),
                    isPublicDomain: true,
                    contentType: { $in: ["music", "audio"] },
                });
                if (!song) {
                    throw new Error("Copyright-free song not found");
                }
                const updateData = {};
                if (updates.title)
                    updateData.title = updates.title;
                if (updates.description !== undefined)
                    updateData.description = updates.description;
                if (updates.category)
                    updateData.category = updates.category;
                if (updates.topics)
                    updateData.topics = updates.topics;
                if (updates.speaker)
                    updateData.speaker = updates.speaker;
                if (updates.artist)
                    updateData.speaker = updates.artist;
                if (updates.year)
                    updateData.year = updates.year;
                if (updates.duration)
                    updateData.duration = updates.duration;
                if (updates.tags)
                    updateData.tags = updates.tags;
                if (updates.fileUrl)
                    updateData.fileUrl = updates.fileUrl;
                if (updates.thumbnailUrl)
                    updateData.thumbnailUrl = updates.thumbnailUrl;
                const updatedSong = yield media_model_1.Media.findByIdAndUpdate(songId, updateData, { new: true })
                    .populate("uploadedBy", "firstName lastName avatar")
                    .lean();
                logger_1.default.info("Copyright-free song updated", {
                    songId,
                    updatedBy: adminId,
                    updates: Object.keys(updateData),
                });
                return updatedSong;
            }
            catch (error) {
                logger_1.default.error("Error updating copyright-free song:", error);
                throw error;
            }
        });
    }
    /**
     * Delete a copyright-free song (Admin only)
     */
    deleteCopyrightFreeSong(songId, adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(songId)) {
                    throw new Error("Invalid song ID");
                }
                const song = yield media_model_1.Media.findOne({
                    _id: new mongoose_1.Types.ObjectId(songId),
                    isPublicDomain: true,
                    contentType: { $in: ["music", "audio"] },
                });
                if (!song) {
                    throw new Error("Copyright-free song not found");
                }
                // Soft delete by marking as hidden
                yield media_model_1.Media.findByIdAndUpdate(songId, {
                    isHidden: true,
                    moderationStatus: "rejected",
                });
                logger_1.default.info("Copyright-free song deleted", {
                    songId,
                    deletedBy: adminId,
                });
                return true;
            }
            catch (error) {
                logger_1.default.error("Error deleting copyright-free song:", error);
                throw error;
            }
        });
    }
    /**
     * Get trending copyright-free songs
     */
    getTrendingSongs() {
        return __awaiter(this, arguments, void 0, function* (limit = 20) {
            try {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const songs = yield media_model_1.Media.find({
                    isPublicDomain: true,
                    contentType: { $in: ["music", "audio"] },
                    isHidden: { $ne: true },
                    createdAt: { $gte: sevenDaysAgo },
                })
                    .sort({ listenCount: -1, viewCount: -1, createdAt: -1 })
                    .limit(limit)
                    .populate("uploadedBy", "firstName lastName avatar")
                    .lean();
                return songs;
            }
            catch (error) {
                logger_1.default.error("Error fetching trending songs:", error);
                throw error;
            }
        });
    }
    /**
     * Get recently added copyright-free songs
     */
    getRecentlyAddedSongs() {
        return __awaiter(this, arguments, void 0, function* (limit = 20) {
            try {
                const songs = yield media_model_1.Media.find({
                    isPublicDomain: true,
                    contentType: { $in: ["music", "audio"] },
                    isHidden: { $ne: true },
                })
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .populate("uploadedBy", "firstName lastName avatar")
                    .lean();
                return songs;
            }
            catch (error) {
                logger_1.default.error("Error fetching recently added songs:", error);
                throw error;
            }
        });
    }
}
exports.AudioService = AudioService;
exports.default = new AudioService();
