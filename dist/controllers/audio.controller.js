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
exports.downloadCopyrightFreeSong = exports.getUserAudioLibrary = exports.saveCopyrightFreeSong = exports.likeCopyrightFreeSong = exports.deleteCopyrightFreeSong = exports.updateCopyrightFreeSong = exports.uploadCopyrightFreeSong = exports.getArtists = exports.getCategories = exports.searchCopyrightFreeSongs = exports.getCopyrightFreeSong = exports.getCopyrightFreeSongs = void 0;
const mongoose_1 = require("mongoose");
const audio_service_1 = __importDefault(require("../service/audio.service"));
const contentInteraction_service_1 = require("../service/contentInteraction.service");
const unifiedBookmark_service_1 = require("../service/unifiedBookmark.service");
const logger_1 = __importDefault(require("../utils/logger"));
const media_service_1 = require("../service/media.service");
const contentInteractionService = new contentInteraction_service_1.ContentInteractionService();
/**
 * Get all copyright-free songs (Public)
 */
const getCopyrightFreeSongs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { search, category, artist, year, minDuration, maxDuration, tags, sortBy = "newest", page = "1", limit = "20", } = req.query;
        const filters = {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            sortBy: sortBy,
        };
        if (search)
            filters.search = search;
        if (category)
            filters.category = category;
        if (artist)
            filters.artist = artist;
        if (year)
            filters.year = parseInt(year);
        if (minDuration)
            filters.minDuration = parseInt(minDuration);
        if (maxDuration)
            filters.maxDuration = parseInt(maxDuration);
        if (tags) {
            filters.tags = Array.isArray(tags) ? tags : [tags];
        }
        const result = yield audio_service_1.default.getCopyrightFreeSongs(filters);
        res.status(200).json({
            success: true,
            message: "Copyright-free songs retrieved successfully",
            data: {
                songs: result.songs,
                pagination: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                    limit: parseInt(limit) || 20,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting copyright-free songs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve copyright-free songs",
            error: error.message,
        });
    }
});
exports.getCopyrightFreeSongs = getCopyrightFreeSongs;
/**
 * Get a single copyright-free song (Public)
 */
const getCopyrightFreeSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(songId)) {
            res.status(400).json({
                success: false,
                message: "Invalid song ID",
            });
            return;
        }
        const song = yield audio_service_1.default.getCopyrightFreeSongById(songId, userId);
        if (!song) {
            res.status(404).json({
                success: false,
                message: "Copyright-free song not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: "Song retrieved successfully",
            data: song,
        });
    }
    catch (error) {
        logger_1.default.error("Error getting copyright-free song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve song",
            error: error.message,
        });
    }
});
exports.getCopyrightFreeSong = getCopyrightFreeSong;
/**
 * Search copyright-free songs (Public)
 */
const searchCopyrightFreeSongs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, category, artist, sortBy, page, limit } = req.query;
        if (!q || q.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "Search query is required",
            });
            return;
        }
        const filters = {};
        if (category)
            filters.category = category;
        if (artist)
            filters.artist = artist;
        if (sortBy)
            filters.sortBy = sortBy;
        if (page)
            filters.page = parseInt(page);
        if (limit)
            filters.limit = parseInt(limit);
        const result = yield audio_service_1.default.searchCopyrightFreeSongs(q, filters);
        res.status(200).json({
            success: true,
            message: "Search completed successfully",
            data: {
                songs: result.songs,
                pagination: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error searching copyright-free songs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search songs",
            error: error.message,
        });
    }
});
exports.searchCopyrightFreeSongs = searchCopyrightFreeSongs;
/**
 * Get categories for copyright-free songs (Public)
 */
const getCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categories = yield audio_service_1.default.getCategories();
        res.status(200).json({
            success: true,
            message: "Categories retrieved successfully",
            data: categories,
        });
    }
    catch (error) {
        logger_1.default.error("Error getting categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve categories",
            error: error.message,
        });
    }
});
exports.getCategories = getCategories;
/**
 * Get artists for copyright-free songs (Public)
 */
