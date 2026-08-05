import { Request, Response } from "express";
import { Types } from "mongoose";
import { Playlist } from "../../models/playlist.model";
import { Media } from "../../models/media.model";
import { CopyrightFreeSong } from "../../models/copyrightFreeSong.model";
import logger from "../../utils/logger";
import {
  AddTrackToPlaylistBody,
  ReorderTracksBody,
  populatePlaylistTracks,
} from "./shared";

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

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      response.status(404).json({
        success: false,
        message: "Playlist not found",
      });
      return;
    }

    // Check ownership
    if (playlist.userId.toString() !== userId) {
      response.status(403).json({
        success: false,
        message: "You can only add tracks to your own playlists",
      });
      return;
    }

    const { mediaId, copyrightFreeSongId, notes, position } =
      request.body as AddTrackToPlaylistBody;

    // Professional validation: Determine track type and validate
    let trackType: "media" | "copyrightFree" | null = null;
    let trackId: string | null = null;

    if (mediaId && copyrightFreeSongId) {
      response.status(400).json({
        success: false,
        error: "Cannot specify both mediaId and copyrightFreeSongId",
      });
      return;
    }

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

    if (!Types.ObjectId.isValid(trackId)) {
      response.status(400).json({
        success: false,
        error: `Invalid ${trackType === "media" ? "media" : "copyright-free song"} ID`,
      });
      return;
    }

    // Verify content exists in appropriate collection
    let contentExists = false;
    if (trackType === "media") {
      const media = await Media.findById(trackId);
      contentExists = !!media;
    } else {
      const song = await CopyrightFreeSong.findById(trackId);
      contentExists = !!song;
      if (song) {
        const url = String(
          (song as any).audio?.playbackUrl || (song as any).fileUrl || ""
        );
        const status = String((song as any).processing?.status || "").toLowerCase();
        if (url.startsWith("pending://") || status === "pending" || status === "failed") {
          response.status(400).json({
            success: false,
            error: "Song is not ready to add to a playlist yet",
            code: "TRACK_NOT_READY",
          });
          return;
        }
      }
    }

    if (!contentExists) {
      response.status(404).json({
        success: false,
        error: `${trackType === "media" ? "Media" : "Copyright-free song"} not found`,
      });
      return;
    }

    // Check for duplicate (check both fields)
    const existingTrack = playlist.tracks.find((t: any) => {
      if (trackType === "media") {
        return t.trackType === "media" && t.mediaId?.toString() === trackId;
      } else {
        return (
          t.trackType === "copyrightFree" &&
          t.copyrightFreeSongId?.toString() === trackId
        );
      }
    });

    if (existingTrack) {
      response.status(400).json({
        success: false,
        error: "This song is already in the playlist",
        message: "This song is already in the playlist",
      });
      return;
    }

    // Determine order (position or append to end)
    let order = position !== undefined ? position : playlist.tracks.length;

    // If inserting at specific position, update orders of subsequent tracks
    if (position !== undefined && position < playlist.tracks.length) {
      playlist.tracks.forEach((track: any) => {
        if (track.order >= position) {
          track.order += 1;
        }
      });
    }

    // Create track object
    const newTrack: any = {
      trackType,
      addedAt: new Date(),
      addedBy: new Types.ObjectId(userId),
      order,
      notes: notes?.trim(),
    };

    if (trackType === "media") {
      newTrack.mediaId = new Types.ObjectId(trackId);
    } else {
      newTrack.copyrightFreeSongId = new Types.ObjectId(trackId);
    }

    // Add track
    playlist.tracks.push(newTrack);
    playlist.totalTracks = playlist.tracks.length;
    await playlist.save();

    // Return populated playlist with unified format
    const populated = await populatePlaylistTracks(playlist);

    logger.info("Track added to playlist", {
      playlistId,
      trackId,
      trackType,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Track added to playlist successfully",
      data: populated,
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
    const { copyrightFreeSongId, trackType } = request.query; // Support query params too
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

    // Check ownership
    if (playlist.userId.toString() !== userId) {
      response.status(403).json({
        success: false,
        message: "You can only remove tracks from your own playlists",
      });
      return;
    }

    // Determine which track to remove
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

    // Find and remove the track (check both types)
    const trackIndex = playlist.tracks.findIndex((t: any) => {
      if (trackTypeToRemove === "media") {
        return (
          t.trackType === "media" && t.mediaId?.toString() === trackIdToRemove
        );
      } else {
        return (
          t.trackType === "copyrightFree" &&
          t.copyrightFreeSongId?.toString() === trackIdToRemove
        );
      }
    });

    if (trackIndex === -1) {
      response.status(404).json({
        success: false,
        message: "Track not found in playlist",
      });
      return;
    }

    const removedOrder = playlist.tracks[trackIndex].order;

    // Remove the track
    playlist.tracks.splice(trackIndex, 1);

    // Reorder remaining tracks
    playlist.tracks.forEach((track: any) => {
      if (track.order > removedOrder) {
        track.order -= 1;
      }
    });

    playlist.totalTracks = playlist.tracks.length;

    await playlist.save();

    // Return populated playlist with unified format
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

    // Check ownership
    if (playlist.userId.toString() !== userId) {
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

    // Create track lookup map - support both track types
    const trackMap = new Map<string, number>();
    tracks.forEach((t) => {
      const trackId = t.mediaId || t.copyrightFreeSongId;
      if (trackId) {
        trackMap.set(trackId, t.order);
      }
    });

    // Update order for each track (support both types)
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

    // Sort tracks by order
    playlist.tracks.sort((a: any, b: any) => a.order - b.order);

    await playlist.save();

    // Return populated playlist with unified format
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
