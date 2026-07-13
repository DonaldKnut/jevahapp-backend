import { Request, Response } from "express";
import { Types } from "mongoose";
import { Playlist } from "../../models/playlist.model";
import logger from "../../utils/logger";
import {
  CreatePlaylistBody,
  UpdatePlaylistBody,
  populatePlaylistTracks,
} from "./shared";

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
      data: {
        playlists: populatedPlaylists,
      },
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

    const playlist = await Playlist.findById(playlistId).populate(
      "userId",
      "firstName lastName avatar"
    );

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
