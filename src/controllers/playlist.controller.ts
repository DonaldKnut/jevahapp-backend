import { Request, Response } from "express";
import { Types } from "mongoose";
import { Playlist } from "../models/playlist.model";
import { Media } from "../models/media.model";
import { CopyrightFreeSong } from "../models/copyrightFreeSong.model";
import logger from "../utils/logger";

interface CreatePlaylistBody {
  name: string;
  description?: string;
  isPublic?: boolean;
  coverImageUrl?: string;
  tags?: string[];
}

interface AddTrackToPlaylistBody {
  mediaId?: string; // For regular Media items
  copyrightFreeSongId?: string; // For copyright-free songs
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
    mediaId?: string;
    copyrightFreeSongId?: string;
    trackType: "media" | "copyrightFree";
    order: number;
  }>;
}

/**
 * Professional helper: Populate playlist tracks from both collections
 * Returns unified format for frontend consumption
 */
async function populatePlaylistTracks(playlist: any) {
  if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
    return playlist;
  }

  // Separate track IDs by type
  const mediaIds: Types.ObjectId[] = [];
  const copyrightFreeIds: Types.ObjectId[] = [];

  playlist.tracks.forEach((track: any) => {
    // Backward compatibility: if trackType doesn't exist, assume it's media (old format)
    if (!track.trackType && track.mediaId) {
      track.trackType = "media"; // Auto-migrate old tracks
    }
    
    if (track.trackType === "media" && track.mediaId) {
      mediaIds.push(track.mediaId);
    } else if (track.trackType === "copyrightFree" && track.copyrightFreeSongId) {
      copyrightFreeIds.push(track.copyrightFreeSongId);
    }
  });

  // Fetch both collections in parallel (performance optimization)
  const [mediaItems, copyrightFreeSongs] = await Promise.all([
    mediaIds.length > 0
      ? Media.find({ _id: { $in: mediaIds } })
          .populate("uploadedBy", "firstName lastName avatar")
          .lean()
      : Promise.resolve([]),
    copyrightFreeIds.length > 0
      ? CopyrightFreeSong.find({ _id: { $in: copyrightFreeIds } })
          .populate("uploadedBy", "firstName lastName avatar")
          .lean()
      : Promise.resolve([]),
  ]);

  // Create lookup maps for O(1) access
  const mediaMap = new Map(mediaItems.map((m: any) => [String(m._id), m]));
  const copyrightFreeMap = new Map(
    copyrightFreeSongs.map((s: any) => [String(s._id), s])
  );

  // Transform tracks to unified format
  const populatedTracks = playlist.tracks.map((track: any) => {
    const trackData = track.toObject ? track.toObject() : track;
    
    // Backward compatibility: auto-detect trackType if missing
    if (!trackData.trackType) {
      if (trackData.mediaId) {
        trackData.trackType = "media";
      } else if (trackData.copyrightFreeSongId) {
        trackData.trackType = "copyrightFree";
      }
    }
    
    let content: any = null;
    
    if (trackData.trackType === "media" && trackData.mediaId) {
      const media = mediaMap.get(String(trackData.mediaId));
      if (media) {
        content = {
          _id: media._id,
          title: media.title,
          thumbnailUrl: media.thumbnailUrl,
          fileUrl: media.fileUrl,
          duration: media.duration,
          artistName: media.speaker || 
            (media.uploadedBy ? `${media.uploadedBy.firstName || ""} ${media.uploadedBy.lastName || ""}`.trim() || "Unknown" : "Unknown"),
          contentType: media.contentType,
          uploadedBy: media.uploadedBy,
        };
      }
    } else if (trackData.trackType === "copyrightFree" && trackData.copyrightFreeSongId) {
      const song = copyrightFreeMap.get(String(trackData.copyrightFreeSongId));
      if (song) {
        content = {
          _id: song._id,
          title: song.title,
          thumbnailUrl: song.thumbnailUrl,
          fileUrl: song.fileUrl,
          duration: song.duration,
          artistName: song.singer || "Unknown",
          contentType: "music",
          uploadedBy: song.uploadedBy,
        };
      }
    }
    
    return {
      _id: trackData._id,
      trackType: trackData.trackType,
      mediaId: trackData.mediaId || null,
      copyrightFreeSongId: trackData.copyrightFreeSongId || null,
      content, // Unified content object (frontend doesn't need to care about source)
      addedAt: trackData.addedAt,
      addedBy: trackData.addedBy,
      order: trackData.order,
      notes: trackData.notes,
    };
  });

  // Return playlist with populated tracks
  const playlistObj = playlist.toObject ? playlist.toObject() : playlist;
  return {
    ...playlistObj,
    tracks: populatedTracks,
  };
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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Playlist.countDocuments({
      userId: new Types.ObjectId(userId),
    });

    // Populate tracks for all playlists using unified helper
    const populatedPlaylists = await Promise.all(
      playlists.map((playlist) => populatePlaylistTracks(playlist))
    );

    response.status(200).json({
      success: true,
      data: populatedPlaylists,
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
      .populate("userId", "firstName lastName avatar");

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

    // Populate tracks using unified helper
    const populated = await populatePlaylistTracks(playlist);

    response.status(200).json({
      success: true,
      data: populated,
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
    );

    logger.info("Playlist updated", {
      playlistId,
      userId,
    });

    // Populate tracks using unified helper
    const populated = await populatePlaylistTracks(updatedPlaylist!);

    response.status(200).json({
      success: true,
      message: "Playlist updated successfully",
      data: populated,
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

    const { mediaId, copyrightFreeSongId, notes, position } = request.body as AddTrackToPlaylistBody;

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
        return t.trackType === "copyrightFree" && t.copyrightFreeSongId?.toString() === trackId;
      }
    });

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
    const trackTypeToRemove = trackType as string || (mediaId ? "media" : "copyrightFree");

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
        return t.trackType === "media" && t.mediaId?.toString() === trackIdToRemove;
      } else {
        return t.trackType === "copyrightFree" && t.copyrightFreeSongId?.toString() === trackIdToRemove;
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
      const trackId = track.mediaId?.toString() || track.copyrightFreeSongId?.toString();
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


