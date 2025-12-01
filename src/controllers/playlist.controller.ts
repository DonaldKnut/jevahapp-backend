import { Request, Response } from "express";
import { Types } from "mongoose";
import { Playlist } from "../models/playlist.model";
import { Media } from "../models/media.model";
import logger from "../utils/logger";

interface CreatePlaylistBody {
  name: string;
  description?: string;
  isPublic?: boolean;
  coverImageUrl?: string;
  tags?: string[];
}

interface AddTrackToPlaylistBody {
  mediaId: string;
  notes?: string;
  position?: number; // Optional position to insert at
}

interface UpdatePlaylistBody {
  name?: string;
  description?: string;
  isPublic?: boolean;
  coverImageUrl?: string;
  tags?: string[];
}

interface ReorderTracksBody {
  tracks: Array<{
    mediaId: string;
    order: number;
  }>;
}

/**
 * Create a new playlist
 */
export const createPlaylist = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { name, description, isPublic, coverImageUrl, tags } =
      request.body as CreatePlaylistBody;

    if (!name || name.trim().length === 0) {
      response.status(400).json({
        success: false,
        message: "Playlist name is required",
      });
      return;
    }

    // Check if user already has a playlist with this name
    const existingPlaylist = await Playlist.findOne({
      userId: new Types.ObjectId(userId),
      name: name.trim(),
    });

    if (existingPlaylist) {
      response.status(400).json({
        success: false,
        message: "You already have a playlist with this name",
      });
      return;
    }

    const playlist = await Playlist.create({
      name: name.trim(),
      description: description?.trim(),
      userId: new Types.ObjectId(userId),
      isPublic: isPublic || false,
      coverImageUrl,
      tags: tags || [],
      tracks: [],
      totalTracks: 0,
      playCount: 0,
    });

    logger.info("Playlist created", {
      playlistId: playlist._id,
      userId,
      name: playlist.name,
    });

    response.status(201).json({
      success: true,
      message: "Playlist created successfully",
      data: playlist,
    });
  } catch (error: any) {
    logger.error("Create playlist error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to create playlist",
      error: error.message,
    });
  }
};

/**
 * Get all playlists for the authenticated user
 */
export const getUserPlaylists = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const playlists = await Playlist.find({
      userId: new Types.ObjectId(userId),
    })
      .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
      .populate("tracks.addedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Playlist.countDocuments({
      userId: new Types.ObjectId(userId),
    });

    response.status(200).json({
      success: true,
      data: playlists,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error("Get user playlists error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve playlists",
    });
  }
};

/**
 * Get a specific playlist by ID
 */
export const getPlaylistById = async (
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

    const playlist = await Playlist.findById(playlistId)
      .populate("userId", "firstName lastName avatar")
      .populate({
        path: "tracks.mediaId",
        select: "title description contentType thumbnailUrl fileUrl duration uploadedBy createdAt",
        populate: {
          path: "uploadedBy",
          select: "firstName lastName avatar",
        },
      })
      .populate("tracks.addedBy", "firstName lastName");

    if (!playlist) {
      response.status(404).json({
        success: false,
        message: "Playlist not found",
      });
      return;
    }

    // Check if user has access (own playlist or public playlist)
    const isOwner = playlist.userId.toString() === userId;
    if (!isOwner && !playlist.isPublic) {
      response.status(403).json({
        success: false,
        message: "You don't have permission to view this playlist",
      });
      return;
    }

    response.status(200).json({
      success: true,
      data: playlist,
    });
  } catch (error: any) {
    logger.error("Get playlist by ID error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve playlist",
    });
  }
};

/**
 * Update playlist details (name, description, etc.)
 */
