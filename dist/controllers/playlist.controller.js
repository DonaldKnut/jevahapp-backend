"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackPlaylistPlay = exports.reorderPlaylistTracks = exports.removeTrackFromPlaylist = exports.addTrackToPlaylist = exports.deletePlaylist = exports.updatePlaylist = exports.getPlaylistById = exports.getUserPlaylists = exports.createPlaylist = void 0;
const mongoose_1 = require("mongoose");
const playlist_model_1 = require("../models/playlist.model");
const media_model_1 = require("../models/media.model");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Create a new playlist
 */
const createPlaylist = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const { name, description, isPublic, coverImageUrl, tags } = request.body;
        if (!name || name.trim().length === 0) {
            response.status(400).json({
                success: false,
                message: "Playlist name is required",
            });
            return;
        }
        // Check if user already has a playlist with this name
        const existingPlaylist = yield playlist_model_1.Playlist.findOne({
            userId: new mongoose_1.Types.ObjectId(userId),
            name: name.trim(),
        });
        if (existingPlaylist) {
            response.status(400).json({
                success: false,
                message: "You already have a playlist with this name",
            });
            return;
        }
        const playlist = yield playlist_model_1.Playlist.create({
            name: name.trim(),
            description: description === null || description === void 0 ? void 0 : description.trim(),
            userId: new mongoose_1.Types.ObjectId(userId),
            isPublic: isPublic || false,
            coverImageUrl,
            tags: tags || [],
            tracks: [],
            totalTracks: 0,
            playCount: 0,
        });
        logger_1.default.info("Playlist created", {
            playlistId: playlist._id,
            userId,
            name: playlist.name,
        });
        response.status(201).json({
            success: true,
            message: "Playlist created successfully",
            data: playlist,
        });
    }
    catch (error) {
        logger_1.default.error("Create playlist error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to create playlist",
            error: error.message,
        });
    }
});
exports.createPlaylist = createPlaylist;
/**
 * Get all playlists for the authenticated user
 */
const getUserPlaylists = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = request.userId;
        if (!userId) {
            response.status(401).json({
                success: false,
                message: "Unauthorized: User not authenticated",
            });
            return;
        }
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 20;
        const skip = (page - 1) * limit;
        const playlists = yield playlist_model_1.Playlist.find({
            userId: new mongoose_1.Types.ObjectId(userId),
        })
            .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
            .populate("tracks.addedBy", "firstName lastName")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = yield playlist_model_1.Playlist.countDocuments({
            userId: new mongoose_1.Types.ObjectId(userId),
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
    }
    catch (error) {
        logger_1.default.error("Get user playlists error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve playlists",
        });
    }
});
exports.getUserPlaylists = getUserPlaylists;
/**
 * Get a specific playlist by ID
 */
const getPlaylistById = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(playlistId)) {
            response.status(400).json({
                success: false,
                message: "Invalid playlist ID",
            });
            return;
        }
        const playlist = yield playlist_model_1.Playlist.findById(playlistId)
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
    }
    catch (error) {
        logger_1.default.error("Get playlist by ID error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to retrieve playlist",
        });
    }
});
exports.getPlaylistById = getPlaylistById;
/**
 * Update playlist details (name, description, etc.)
 */
const updatePlaylist = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(playlistId)) {
            response.status(400).json({
                success: false,
                message: "Invalid playlist ID",
            });
            return;
        }
        const playlist = yield playlist_model_1.Playlist.findById(playlistId);
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
        const { name, description, isPublic, coverImageUrl, tags } = request.body;
        // If name is being updated, check for duplicates
        if (name && name.trim() !== playlist.name) {
            const existingPlaylist = yield playlist_model_1.Playlist.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
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
        const updateData = {};
        if (name !== undefined)
            updateData.name = name.trim();
        if (description !== undefined)
            updateData.description = description === null || description === void 0 ? void 0 : description.trim();
        if (isPublic !== undefined)
            updateData.isPublic = isPublic;
        if (coverImageUrl !== undefined)
            updateData.coverImageUrl = coverImageUrl;
        if (tags !== undefined)
            updateData.tags = tags;
        const updatedPlaylist = yield playlist_model_1.Playlist.findByIdAndUpdate(playlistId, updateData, { new: true })
            .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
            .populate("tracks.addedBy", "firstName lastName");
        logger_1.default.info("Playlist updated", {
            playlistId,
            userId,
        });
        response.status(200).json({
            success: true,
            message: "Playlist updated successfully",
            data: updatedPlaylist,
        });
    }
    catch (error) {
        logger_1.default.error("Update playlist error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to update playlist",
        });
    }
});
exports.updatePlaylist = updatePlaylist;
/**
 * Delete a playlist
 */
const deletePlaylist = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(playlistId)) {
            response.status(400).json({
                success: false,
                message: "Invalid playlist ID",
            });
            return;
        }
        const playlist = yield playlist_model_1.Playlist.findById(playlistId);
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
        yield playlist_model_1.Playlist.findByIdAndDelete(playlistId);
        logger_1.default.info("Playlist deleted", {
            playlistId,
            userId,
        });
        response.status(200).json({
            success: true,
            message: "Playlist deleted successfully",
        });
    }
    catch (error) {
        logger_1.default.error("Delete playlist error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to delete playlist",
        });
    }
});
exports.deletePlaylist = deletePlaylist;
/**
 * Add a track (media) to a playlist
 */
