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
exports.PlaybackSessionService = void 0;
const mongoose_1 = require("mongoose");
const playbackSession_model_1 = require("../models/playbackSession.model");
const media_model_1 = require("../models/media.model");
const library_model_1 = require("../models/library.model");
const mediaInteraction_model_1 = require("../models/mediaInteraction.model");
const logger_1 = __importDefault(require("../utils/logger"));
class PlaybackSessionService {
    /**
     * Start a new playback session
     * Automatically pauses any existing active session for the user
     */
    static startPlayback(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, mediaId, duration, position = 0, deviceInfo, userAgent } = data;
                // Verify media exists
                const media = yield media_model_1.Media.findById(mediaId);
                if (!media) {
                    throw new Error("Media not found");
                }
                // Pause any existing active session for this user
                const previousSession = yield playbackSession_model_1.PlaybackSession.findOneAndUpdate({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    isActive: true,
                }, {
                    isActive: false,
                    isPaused: true,
                    pausedAt: new Date(),
                    endedAt: new Date(),
                }, { new: true });
                // Get or create library entry for progress storage
                const libraryEntry = yield library_model_1.Library.findOneAndUpdate({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    mediaId: new mongoose_1.Types.ObjectId(mediaId),
                    mediaType: "media",
                }, {
                    $setOnInsert: {
                        userId: new mongoose_1.Types.ObjectId(userId),
                        mediaId: new mongoose_1.Types.ObjectId(mediaId),
                        mediaType: "media",
                        addedAt: new Date(),
                        isFavorite: false,
                    },
                }, { upsert: true, new: true });
                // Resume from last position if available
                const resumePosition = position || libraryEntry.watchProgress || 0;
                const progressPercentage = duration > 0
                    ? Math.min(100, Math.round((resumePosition / duration) * 100))
                    : 0;
                // Create new active session
                const session = yield playbackSession_model_1.PlaybackSession.create({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    mediaId: new mongoose_1.Types.ObjectId(mediaId),
                    startedAt: new Date(),
                    lastProgressAt: new Date(),
                    currentPosition: resumePosition,
                    duration,
                    progressPercentage,
                    isActive: true,
                    isPaused: false,
                    totalWatchTime: 0,
                    deviceInfo,
                    userAgent,
                });
                logger_1.default.info("Playback session started", {
                    sessionId: session._id,
                    userId,
                    mediaId,
                    previousSessionId: previousSession === null || previousSession === void 0 ? void 0 : previousSession._id,
                });
                return {
                    session,
                    previousSessionPaused: previousSession || undefined,
                };
            }
            catch (error) {
                logger_1.default.error("Error starting playback session:", error);
                throw error;
            }
        });
    }
    /**
     * Update playback progress
     */
    static updateProgress(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { sessionId, position, duration, progressPercentage } = data;
                const session = yield playbackSession_model_1.PlaybackSession.findById(sessionId);
                if (!session) {
                    throw new Error("Playback session not found");
                }
                if (!session.isActive) {
                    throw new Error("Playback session is not active");
                }
                // Calculate watch time increment
                const previousPosition = session.currentPosition;
                const positionDiff = Math.max(0, position - previousPosition);
                const newTotalWatchTime = session.totalWatchTime + positionDiff;
                // Update session
                const updatedSession = yield playbackSession_model_1.PlaybackSession.findByIdAndUpdate(sessionId, {
                    currentPosition: position,
                    duration,
                    progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
                    lastProgressAt: new Date(),
                    totalWatchTime: newTotalWatchTime,
                }, { new: true });
                // Update library progress for resume functionality
                yield library_model_1.Library.findOneAndUpdate({
                    userId: session.userId,
                    mediaId: session.mediaId,
                    mediaType: "media",
                }, {
                    watchProgress: position,
                    completionPercentage: progressPercentage,
                    lastWatched: new Date(),
                }, { upsert: true });
                return updatedSession;
            }
            catch (error) {
                logger_1.default.error("Error updating playback progress:", error);
                throw error;
            }
        });
    }
    /**
     * Pause playback
     */
    static pausePlayback(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const session = yield playbackSession_model_1.PlaybackSession.findById(sessionId);
                if (!session) {
                    throw new Error("Playback session not found");
                }
                if (!session.isActive) {
                    throw new Error("Playback session is not active");
                }
                const updatedSession = yield playbackSession_model_1.PlaybackSession.findByIdAndUpdate(sessionId, {
                    isPaused: true,
                    pausedAt: new Date(),
                    lastProgressAt: new Date(),
                }, { new: true });
                // Update library progress
                yield library_model_1.Library.findOneAndUpdate({
                    userId: session.userId,
                    mediaId: session.mediaId,
                    mediaType: "media",
                }, {
                    watchProgress: session.currentPosition,
                    completionPercentage: session.progressPercentage,
                    lastWatched: new Date(),
                });
                logger_1.default.info("Playback paused", { sessionId, userId: session.userId.toString() });
                return updatedSession;
            }
            catch (error) {
                logger_1.default.error("Error pausing playback:", error);
                throw error;
            }
        });
    }
    /**
     * Resume playback
     */
    static resumePlayback(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const session = yield playbackSession_model_1.PlaybackSession.findById(sessionId);
                if (!session) {
                    throw new Error("Playback session not found");
                }
                const updatedSession = yield playbackSession_model_1.PlaybackSession.findByIdAndUpdate(sessionId, {
                    isPaused: false,
                    pausedAt: undefined,
                    lastProgressAt: new Date(),
                }, { new: true });
                logger_1.default.info("Playback resumed", { sessionId, userId: session.userId.toString() });
                return updatedSession;
            }
            catch (error) {
                logger_1.default.error("Error resuming playback:", error);
                throw error;
            }
        });
    }
    /**
     * End playback session
     */
    static endPlayback(sessionId_1) {
        return __awaiter(this, arguments, void 0, function* (sessionId, options = {}) {
            try {
                const { reason = "stopped", finalPosition } = options;
                const session = yield playbackSession_model_1.PlaybackSession.findById(sessionId);
                if (!session) {
                    throw new Error("Playback session not found");
                }
                const endPosition = finalPosition !== undefined ? finalPosition : session.currentPosition;
                const finalProgressPercentage = session.duration > 0
                    ? Math.min(100, Math.round((endPosition / session.duration) * 100))
                    : session.progressPercentage;
                // Mark session as inactive
                const updatedSession = yield playbackSession_model_1.PlaybackSession.findByIdAndUpdate(sessionId, {
                    isActive: false,
                    isPaused: false,
                    currentPosition: endPosition,
                    progressPercentage: finalProgressPercentage,
                    endedAt: new Date(),
                    lastProgressAt: new Date(),
                }, { new: true });
                // Update library progress
                yield library_model_1.Library.findOneAndUpdate({
                    userId: session.userId,
                    mediaId: session.mediaId,
                    mediaType: "media",
                }, {
                    watchProgress: endPosition,
                    completionPercentage: finalProgressPercentage,
                    lastWatched: new Date(),
                }, { upsert: true });
                // Get media to determine interaction type
                const media = yield media_model_1.Media.findById(session.mediaId);
                if (!media) {
                    throw new Error("Media not found");
                }
                // Determine interaction type based on content type
                // Videos use "view", audio/music use "listen"
                const isAudioContent = ["music", "audio", "podcast", "sermon"].includes(media.contentType);
                const interactionType = isAudioContent ? "listen" : "view";
                // Record view/listen if threshold met (30 seconds default)
                let viewRecorded = false;
                const viewThreshold = 30; // seconds
                if (session.totalWatchTime >= viewThreshold || endPosition >= viewThreshold) {
                    // Record interaction (view or listen)
                    yield mediaInteraction_model_1.MediaInteraction.findOneAndUpdate({
                        user: session.userId,
                        media: session.mediaId,
                        interactionType: interactionType,
                    }, {
                        $inc: { count: 1 },
                        $set: { lastInteraction: new Date() },
                        $push: {
                            interactions: {
                                timestamp: new Date(),
                                duration: session.totalWatchTime,
                                isComplete: finalProgressPercentage >= 90,
                                progressPct: finalProgressPercentage,
                            },
                        },
                    }, { upsert: true });
                    // Increment appropriate count on media
                    const updateField = isAudioContent
                        ? { listenCount: 1 }
                        : { viewCount: 1 };
                    yield media_model_1.Media.findByIdAndUpdate(session.mediaId, {
                        $inc: updateField,
                    });
                    viewRecorded = true;
                }
                logger_1.default.info("Playback ended", {
                    sessionId,
                    userId: session.userId.toString(),
                    reason,
                    totalWatchTime: session.totalWatchTime,
                    viewRecorded,
                });
                return {
                    session: updatedSession,
                    viewRecorded,
                };
            }
            catch (error) {
                logger_1.default.error("Error ending playback:", error);
                throw error;
            }
        });
    }
    /**
     * Get active playback session for user
     */
    static getActiveSession(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const session = yield playbackSession_model_1.PlaybackSession.findOne({
                    userId: new mongoose_1.Types.ObjectId(userId),
                    isActive: true,
                })
                    .populate("mediaId", "title contentType thumbnailUrl duration")
                    .sort({ startedAt: -1 });
                return session;
            }
            catch (error) {
                logger_1.default.error("Error getting active session:", error);
                throw error;
            }
        });
    }
    /**
     * Get playback history for user
     */
    static getPlaybackHistory(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, options = {}) {
            try {
                const { page = 1, limit = 20, includeInactive = true } = options;
                const skip = (page - 1) * limit;
                const query = {
                    userId: new mongoose_1.Types.ObjectId(userId),
                };
                if (!includeInactive) {
                    query.isActive = true;
                }
                const [sessions, total] = yield Promise.all([
                    playbackSession_model_1.PlaybackSession.find(query)
                        .populate("mediaId", "title contentType thumbnailUrl duration")
                        .sort({ startedAt: -1 })
                        .skip(skip)
                        .limit(limit),
                    playbackSession_model_1.PlaybackSession.countDocuments(query),
                ]);
                return {
                    sessions,
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit),
                };
            }
            catch (error) {
                logger_1.default.error("Error getting playback history:", error);
                throw error;
            }
        });
    }
    /**
     * Clean up stale sessions (sessions that haven't been updated in 30 minutes)
     */
    static cleanupStaleSessions() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
                const result = yield playbackSession_model_1.PlaybackSession.updateMany({
                    isActive: true,
                    lastProgressAt: { $lt: thirtyMinutesAgo },
                }, {
                    isActive: false,
                    isPaused: true,
                    endedAt: new Date(),
                });
                logger_1.default.info("Cleaned up stale playback sessions", {
                    count: result.modifiedCount,
                });
                return result.modifiedCount || 0;
            }
            catch (error) {
                logger_1.default.error("Error cleaning up stale sessions:", error);
                throw error;
            }
        });
    }
}
exports.PlaybackSessionService = PlaybackSessionService;
exports.default = PlaybackSessionService;
