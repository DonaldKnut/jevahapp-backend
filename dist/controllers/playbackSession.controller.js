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
exports.getPlaybackHistory = exports.getActivePlayback = exports.endPlayback = exports.resumePlayback = exports.pausePlayback = exports.updateProgress = exports.startPlayback = void 0;
const playbackSession_service_1 = __importDefault(require("../service/playbackSession.service"));
const response_util_1 = __importDefault(require("../utils/response.util"));
const validation_util_1 = __importDefault(require("../utils/validation.util"));
const controller_util_1 = __importDefault(require("../utils/controller.util"));
const media_model_1 = require("../models/media.model");
/**
 * Start playback session
 * Automatically pauses any existing active session
 */
const startPlayback = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = controller_util_1.default.getUserId(request, response);
        if (!userId)
            return;
        const mediaId = controller_util_1.default.validateAndConvertObjectId(response, request.params.id || request.body.mediaId, "Media ID");
        if (!mediaId)
            return;
        const { duration, position, deviceInfo } = request.body;
        // Validate duration
        if (!validation_util_1.default.validateNumberRange(response, duration, "Duration", 1)) {
            return;
        }
        // Get media to verify it exists and get default duration
        const media = yield media_model_1.Media.findById(mediaId);
        if (!media) {
            response_util_1.default.notFound(response, "Media not found");
            return;
        }
        const mediaDuration = duration || media.duration || 0;
        // Start playback session
        const result = yield playbackSession_service_1.default.startPlayback({
            userId,
            mediaId: mediaId.toString(),
            duration: mediaDuration,
            position,
            deviceInfo: deviceInfo || request.headers["user-agent"],
            userAgent: request.headers["user-agent"],
        });
        response_util_1.default.success(response, {
            session: result.session,
            previousSessionPaused: result.previousSessionPaused ? {
                sessionId: result.previousSessionPaused._id,
                mediaId: result.previousSessionPaused.mediaId,
                position: result.previousSessionPaused.currentPosition,
            } : undefined,
            resumeFrom: result.session.currentPosition > 0 ? result.session.currentPosition : undefined,
        }, "Playback started successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to start playback");
    }
});
exports.startPlayback = startPlayback;
/**
 * Update playback progress
 */
const updateProgress = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = controller_util_1.default.getUserId(request, response);
        if (!userId)
            return;
        const { sessionId, position, duration, progressPercentage } = request.body;
        // Validate fields
        if (!validation_util_1.default.validateRequired(response, sessionId, "Session ID"))
            return;
        if (!validation_util_1.default.validateNumberRange(response, position, "Position", 0))
            return;
        if (!validation_util_1.default.validateNumberRange(response, duration, "Duration", 1))
            return;
        if (!validation_util_1.default.validateNumberRange(response, progressPercentage, "Progress Percentage", 0, 100))
            return;
        // Update progress
        const session = yield playbackSession_service_1.default.updateProgress({
            sessionId,
            position,
            duration,
            progressPercentage,
        });
        response_util_1.default.success(response, {
            session,
            position: session.currentPosition,
            progressPercentage: session.progressPercentage,
        }, "Progress updated successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to update progress");
    }
});
exports.updateProgress = updateProgress;
/**
 * Pause playback
 */
const pausePlayback = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = controller_util_1.default.getUserId(request, response);
        if (!userId)
            return;
        const { sessionId } = request.body;
        if (!validation_util_1.default.validateRequired(response, sessionId, "Session ID"))
            return;
        const session = yield playbackSession_service_1.default.pausePlayback(sessionId);
        response_util_1.default.success(response, {
            session,
            position: session.currentPosition,
        }, "Playback paused successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to pause playback");
    }
});
exports.pausePlayback = pausePlayback;
/**
 * Resume playback
 */
const resumePlayback = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = controller_util_1.default.getUserId(request, response);
        if (!userId)
            return;
        const { sessionId } = request.body;
        if (!validation_util_1.default.validateRequired(response, sessionId, "Session ID"))
            return;
        const session = yield playbackSession_service_1.default.resumePlayback(sessionId);
        response_util_1.default.success(response, {
            session,
            position: session.currentPosition,
        }, "Playback resumed successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to resume playback");
    }
});
exports.resumePlayback = resumePlayback;
/**
 * End playback session
 */
const endPlayback = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = controller_util_1.default.getUserId(request, response);
        if (!userId)
            return;
        const { sessionId, reason, finalPosition } = request.body;
        if (!validation_util_1.default.validateRequired(response, sessionId, "Session ID"))
            return;
        const result = yield playbackSession_service_1.default.endPlayback(sessionId, {
            reason: reason || "stopped",
            finalPosition,
        });
        response_util_1.default.success(response, {
            session: result.session,
            viewRecorded: result.viewRecorded,
        }, "Playback ended successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to end playback");
    }
});
exports.endPlayback = endPlayback;
/**
 * Get active playback session
 */
const getActivePlayback = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = controller_util_1.default.getUserId(request, response);
        if (!userId)
            return;
        const session = yield playbackSession_service_1.default.getActiveSession(userId);
        if (!session) {
            response_util_1.default.success(response, { session: null }, "No active playback session");
            return;
        }
        response_util_1.default.success(response, {
            session: {
                sessionId: session._id,
                mediaId: session.mediaId,
                media: session.mediaId, // Populated
                position: session.currentPosition,
                duration: session.duration,
                progressPercentage: session.progressPercentage,
                isPaused: session.isPaused,
                startedAt: session.startedAt,
                totalWatchTime: session.totalWatchTime,
            },
        }, "Active playback session retrieved successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to get active playback");
    }
});
exports.getActivePlayback = getActivePlayback;
/**
 * Get playback history
 */
const getPlaybackHistory = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = controller_util_1.default.getUserId(request, response);
        if (!userId)
            return;
        const { page, limit } = controller_util_1.default.getPagination(request);
        const includeInactive = request.query.includeInactive !== "false";
        const result = yield playbackSession_service_1.default.getPlaybackHistory(userId, {
            page,
            limit,
            includeInactive,
        });
        response_util_1.default.paginated(response, result.sessions, {
            page: result.page,
            limit: result.limit,
            total: result.total,
        }, "Playback history retrieved successfully");
    }
    catch (error) {
        controller_util_1.default.handleServiceError(response, error, "Failed to get playback history");
    }
});
exports.getPlaybackHistory = getPlaybackHistory;
