import { Types } from "mongoose";
import { CopyrightFreeSongInteraction } from "../../../models/copyrightFreeSongInteraction.model";
import { CopyrightFreeSong } from "../../../models/copyrightFreeSong.model";
import logger from "../../../utils/logger";
import type { CopyrightFreeSongInteractionDeps } from "./deps";

/** Public deep-link for share sheets (Spotify/YTM-style). */
export function buildCopyrightFreeShareUrl(songId: string): string {
  const base = (
    process.env.PUBLIC_WEB_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_PUBLIC_URL ||
    "https://jevahapp.com"
  ).replace(/\/$/, "");
  return `${base}/audio/copyright-free/${songId}`;
}

/**
 * Record a share action.
 * Like YouTube Music / Spotify analytics: **every** share increments shareCount.
 * `hasShared` still marks that this user has shared at least once.
 */
export async function shareSong(
  deps: CopyrightFreeSongInteractionDeps,
  userId: string,
  songId: string,
  opts: { platform?: string } = {}
): Promise<{
  shared: true;
  shareCount: number;
  likeCount: number;
  viewCount: number;
  shareUrl: string;
  platform?: string;
}> {
  try {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(songId)) {
      throw new Error("Invalid user or song id");
    }

    const songExists = await CopyrightFreeSong.findById(songId).select("_id");
    if (!songExists) {
      throw new Error("Song not found");
    }

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
        hasSaved: false,
        hasViewed: false,
      });
    } else if (!interaction.hasShared) {
      interaction.hasShared = true;
      await interaction.save();
    }

    // Always count this share action (repeat shares still increment)
    await deps.songService.incrementShareCount(songId);

    const song = await deps.songService.getSongByIdAdmin(songId);
    const likeCount = song?.likeCount || 0;
    const viewCount = Math.max(song?.viewCount || 0, likeCount);

    return {
      shared: true,
      shareCount: song?.shareCount || 0,
      likeCount,
      viewCount,
      shareUrl: buildCopyrightFreeShareUrl(songId),
      platform: opts.platform,
    };
  } catch (error: any) {
    logger.error("Error sharing song:", error);
    throw error;
  }
}