const getArtists = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const artists = yield audio_service_1.default.getArtists();
        res.status(200).json({
            success: true,
            message: "Artists retrieved successfully",
            data: artists,
        });
    }
    catch (error) {
        logger_1.default.error("Error getting artists:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve artists",
            error: error.message,
        });
    }
});
exports.getArtists = getArtists;
/**
 * Upload a copyright-free song (Admin Only)
 */
const uploadCopyrightFreeSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { title, description, artist, speaker, year, category, topics, duration, tags, } = req.body;
        // Validate required fields
        if (!title) {
            res.status(400).json({
                success: false,
                message: "Title is required",
            });
            return;
        }
        // Get files from multer
        const files = req.files;
        const file = (_a = files === null || files === void 0 ? void 0 : files.file) === null || _a === void 0 ? void 0 : _a[0];
        const thumbnail = (_b = files === null || files === void 0 ? void 0 : files.thumbnail) === null || _b === void 0 ? void 0 : _b[0];
        if (!file || !file.buffer) {
            res.status(400).json({
                success: false,
                message: "Audio file is required",
            });
            return;
        }
        if (!thumbnail || !thumbnail.buffer) {
            res.status(400).json({
                success: false,
                message: "Thumbnail is required",
            });
            return;
        }
        // Parse topics and tags
        let parsedTopics = [];
        if (topics) {
            try {
                parsedTopics = Array.isArray(topics) ? topics : JSON.parse(topics);
            }
            catch (error) {
                parsedTopics = [];
            }
        }
        let parsedTags = [];
        if (tags) {
            try {
                parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
            }
            catch (error) {
                parsedTags = [];
            }
        }
        // Prepare upload data
        const uploadData = {
            title: title.trim(),
            description: description === null || description === void 0 ? void 0 : description.trim(),
            artist: artist === null || artist === void 0 ? void 0 : artist.trim(),
            speaker: (speaker === null || speaker === void 0 ? void 0 : speaker.trim()) || (artist === null || artist === void 0 ? void 0 : artist.trim()),
            year: year ? parseInt(year) : undefined,
            category: category === null || category === void 0 ? void 0 : category.trim(),
            topics: parsedTopics,
            duration: duration ? parseFloat(duration) : undefined,
            tags: parsedTags,
            uploadedBy: new mongoose_1.Types.ObjectId(userId),
            file: file.buffer,
            fileMimeType: file.mimetype,
            thumbnail: thumbnail.buffer,
            thumbnailMimeType: thumbnail.mimetype,
        };
        // Upload the song using MediaService first (handles file uploads to Cloudflare R2)
        const mediaService = new media_service_1.MediaService();
        // Use MediaService to handle file uploads
        const mediaInput = {
            title: uploadData.title,
            description: uploadData.description,
            contentType: file.mimetype.startsWith("audio/") ? "music" : "audio",
            category: uploadData.category,
            topics: uploadData.topics,
            duration: uploadData.duration,
            uploadedBy: uploadData.uploadedBy,
            file: uploadData.file,
            fileMimeType: uploadData.fileMimeType,
            thumbnail: uploadData.thumbnail,
            thumbnailMimeType: uploadData.thumbnailMimeType,
        };
        const media = yield mediaService.uploadMedia(mediaInput);
        // Update with copyright-free specific fields using Media model directly
        const { Media } = yield Promise.resolve().then(() => __importStar(require("../models/media.model")));
        const updatedMedia = yield Media.findByIdAndUpdate(media._id, {
            isPublicDomain: true,
            moderationStatus: "approved",
            speaker: uploadData.speaker,
            year: uploadData.year,
            tags: uploadData.tags,
        }, { new: true })
            .populate("uploadedBy", "firstName lastName avatar")
            .lean();
        if (!updatedMedia) {
            res.status(500).json({
                success: false,
                message: "Failed to update song with copyright-free fields",
            });
            return;
        }
        res.status(201).json({
            success: true,
            message: "Copyright-free song uploaded successfully",
            data: updatedMedia,
        });
    }
    catch (error) {
        logger_1.default.error("Error uploading copyright-free song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to upload song",
            error: error.message,
        });
    }
});
exports.uploadCopyrightFreeSong = uploadCopyrightFreeSong;
/**
 * Update a copyright-free song (Admin Only)
 */
const updateCopyrightFreeSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(songId)) {
            res.status(400).json({
                success: false,
                message: "Invalid song ID",
            });
            return;
        }
        const updates = req.body;
        const updatedSong = yield audio_service_1.default.updateCopyrightFreeSong(songId, updates, userId);
        if (!updatedSong) {
            res.status(404).json({
                success: false,
                message: "Copyright-free song not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: "Song updated successfully",
            data: updatedSong,
        });
    }
    catch (error) {
        logger_1.default.error("Error updating copyright-free song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update song",
            error: error.message,
        });
    }
});
exports.updateCopyrightFreeSong = updateCopyrightFreeSong;
/**
 * Delete a copyright-free song (Admin Only)
 */
const deleteCopyrightFreeSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(songId)) {
            res.status(400).json({
                success: false,
                message: "Invalid song ID",
            });
            return;
        }
        yield audio_service_1.default.deleteCopyrightFreeSong(songId, userId);
        res.status(200).json({
            success: true,
            message: "Song deleted successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Error deleting copyright-free song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete song",
            error: error.message,
        });
    }
});
exports.deleteCopyrightFreeSong = deleteCopyrightFreeSong;
/**
 * Like/Unlike a copyright-free song (Authenticated)
 * Toggle endpoint - same endpoint for like and unlike
 */
const likeCopyrightFreeSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(songId)) {
            res.status(400).json({
                success: false,
                message: "Invalid song ID",
            });
            return;
        }
        // Toggle like (ContentInteractionService handles real-time Socket.IO events)
        const result = yield contentInteractionService.toggleLike(userId, songId, "media");
        // Get updated song with all counts
        const { Media } = yield Promise.resolve().then(() => __importStar(require("../models/media.model")));
        const song = yield Media.findById(songId)
            .select("likeCount viewCount listenCount")
            .lean();
        const viewCount = (song === null || song === void 0 ? void 0 : song.viewCount) || 0;
        const listenCount = (song === null || song === void 0 ? void 0 : song.listenCount) || 0;
        // Emit additional real-time event specifically for audio/copyright-free songs
        try {
            const io = require("../socket/socketManager").getIO();
            if (io) {
                // Emit to audio-specific rooms
                io.to(`content:media:${songId}`).emit("audio-like-updated", {
                    songId,
                    liked: result.liked,
                    likeCount: result.likeCount,
                    viewCount,
                    listenCount,
                    userId,
                    timestamp: new Date().toISOString(),
                });
                // Also emit to copyright-free specific room
                io.to(`audio:copyright-free:${songId}`).emit("like-updated", {
                    songId,
                    liked: result.liked,
                    likeCount: result.likeCount,
                    viewCount,
                    listenCount,
                    userId,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        catch (socketError) {
            logger_1.default.warn("Failed to send audio-specific real-time like update", {
                error: socketError,
                songId,
            });
        }
        res.status(200).json({
            success: true,
            message: result.liked ? "Song liked successfully" : "Song unliked",
            data: {
                liked: result.liked,
                likeCount: result.likeCount,
                viewCount,
                listenCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error liking copyright-free song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to like song",
            error: error.message,
        });
    }
});
exports.likeCopyrightFreeSong = likeCopyrightFreeSong;
/**
 * Save a copyright-free song to library (Authenticated)
 */
const saveCopyrightFreeSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(songId)) {
            res.status(400).json({
                success: false,
                message: "Invalid song ID",
            });
            return;
        }
        const result = yield unifiedBookmark_service_1.UnifiedBookmarkService.toggleBookmark(userId, songId);
        res.status(200).json({
            success: true,
            message: result.bookmarked
                ? "Song saved to library"
                : "Song removed from library",
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error("Error saving copyright-free song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to save song",
            error: error.message,
        });
    }
});
exports.saveCopyrightFreeSong = saveCopyrightFreeSong;
/**
 * Get user's audio library (Authenticated)
 */