const addTrackToPlaylist = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(playlistId)) {
            response.status(400).json({
                success: false,
                message: "Invalid playlist ID",
            });
            return;
        }
        const playlist = yield playlist_model_1.Playlist.findById(playlistId);
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
        const { mediaId, notes, position } = request.body;
        if (!mediaId || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            response.status(400).json({
                success: false,
                message: "Valid media ID is required",
            });
            return;
        }
        // Verify media exists
        const media = yield media_model_1.Media.findById(mediaId);
        if (!media) {
            response.status(404).json({
                success: false,
                message: "Media not found",
            });
            return;
        }
        // Check if track is already in playlist
        const existingTrack = playlist.tracks.find((t) => t.mediaId.toString() === mediaId);
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
            playlist.tracks.forEach((track) => {
                if (track.order >= position) {
                    track.order += 1;
                }
            });
        }
        // Add track
        playlist.tracks.push({
            mediaId: new mongoose_1.Types.ObjectId(mediaId),
            addedAt: new Date(),
            addedBy: new mongoose_1.Types.ObjectId(userId),
            order,
            notes: notes === null || notes === void 0 ? void 0 : notes.trim(),
        });
        // Update total tracks (will be done by pre-save hook, but we can also do it manually)
        playlist.totalTracks = playlist.tracks.length;
        yield playlist.save();
        const updatedPlaylist = yield playlist_model_1.Playlist.findById(playlistId)
            .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
            .populate("tracks.addedBy", "firstName lastName");
        logger_1.default.info("Track added to playlist", {
            playlistId,
            mediaId,
            userId,
        });
        response.status(200).json({
            success: true,
            message: "Track added to playlist successfully",
            data: updatedPlaylist,
        });
    }
    catch (error) {
        logger_1.default.error("Add track to playlist error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to add track to playlist",
            error: error.message,
        });
    }
});
exports.addTrackToPlaylist = addTrackToPlaylist;
/**
 * Remove a track from a playlist
 */
const removeTrackFromPlaylist = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(playlistId) || !mongoose_1.Types.ObjectId.isValid(mediaId)) {
            response.status(400).json({
                success: false,
                message: "Invalid playlist ID or media ID",
            });
            return;
        }
        const playlist = yield playlist_model_1.Playlist.findById(playlistId);
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
        const trackIndex = playlist.tracks.findIndex((t) => t.mediaId.toString() === mediaId);
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
        playlist.tracks.forEach((track) => {
            if (track.order > removedOrder) {
                track.order -= 1;
            }
        });
        playlist.totalTracks = playlist.tracks.length;
        yield playlist.save();
        const updatedPlaylist = yield playlist_model_1.Playlist.findById(playlistId)
            .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
            .populate("tracks.addedBy", "firstName lastName");
        logger_1.default.info("Track removed from playlist", {
            playlistId,
            mediaId,
            userId,
        });
        response.status(200).json({
            success: true,
            message: "Track removed from playlist successfully",
            data: updatedPlaylist,
        });
    }
    catch (error) {
        logger_1.default.error("Remove track from playlist error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to remove track from playlist",
        });
    }
});
exports.removeTrackFromPlaylist = removeTrackFromPlaylist;
/**
 * Reorder tracks in a playlist
 */
const reorderPlaylistTracks = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(playlistId)) {
            response.status(400).json({
                success: false,
                message: "Invalid playlist ID",
            });
            return;
        }
        const playlist = yield playlist_model_1.Playlist.findById(playlistId);
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
        const { tracks } = request.body;
        if (!tracks || !Array.isArray(tracks)) {
            response.status(400).json({
                success: false,
                message: "Invalid tracks array",
            });
            return;
        }
        // Update order for each track
        const trackMap = new Map(tracks.map((t) => [t.mediaId, t.order]));
        playlist.tracks.forEach((track) => {
            const newOrder = trackMap.get(track.mediaId.toString());
            if (newOrder !== undefined) {
                track.order = newOrder;
            }
        });
        // Sort tracks by order
        playlist.tracks.sort((a, b) => a.order - b.order);
        yield playlist.save();
        const updatedPlaylist = yield playlist_model_1.Playlist.findById(playlistId)
            .populate("tracks.mediaId", "title contentType thumbnailUrl duration")
            .populate("tracks.addedBy", "firstName lastName");
        logger_1.default.info("Playlist tracks reordered", {
            playlistId,
            userId,
        });
        response.status(200).json({
            success: true,
            message: "Playlist tracks reordered successfully",
            data: updatedPlaylist,
        });
    }
    catch (error) {
        logger_1.default.error("Reorder playlist tracks error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to reorder playlist tracks",
        });
    }
});
exports.reorderPlaylistTracks = reorderPlaylistTracks;
/**
 * Track playlist play (increment play count)
 */
const trackPlaylistPlay = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
        if (!mongoose_1.Types.ObjectId.isValid(playlistId)) {
            response.status(400).json({
                success: false,
                message: "Invalid playlist ID",
            });
            return;
        }
        const playlist = yield playlist_model_1.Playlist.findByIdAndUpdate(playlistId, {
            $inc: { playCount: 1 },
            $set: { lastPlayedAt: new Date() },
        }, { new: true });
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
    }
    catch (error) {
        logger_1.default.error("Track playlist play error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to track playlist play",
        });
    }
});
exports.trackPlaylistPlay = trackPlaylistPlay;
