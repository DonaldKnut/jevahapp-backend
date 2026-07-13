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
} from "../../controllers/playlist.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { apiRateLimiter } from "../../middleware/rateLimiter";
import { cacheMiddleware } from "../../middleware/cache.middleware";

const router = Router();

/**
 * @route   GET /api/audio/playlists
 * @desc    Get all playlists for the authenticated user
 * @access  Protected (Authenticated users only)
 */
router.get("/playlists", verifyToken, apiRateLimiter, getUserPlaylists);

/**
 * @route   POST /api/audio/playlists
 * @desc    Create a new playlist
 * @access  Protected (Authenticated users only)
 */
router.post("/playlists", verifyToken, apiRateLimiter, createPlaylist);

/**
 * @route   GET /api/audio/playlists/:playlistId
 * @desc    Get a specific playlist by ID
 * @access  Protected (Authenticated users only - own playlists or public playlists)
 */
router.get(
  "/playlists/:playlistId",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(120, undefined, { allowAuthenticated: true }),
  getPlaylistById
);

/**
 * @route   PUT /api/audio/playlists/:playlistId
 * @desc    Update playlist details
 * @access  Protected (Authenticated users only - own playlists only)
 */
router.put("/playlists/:playlistId", verifyToken, apiRateLimiter, updatePlaylist);

/**
 * @route   DELETE /api/audio/playlists/:playlistId
 * @desc    Delete a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 */
router.delete("/playlists/:playlistId", verifyToken, apiRateLimiter, deletePlaylist);

/**
 * @route   POST /api/audio/playlists/:playlistId/songs
 * @desc    Add a song to a playlist (wrapper for /tracks endpoint)
 * @access  Protected (Authenticated users only - own playlists only)
 */
router.post("/playlists/:playlistId/songs", verifyToken, apiRateLimiter, addTrackToPlaylist);

/**
 * @route   DELETE /api/audio/playlists/:playlistId/songs/:songId
 * @desc    Remove a song from a playlist (wrapper for /tracks/:mediaId endpoint)
 * @access  Protected (Authenticated users only - own playlists only)
 */
router.delete(
  "/playlists/:playlistId/songs/:songId",
  verifyToken,
  apiRateLimiter,
  (req, res, next) => {
    req.params.mediaId = req.params.songId;
    delete req.params.songId;
    next();
  },
  removeTrackFromPlaylist
);

/**
 * @route   PUT /api/audio/playlists/:playlistId/songs/reorder
 * @desc    Reorder songs in a playlist (wrapper for /tracks/reorder endpoint)
 * @access  Protected (Authenticated users only - own playlists only)
 */
router.put("/playlists/:playlistId/songs/reorder", verifyToken, apiRateLimiter, reorderPlaylistTracks);

export default router;
