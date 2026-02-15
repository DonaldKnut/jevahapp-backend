import { Types } from "mongoose";
import { PlaybackSession } from "../models/playbackSession.model";
import { Media } from "../models/media.model";
import { Library } from "../models/library.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import logger from "../utils/logger";

export interface StartPlaybackData {
  userId: string;
  mediaId: string;
  duration: number;
  position?: number; // Resume position
  deviceInfo?: string;
  userAgent?: string;
}

export interface UpdateProgressData {
  sessionId: string;
  position: number;
  duration: number;
  progressPercentage: number;
}

export class PlaybackSessionService {
  /**
   * Start a new playback session
   * Automatically pauses any existing active session for the user
   */
  static async startPlayback(data: StartPlaybackData): Promise<{
    session: any;
    previousSessionPaused?: any;
  }> {
    try {
      const { userId, mediaId, duration, position = 0, deviceInfo, userAgent } = data;

      // Verify media exists
      const media = await Media.findById(mediaId);
      if (!media) {
        throw new Error("Media not found");
      }

      // Pause any existing active session for this user
      const previousSession = await PlaybackSession.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          isActive: true,
        },
        {
          isActive: false,
          isPaused: true,
          pausedAt: new Date(),
          endedAt: new Date(),
        },
        { new: true }
      );

