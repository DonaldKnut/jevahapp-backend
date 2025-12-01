import { Request, Response } from "express";
import { Types } from "mongoose";
import PlaybackSessionService, {
  StartPlaybackData,
  UpdateProgressData,
} from "../service/playbackSession.service";
import ResponseUtil from "../utils/response.util";
import ValidationUtil from "../utils/validation.util";
import ControllerUtil from "../utils/controller.util";
import { Media } from "../models/media.model";
import logger from "../utils/logger";

/**
 * Start playback session
 * Automatically pauses any existing active session
 */
export const startPlayback = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = ControllerUtil.getUserId(request, response);
    if (!userId) return;

    const mediaId = ControllerUtil.validateAndConvertObjectId(
      response,
      request.params.id || request.body.mediaId,
      "Media ID"
    );
    if (!mediaId) return;

    const { duration, position, deviceInfo } = request.body;

    // Validate duration
    if (!ValidationUtil.validateNumberRange(response, duration, "Duration", 1)) {
      return;
    }

    // Get media to verify it exists and get default duration
    const media = await Media.findById(mediaId);
    if (!media) {
      ResponseUtil.notFound(response, "Media not found");
      return;
    }

    const mediaDuration = duration || media.duration || 0;

    // Start playback session
    const result = await PlaybackSessionService.startPlayback({
      userId,
      mediaId: mediaId.toString(),
      duration: mediaDuration,
      position,
      deviceInfo: deviceInfo || request.headers["user-agent"],
      userAgent: request.headers["user-agent"],
    });

    ResponseUtil.success(
      response,
      {
        session: result.session,
        previousSessionPaused: result.previousSessionPaused ? {
          sessionId: result.previousSessionPaused._id,
          mediaId: result.previousSessionPaused.mediaId,
          position: result.previousSessionPaused.currentPosition,
        } : undefined,
        resumeFrom: result.session.currentPosition > 0 ? result.session.currentPosition : undefined,
      },
      "Playback started successfully"
    );
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to start playback");
  }
};

/**
 * Update playback progress
 */
export const updateProgress = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = ControllerUtil.getUserId(request, response);
    if (!userId) return;

    const { sessionId, position, duration, progressPercentage } = request.body;

    // Validate fields
    if (!ValidationUtil.validateRequired(response, sessionId, "Session ID")) return;
    if (!ValidationUtil.validateNumberRange(response, position, "Position", 0)) return;
    if (!ValidationUtil.validateNumberRange(response, duration, "Duration", 1)) return;
    if (!ValidationUtil.validateNumberRange(response, progressPercentage, "Progress Percentage", 0, 100)) return;

    // Update progress
    const session = await PlaybackSessionService.updateProgress({
      sessionId,
      position,
      duration,
      progressPercentage,
    });

    ResponseUtil.success(
      response,
      {
        session,
        position: session.currentPosition,
        progressPercentage: session.progressPercentage,
      },
      "Progress updated successfully"
    );
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to update progress");
  }
};

/**
 * Pause playback
 */
export const pausePlayback = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = ControllerUtil.getUserId(request, response);
    if (!userId) return;

    const { sessionId } = request.body;

    if (!ValidationUtil.validateRequired(response, sessionId, "Session ID")) return;

    const session = await PlaybackSessionService.pausePlayback(sessionId);

    ResponseUtil.success(
      response,
      {
        session,
        position: session.currentPosition,
      },
      "Playback paused successfully"
    );
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to pause playback");
  }
};

/**
 * Resume playback
 */
export const resumePlayback = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = ControllerUtil.getUserId(request, response);
    if (!userId) return;

    const { sessionId } = request.body;

    if (!ValidationUtil.validateRequired(response, sessionId, "Session ID")) return;

    const session = await PlaybackSessionService.resumePlayback(sessionId);

    ResponseUtil.success(
      response,
      {
        session,
        position: session.currentPosition,
      },
      "Playback resumed successfully"
    );
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to resume playback");
  }
};

/**
 * End playback session
 */
export const endPlayback = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = ControllerUtil.getUserId(request, response);
    if (!userId) return;

    const { sessionId, reason, finalPosition } = request.body;

    if (!ValidationUtil.validateRequired(response, sessionId, "Session ID")) return;

    const result = await PlaybackSessionService.endPlayback(sessionId, {
      reason: reason || "stopped",
      finalPosition,
    });

    ResponseUtil.success(
      response,
      {
        session: result.session,
        viewRecorded: result.viewRecorded,
      },
      "Playback ended successfully"
    );
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to end playback");
  }
};

/**
 * Get active playback session
 */
export const getActivePlayback = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = ControllerUtil.getUserId(request, response);
    if (!userId) return;

    const session = await PlaybackSessionService.getActiveSession(userId);

    if (!session) {
      ResponseUtil.success(
        response,
        { session: null },
        "No active playback session"
      );
      return;
    }

    ResponseUtil.success(
      response,
      {
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
      },
      "Active playback session retrieved successfully"
    );
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to get active playback");
  }
};

/**
 * Get playback history
 */
export const getPlaybackHistory = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = ControllerUtil.getUserId(request, response);
    if (!userId) return;

    const { page, limit } = ControllerUtil.getPagination(request);
    const includeInactive = request.query.includeInactive !== "false";

    const result = await PlaybackSessionService.getPlaybackHistory(userId, {
      page,
      limit,
      includeInactive,
    });

    ResponseUtil.paginated(
      response,
      result.sessions,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
      "Playback history retrieved successfully"
    );
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to get playback history");
  }
};