const getUserAudioLibrary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { Bookmark } = yield Promise.resolve().then(() => __importStar(require("../models/bookmark.model")));
        const { Media } = yield Promise.resolve().then(() => __importStar(require("../models/media.model")));
        // Get all bookmarked media that are audio/music
        const bookmarks = yield Bookmark.find({
            user: new mongoose_1.Types.ObjectId(userId),
        })
            .populate({
            path: "media",
            match: {
                contentType: { $in: ["music", "audio"] },
            },
        })
            .sort({ createdAt: -1 })
            .lean();
        // Filter out null media (populate failed)
        const audioBookmarks = bookmarks.filter((b) => b.media !== null);
        res.status(200).json({
            success: true,
            message: "Audio library retrieved successfully",
            data: audioBookmarks.map((b) => (Object.assign(Object.assign({ id: b.media._id }, b.media), { savedAt: b.createdAt }))),
        });
    }
    catch (error) {
        logger_1.default.error("Error getting audio library:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve audio library",
            error: error.message,
        });
    }
});
exports.getUserAudioLibrary = getUserAudioLibrary;
/**
 * Download a copyright-free song for offline listening (Authenticated)
 */
const downloadCopyrightFreeSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const { fileSize } = req.body;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        if (!songId || !mongoose_1.Types.ObjectId.isValid(songId)) {
            res.status(400).json({
                success: false,
                message: "Invalid song ID",
            });
            return;
        }
        // Fetch the song to verify it exists and is a copyright-free song
        const { Media } = yield Promise.resolve().then(() => __importStar(require("../models/media.model")));
        const song = yield Media.findById(songId).select("fileSize fileUrl contentType title isPublicDomain");
        if (!song) {
            res.status(404).json({
                success: false,
                message: "Song not found",
            });
            return;
        }
        // Verify this is a copyright-free song
        if (!song.isPublicDomain) {
            res.status(403).json({
                success: false,
                message: "This song is not available for download as a copyright-free song",
            });
            return;
        }
        // Verify it's an audio/music file
        if (!["music", "audio"].includes(song.contentType)) {
            res.status(400).json({
                success: false,
                message: "This content is not an audio file",
            });
            return;
        }
        // Check if file is available
        if (!song.fileUrl) {
            res.status(403).json({
                success: false,
                message: "Song file not available for download",
            });
            return;
        }
        // Use provided fileSize, or fallback to song.fileSize, or 0 as default
        const finalFileSize = fileSize && typeof fileSize === "number" && fileSize > 0
            ? fileSize
            : song.fileSize && typeof song.fileSize === "number" && song.fileSize > 0
                ? song.fileSize
                : 0;
        // Use the existing MediaService to handle download
        const mediaService = new media_service_1.MediaService();
        const result = yield mediaService.downloadMedia({
            userId,
            mediaId: songId,
            fileSize: finalFileSize,
        });
        res.status(200).json({
            success: true,
            message: "Download recorded successfully",
            downloadUrl: result.downloadUrl,
            fileName: result.fileName,
            fileSize: result.fileSize,
            contentType: result.contentType,
        });
    }
    catch (error) {
        logger_1.default.error("Error downloading copyright-free song:", error);
        if (error instanceof Error) {
            if (error.message.includes("not found")) {
                res.status(404).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("not available for download") ||
                error.message.includes("not available")) {
                res.status(403).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
            if (error.message.includes("Invalid") ||
                error.message.includes("required")) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }
        res.status(500).json({
            success: false,
            message: "Failed to record download",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
exports.downloadCopyrightFreeSong = downloadCopyrightFreeSong;