      // Get or create library entry for progress storage
      const libraryEntry = await Library.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          mediaId: new Types.ObjectId(mediaId),
          mediaType: "media",
        },
        {
          $setOnInsert: {
            userId: new Types.ObjectId(userId),
            mediaId: new Types.ObjectId(mediaId),
            mediaType: "media" as const,
            addedAt: new Date(),
            isFavorite: false,
          },
        },
        { upsert: true, new: true }
      );

      // Resume from last position if available
      const resumePosition = position || libraryEntry.watchProgress || 0;
      const progressPercentage = duration > 0 
        ? Math.min(100, Math.round((resumePosition / duration) * 100))
        : 0;

      // Create new active session
      const session = await PlaybackSession.create({
        userId: new Types.ObjectId(userId),
        mediaId: new Types.ObjectId(mediaId),
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

      logger.info("Playback session started", {
        sessionId: session._id,
        userId,
        mediaId,
        previousSessionId: previousSession?._id,
      });

      return {
        session,
        previousSessionPaused: previousSession || undefined,
      };
    } catch (error: any) {
      logger.error("Error starting playback session:", error);
      throw error;
    }
  }

  /**
   * Update playback progress
   */
  static async updateProgress(data: UpdateProgressData): Promise<any> {
    try {
      const { sessionId, position, duration, progressPercentage } = data;

      const session = await PlaybackSession.findById(sessionId);
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
      const updatedSession = await PlaybackSession.findByIdAndUpdate(
        sessionId,
        {
          currentPosition: position,
          duration,
          progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
          lastProgressAt: new Date(),
          totalWatchTime: newTotalWatchTime,
        },
        { new: true }
      );

      // Update library progress for resume functionality
      await Library.findOneAndUpdate(
        {
          userId: session.userId,
          mediaId: session.mediaId,
          mediaType: "media",
        },
        {
          watchProgress: position,
          completionPercentage: progressPercentage,
          lastWatched: new Date(),
        },
        { upsert: true }
      );

      return updatedSession;
    } catch (error: any) {
      logger.error("Error updating playback progress:", error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  static async pausePlayback(sessionId: string): Promise<any> {
    try {
      const session = await PlaybackSession.findById(sessionId);
      if (!session) {
        throw new Error("Playback session not found");
      }

      if (!session.isActive) {
        throw new Error("Playback session is not active");
      }

      const updatedSession = await PlaybackSession.findByIdAndUpdate(
        sessionId,
        {
          isPaused: true,
          pausedAt: new Date(),
          lastProgressAt: new Date(),
        },
        { new: true }
      );

      // Update library progress
      await Library.findOneAndUpdate(
        {
          userId: session.userId,
          mediaId: session.mediaId,
          mediaType: "media",
        },
        {
          watchProgress: session.currentPosition,
          completionPercentage: session.progressPercentage,
          lastWatched: new Date(),
        }
      );

      logger.info("Playback paused", { sessionId, userId: session.userId.toString() });

      return updatedSession;
    } catch (error: any) {
      logger.error("Error pausing playback:", error);
      throw error;
    }
  }

  /**
   * Resume playback
   */
  static async resumePlayback(sessionId: string): Promise<any> {
    try {
      const session = await PlaybackSession.findById(sessionId);
      if (!session) {
        throw new Error("Playback session not found");
      }

      const updatedSession = await PlaybackSession.findByIdAndUpdate(
        sessionId,
        {
          isPaused: false,
          pausedAt: undefined,
          lastProgressAt: new Date(),
        },
        { new: true }
      );

      logger.info("Playback resumed", { sessionId, userId: session.userId.toString() });

      return updatedSession;
    } catch (error: any) {
      logger.error("Error resuming playback:", error);
      throw error;
    }
  }

  /**
   * End playback session
   */
  static async endPlayback(
    sessionId: string,
    options: {
      reason?: "completed" | "stopped" | "error";
      finalPosition?: number;
    } = {}
  ): Promise<{
    session: any;
    viewRecorded: boolean;
  }> {
    try {
      const { reason = "stopped", finalPosition } = options;

      const session = await PlaybackSession.findById(sessionId);
      if (!session) {
        throw new Error("Playback session not found");
      }

      const endPosition = finalPosition !== undefined ? finalPosition : session.currentPosition;
      const finalProgressPercentage = session.duration > 0
        ? Math.min(100, Math.round((endPosition / session.duration) * 100))
        : session.progressPercentage;

      // Mark session as inactive
      const updatedSession = await PlaybackSession.findByIdAndUpdate(
        sessionId,
        {
          isActive: false,
          isPaused: false,
          currentPosition: endPosition,
          progressPercentage: finalProgressPercentage,
          endedAt: new Date(),
          lastProgressAt: new Date(),
        },
        { new: true }
      );

      // Update library progress
      await Library.findOneAndUpdate(
        {
          userId: session.userId,
          mediaId: session.mediaId,
          mediaType: "media",
        },
        {
          watchProgress: endPosition,
          completionPercentage: finalProgressPercentage,
          lastWatched: new Date(),
        },
        { upsert: true }
      );

      // Get media to determine interaction type
      const media = await Media.findById(session.mediaId);
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
        await MediaInteraction.findOneAndUpdate(
          {
            user: session.userId,
            media: session.mediaId,
            interactionType: interactionType,
          },
          {
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
          },
          { upsert: true }
        );

        // Increment appropriate count on media
        const updateField = isAudioContent 
          ? { listenCount: 1 } 
          : { viewCount: 1 };
        
        await Media.findByIdAndUpdate(session.mediaId, {
          $inc: updateField,
        });

        viewRecorded = true;
      }

      logger.info("Playback ended", {
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
    } catch (error: any) {
      logger.error("Error ending playback:", error);
      throw error;
    }
  }

  /**
   * Get active playback session for user
   */
  static async getActiveSession(userId: string): Promise<any | null> {
    try {
      const session = await PlaybackSession.findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
      })
        .populate("mediaId", "title contentType thumbnailUrl duration")
        .sort({ startedAt: -1 });

      return session;
    } catch (error: any) {
      logger.error("Error getting active session:", error);
      throw error;
    }
  }

  /**
   * Get playback history for user
   */
  static async getPlaybackHistory(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      includeInactive?: boolean;
    } = {}
  ): Promise<{
    sessions: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    try {
      const { page = 1, limit = 20, includeInactive = true } = options;
      const skip = (page - 1) * limit;

      const query: any = {
        userId: new Types.ObjectId(userId),
      };

      if (!includeInactive) {
        query.isActive = true;
      }

      const [sessions, total] = await Promise.all([
        PlaybackSession.find(query)
          .populate("mediaId", "title contentType thumbnailUrl duration")
          .sort({ startedAt: -1 })
          .skip(skip)
          .limit(limit),
        PlaybackSession.countDocuments(query),
      ]);

      return {
        sessions,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error("Error getting playback history:", error);
      throw error;
    }
  }

  /**
   * Clean up stale sessions (sessions that haven't been updated in 30 minutes)
   */
  static async cleanupStaleSessions(): Promise<number> {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      const result = await PlaybackSession.updateMany(
        {
          isActive: true,
          lastProgressAt: { $lt: thirtyMinutesAgo },
        },
        {
          isActive: false,
          isPaused: true,
          endedAt: new Date(),
        }
      );

      logger.info("Cleaned up stale playback sessions", {
        count: result.modifiedCount,
      });

      return result.modifiedCount || 0;
    } catch (error: any) {
      logger.error("Error cleaning up stale sessions:", error);
      throw error;
    }
  }
}

export default PlaybackSessionService;

