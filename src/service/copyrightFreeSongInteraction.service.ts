import { Types } from "mongoose";
import { CopyrightFreeSongInteraction } from "../models/copyrightFreeSongInteraction.model";
import { CopyrightFreeSongService } from "./copyrightFreeSong.service";
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
  ): Promise<{ liked: boolean; likeCount: number; shareCount: number }> {
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
      };
    } catch (error: any) {
      logger.error("Error toggling like:", error);
      throw error;
    }
  }

  async shareSong(
    userId: string,
    songId: string
  ): Promise<{ shareCount: number; likeCount: number }> {
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
        };
      }

      // Increment share count
      await this.songService.incrementShareCount(songId);

      // Get updated counts
      const song = await this.songService.getSongById(songId);

      return {
        shareCount: song?.shareCount || 0,
        likeCount: song?.likeCount || 0,
      };
    } catch (error: any) {
      logger.error("Error sharing song:", error);
      throw error;
    }
  }
}

