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

    // Validate song exists
    const song = await CopyrightFreeSong.findById(songId);
    if (!song) {
      throw new Error("Song not found");
    }

    const userIdObj = new Types.ObjectId(userId);
    const songIdObj = new Types.ObjectId(songId);
    const now = new Date();

    // Check if user already viewed this song
    let viewRecord = await CopyrightFreeSongInteraction.findOne({
      userId: userIdObj,
      songId: songIdObj,
    });

    if (viewRecord && viewRecord.hasViewed) {
      // User already viewed → Update engagement metrics but DON'T increment count
      viewRecord.durationMs = Math.max(viewRecord.durationMs || 0, durationMs || 0);
      viewRecord.progressPct = Math.max(viewRecord.progressPct || 0, progressPct || 0);
      viewRecord.isComplete = viewRecord.isComplete || isComplete;
      viewRecord.lastViewedAt = now;
      await viewRecord.save();

      // Return current count (NOT incremented)
      const updatedSong = await CopyrightFreeSong.findById(songId).select("viewCount").lean() as { viewCount?: number } | null;
      return {
        viewCount: (updatedSong?.viewCount as number) || 0,
        hasViewed: true,
        isNewView: false,
      };
    }

    // User hasn't viewed → Create new view record and increment count
    // Use transaction to ensure atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check again within transaction (double-check pattern)
      const existingView = await CopyrightFreeSongInteraction.findOne(
        {
          userId: userIdObj,
          songId: songIdObj,
          hasViewed: true,
        },
        null,
        { session }
      );

      if (existingView) {
        // Another request already created the view record
        await session.abortTransaction();
        
        // Update engagement metrics
        existingView.durationMs = Math.max(existingView.durationMs || 0, durationMs || 0);
        existingView.progressPct = Math.max(existingView.progressPct || 0, progressPct || 0);
        existingView.isComplete = existingView.isComplete || isComplete;
        existingView.lastViewedAt = now;
        await existingView.save();

        const currentSong = await CopyrightFreeSong.findById(songId).select("viewCount").lean() as { viewCount?: number } | null;
        return {
          viewCount: (currentSong?.viewCount as number) || 0,
          hasViewed: true,
          isNewView: false,
        };
      }

      // Check if interaction exists before creating/updating
      const existingInteraction = await CopyrightFreeSongInteraction.findOne(
        { userId: userIdObj, songId: songIdObj },
        null,
        { session }
      );

      const isNewView = !existingInteraction || !existingInteraction.hasViewed;

      // Create or update interaction record with view data
      const updateData: any = {
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
        updateData.$set = {
          ...updateData.$set,
          isComplete: existingInteraction.isComplete || isComplete,
        };
      } else {
        // For new records, set isComplete in $setOnInsert
        updateData.$setOnInsert.isComplete = isComplete || false;
      }

      const interaction = await CopyrightFreeSongInteraction.findOneAndUpdate(
        { userId: userIdObj, songId: songIdObj },
        updateData,
        {
          upsert: true,
          new: true,
          session,
        }
      );

      if (isNewView) {
        // Increment view count only for new views
        await CopyrightFreeSong.findByIdAndUpdate(
          songId,
          { $inc: { viewCount: 1 } },
          { session }
        );
      }

      await session.commitTransaction();

      // Get updated song with new view count
      const updatedSong = await CopyrightFreeSong.findById(songId).select("viewCount").lean() as { viewCount?: number } | null;

      return {
        viewCount: (updatedSong?.viewCount as number) || 0,
        hasViewed: true,
        isNewView: isNewView,
      };
    } catch (error: any) {
      await session.abortTransaction();

      // Handle duplicate key error (race condition)
      if (error.code === 11000 || error.message.includes("duplicate")) {
        // Another request already created the view record
        // Fetch the existing record and return current count
        const existingView = await CopyrightFreeSongInteraction.findOne({
          userId: userIdObj,
          songId: songIdObj,
        });

        if (existingView) {
          // Update engagement metrics
          existingView.durationMs = Math.max(existingView.durationMs || 0, durationMs || 0);
          existingView.progressPct = Math.max(existingView.progressPct || 0, progressPct || 0);
          existingView.isComplete = existingView.isComplete || isComplete;
          existingView.lastViewedAt = now;
          await existingView.save();
        }

        const currentSong = await CopyrightFreeSong.findById(songId).select("viewCount").lean() as { viewCount?: number } | null;
        return {
          viewCount: (currentSong?.viewCount as number) || 0,
          hasViewed: true,
          isNewView: false,
        };
      }

      logger.error("Error recording view:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

