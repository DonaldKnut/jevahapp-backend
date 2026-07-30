import { Types } from "mongoose";
import { CopyrightFreeSong } from "../../../models/copyrightFreeSong.model";
import { CopyrightFreeSongInteraction } from "../../../models/copyrightFreeSongInteraction.model";
import logger from "../../../utils/logger";
import type { CopyrightFreeSongInteractionDeps } from "./deps";

export async function getInteraction(userId: string, songId: string) {
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

export async function markAsViewed(userId: string, songId: string): Promise<void> {
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
        hasSaved: false,
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

export async function isSaved(userId: string, songId: string): Promise<boolean> {
  try {
    const interaction = await CopyrightFreeSongInteraction.findOne({
      userId: new Types.ObjectId(userId),
      songId: new Types.ObjectId(songId),
    });

    return interaction?.hasSaved || false;
  } catch (error: any) {
    logger.error("Error checking if saved:", error);
    return false;
  }
}

export async function toggleSave(
  deps: CopyrightFreeSongInteractionDeps,
  userId: string,
  songId: string
): Promise<{ saved: boolean; saveCount: number }> {
  try {
    const song = await CopyrightFreeSong.findById(songId);
    if (!song) {
      throw new Error("Song not found");
    }

    let interaction = await CopyrightFreeSongInteraction.findOne({
      userId: new Types.ObjectId(userId),
      songId: new Types.ObjectId(songId),
    });

    const wasSaved = interaction?.hasSaved || false;
    const newSavedState = !wasSaved;

    if (!interaction) {
      interaction = await CopyrightFreeSongInteraction.create({
        userId: new Types.ObjectId(userId),
        songId: new Types.ObjectId(songId),
        hasLiked: false,
        hasShared: false,
        hasSaved: newSavedState,
      });
    } else {
      interaction.hasSaved = newSavedState;
      await interaction.save();
    }

    if (newSavedState) {
      await deps.songService.incrementSaveCount(songId);
    } else {
      await deps.songService.decrementSaveCount(songId);
    }

    const updatedSong = await deps.songService.getSongByIdAdmin(songId);
    const saveCount = Math.max(updatedSong?.saveCount ?? 0, 0);

    return {
      saved: newSavedState,
      saveCount,
    };
  } catch (error: any) {
    logger.error("Error toggling save:", error);
    throw error;
  }
}
