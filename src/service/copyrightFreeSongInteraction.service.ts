import { Types } from "mongoose";
import mongoose from "mongoose";
import { CopyrightFreeSongInteraction } from "../models/copyrightFreeSongInteraction.model";
import { CopyrightFreeSongService } from "./copyrightFreeSong.service";
import { CopyrightFreeSong } from "../models/copyrightFreeSong.model";
import logger from "../utils/logger";

export class CopyrightFreeSongInteractionService {
  private songService: CopyrightFreeSongService;

  constructor() {
    this.songService = new CopyrightFreeSongService();
  }

  async isLiked(userId: string, songId: string): Promise<boolean> {
    try {
      const interaction = await CopyrightFreeSongInteraction.findOne({
        userId: new Types.ObjectId(userId),
        songId: new Types.ObjectId(songId),
      });

      return interaction?.hasLiked || false;
    } catch (error: any) {
      logger.error("Error checking if liked:", error);
      return false;
    }
  }

  async toggleLike(
    userId: string,
    songId: string
  ): Promise<{ liked: boolean; likeCount: number; shareCount: number; viewCount: number }> {
    try {
      // Get or create interaction
      let interaction = await CopyrightFreeSongInteraction.findOne({
        userId: new Types.ObjectId(userId),
        songId: new Types.ObjectId(songId),
      });

      const wasLiked = interaction?.hasLiked || false;
      const newLikedState = !wasLiked;

      if (!interaction) {
        interaction = await CopyrightFreeSongInteraction.create({
          userId: new Types.ObjectId(userId),
          songId: new Types.ObjectId(songId),
          hasLiked: newLikedState,
          hasShared: false,
        });
      } else {
        interaction.hasLiked = newLikedState;
        await interaction.save();
      }

      // Update song counts
      if (newLikedState) {
        await this.songService.incrementLikeCount(songId);
      } else {
        await this.songService.decrementLikeCount(songId);
      }

      // Get updated counts
      const song = await this.songService.getSongById(songId);

      return {
        liked: newLikedState,
        likeCount: song?.likeCount || 0,
        shareCount: song?.shareCount || 0,
        viewCount: song?.viewCount || 0,
      };
    } catch (error: any) {
      logger.error("Error toggling like:", error);
      throw error;
    }
  }

  async shareSong(
    userId: string,
    songId: string
  ): Promise<{ shareCount: number; likeCount: number; viewCount: number }> {
    try {
      // Get or create interaction
      let interaction = await CopyrightFreeSongInteraction.findOne({
        userId: new Types.ObjectId(userId),
        songId: new Types.ObjectId(songId),
      });

      if (!interaction) {
        interaction = await CopyrightFreeSongInteraction.create({
          userId: new Types.ObjectId(userId),
          songId: new Types.ObjectId(songId),
          hasLiked: false,
          hasShared: true,
        });
      } else if (!interaction.hasShared) {
        interaction.hasShared = true;
        await interaction.save();
      } else {
        // Already shared, don't increment again
        const song = await this.songService.getSongById(songId);
        return {
          shareCount: song?.shareCount || 0,
          likeCount: song?.likeCount || 0,
          viewCount: song?.viewCount || 0,
        };
      }

      // Increment share count
      await this.songService.incrementShareCount(songId);

      // Get updated counts
      const song = await this.songService.getSongById(songId);

      return {
        shareCount: song?.shareCount || 0,
        likeCount: song?.likeCount || 0,
        viewCount: song?.viewCount || 0,
      };
    } catch (error: any) {
      logger.error("Error sharing song:", error);
      throw error;
    }
  }

  async getInteraction(userId: string, songId: string) {
    try {
      const interaction = await CopyrightFreeSongInteraction.findOne({
        userId: new Types.ObjectId(userId),
        songId: new Types.ObjectId(songId),
      });
      return interaction;
    } catch (error: any) {
      logger.error("Error getting interaction:", error);
      return null;
    }
  }

  async markAsViewed(userId: string, songId: string): Promise<void> {
    try {
      let interaction = await CopyrightFreeSongInteraction.findOne({
        userId: new Types.ObjectId(userId),
        songId: new Types.ObjectId(songId),
      });

      if (!interaction) {
        await CopyrightFreeSongInteraction.create({
          userId: new Types.ObjectId(userId),
          songId: new Types.ObjectId(songId),
          hasLiked: false,
          hasShared: false,
          hasViewed: true,
        });
      } else {
        interaction.hasViewed = true;
        await interaction.save();
      }
    } catch (error: any) {
      logger.error("Error marking as viewed:", error);
      throw error;
    }
  }

