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

      // Enforce viewCount >= likeCount (so client never sees likes > views)
      await this.songService.ensureViewCountInvariant(songId);

      // Get updated counts (viewCount may have been raised to likeCount)
      const song = await this.songService.getSongById(songId);
      const likeCount = song?.likeCount ?? 0;
      const viewCount = Math.max(song?.viewCount ?? 0, likeCount);

      return {
        liked: newLikedState,
        likeCount,
        shareCount: song?.shareCount ?? 0,
        viewCount,
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

      // Qualified play: count as view only if (durationMs >= 3000) OR (progressPct >= 25) OR (isComplete === true)
      const isQualified = durationMs >= 3000 || progressPct >= 25 || isComplete === true;

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

        await this.songService.ensureViewCountInvariant(songId);
        const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
        const viewCount = Math.max(updatedSong?.viewCount ?? 0, updatedSong?.likeCount ?? 0);
        return {
          viewCount,
          hasViewed: true,
          isNewView: false,
        };
      }

      // User hasn't viewed yet: only count if play is qualified
      if (!isQualified) {
        await this.songService.ensureViewCountInvariant(songId);
        const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
        return {
          viewCount: Math.max(currentSong?.viewCount ?? 0, currentSong?.likeCount ?? 0),
          hasViewed: false,
          isNewView: false,
        };
      }

      // User hasn't viewed and play is qualified → Create new view record and increment count
      // Use transaction when supported (replica set); otherwise fallback to non-transactional path
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

            const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").session(session).lean() as { viewCount?: number; likeCount?: number } | null;
            viewCount = Math.max(currentSong?.viewCount ?? 0, currentSong?.likeCount ?? 0);
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

        await this.songService.ensureViewCountInvariant(songId);
        const afterInvariant = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
        const normalized = Math.max(afterInvariant?.viewCount ?? 0, afterInvariant?.likeCount ?? 0);

        return {
          viewCount: normalized,
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

            await this.songService.ensureViewCountInvariant(songId);
            const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
            const normalized = Math.max(currentSong?.viewCount ?? 0, currentSong?.likeCount ?? 0);
            return {
              viewCount: normalized,
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

        // Transaction not supported (e.g. standalone MongoDB without replica set) → fallback
        if (this.isTransactionUnsupportedError(error)) {
          await session.endSession();
          logger.warn("Transactions not supported, using fallback for view recording", {
            userId,
            songId,
            message: error.message,
          });
          return this.recordViewWithoutTransaction(userIdObj, songIdObj, song, {
            durationMs,
            progressPct,
            isComplete,
          });
        }

        // Re-throw other transaction errors
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
      // Transaction failed before or after withTransaction (e.g. startSession failed)
      if (this.isTransactionUnsupportedError(error)) {
        logger.warn("Transactions not supported, using fallback for view recording", {
          userId,
          songId,
          message: error.message,
        });
        const userIdObj = new Types.ObjectId(userId);
        const songIdObj = new Types.ObjectId(songId);
        const song = await CopyrightFreeSong.findById(songIdObj);
        if (!song) throw new Error("Song not found");
        return this.recordViewWithoutTransaction(userIdObj, songIdObj, song, {
          durationMs,
          progressPct,
          isComplete,
        });
      }

      // Enhanced error logging for all other errors
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

      throw error;
    }
  }

  /**
   * True if the error indicates MongoDB transactions are not available (e.g. standalone without replica set).
   */
  private isTransactionUnsupportedError(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || "").toLowerCase();
    const code = error.code ?? error.codeName;
    return (
      code === 72 ||
      code === 251 ||
      code === "IllegalOperation" ||
      msg.includes("replica set") ||
      msg.includes("transaction numbers are only allowed") ||
      msg.includes("transaction is not supported")
    );
  }

  /**
   * Record a view without using MongoDB transactions (fallback for standalone deployments).
   * Uses findOneAndUpdate with condition hasViewed != true and handles duplicate key on race.
   */
  private async recordViewWithoutTransaction(
    userIdObj: Types.ObjectId,
    songIdObj: Types.ObjectId,
    song: { _id: Types.ObjectId },
    payload: { durationMs?: number; progressPct?: number; isComplete?: boolean }
  ): Promise<{ viewCount: number; hasViewed: boolean; isNewView: boolean }> {
    const { durationMs = 0, progressPct = 0, isComplete = false } = payload;
    const now = new Date();

    const existingInteraction = await CopyrightFreeSongInteraction.findOne({
      userId: userIdObj,
      songId: songIdObj,
    });

    if (existingInteraction?.hasViewed) {
      const maxDurationMs = Math.max(existingInteraction.durationMs || 0, durationMs || 0);
      const maxProgressPct = Math.max(existingInteraction.progressPct || 0, progressPct || 0);
      existingInteraction.durationMs = maxDurationMs;
      existingInteraction.progressPct = maxProgressPct;
      existingInteraction.isComplete = existingInteraction.isComplete || isComplete;
      existingInteraction.lastViewedAt = now;
      await existingInteraction.save();

      await this.songService.ensureViewCountInvariant(songIdObj.toString());
      const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
      const viewCount = Math.max(updatedSong?.viewCount ?? 0, updatedSong?.likeCount ?? 0);
      return {
        viewCount,
        hasViewed: true,
        isNewView: false,
      };
    }

    const maxDurationMs = Math.max(existingInteraction?.durationMs || 0, durationMs || 0);
    const maxProgressPct = Math.max(existingInteraction?.progressPct || 0, progressPct || 0);
    const updatedIsComplete = (existingInteraction?.isComplete || false) || isComplete;

    try {
      const oldDoc = await CopyrightFreeSongInteraction.findOneAndUpdate(
        { userId: userIdObj, songId: songIdObj, hasViewed: { $ne: true } },
        {
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
        },
        { upsert: true, new: false, runValidators: true }
      );

      await CopyrightFreeSong.findByIdAndUpdate(songIdObj, { $inc: { viewCount: 1 } });
      await this.songService.ensureViewCountInvariant(songIdObj.toString());
      const updatedSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
      const viewCount = Math.max(updatedSong?.viewCount ?? 0, updatedSong?.likeCount ?? 0);
      return {
        viewCount,
        hasViewed: true,
        isNewView: true,
      };
    } catch (err: any) {
      if (err.code === 11000 || (err.message && String(err.message).includes("duplicate"))) {
        const existingView = await CopyrightFreeSongInteraction.findOne({
          userId: userIdObj,
          songId: songIdObj,
        });
        if (existingView) {
          const maxD = Math.max(existingView.durationMs || 0, durationMs || 0);
          const maxP = Math.max(existingView.progressPct || 0, progressPct || 0);
          existingView.durationMs = maxD;
          existingView.progressPct = maxP;
          existingView.isComplete = existingView.isComplete || isComplete;
          existingView.lastViewedAt = now;
          await existingView.save();
        }
        await this.songService.ensureViewCountInvariant(songIdObj.toString());
        const currentSong = await CopyrightFreeSong.findById(songIdObj).select("viewCount likeCount").lean() as { viewCount?: number; likeCount?: number } | null;
        const viewCount = Math.max(currentSong?.viewCount ?? 0, currentSong?.likeCount ?? 0);
        return {
          viewCount,
          hasViewed: true,
          isNewView: false,
        };
      }
      throw err;
    }
  }
}

