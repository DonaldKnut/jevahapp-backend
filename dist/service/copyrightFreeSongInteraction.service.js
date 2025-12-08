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
            try {
                // Validate userId and songId are valid ObjectIds
                if (!mongoose_1.Types.ObjectId.isValid(userId)) {
                    throw new Error(`Invalid userId format: ${userId}`);
                }
                if (!mongoose_1.Types.ObjectId.isValid(songId)) {
                    throw new Error(`Invalid songId format: ${songId}`);
                }
                const userIdObj = new mongoose_1.Types.ObjectId(userId);
                const songIdObj = new mongoose_1.Types.ObjectId(songId);
                // Validate song exists
                const song = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songIdObj);
                if (!song) {
                    throw new Error("Song not found");
                }
                const now = new Date();
                // Check if user already viewed this song (outside transaction for early return)
                const existingInteraction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                    userId: userIdObj,
                    songId: songIdObj,
                });
                if (existingInteraction && existingInteraction.hasViewed) {
                    // User already viewed → Update engagement metrics but DON'T increment count
                    const maxDurationMs = Math.max(existingInteraction.durationMs || 0, durationMs || 0);
                    const maxProgressPct = Math.max(existingInteraction.progressPct || 0, progressPct || 0);
                    const updatedIsComplete = existingInteraction.isComplete || isComplete;
                    existingInteraction.durationMs = maxDurationMs;
                    existingInteraction.progressPct = maxProgressPct;
                    existingInteraction.isComplete = updatedIsComplete;
                    existingInteraction.lastViewedAt = now;
                    yield existingInteraction.save();
                    // Return current count (NOT incremented)
                    const updatedSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songIdObj).select("viewCount").lean();
                    return {
                        viewCount: (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) || 0,
                        hasViewed: true,
                        isNewView: false,
                    };
                }
                // User hasn't viewed → Create new view record and increment count
                // Use transaction to ensure atomicity
                const session = yield mongoose_2.default.startSession();
                try {
                    let isNewView = false;
                    let viewCount = 0;
                    yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                        // Double-check within transaction (race condition protection)
                        const existingViewInTx = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                            userId: userIdObj,
                            songId: songIdObj,
                            hasViewed: true,
                        }, null, { session });
                        if (existingViewInTx) {
                            // Another request already created the view record
                            // Update engagement metrics
                            const maxDurationMs = Math.max(existingViewInTx.durationMs || 0, durationMs || 0);
                            const maxProgressPct = Math.max(existingViewInTx.progressPct || 0, progressPct || 0);
                            const updatedIsComplete = existingViewInTx.isComplete || isComplete;
                            existingViewInTx.durationMs = maxDurationMs;
                            existingViewInTx.progressPct = maxProgressPct;
                            existingViewInTx.isComplete = updatedIsComplete;
                            existingViewInTx.lastViewedAt = now;
                            yield existingViewInTx.save({ session });
                            const currentSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songIdObj).select("viewCount").session(session).lean();
                            viewCount = (currentSong === null || currentSong === void 0 ? void 0 : currentSong.viewCount) || 0;
                            isNewView = false;
                            return; // Exit transaction early
                        }
                        // Check if interaction exists (without hasViewed requirement)
                        const interactionInTx = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({ userId: userIdObj, songId: songIdObj }, null, { session });
                        isNewView = !interactionInTx || !interactionInTx.hasViewed;
                        // Calculate max values for update
                        const currentDurationMs = (interactionInTx === null || interactionInTx === void 0 ? void 0 : interactionInTx.durationMs) || 0;
                        const currentProgressPct = (interactionInTx === null || interactionInTx === void 0 ? void 0 : interactionInTx.progressPct) || 0;
                        const maxDurationMs = Math.max(currentDurationMs, durationMs || 0);
                        const maxProgressPct = Math.max(currentProgressPct, progressPct || 0);
                        const updatedIsComplete = ((interactionInTx === null || interactionInTx === void 0 ? void 0 : interactionInTx.isComplete) || false) || isComplete;
                        // Create or update interaction record with view data
                        // Use $set with calculated max values (no $max operator to avoid conflicts)
                        const updateData = {
                            $set: {
                                hasViewed: true,
                                lastViewedAt: now,
                                durationMs: maxDurationMs,
                                progressPct: maxProgressPct,
                                isComplete: updatedIsComplete,
                            },
                            $setOnInsert: {
                                userId: userIdObj,
                                songId: songIdObj,
                                hasLiked: false,
                                hasShared: false,
                                viewedAt: now,
                            },
                        };
                        const interaction = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOneAndUpdate({ userId: userIdObj, songId: songIdObj }, updateData, {
                            upsert: true,
                            new: true,
                            session,
                            runValidators: true,
                        });
                        if (isNewView) {
                            // Increment view count only for new views
                            yield copyrightFreeSong_model_1.CopyrightFreeSong.findByIdAndUpdate(songIdObj, { $inc: { viewCount: 1 } }, { session });
                        }
                        // Get updated song with new view count
                        const updatedSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songIdObj).select("viewCount").session(session).lean();
                        viewCount = (updatedSong === null || updatedSong === void 0 ? void 0 : updatedSong.viewCount) || 0;
                    }));
                    return {
                        viewCount,
                        hasViewed: true,
                        isNewView,
                    };
                }
                catch (error) {
                    // Handle duplicate key error (race condition)
                    if (error.code === 11000 || (error.message && error.message.includes("duplicate"))) {
                        // Another request already created the view record
                        // Fetch the existing record and return current count
                        try {
                            const existingView = yield copyrightFreeSongInteraction_model_1.CopyrightFreeSongInteraction.findOne({
                                userId: userIdObj,
                                songId: songIdObj,
                            });
                            if (existingView) {
                                // Update engagement metrics
                                const maxDurationMs = Math.max(existingView.durationMs || 0, durationMs || 0);
                                const maxProgressPct = Math.max(existingView.progressPct || 0, progressPct || 0);
                                const updatedIsComplete = existingView.isComplete || isComplete;
                                existingView.durationMs = maxDurationMs;
                                existingView.progressPct = maxProgressPct;
                                existingView.isComplete = updatedIsComplete;
                                existingView.lastViewedAt = now;
                                yield existingView.save();
                            }
                            const currentSong = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(songIdObj).select("viewCount").lean();
                            return {
                                viewCount: (currentSong === null || currentSong === void 0 ? void 0 : currentSong.viewCount) || 0,
                                hasViewed: true,
                                isNewView: false,
                            };
                        }
                        catch (recoveryError) {
                            logger_1.default.error("Error during duplicate key recovery:", {
                                error: recoveryError.message,
                                stack: recoveryError.stack,
                                code: recoveryError.code,
                                name: recoveryError.name,
                                userId,
                                songId,
                            });
                            throw recoveryError;
                        }
                    }
                    // Re-throw transaction errors
                    logger_1.default.error("Error in transaction while recording view:", {
                        error: error.message,
                        stack: error.stack,
                        code: error.code,
                        codeName: error.codeName,
                        name: error.name,
                        userId,
                        songId,
                        durationMs,
                        progressPct,
                        isComplete,
                    });
                    throw error;
                }
                finally {
                    yield session.endSession();
                }
            }
            catch (error) {
                // Enhanced error logging with all relevant details
                logger_1.default.error("Error recording view:", {
                    error: error.message,
                    stack: error.stack,
                    code: error.code,
                    codeName: error.codeName,
                    name: error.name,
                    userId,
                    songId,
                    durationMs,
                    progressPct,
                    isComplete,
                    mongoError: error.code,
                    mongoErrorCode: error.codeName,
                    errorType: error.constructor.name,
                });
                // Re-throw to be handled by controller
                throw error;
            }
        });
    }
}
exports.CopyrightFreeSongInteractionService = CopyrightFreeSongInteractionService;