  /**
   * Record a view for a copyright-free song with engagement metrics
   * Implements one view per user per song with proper deduplication
   * @param userId - The authenticated user ID
   * @param songId - The song ID
   * @param payload - View engagement data (durationMs, progressPct, isComplete)
   * @returns View count and hasViewed status
   */
  async recordView(
    userId: string,
    songId: string,
    payload: {
      durationMs?: number;
      progressPct?: number;
      isComplete?: boolean;
    } = {}
  ): Promise<{ viewCount: number; hasViewed: boolean; isNewView: boolean }> {
    const { durationMs = 0, progressPct = 0, isComplete = false } = payload;

    try {
      // Validate userId and songId are valid ObjectIds
      if (!Types.ObjectId.isValid(userId)) {
        throw new Error(`Invalid userId format: ${userId}`);
      }
      if (!Types.ObjectId.isValid(songId)) {
        throw new Error(`Invalid songId format: ${songId}`);
      }

      const userIdObj = new Types.ObjectId(userId);
      const songIdObj = new Types.ObjectId(songId);

      // Validate song exists
      const song = await CopyrightFreeSong.findById(songIdObj);
      if (!song) {
        throw new Error("Song not found");
      }

      const now = new Date();

      // Check if user already viewed this song (outside transaction for early return)
      const existingInteraction = await CopyrightFreeSongInteraction.findOne({
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
        await existingInteraction.save();

        // Return current count (NOT incremented)
        const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount").lean() as { viewCount?: number } | null;
        return {
          viewCount: (updatedSong?.viewCount as number) || 0,
          hasViewed: true,
          isNewView: false,
        };
      }

      // User hasn't viewed → Create new view record and increment count
      // Use transaction to ensure atomicity
      const session = await mongoose.startSession();

      try {
        let isNewView = false;
        let viewCount = 0;

        await session.withTransaction(async () => {
          // Double-check within transaction (race condition protection)
          const existingViewInTx = await CopyrightFreeSongInteraction.findOne(
            {
              userId: userIdObj,
              songId: songIdObj,
              hasViewed: true,
            },
            null,
            { session }
          );

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
            await existingViewInTx.save({ session });

            const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount").session(session).lean() as { viewCount?: number } | null;
            viewCount = (currentSong?.viewCount as number) || 0;
            isNewView = false;
            return; // Exit transaction early
          }

          // Check if interaction exists (without hasViewed requirement)
          const interactionInTx = await CopyrightFreeSongInteraction.findOne(
            { userId: userIdObj, songId: songIdObj },
            null,
            { session }
          );

          isNewView = !interactionInTx || !interactionInTx.hasViewed;

          // Calculate max values for update
          const currentDurationMs = interactionInTx?.durationMs || 0;
          const currentProgressPct = interactionInTx?.progressPct || 0;
          const maxDurationMs = Math.max(currentDurationMs, durationMs || 0);
          const maxProgressPct = Math.max(currentProgressPct, progressPct || 0);
          const updatedIsComplete = (interactionInTx?.isComplete || false) || isComplete;

          // Create or update interaction record with view data
          // Use $set with calculated max values (no $max operator to avoid conflicts)
          const updateData: any = {
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

          const interaction = await CopyrightFreeSongInteraction.findOneAndUpdate(
            { userId: userIdObj, songId: songIdObj },
            updateData,
            {
              upsert: true,
              new: true,
              session,
              runValidators: true,
            }
          );

          if (isNewView) {
            // Increment view count only for new views
            await CopyrightFreeSong.findByIdAndUpdate(
              songIdObj,
              { $inc: { viewCount: 1 } },
              { session }
            );
          }

          // Get updated song with new view count
          const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount").session(session).lean() as { viewCount?: number } | null;
          viewCount = (updatedSong?.viewCount as number) || 0;
        });

        return {
          viewCount,
          hasViewed: true,
          isNewView,
        };
      } catch (error: any) {
        // Handle duplicate key error (race condition)
        if (error.code === 11000 || (error.message && error.message.includes("duplicate"))) {
          // Another request already created the view record
          // Fetch the existing record and return current count
          try {
            const existingView = await CopyrightFreeSongInteraction.findOne({
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
              await existingView.save();
            }

            const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount").lean() as { viewCount?: number } | null;
            return {
              viewCount: (currentSong?.viewCount as number) || 0,
              hasViewed: true,
              isNewView: false,
            };
          } catch (recoveryError: any) {
            logger.error("Error during duplicate key recovery:", {
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
        logger.error("Error in transaction while recording view:", {
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
      } finally {
        await session.endSession();
      }
    } catch (error: any) {
      // Enhanced error logging with all relevant details
      logger.error("Error recording view:", {
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
  }
}

