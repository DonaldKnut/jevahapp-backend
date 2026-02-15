/**
 * REFACTORED EXAMPLE - Playlist Controller using DRY utilities
 * This demonstrates how controllers should be structured using shared utilities
 * DO NOT USE THIS FILE - It's for reference only
 */

import { Request, Response } from "express";
import { Types } from "mongoose";
import { Playlist } from "../models/playlist.model";
import { Media } from "../models/media.model";
import ResponseUtil from "../utils/response.util";
import ValidationUtil from "../utils/validation.util";
import ControllerUtil from "../utils/controller.util";
import QueryUtil from "../utils/query.util";
import logger from "../utils/logger";

/**
 * REFACTORED: Create a new playlist
 * BEFORE: ~50 lines | AFTER: ~30 lines
 */
export const createPlaylistRefactored = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId = ControllerUtil.getUserId(request, response);
  if (!userId) return;

  // Validate required fields using utility
  if (!ValidationUtil.validateFields(response, [
    { value: request.body.name, fieldName: "name", required: true, type: "string", minLength: 1, maxLength: 100 },
  ])) {
    return;
  }

  const { name, description, isPublic, coverImageUrl, tags } = request.body;

  // Check for duplicate using query utility
  const existingPlaylist = await Playlist.findOne({
    ...QueryUtil.buildUserFilter(userId),
    name: name.trim(),
  });

  if (existingPlaylist) {
    ResponseUtil.badRequest(response, "You already have a playlist with this name");
    return;
  }

  try {
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

    logger.info("Playlist created", { playlistId: playlist._id, userId, name: playlist.name });
    ResponseUtil.created(response, playlist, "Playlist created successfully");
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to create playlist");
  }
};

/**
 * REFACTORED: Get user playlists
 * BEFORE: ~40 lines | AFTER: ~15 lines (using base controller)
 */
export const getUserPlaylistsRefactored = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId = ControllerUtil.getUserId(request, response);
  if (!userId) return;

  const { page, limit, skip } = ControllerUtil.getPagination(request);

  try {
    const { query, options } = QueryUtil.buildQuery(
      QueryUtil.buildUserFilter(userId),
      { page, limit, skip },
      { sortBy: "createdAt", sortOrder: "desc" }
    );

    const result = await QueryUtil.executePaginatedQuery(Playlist, query, {
      ...options,
      populate: ["tracks.mediaId", "tracks.addedBy"],
    });

    ResponseUtil.paginated(response, result.data, result, "Playlists retrieved successfully");
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to retrieve playlists");
  }
};

/**
 * REFACTORED: Get playlist by ID
 * BEFORE: ~50 lines | AFTER: ~25 lines
 */
export const getPlaylistByIdRefactored = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userId = ControllerUtil.getUserId(request, response);
  if (!userId) return;

  const playlistId = ControllerUtil.validateAndConvertObjectId(response, request.params.playlistId, "Playlist ID");
  if (!playlistId) return;

  try {
    const playlist = await Playlist.findById(playlistId)
      .populate("userId", "firstName lastName avatar")
      .populate({
        path: "tracks.mediaId",
        select: "title description contentType thumbnailUrl fileUrl duration uploadedBy createdAt",
        populate: { path: "uploadedBy", select: "firstName lastName avatar" },
      })
      .populate("tracks.addedBy", "firstName lastName");

    if (!playlist) {
      ResponseUtil.notFound(response, "Playlist not found");
      return;
    }

    // Check access
    const isOwner = playlist.userId.toString() === userId;
    if (!isOwner && !playlist.isPublic) {
      ResponseUtil.forbidden(response, "You don't have permission to view this playlist");
      return;
    }

    ResponseUtil.success(response, playlist, "Playlist retrieved successfully");
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to retrieve playlist");
  }
};


