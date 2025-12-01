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
exports.searchSongs = exports.shareSong = exports.toggleLike = exports.deleteSong = exports.updateSong = exports.createSong = exports.getSongById = exports.getAllSongs = void 0;
const copyrightFreeSong_service_1 = require("../service/copyrightFreeSong.service");
const logger_1 = __importDefault(require("../utils/logger"));
const copyrightFreeSongInteraction_service_1 = require("../service/copyrightFreeSongInteraction.service");
const songService = new copyrightFreeSong_service_1.CopyrightFreeSongService();
const interactionService = new copyrightFreeSongInteraction_service_1.CopyrightFreeSongInteractionService();
const getAllSongs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = yield songService.getAllSongs(page, limit);
        res.status(200).json({
            success: true,
            data: {
                songs: result.songs,
                pagination: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                    limit,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error getting all songs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve songs",
            error: error.message,
        });
    }
});
exports.getAllSongs = getAllSongs;
const getSongById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        const song = yield songService.getSongById(songId);
        if (!song) {
            res.status(404).json({
                success: false,
                message: "Song not found",
            });
            return;
        }
        let isLiked = false;
        if (userId) {
            isLiked = yield interactionService.isLiked(userId, songId);
        }
        res.status(200).json({
            success: true,
            data: Object.assign(Object.assign({}, song), { isLiked }),
        });
    }
    catch (error) {
        logger_1.default.error("Error getting song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve song",
            error: error.message,
        });
    }
});
exports.getSongById = getSongById;
const createSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { title, singer, fileUrl, thumbnailUrl, duration } = req.body;
        const uploadedBy = req.userId;
        if (!title || !singer || !fileUrl || !uploadedBy) {
            res.status(400).json({
                success: false,
                message: "Title, singer, fileUrl, and uploadedBy are required",
            });
            return;
        }
        const song = yield songService.createSong({
            title,
            singer,
            fileUrl,
            thumbnailUrl,
            duration,
            uploadedBy,
        });
        res.status(201).json({
            success: true,
            data: song,
        });
    }
    catch (error) {
        logger_1.default.error("Error creating song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create song",
            error: error.message,
        });
    }
});
exports.createSong = createSong;
const updateSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const { title, singer, thumbnailUrl, duration } = req.body;
        const song = yield songService.updateSong(songId, {
            title,
            singer,
            thumbnailUrl,
            duration,
        });
        if (!song) {
            res.status(404).json({
                success: false,
                message: "Song not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: song,
        });
    }
    catch (error) {
        logger_1.default.error("Error updating song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update song",
            error: error.message,
        });
    }
});
exports.updateSong = updateSong;
const deleteSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const deleted = yield songService.deleteSong(songId);
        if (!deleted) {
            res.status(404).json({
                success: false,
                message: "Song not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: "Song deleted successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Error deleting song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete song",
            error: error.message,
        });
    }
});
exports.deleteSong = deleteSong;
const toggleLike = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { liked, likeCount, shareCount } = yield interactionService.toggleLike(userId, songId);
        res.status(200).json({
            success: true,
            data: {
                liked,
                likeCount,
                shareCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error toggling like:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle like",
            error: error.message,
        });
    }
});
exports.toggleLike = toggleLike;
const shareSong = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { songId } = req.params;
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { shareCount, likeCount } = yield interactionService.shareSong(userId, songId);
        res.status(200).json({
            success: true,
            data: {
                shareCount,
                likeCount,
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error sharing song:", error);
        res.status(500).json({
            success: false,
            message: "Failed to share song",
            error: error.message,
        });
    }
});
exports.shareSong = shareSong;
const searchSongs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        if (!q || typeof q !== "string") {
            res.status(400).json({
                success: false,
                message: "Search query (q) is required",
            });
            return;
        }
        const result = yield songService.searchSongs(q, page, limit);
        res.status(200).json({
            success: true,
            data: {
                songs: result.songs,
                pagination: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                    limit,
                },
            },
        });
    }
    catch (error) {
        logger_1.default.error("Error searching songs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search songs",
            error: error.message,
        });
    }
});
exports.searchSongs = searchSongs;
