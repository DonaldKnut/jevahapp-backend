import { Request, Response } from "express";
import { Types } from "mongoose";
import { Playlist } from "../../models/playlist.model";
import logger from "../../utils/logger";
import {
  ReorderTracksBody,
  populatePlaylistTracks,
  playlistOwnerId,
  invalidatePlaylistCaches,
} from "./shared";
import { addTrackToPlaylistAtomic } from "../../service/playlist/addTrack.service";

/**
 * Add a track (media) to a playlist
 */
export const addTrackToPlaylist = async (
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

    const body = request.body || {};
    const mediaId = body.mediaId;
    const copyrightFreeSongId =
      body.copyrightFreeSongId || body.songId || body.trackId || undefined;

    if (mediaId && copyrightFreeSongId) {
      response.status(400).json({
        success: false,
        error: "Cannot specify both mediaId and copyrightFreeSongId",
      });
      return;
    }

    let trackType: "media" | "copyrightFree" | null = null;
    let trackId: string | null = null;
    if (mediaId) {
      trackType = "media";
      trackId = mediaId;
    } else if (copyrightFreeSongId) {
      trackType = "copyrightFree";
      trackId = copyrightFreeSongId;
    } else {
      response.status(400).json({
        success: false,
        error: "Either mediaId or copyrightFreeSongId is required",
      });
      return;
    }

    const result = await addTrackToPlaylistAtomic({
      playlistId,
      userId: String(userId),
      trackType,
      trackId: String(trackId),
      notes: body.notes,
      position: body.position,
    });

    if (!result.ok) {
      response.status(result.status).json({
        success: false,
        error: result.error,
        message: result.error,
        code: result.code,
      });
      return;
    }

    logger.info("Track added to playlist", {
      playlistId,
      trackId,
      trackType,
      userId,
      alreadyExists: !!result.alreadyExists,
    });

    response.status(200).json({
      success: true,
      code: result.alreadyExists ? "TRACK_ALREADY_IN_PLAYLIST" : undefined,
      message: result.alreadyExists
        ? "This song is already in the playlist"
        : "Track added to playlist successfully",
      data: result.playlist,
      alreadyExists: !!result.alreadyExists,
    });
  } catch (error: any) {
    logger.error("Add track to playlist error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to add track to playlist",
      error: error.message,
    });
  }
};

/**
 * Remove a track from a playlist (supports both Media and CopyrightFreeSong)
 */
export const removeTrackFromPlaylist = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { playlistId, mediaId } = request.params;
    const { copyrightFreeSongId, trackType } = request.query;
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

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      response.status(404).json({
        success: false,
        message: "Playlist not found",
      });
      return;
    }

    if (playlistOwnerId(playlist) !== String(userId)) {
      response.status(403).json({
        success: false,
        message: "You can only remove tracks from your own playlists",
      });
      return;
    }

    const trackIdToRemove = mediaId || (copyrightFreeSongId as string);
    const trackTypeToRemove =
      (trackType as string) || (mediaId ? "media" : "copyrightFree");

    if (!trackIdToRemove || !Types.ObjectId.isValid(trackIdToRemove)) {
      response.status(400).json({
        success: false,
        message: "Invalid track ID",
      });
      return;
    }

    const trackIndex = playlist.tracks.findIndex((t: any) => {
      if (trackTypeToRemove === "media") {
        return (
          t.trackType === "media" && t.mediaId?.toString() === trackIdToRemove
        );
      }
      return (
        t.trackType === "copyrightFree" &&
        t.copyrightFreeSongId?.toString() === trackIdToRemove
      );
    });

    if (trackIndex === -1) {
      response.status(404).json({
        success: false,
        message: "Track not found in playlist",
      });
      return;
    }

    const removedOrder = playlist.tracks[trackIndex].order;
    playlist.tracks.splice(trackIndex, 1);
    playlist.tracks.forEach((track: any) => {
      if (track.order > removedOrder) {
        track.order -= 1;
      }
    });
    playlist.totalTracks = playlist.tracks.length;
    await playlist.save();
    await invalidatePlaylistCaches(String(userId), playlistId);

    const populated = await populatePlaylistTracks(playlist);

    logger.info("Track removed from playlist", {
      playlistId,
      trackId: trackIdToRemove,
      trackType: trackTypeToRemove,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Track removed from playlist successfully",
      data: populated,
    });
  } catch (error: any) {
    logger.error("Remove track from playlist error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to remove track from playlist",
    });
  }
};

/**
 * Reorder tracks in a playlist
 */
export const reorderPlaylistTracks = async (
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

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      response.status(404).json({
        success: false,
        message: "Playlist not found",
      });
      return;
    }

    if (playlistOwnerId(playlist) !== String(userId)) {
      response.status(403).json({
        success: false,
        message: "You can only reorder tracks in your own playlists",
      });
      return;
    }

    const { tracks } = request.body as ReorderTracksBody;

    if (!tracks || !Array.isArray(tracks)) {
      response.status(400).json({
        success: false,
        message: "Invalid tracks array",
      });
      return;
    }

    const trackMap = new Map<string, number>();
    tracks.forEach(t => {
      const trackId = t.mediaId || t.copyrightFreeSongId;
      if (trackId) {
        trackMap.set(trackId, t.order);
      }
    });

    playlist.tracks.forEach((track: any) => {
      const trackId =
        track.mediaId?.toString() || track.copyrightFreeSongId?.toString();
      if (trackId) {
        const newOrder = trackMap.get(trackId);
        if (newOrder !== undefined) {
          track.order = newOrder;
        }
      }
    });

    playlist.tracks.sort((a: any, b: any) => a.order - b.order);
    await playlist.save();
    await invalidatePlaylistCaches(String(userId), playlistId);

    const populated = await populatePlaylistTracks(playlist);

    logger.info("Playlist tracks reordered", {
      playlistId,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Playlist tracks reordered successfully",
      data: populated,
    });
  } catch (error: any) {
    logger.error("Reorder playlist tracks error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to reorder playlist tracks",
    });
  }
};
