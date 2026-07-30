import { Types } from "mongoose";
import { CopyrightFreeSongInteraction } from "../../../models/copyrightFreeSongInteraction.model";
import logger from "../../../utils/logger";
import type { CopyrightFreeSongInteractionDeps } from "./deps";

export async function isLiked(userId: string, songId: string): Promise<boolean> {
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

export async function toggleLike(
  deps: CopyrightFreeSongInteractionDeps,
  userId: string,
  songId: string
): Promise<{ liked: boolean; likeCount: number; shareCount: number; viewCount: number }> {
  try {
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

    if (newLikedState) {
      await deps.songService.incrementLikeCount(songId);
    } else {
      await deps.songService.decrementLikeCount(songId);
    }

    await deps.songService.ensureViewCountInvariant(songId);

    const song = await deps.songService.getSongByIdAdmin(songId);
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
