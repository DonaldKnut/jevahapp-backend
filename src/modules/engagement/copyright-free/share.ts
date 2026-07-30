import { Types } from "mongoose";
import { CopyrightFreeSongInteraction } from "../../../models/copyrightFreeSongInteraction.model";
import logger from "../../../utils/logger";
import type { CopyrightFreeSongInteractionDeps } from "./deps";

export async function shareSong(
  deps: CopyrightFreeSongInteractionDeps,
  userId: string,
  songId: string
): Promise<{ shareCount: number; likeCount: number; viewCount: number }> {
  try {
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
      const song = await deps.songService.getSongByIdAdmin(songId);
      return {
        shareCount: song?.shareCount || 0,
        likeCount: song?.likeCount || 0,
        viewCount: song?.viewCount || 0,
      };
    }

    await deps.songService.incrementShareCount(songId);

    const song = await deps.songService.getSongByIdAdmin(songId);

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
