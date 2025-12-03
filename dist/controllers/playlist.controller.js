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
const copyrightFreeSong_model_1 = require("../models/copyrightFreeSong.model");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Professional helper: Populate playlist tracks from both collections
 * Returns unified format for frontend consumption
 */
function populatePlaylistTracks(playlist) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!playlist || !playlist.tracks || playlist.tracks.length === 0) {
            return playlist;
        }
        // Separate track IDs by type
        const mediaIds = [];
        const copyrightFreeIds = [];
        playlist.tracks.forEach((track) => {
            // Backward compatibility: if trackType doesn't exist, assume it's media (old format)
            if (!track.trackType && track.mediaId) {
                track.trackType = "media"; // Auto-migrate old tracks
            }
            if (track.trackType === "media" && track.mediaId) {
                mediaIds.push(track.mediaId);
            }
            else if (track.trackType === "copyrightFree" && track.copyrightFreeSongId) {
                copyrightFreeIds.push(track.copyrightFreeSongId);
            }
        });
        // Fetch both collections in parallel (performance optimization)
        const [mediaItems, copyrightFreeSongs] = yield Promise.all([
            mediaIds.length > 0
                ? media_model_1.Media.find({ _id: { $in: mediaIds } })
                    .populate("uploadedBy", "firstName lastName avatar")
                    .lean()
                : Promise.resolve([]),
            copyrightFreeIds.length > 0
                ? copyrightFreeSong_model_1.CopyrightFreeSong.find({ _id: { $in: copyrightFreeIds } })
                    .populate("uploadedBy", "firstName lastName avatar")
                    .lean()
                : Promise.resolve([]),
        ]);
        // Create lookup maps for O(1) access
        const mediaMap = new Map(mediaItems.map((m) => [String(m._id), m]));
        const copyrightFreeMap = new Map(copyrightFreeSongs.map((s) => [String(s._id), s]));
        // Transform tracks to unified format
        const populatedTracks = playlist.tracks.map((track) => {
            const trackData = track.toObject ? track.toObject() : track;
            // Backward compatibility: auto-detect trackType if missing
            if (!trackData.trackType) {
                if (trackData.mediaId) {
                    trackData.trackType = "media";
                }
                else if (trackData.copyrightFreeSongId) {
                    trackData.trackType = "copyrightFree";
                }
            }
            let content = null;
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
            }
            else if (trackData.trackType === "copyrightFree" && trackData.copyrightFreeSongId) {
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
        return Object.assign(Object.assign({}, playlistObj), { tracks: populatedTracks });
    });
}
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
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = yield playlist_model_1.Playlist.countDocuments({
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        // Populate tracks for all playlists using unified helper
        const populatedPlaylists = yield Promise.all(playlists.map((playlist) => populatePlaylistTracks(playlist)));
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
        const populated = yield populatePlaylistTracks(playlist);
        response.status(200).json({
            success: true,
            data: populated,
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
        const updatedPlaylist = yield playlist_model_1.Playlist.findByIdAndUpdate(playlistId, updateData, { new: true });
        logger_1.default.info("Playlist updated", {
            playlistId,
            userId,
        });
        // Populate tracks using unified helper
        const populated = yield populatePlaylistTracks(updatedPlaylist);
        response.status(200).json({
            success: true,
            message: "Playlist updated successfully",
            data: populated,
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
        const { mediaId, copyrightFreeSongId, notes, position } = request.body;
        // Professional validation: Determine track type and validate
        let trackType = null;
        let trackId = null;
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
        }
        else if (copyrightFreeSongId) {
            trackType = "copyrightFree";
            trackId = copyrightFreeSongId;
        }
        else {
            response.status(400).json({
                success: false,
                error: "Either mediaId or copyrightFreeSongId is required",
            });
            return;
        }
        if (!mongoose_1.Types.ObjectId.isValid(trackId)) {
            response.status(400).json({
                success: false,
                error: `Invalid ${trackType === "media" ? "media" : "copyright-free song"} ID`,
            });
            return;
        }
        // Verify content exists in appropriate collection
        let contentExists = false;
        if (trackType === "media") {
            const media = yield media_model_1.Media.findById(trackId);
            contentExists = !!media;
        }
        else {
            const song = yield copyrightFreeSong_model_1.CopyrightFreeSong.findById(trackId);
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
        const existingTrack = playlist.tracks.find((t) => {
            var _a, _b;
            if (trackType === "media") {
                return t.trackType === "media" && ((_a = t.mediaId) === null || _a === void 0 ? void 0 : _a.toString()) === trackId;
            }
            else {
                return t.trackType === "copyrightFree" && ((_b = t.copyrightFreeSongId) === null || _b === void 0 ? void 0 : _b.toString()) === trackId;
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
            playlist.tracks.forEach((track) => {
                if (track.order >= position) {
                    track.order += 1;
                }
            });
        }
        // Create track object
        const newTrack = {
            trackType,
            addedAt: new Date(),
            addedBy: new mongoose_1.Types.ObjectId(userId),
            order,
            notes: notes === null || notes === void 0 ? void 0 : notes.trim(),
        };
        if (trackType === "media") {
            newTrack.mediaId = new mongoose_1.Types.ObjectId(trackId);
        }
        else {
            newTrack.copyrightFreeSongId = new mongoose_1.Types.ObjectId(trackId);
        }
        // Add track
        playlist.tracks.push(newTrack);
        playlist.totalTracks = playlist.tracks.length;
        yield playlist.save();
        // Return populated playlist with unified format
        const populated = yield populatePlaylistTracks(playlist);
        logger_1.default.info("Track added to playlist", {
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
 * Remove a track from a playlist (supports both Media and CopyrightFreeSong)
 */
const removeTrackFromPlaylist = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
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
                message: "You can only remove tracks from your own playlists",
            });
            return;
        }
        // Determine which track to remove
        const trackIdToRemove = mediaId || copyrightFreeSongId;
        const trackTypeToRemove = trackType || (mediaId ? "media" : "copyrightFree");
        if (!trackIdToRemove || !mongoose_1.Types.ObjectId.isValid(trackIdToRemove)) {
            response.status(400).json({
                success: false,
                message: "Invalid track ID",
            });
            return;
        }
        // Find and remove the track (check both types)
        const trackIndex = playlist.tracks.findIndex((t) => {
            var _a, _b;
            if (trackTypeToRemove === "media") {
                return t.trackType === "media" && ((_a = t.mediaId) === null || _a === void 0 ? void 0 : _a.toString()) === trackIdToRemove;
            }
            else {
                return t.trackType === "copyrightFree" && ((_b = t.copyrightFreeSongId) === null || _b === void 0 ? void 0 : _b.toString()) === trackIdToRemove;
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
        playlist.tracks.forEach((track) => {
            if (track.order > removedOrder) {
                track.order -= 1;
            }
        });
        playlist.totalTracks = playlist.tracks.length;
        yield playlist.save();
        // Return populated playlist with unified format
        const populated = yield populatePlaylistTracks(playlist);
        logger_1.default.info("Track removed from playlist", {
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
        // Create track lookup map - support both track types
        const trackMap = new Map();
        tracks.forEach((t) => {
            const trackId = t.mediaId || t.copyrightFreeSongId;
            if (trackId) {
                trackMap.set(trackId, t.order);
            }
        });
        // Update order for each track (support both types)
        playlist.tracks.forEach((track) => {
            var _a, _b;
            const trackId = ((_a = track.mediaId) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = track.copyrightFreeSongId) === null || _b === void 0 ? void 0 : _b.toString());
            if (trackId) {
                const newOrder = trackMap.get(trackId);
                if (newOrder !== undefined) {
                    track.order = newOrder;
                }
            }
        });
        // Sort tracks by order
        playlist.tracks.sort((a, b) => a.order - b.order);
        yield playlist.save();
        // Return populated playlist with unified format
        const populated = yield populatePlaylistTracks(playlist);
        logger_1.default.info("Playlist tracks reordered", {
            playlistId,
            userId,
        });
        response.status(200).json({
            success: true,
            message: "Playlist tracks reordered successfully",
            data: populated,
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
