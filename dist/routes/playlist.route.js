"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const playlist_controller_1 = require("../controllers/playlist.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
/**
 * @route   POST /api/playlists
 * @desc    Create a new playlist
 * @access  Protected (Authenticated users only)
 * @body    { name: string, description?: string, isPublic?: boolean, coverImageUrl?: string, tags?: string[] }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.post("/", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.createPlaylist);
/**
 * @route   GET /api/playlists
 * @desc    Get all playlists for the authenticated user
 * @access  Protected (Authenticated users only)
 * @query   { page?: number, limit?: number }
 * @returns { success: boolean, data: Playlist[], pagination: object }
 */
router.get("/", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.getUserPlaylists);
/**
 * @route   GET /api/playlists/:playlistId
 * @desc    Get a specific playlist by ID
 * @access  Protected (Authenticated users only - own playlists or public playlists)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, data: Playlist }
 */
router.get("/:playlistId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.getPlaylistById);
/**
 * @route   PUT /api/playlists/:playlistId
 * @desc    Update playlist details (name, description, isPublic, etc.)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { name?: string, description?: string, isPublic?: boolean, coverImageUrl?: string, tags?: string[] }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.put("/:playlistId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.updatePlaylist);
/**
 * @route   DELETE /api/playlists/:playlistId
 * @desc    Delete a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, message: string }
 */
router.delete("/:playlistId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.deletePlaylist);
/**
 * @route   POST /api/playlists/:playlistId/tracks
 * @desc    Add a track (media) to a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { mediaId: string, notes?: string, position?: number }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.post("/:playlistId/tracks", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.addTrackToPlaylist);
/**
 * @route   DELETE /api/playlists/:playlistId/tracks/:mediaId
 * @desc    Remove a track from a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @param   { mediaId: string } - MongoDB ObjectId of the media item
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.delete("/:playlistId/tracks/:mediaId", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.removeTrackFromPlaylist);
/**
 * @route   PUT /api/playlists/:playlistId/tracks/reorder
 * @desc    Reorder tracks in a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { tracks: Array<{ mediaId: string, order: number }> }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.put("/:playlistId/tracks/reorder", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.reorderPlaylistTracks);
/**
 * @route   POST /api/playlists/:playlistId/play
 * @desc    Track playlist play (increment play count)
 * @access  Protected (Authenticated users only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, message: string, data: { playCount: number, lastPlayedAt: Date } }
 */
router.post("/:playlistId/play", auth_middleware_1.verifyToken, rateLimiter_1.apiRateLimiter, playlist_controller_1.trackPlaylistPlay);
exports.default = router;