export const updatePlaylist = async (
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
        message: "You can only edit your own playlists",
      });
      return;
    }

    const { name, description, isPublic, coverImageUrl, tags } =
      request.body as UpdatePlaylistBody;

    // If name is being updated, check for duplicates
    if (name && name.trim() !== playlist.name) {
      const existingPlaylist = await Playlist.findOne({
        userId: new Types.ObjectId(userId),
        name: name.trim(),
        _id: { $ne: playlistId },
      });

      if (existingPlaylist) {
        response.status(400).json({
          success: false,
          message: "You already have a playlist with this name",
        });
        return;
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl;
    if (tags !== undefined) updateData.tags = tags;

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      updateData,
      { new: true }
    )
      .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
      .populate("tracks.addedBy", "firstName lastName");

    logger.info("Playlist updated", {
      playlistId,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Playlist updated successfully",
      data: updatedPlaylist,
    });
  } catch (error: any) {
    logger.error("Update playlist error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to update playlist",
    });
  }
};

/**
 * Delete a playlist
 */
export const deletePlaylist = async (
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
        message: "You can only delete your own playlists",
      });
      return;
    }

    // Prevent deletion of default playlists
    if (playlist.isDefault) {
      response.status(400).json({
        success: false,
        message: "Cannot delete default playlists",
      });
      return;
    }

    await Playlist.findByIdAndDelete(playlistId);

    logger.info("Playlist deleted", {
      playlistId,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Playlist deleted successfully",
    });
  } catch (error: any) {
    logger.error("Delete playlist error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to delete playlist",
    });
  }
};

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

    const { mediaId, notes, position } = request.body as AddTrackToPlaylistBody;

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      response.status(400).json({
        success: false,
        message: "Valid media ID is required",
      });
      return;
    }

    // Verify media exists
    const media = await Media.findById(mediaId);
    if (!media) {
      response.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    // Check if track is already in playlist
    const existingTrack = playlist.tracks.find(
      (t: any) => t.mediaId.toString() === mediaId
    );

    if (existingTrack) {
      response.status(400).json({
        success: false,
        message: "This track is already in the playlist",
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

    // Add track
    playlist.tracks.push({
      mediaId: new Types.ObjectId(mediaId),
      addedAt: new Date(),
      addedBy: new Types.ObjectId(userId),
      order,
      notes: notes?.trim(),
    });

    // Update total tracks (will be done by pre-save hook, but we can also do it manually)
    playlist.totalTracks = playlist.tracks.length;

    await playlist.save();

    const updatedPlaylist = await Playlist.findById(playlistId)
      .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
      .populate("tracks.addedBy", "firstName lastName");

    logger.info("Track added to playlist", {
      playlistId,
      mediaId,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Track added to playlist successfully",
      data: updatedPlaylist,
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
 * Remove a track from a playlist
 */
export const removeTrackFromPlaylist = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { playlistId, mediaId } = request.params;
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(playlistId) || !Types.ObjectId.isValid(mediaId)) {
      response.status(400).json({
        success: false,
        message: "Invalid playlist ID or media ID",
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

    // Find and remove the track
    const trackIndex = playlist.tracks.findIndex(
      (t: any) => t.mediaId.toString() === mediaId
    );

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

    const updatedPlaylist = await Playlist.findById(playlistId)
      .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
      .populate("tracks.addedBy", "firstName lastName");

    logger.info("Track removed from playlist", {
      playlistId,
      mediaId,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Track removed from playlist successfully",
      data: updatedPlaylist,
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

    // Update order for each track
    const trackMap = new Map(
      tracks.map((t) => [t.mediaId, t.order])
    );

    playlist.tracks.forEach((track: any) => {
      const newOrder = trackMap.get(track.mediaId.toString());
      if (newOrder !== undefined) {
        track.order = newOrder;
      }
    });

    // Sort tracks by order
    playlist.tracks.sort((a: any, b: any) => a.order - b.order);

    await playlist.save();

    const updatedPlaylist = await Playlist.findById(playlistId)
      .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
      .populate("tracks.addedBy", "firstName lastName");

    logger.info("Playlist tracks reordered", {
      playlistId,
      userId,
    });

    response.status(200).json({
      success: true,
      message: "Playlist tracks reordered successfully",
      data: updatedPlaylist,
    });
  } catch (error: any) {
    logger.error("Reorder playlist tracks error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to reorder playlist tracks",
    });
  }
};

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


