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
exports.CopyrightFreeSongService = void 0;
const copyrightFreeSong_model_1 = require("../models/copyrightFreeSong.model");
const logger_1 = __importDefault(require("../utils/logger"));
class CopyrightFreeSongService {
    getAllSongs() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 20) {
            try {
                const skip = (page - 1) * limit;
                const [songs, total] = yield Promise.all([
                    copyrightFreeSong_model_1.CopyrightFreeSong.find()
                        .populate("uploadedBy", "firstName lastName avatar")
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    copyrightFreeSong_model_1.CopyrightFreeSong.countDocuments(),
                ]);
                return {
                    songs: songs,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                };
            }
            catch (error) {
                logger_1.default.error("Error getting all copyright-free songs:", error);
                throw error;
            }
        });
    }
    getSongById(songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const song = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songId)
                    .populate("uploadedBy", "firstName lastName avatar")
                    .lean();
                return song;
            }
            catch (error) {
                logger_1.default.error("Error getting copyright-free song:", error);
                throw error;
            }
        });
    }
    createSong(input) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const song = yield copyrightFreeSong_model_1.CopyrightFreeSong.create({
                    title: input.title,
                    singer: input.singer,
                    fileUrl: input.fileUrl,
                    thumbnailUrl: input.thumbnailUrl,
                    duration: input.duration,
                    uploadedBy: input.uploadedBy,
                    likeCount: 0,
                    shareCount: 0,
                    viewCount: 0,
                });
                return song;
            }
            catch (error) {
                logger_1.default.error("Error creating copyright-free song:", error);
                throw error;
            }
        });
    }
    updateSong(songId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const song = yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndUpdate(songId, { $set: input }, { new: true, runValidators: true });
                return song;
            }
            catch (error) {
                logger_1.default.error("Error updating copyright-free song:", error);
                throw error;
            }
        });
    }
    deleteSong(songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndDelete(songId);
                return !!result;
            }
            catch (error) {
                logger_1.default.error("Error deleting copyright-free song:", error);
                throw error;
            }
        });
    }
    incrementLikeCount(songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndUpdate(songId, {
                    $inc: { likeCount: 1 },
                });
            }
            catch (error) {
                logger_1.default.error("Error incrementing like count:", error);
                throw error;
            }
        });
    }
    decrementLikeCount(songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndUpdate(songId, {
                    $inc: { likeCount: -1 },
                });
            }
            catch (error) {
                logger_1.default.error("Error decrementing like count:", error);
                throw error;
            }
        });
    }
    incrementShareCount(songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndUpdate(songId, {
                    $inc: { shareCount: 1 },
                });
            }
            catch (error) {
                logger_1.default.error("Error incrementing share count:", error);
                throw error;
            }
        });
    }
    incrementViewCount(songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndUpdate(songId, {
                    $inc: { viewCount: 1 },
                });
            }
            catch (error) {
                logger_1.default.error("Error incrementing view count:", error);
                throw error;
            }
        });
    }
    /**
     * Track playback and increment view count if threshold is met (30 seconds)
     * This is called when playback ends
     */
    trackPlayback(songId_1, playbackDuration_1) {
        return __awaiter(this, arguments, void 0, function* (songId, playbackDuration, thresholdSeconds = 30) {
            var _a;
            try {
                const song = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songId);
                if (!song) {
                    throw new Error("Song not found");
                }
                let viewCountIncremented = false;
                // Only increment view count if user listened for at least threshold seconds
                if (playbackDuration >= thresholdSeconds) {
                    yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndUpdate(songId, {
                        $inc: { viewCount: 1 },
                    });
                    viewCountIncremented = true;
                }
                // Get updated view count
                const updatedSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songId).select("viewCount").lean();
                const newViewCount = (_a = updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) !== null && _a !== void 0 ? _a : song.viewCount;
                logger_1.default.info("Playback tracked for copyright-free song", {
                    songId,
                    playbackDuration,
                    thresholdSeconds,
                    viewCountIncremented,
                    newViewCount,
                });
                return {
                    viewCountIncremented,
                    newViewCount,
                };
            }
            catch (error) {
                logger_1.default.error("Error tracking playback:", error);
                throw error;
            }
        });
    }
    searchSongs(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, page = 1, limit = 20) {
            try {
                const skip = (page - 1) * limit;
                const searchRegex = new RegExp(query, "i");
                const [songs, total] = yield Promise.all([
                    copyrightFreeSong_model_1.CopyrightFreeSong.find({
                        $or: [
                            { title: searchRegex },
                            { singer: searchRegex },
                        ],
                    })
                        .populate("uploadedBy", "firstName lastName avatar")
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    copyrightFreeSong_model_1.CopyrightFreeSong.countDocuments({
                        $or: [
                            { title: searchRegex },
                            { singer: searchRegex },
                        ],
                    }),
                ]);
                return {
                    songs: songs,
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                };
            }
            catch (error) {
                logger_1.default.error("Error searching copyright-free songs:", error);
                throw error;
            }
        });
    }
}
exports.CopyrightFreeSongService = CopyrightFreeSongService;
