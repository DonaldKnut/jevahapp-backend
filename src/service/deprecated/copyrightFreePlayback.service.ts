import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import logger from "../../utils/logger";

/**
 * @deprecated Prefer POST /api/audio/copyright-free/:songId/view via recordView.
 * Legacy playback-duration threshold view counting.
 */
export class CopyrightFreePlaybackService {
  async trackPlayback(
    songId: string,
    playbackDuration: number,
    thresholdSeconds: number = 30
  ): Promise<{ viewCountIncremented: boolean; newViewCount: number }> {
    try {
      const song = await CopyrightFreeSong.findById(songId);
      if (!song) {
        throw new Error("Song not found");
      }

      let viewCountIncremented = false;

      if (playbackDuration >= thresholdSeconds) {
        await CopyrightFreeSong.findByIdAndUpdate(songId, {
          $inc: { viewCount: 1 },
        });
        viewCountIncremented = true;
      }

      const updatedSong = await CopyrightFreeSong.findById(songId).select("viewCount").lean() as { viewCount?: number } | null;
      const newViewCount = updatedSong?.viewCount ?? song.viewCount;

      logger.info("Playback tracked for copyright-free song", {
        songId,
        playbackDuration,
        thresholdSeconds,
        viewCountIncremented,
        newViewCount,
      });

      return {
        viewCountIncremented,
        newViewCount,
      };
    } catch (error: any) {
      logger.error("Error tracking playback:", error);
      throw error;
    }
  }
}

export default new CopyrightFreePlaybackService();
