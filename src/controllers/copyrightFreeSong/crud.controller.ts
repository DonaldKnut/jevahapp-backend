import { Request, Response } from "express";
import { CopyrightFreeSongService } from "../../service/copyrightFreeSong.service";
import likeService from "../../modules/engagement/like/like.service";
import logger from "../../utils/logger";
import { normalizeUrl, songService } from "./shared";

export const getAllSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string | undefined;
    const search = (req.query.search as string) || undefined;
    const updatedSince = (req.query.updatedSince as string) || undefined;

    // Enforce maximum limit for mobile-friendly payloads
    limit = Math.min(Math.max(limit, 1), 100);

    const result = await songService.getAllSongs(page, limit, category, {
      search,
      updatedSince,
    });

    const { shapePublicSong } = await import("../../modules/audio/track.formatter");
    const { CopyrightFreeSongService } = await import(
      "../../service/copyrightFreeSong.service"
    );

    const songs = (result.songs || []).map((s: any) => {
      const viewCount = CopyrightFreeSongService.normalizedViewCount(s);
      const likeCount = s.likeCount ?? s.likes ?? 0;
      return shapePublicSong(s, {
        viewCount,
        views: viewCount,
        likeCount,
        likes: likeCount,
      });
    });

    res.status(200).json({
      success: true,
      data: {
        songs,
        items: songs,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit,
        },
      },
    });
  } catch (error: any) {
    logger.error("Error getting all songs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve songs",
      error: error.message,
    });
  }
};

export const getSongById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const userId = req.userId;

    // Validate ObjectId early to avoid noisy 500s from cast errors
    const mongoose = await import("mongoose");
    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({
        success: false,
        message: "Invalid song ID format",
      });
      return;
    }

    const song = await songService.getSongById(songId);

    if (!song) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    // Don't increment view count on GET - only count on actual playback (≥30 seconds)
    // View count is now tracked via playback sessions (POST /playback/track)

    let isLiked = false;
    if (userId) {
      isLiked = await likeService.hasUserLiked(userId, songId, "copyright_free_song");
    }

    const viewCount = CopyrightFreeSongService.normalizedViewCount(song as any);
    const likeCount = (song as any).likeCount ?? (song as any).likes ?? 0;
    res.status(200).json({
      success: true,
      data: {
        ...(song as any),
        id: (song as any)._id?.toString?.() || (song as any).id,
        artist: (song as any).singer,
        audioUrl: normalizeUrl((song as any).fileUrl),
        fileUrl: normalizeUrl((song as any).fileUrl),
        viewCount,
        views: viewCount,
        likeCount,
        likes: likeCount,
        isLiked,
      },
    });
  } catch (error: any) {
    logger.error("Error getting song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve song",
      error: error.message,
    });
  }
};

/**
 * Stream redirect for copyright-free song audio
 *
 * GET /api/audio/copyright-free/:songId/stream
 *
 * This endpoint does NOT proxy the audio bytes. It returns a 302 redirect to the
 * CDN-backed `audioUrl` (Cloudflare R2 public URL). This improves compatibility
 * with players that prefer a dedicated "stream URL" endpoint and reduces backend load.
 */
export const streamSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;

    const mongoose = await import("mongoose");
    if (!mongoose.Types.ObjectId.isValid(songId)) {
      res.status(400).json({ success: false, message: "Invalid song ID format" });
      return;
    }

    const song = await songService.getSongById(songId);
    if (!song) {
      res.status(404).json({ success: false, message: "Song not found" });
      return;
    }

    const audioUrl = normalizeUrl((song as any).fileUrl);
    if (!audioUrl) {
      res.status(404).json({ success: false, message: "Song audio URL not available" });
      return;
    }

    // Short cache at API layer to reduce repeated DB lookups; CDN URL itself can be long-lived.
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.setHeader("Vary", "Accept-Encoding");

    // 302 so clients always re-resolve if we ever rotate the URL format.
    res.redirect(302, audioUrl);
  } catch (error: any) {
    logger.error("Error redirecting song stream:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start stream",
      error: error.message,
    });
  }
};

export const createSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      singer,
      artistName,
      fileUrl,
      playbackUrl,
      thumbnailUrl,
      category,
      duration,
      durationSec,
    } = req.body;
    const uploadedBy = req.userId;
    const displayArtist = artistName || singer;
    const audioUrl = playbackUrl || fileUrl;

    if (!title || !displayArtist || !audioUrl || !uploadedBy) {
      res.status(400).json({
        success: false,
        message: "Title, singer/artistName, fileUrl/playbackUrl, and auth are required",
      });
      return;
    }

    const song = await songService.createSong({
      title,
      singer: displayArtist,
      fileUrl: audioUrl,
      thumbnailUrl,
      category,
      duration: durationSec ?? duration,
      uploadedBy,
    });

    const { shapeTrackCard } = await import("../../modules/audio/track.formatter");
    const { AuditService } = await import("../../service/audit.service");
    await AuditService.logAdminAction(
      uploadedBy,
      "create_track",
      (song as any)._id.toString(),
      { source: "legacy_url_post", lane: "curated" }
    );

    res.status(201).json({
      success: true,
      data: shapeTrackCard(song.toObject ? song.toObject() : song),
    });
  } catch (error: any) {
    logger.error("Error creating song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create song",
      error: error.message,
    });
  }
};

export const updateSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const {
      title,
      singer,
      artistName,
      thumbnailUrl,
      category,
      duration,
      durationSec,
    } = req.body;

    const song = await songService.updateSong(songId, {
      title,
      singer: artistName || singer,
      thumbnailUrl,
      category,
      duration: durationSec ?? duration,
    });

    if (!song) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    const { shapeTrackCard } = await import("../../modules/audio/track.formatter");
    res.status(200).json({
      success: true,
      data: shapeTrackCard(song.toObject ? song.toObject() : song),
    });
  } catch (error: any) {
    logger.error("Error updating song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update song",
      error: error.message,
    });
  }
};

export const deleteSong = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songId } = req.params;
    const adminId = req.userId;

    if (adminId) {
      const { hardDeleteTrack, TrackUploadError } = await import(
        "../../modules/audio/trackUpload.service"
      );
      try {
        await hardDeleteTrack(songId, adminId);
        res.status(200).json({
          success: true,
          message: "Song deleted successfully",
        });
        return;
      } catch (err: any) {
        if (!(err instanceof TrackUploadError) || err.status !== 404) {
          throw err;
        }
      }
    }

    const deleted = await songService.deleteSong(songId);
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Song not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Song deleted successfully",
    });
  } catch (error: any) {
    logger.error("Error deleting song:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete song",
      error: error.message,
    });
  }
};
