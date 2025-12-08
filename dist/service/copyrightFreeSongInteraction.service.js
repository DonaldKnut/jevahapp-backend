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
exports.CopyrightFreeSongInteractionService = void 0;
const mongoose_1 = require("mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
const copyrightFreeSongInteraction_model_1 = require("../models/copyrightFreeSongInteraction.model");
const copyrightFreeSong_service_1 = require("./copyrightFreeSong.service");
const copyrightFreeSong_model_1 = require("../models/copyrightFreeSong.model");
const logger_1 = __importDefault(require("../utils/logger"));
class CopyrightFreeSongInteractionService {
    constructor() {
        this.songService = new copyrightFreeSong_service_1.CopyrightFreeSongService();
    }
    isLiked(userId, songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    songId: new mongoose_1.Types.ObjectId(songId),
                });
                return (interaction === null || interaction === void 0 ? void 0 : interaction.hasLiked) || false;
            }
            catch (error) {
                logger_1.default.error("Error checking if liked:", error);
                return false;
            }
        });
    }
    toggleLike(userId, songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get or create interaction
                let interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    songId: new mongoose_1.Types.ObjectId(songId),
                });
                const wasLiked = (interaction === null || interaction === void 0 ? void 0 : interaction.hasLiked) || false;
                const newLikedState = !wasLiked;
                if (!interaction) {
                    interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.create({
                        userId: new mongoose_1.Types.ObjectId(userId),
                        songId: new mongoose_1.Types.ObjectId(songId),
                        hasLiked: newLikedState,
                        hasShared: false,
                    });
                }
                else {
                    interaction.hasLiked = newLikedState;
                    yield interaction.save();
                }
                // Update song counts
                if (newLikedState) {
                    yield this.songService.incrementLikeCount(songId);
                }
                else {
                    yield this.songService.decrementLikeCount(songId);
                }
                // Get updated counts
                const song = yield this.songService.getSongById(songId);
                return {
                    liked: newLikedState,
                    likeCount: (song === null || song === void 0 ? void 0 : song.likeCount) || 0,
                    shareCount: (song === null || song === void 0 ? void 0 : song.shareCount) || 0,
                    viewCount: (song === null || song === void 0 ? void 0 : song.viewCount) || 0,
                };
            }
            catch (error) {
                logger_1.default.error("Error toggling like:", error);
                throw error;
            }
        });
    }
    shareSong(userId, songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get or create interaction
                let interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    songId: new mongoose_1.Types.ObjectId(songId),
                });
                if (!interaction) {
                    interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.create({
                        userId: new mongoose_1.Types.ObjectId(userId),
                        songId: new mongoose_1.Types.ObjectId(songId),
                        hasLiked: false,
                        hasShared: true,
                    });
                }
                else if (!interaction.hasShared) {
                    interaction.hasShared = true;
                    yield interaction.save();
                }
                else {
                    // Already shared, don't increment again
                    const song = yield this.songService.getSongById(songId);
                    return {
                        shareCount: (song === null || song === void 0 ? void 0 : song.shareCount) || 0,
                        likeCount: (song === null || song === void 0 ? void 0 : song.likeCount) || 0,
                        viewCount: (song === null || song === void 0 ? void 0 : song.viewCount) || 0,
                    };
                }
                // Increment share count
                yield this.songService.incrementShareCount(songId);
                // Get updated counts
                const song = yield this.songService.getSongById(songId);
                return {
                    shareCount: (song === null || song === void 0 ? void 0 : song.shareCount) || 0,
                    likeCount: (song === null || song === void 0 ? void 0 : song.likeCount) || 0,
                    viewCount: (song === null || song === void 0 ? void 0 : song.viewCount) || 0,
                };
            }
            catch (error) {
                logger_1.default.error("Error sharing song:", error);
                throw error;
            }
        });
    }
    getInteraction(userId, songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    songId: new mongoose_1.Types.ObjectId(songId),
                });
                return interaction;
            }
            catch (error) {
                logger_1.default.error("Error getting interaction:", error);
                return null;
            }
        });
    }
    markAsViewed(userId, songId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    songId: new mongoose_1.Types.ObjectId(songId),
                });
                if (!interaction) {
                    yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.create({
                        userId: new mongoose_1.Types.ObjectId(userId),
                        songId: new mongoose_1.Types.ObjectId(songId),
                        hasLiked: false,
                        hasShared: false,
                        hasViewed: true,
                    });
                }
                else {
                    interaction.hasViewed = true;
                    yield interaction.save();
                }
            }
            catch (error) {
                logger_1.default.error("Error marking as viewed:", error);
                throw error;
            }
        });
    }
    /**
     * Record a view for a copyright-free song with engagement metrics
     * Implements one view per user per song with proper deduplication
     * @param userId - The authenticated user ID
     * @param songId - The song ID
     * @param payload - View engagement data (durationMs, progressPct, isComplete)
     * @returns View count and hasViewed status
     */
    recordView(userId_1, songId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, songId, payload = {}) {
            const { durationMs = 0, progressPct = 0, isComplete = false } = payload;
            // Validate song exists
            const song = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songId);
            if (!song) {
                throw new Error("Song not found");
            }
            const userIdObj = new mongoose_1.Types.ObjectId(userId);
            const songIdObj = new mongoose_1.Types.ObjectId(songId);
            const now = new Date();
            // Check if user already viewed this song
            let viewRecord = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                userId: userIdObj,
                songId: songIdObj,
            });
            if (viewRecord && viewRecord.hasViewed) {
                // User already viewed → Update engagement metrics but DON'T increment count
                viewRecord.durationMs = Math.max(viewRecord.durationMs || 0, durationMs || 0);
                viewRecord.progressPct = Math.max(viewRecord.progressPct || 0, progressPct || 0);
                viewRecord.isComplete = viewRecord.isComplete || isComplete;
                viewRecord.lastViewedAt = now;
                yield viewRecord.save();
                // Return current count (NOT incremented)
                const updatedSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songId).select("viewCount").lean();
                return {
                    viewCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) || 0,
                    hasViewed: true,
                    isNewView: false,
                };
            }
            // User hasn't viewed → Create new view record and increment count
            // Use transaction to ensure atomicity
            const session = yield mongoose_2.default.startSession();
            session.startTransaction();
            try {
                // Check again within transaction (double-check pattern)
                const existingView = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: userIdObj,
                    songId: songIdObj,
                    hasViewed: true,
                }, null, { session });
                if (existingView) {
                    // Another request already created the view record
                    yield session.abortTransaction();
                    // Update engagement metrics
                    existingView.durationMs = Math.max(existingView.durationMs || 0, durationMs || 0);
                    existingView.progressPct = Math.max(existingView.progressPct || 0, progressPct || 0);
                    existingView.isComplete = existingView.isComplete || isComplete;
                    existingView.lastViewedAt = now;
                    yield existingView.save();
                    const currentSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songId).select("viewCount").lean();
                    return {
                        viewCount: (currentSong === null || currentSong === void 0 ? void 0 : currentSong.viewCount) || 0,
                        hasViewed: true,
                        isNewView: false,
                    };
                }
                // Check if interaction exists before creating/updating
                const existingInteraction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({ userId: userIdObj, songId: songIdObj }, null, { session });
                const isNewView = !existingInteraction || !existingInteraction.hasViewed;
                // Create or update interaction record with view data
                const updateData = {
                    $setOnInsert: {
                        userId: userIdObj,
                        songId: songIdObj,
                        hasLiked: false,
                        hasShared: false,
                        hasViewed: true,
                        viewedAt: now,
                        durationMs: durationMs || 0,
                        progressPct: progressPct || 0,
                        isComplete: isComplete || false,
                        lastViewedAt: now,
                    },
                    $set: {
                        hasViewed: true,
                        lastViewedAt: now,
                    },
                    $max: {
                        durationMs: durationMs || 0,
                        progressPct: progressPct || 0,
                    },
                };
                // For existing records, update isComplete if needed
                if (existingInteraction) {
                    updateData.$set = Object.assign(Object.assign({}, updateData.$set), { isComplete: existingInteraction.isComplete || isComplete });
                }
                else {
                    // For new records, set isComplete in $setOnInsert
                    updateData.$setOnInsert.isComplete = isComplete || false;
                }
                const interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOneAndUpdate({ userId: userIdObj, songId: songIdObj }, updateData, {
                    upsert: true,
                    new: true,
                    session,
                });
                if (isNewView) {
                    // Increment view count only for new views
                    yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndUpdate(songId, { $inc: { viewCount: 1 } }, { session });
                }
                yield session.commitTransaction();
                // Get updated song with new view count
                const updatedSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songId).select("viewCount").lean();
                return {
                    viewCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) || 0,
                    hasViewed: true,
                    isNewView: isNewView,
                };
            }
            catch (error) {
                yield session.abortTransaction();
                // Handle duplicate key error (race condition)
                if (error.code === 11000 || error.message.includes("duplicate")) {
                    // Another request already created the view record
                    // Fetch the existing record and return current count
                    const existingView = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                        userId: userIdObj,
                        songId: songIdObj,
                    });
                    if (existingView) {
                        // Update engagement metrics
                        existingView.durationMs = Math.max(existingView.durationMs || 0, durationMs || 0);
                        existingView.progressPct = Math.max(existingView.progressPct || 0, progressPct || 0);
                        existingView.isComplete = existingView.isComplete || isComplete;
                        existingView.lastViewedAt = now;
                        yield existingView.save();
                    }
                    const currentSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songId).select("viewCount").lean();
                    return {
                        viewCount: (currentSong === null || currentSong === void 0 ? void 0 : currentSong.viewCount) || 0,
                        hasViewed: true,
                        isNewView: false,
                    };
                }
                logger_1.default.error("Error recording view:", error);
                throw error;
            }
            finally {
                session.endSession();
            }
        });
    }
}
exports.CopyrightFreeSongInteractionService = CopyrightFreeSongInteractionService;
