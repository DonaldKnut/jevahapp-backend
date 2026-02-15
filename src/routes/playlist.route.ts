import { Router } from "express";
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
  trackPlaylistPlay,
} from "../controllers/playlist.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = Router();

/**
 * @route   POST /api/playlists
 * @desc    Create a new playlist
 * @access  Protected (Authenticated users only)
 * @body    { name: string, description?: string, isPublic?: boolean, coverImageUrl?: string, tags?: string[] }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.post("/", verifyToken, apiRateLimiter, createPlaylist);

/**
 * @route   GET /api/playlists
 * @desc    Get all playlists for the authenticated user
 * @access  Protected (Authenticated users only)
 * @query   { page?: number, limit?: number }
 * @returns { success: boolean, data: Playlist[], pagination: object }
 */
router.get(
  "/",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(60, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserPlaylists
);

/**
 * @route   GET /api/playlists/:playlistId
 * @desc    Get a specific playlist by ID
 * @access  Protected (Authenticated users only - own playlists or public playlists)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, data: Playlist }
 */
router.get(
  "/:playlistId",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getPlaylistById
);

/**
 * @route   PUT /api/playlists/:playlistId
 * @desc    Update playlist details (name, description, isPublic, etc.)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { name?: string, description?: string, isPublic?: boolean, coverImageUrl?: string, tags?: string[] }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.put("/:playlistId", verifyToken, apiRateLimiter, updatePlaylist);

/**
 * @route   DELETE /api/playlists/:playlistId
 * @desc    Delete a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, message: string }
 */
router.delete("/:playlistId", verifyToken, apiRateLimiter, deletePlaylist);

/**
 * @route   POST /api/playlists/:playlistId/tracks
 * @desc    Add a track to a playlist (supports both Media and CopyrightFreeSong)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { mediaId?: string, copyrightFreeSongId?: string, notes?: string, position?: number }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.post("/:playlistId/tracks", verifyToken, apiRateLimiter, addTrackToPlaylist);

/**
 * @route   DELETE /api/playlists/:playlistId/tracks/:mediaId
 * @desc    Remove a track from a playlist (supports both Media and CopyrightFreeSong)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @param   { mediaId: string } - MongoDB ObjectId of the track (media or copyright-free song)
 * @query   { trackType?: "media" | "copyrightFree", copyrightFreeSongId?: string }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.delete("/:playlistId/tracks/:mediaId", verifyToken, apiRateLimiter, removeTrackFromPlaylist);

/**
 * @route   PUT /api/playlists/:playlistId/tracks/reorder
 * @desc    Reorder tracks in a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { tracks: Array<{ mediaId: string, order: number }> }
 * @returns { success: boolean, message: string, data: Playlist }
 */
router.put("/:playlistId/tracks/reorder", verifyToken, apiRateLimiter, reorderPlaylistTracks);

/**
 * @route   POST /api/playlists/:playlistId/play
 * @desc    Track playlist play (increment play count)
 * @access  Protected (Authenticated users only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, message: string, data: { playCount: number, lastPlayedAt: Date } }
 */
router.post("/:playlistId/play", verifyToken, apiRateLimiter, trackPlaylistPlay);

export default router;


