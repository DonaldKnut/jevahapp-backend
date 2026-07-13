import { Request, Response } from "express";
import { Types } from "mongoose";
import { Playlist } from "../../models/playlist.model";
import logger from "../../utils/logger";

/**
 * Track playlist play (increment play count)
 */
export const trackPlaylistPlay = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { playlistId } = request.params;
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(playlistId)) {
      response.status(400).json({
        success: false,
        message: "Invalid playlist ID",
      });
      return;
    }

    const playlist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $inc: { playCount: 1 },
        $set: { lastPlayedAt: new Date() },
      },
      { new: true }
    );

    if (!playlist) {
      response.status(404).json({
        success: false,
        message: "Playlist not found",
      });
      return;
    }

    response.status(200).json({
      success: true,
      message: "Playlist play tracked",
      data: {
        playCount: playlist.playCount,
        lastPlayedAt: playlist.lastPlayedAt,
      },
    });
  } catch (error: any) {
    logger.error("Track playlist play error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to track playlist play",
    });
  }
};
