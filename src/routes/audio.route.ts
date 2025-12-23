import { Router } from "express";
import multer from "multer";
import {
  getAllSongs as getCopyrightFreeSongsNew,
  getSongById as getCopyrightFreeSongNew,
  searchSongs as searchCopyrightFreeSongsNew,
  getSearchSuggestions as getSearchSuggestionsCopyrightFree,
  getTrendingSearches as getTrendingSearchesCopyrightFree,
  createSong as createCopyrightFreeSongNew,
  updateSong as updateCopyrightFreeSongNew,
  deleteSong as deleteCopyrightFreeSongNew,
  toggleLike as toggleLikeCopyrightFreeSongNew,
  shareSong as shareCopyrightFreeSongNew,
  trackPlayback as trackCopyrightFreeSongPlayback,
  recordView as recordViewCopyrightFreeSong,
  toggleSave as toggleSaveCopyrightFreeSong,
  getCategories as getCopyrightFreeCategories,
} from "../controllers/copyrightFreeSong.controller";
import {
  getUserAudioLibrary,
  downloadCopyrightFreeSong,
} from "../controllers/audio.controller";
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
} from "../controllers/playlist.controller";
import {
  startPlayback,
  updateProgress,
  pausePlayback,
  resumePlayback,
  endPlayback,
  getActivePlayback,
  getPlaybackHistory,
} from "../controllers/playbackSession.controller";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/role.middleware";
import { apiRateLimiter, mediaUploadRateLimiter } from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";
import { Media } from "../models/media.model";

const router = Router();

// Configure Multer for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage() });

// ============================================================================
// COPYRIGHT-FREE SONGS ROUTES
// ============================================================================

/**
 * @route   GET /api/audio/copyright-free
 * @desc    Get all copyright-free songs (Public)
 * @access  Public (No authentication required)
 * @query   { search?, category?, artist?, year?, minDuration?, maxDuration?, tags?, sortBy?, page?, limit? }
 * @returns { success: boolean, data: { songs: Song[], pagination: object } }
 */
router.get(
  "/copyright-free",
  apiRateLimiter,
  cacheMiddleware(60), // 1 minute for public copyright-free songs
  getCopyrightFreeSongsNew
);

/**
 * @route   GET /api/audio/copyright-free/:songId
 * @desc    Get a single copyright-free song (Public)
 * @access  Public (No authentication required)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, data: Song }
 */
router.get("/copyright-free/:songId", apiRateLimiter, getCopyrightFreeSongNew);

/**
 * @route   GET /api/audio/copyright-free/search
 * @desc    Search copyright-free songs (Public)
 * @access  Public (No authentication required)
 * @query   { q: string (required), page?, limit?, category?, sort? }
 * @returns { success: boolean, data: { songs: Song[], pagination: object, query: string, searchTime: number } }
 */
router.get(
  "/copyright-free/search",
  apiRateLimiter,
  cacheMiddleware(30), // 30 seconds for search results
  searchCopyrightFreeSongsNew
);

/**
 * @route   GET /api/audio/copyright-free/search/suggestions
 * @desc    Get search suggestions/autocomplete (Public)
 * @access  Public (No authentication required)
 * @query   { q: string (required), limit? }
 * @returns { success: boolean, data: { suggestions: string[] } }
 */
router.get("/copyright-free/search/suggestions", apiRateLimiter, getSearchSuggestionsCopyrightFree);

/**
 * @route   GET /api/audio/copyright-free/search/trending
 * @desc    Get trending searches (Public)
 * @access  Public (No authentication required)
 * @query   { limit?, period? }
 * @returns { success: boolean, data: { trending: TrendingSearch[] } }
 */
router.get(
  "/copyright-free/search/trending",
  apiRateLimiter,
  cacheMiddleware(120), // 2 minutes for trending searches
  getTrendingSearchesCopyrightFree
);

/**
 * @route   GET /api/audio/copyright-free/categories
 * @desc    Get categories for copyright-free songs (Public)
 * @access  Public (No authentication required)
 * @returns { success: boolean, data: { categories: string[] } }
 */
router.get(
  "/copyright-free/categories",
  apiRateLimiter,
  cacheMiddleware(300), // 5 minutes for categories (rarely change)
  getCopyrightFreeCategories
);


/**
 * @route   POST /api/audio/copyright-free
 * @desc    Create a copyright-free song (Admin Only)
 * @access  Protected (Admin only)
 * @body    { title: string, singer: string, fileUrl: string, thumbnailUrl?: string, duration?: number }
 * @returns { success: boolean, data: Song }
 */
router.post(
  "/copyright-free",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  createCopyrightFreeSongNew
);

/**
 * @route   PUT /api/audio/copyright-free/:songId
 * @desc    Update a copyright-free song (Admin Only)
 * @access  Protected (Admin only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @body    { title?, singer?, thumbnailUrl?, duration? }
 * @returns { success: boolean, data: Song }
 */
router.put(
  "/copyright-free/:songId",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  updateCopyrightFreeSongNew
);

/**
 * @route   DELETE /api/audio/copyright-free/:songId
 * @desc    Delete a copyright-free song (Admin Only)
 * @access  Protected (Admin only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, message: string }
 */
router.delete(
  "/copyright-free/:songId",
  verifyToken,
  requireAdmin,
  apiRateLimiter,
  deleteCopyrightFreeSongNew
);

/**
 * @route   POST /api/audio/copyright-free/:songId/like
 * @desc    Like/unlike a copyright-free song (Authenticated)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, data: { liked: boolean, likeCount: number } }
 */
router.post(
  "/copyright-free/:songId/like",
  verifyToken,
  apiRateLimiter,
  toggleLikeCopyrightFreeSongNew
);

/**
 * @route   POST /api/audio/copyright-free/:songId/share
 * @desc    Share a copyright-free song (Authenticated)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, data: { shareCount: number, likeCount: number } }
 */
router.post(
  "/copyright-free/:songId/share",
  verifyToken,
  apiRateLimiter,
  shareCopyrightFreeSongNew
);

/**
 * @route   POST /api/audio/copyright-free/:songId/download
 * @desc    Download a copyright-free song for offline listening (Authenticated)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @body    { fileSize?: number } - Optional file size in bytes
 * @returns { success: boolean, downloadUrl: string, fileName: string, fileSize: number, contentType: string }
 */
router.post(
  "/copyright-free/:songId/download",
  verifyToken,
  apiRateLimiter,
  downloadCopyrightFreeSong
);

/**
 * @route   POST /api/audio/copyright-free/:songId/playback/track
 * @desc    Track playback and increment view count if threshold is met (Authenticated)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @body    { playbackDuration: number (required), thresholdSeconds?: number (optional, default: 30) }
 * @returns { success: boolean, data: { viewCountIncremented: boolean, newViewCount: number, playbackDuration: number, thresholdSeconds: number } }
 */
router.post(
  "/copyright-free/:songId/playback/track",
  verifyToken,
  apiRateLimiter,
  trackCopyrightFreeSongPlayback
);

/**
 * @route   POST /api/audio/copyright-free/:songId/view
 * @desc    Record view for a copyright-free song (one view per user per song)
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @body    { durationMs?: number, progressPct?: number, isComplete?: boolean }
 * @returns { success: boolean, data: { viewCount: number, hasViewed: boolean } }
 */
router.post(
  "/copyright-free/:songId/view",
  verifyToken,
  apiRateLimiter,
  recordViewCopyrightFreeSong
);

/**
 * @route   POST /api/audio/copyright-free/:songId/save
 * @desc    Toggle save/bookmark for a copyright-free song
 * @access  Protected (Authenticated users only)
 * @param   { songId: string } - MongoDB ObjectId of the song
 * @returns { success: boolean, data: { bookmarked: boolean, bookmarkCount: number } }
 */
router.post(
  "/copyright-free/:songId/save",
  verifyToken,
  apiRateLimiter,
  toggleSaveCopyrightFreeSong
);


// ============================================================================
// AUDIO PLAYLIST ROUTES (Wrapper for existing playlist routes)
// ============================================================================

/**
 * @route   GET /api/audio/playlists
 * @desc    Get all playlists for the authenticated user
 * @access  Protected (Authenticated users only)
 * @query   { page?, limit? }
 * @returns { success: boolean, data: Playlist[], pagination: object }
 */
router.get("/playlists", verifyToken, apiRateLimiter, getUserPlaylists);

/**
 * @route   POST /api/audio/playlists
 * @desc    Create a new playlist
 * @access  Protected (Authenticated users only)
 * @body    { name: string, description?, isPublic?, coverImageUrl?, tags? }
 * @returns { success: boolean, data: Playlist }
 */
router.post("/playlists", verifyToken, apiRateLimiter, createPlaylist);

/**
 * @route   GET /api/audio/playlists/:playlistId
 * @desc    Get a specific playlist by ID
 * @access  Protected (Authenticated users only - own playlists or public playlists)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, data: Playlist }
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
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { name?, description?, isPublic?, coverImageUrl?, tags? }
 * @returns { success: boolean, data: Playlist }
 */
router.put("/playlists/:playlistId", verifyToken, apiRateLimiter, updatePlaylist);

/**
 * @route   DELETE /api/audio/playlists/:playlistId
 * @desc    Delete a playlist
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @returns { success: boolean, message: string }
 */
router.delete("/playlists/:playlistId", verifyToken, apiRateLimiter, deletePlaylist);

/**
 * @route   POST /api/audio/playlists/:playlistId/songs
 * @desc    Add a song to a playlist (wrapper for /tracks endpoint)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { mediaId: string, notes?, position? }
 * @returns { success: boolean, data: Playlist }
 */
router.post("/playlists/:playlistId/songs", verifyToken, apiRateLimiter, addTrackToPlaylist);

/**
 * @route   DELETE /api/audio/playlists/:playlistId/songs/:songId
 * @desc    Remove a song from a playlist (wrapper for /tracks/:mediaId endpoint)
 * @access  Protected (Authenticated users only - own playlists only)
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @param   { songId: string } - MongoDB ObjectId of the song/media
 * @returns { success: boolean, data: Playlist }
 */
router.delete(
  "/playlists/:playlistId/songs/:songId",
  verifyToken,
  apiRateLimiter,
  (req, res, next) => {
    // Map songId param to mediaId for the controller (which expects mediaId)
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
 * @param   { playlistId: string } - MongoDB ObjectId of the playlist
 * @body    { tracks: Array<{ mediaId: string, order: number }> }
 * @returns { success: boolean, data: Playlist }
 */
router.put("/playlists/:playlistId/songs/reorder", verifyToken, apiRateLimiter, reorderPlaylistTracks);

// ============================================================================
// AUDIO PLAYBACK ROUTES (Wrapper for existing playback routes)
// ============================================================================

/**
 * @route   POST /api/audio/playback/start
 * @desc    Start playback session for audio (wrapper for /api/media/:id/playback/start)
 * @access  Protected (Authenticated users only)
 * @body    { trackId: string, duration: number, position?, deviceInfo? }
 * @returns { success: boolean, data: { session: PlaybackSession, previousSessionPaused?, resumeFrom? } }
 */
router.post(
  "/playback/start",
  verifyToken,
  apiRateLimiter,
  (req, res, next) => {
    // Transform request: extract trackId and pass as :id param
    const { trackId } = req.body;
    if (!trackId) {
      res.status(400).json({
        success: false,
        message: "trackId is required",
      });
      return;
    }
    req.params.id = trackId;
    next();
  },
  startPlayback
);

/**
 * @route   POST /api/audio/playback/progress
 * @desc    Update playback progress
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, position: number, duration: number, progressPercentage: number }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number, progressPercentage: number } }
 */
router.post("/playback/progress", verifyToken, apiRateLimiter, updateProgress);

/**
 * @route   POST /api/audio/playback/pause
 * @desc    Pause playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number } }
 */
router.post("/playback/pause", verifyToken, apiRateLimiter, pausePlayback);

/**
 * @route   POST /api/audio/playback/resume
 * @desc    Resume playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string }
 * @returns { success: boolean, data: { session: PlaybackSession, position: number } }
 */
router.post("/playback/resume", verifyToken, apiRateLimiter, resumePlayback);

/**
 * @route   POST /api/audio/playback/complete
 * @desc    Complete playback session (alias for /end)
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, reason?, finalPosition? }
 * @returns { success: boolean, data: { session: PlaybackSession, viewRecorded: boolean } }
 */
router.post("/playback/complete", verifyToken, apiRateLimiter, endPlayback);

/**
 * @route   POST /api/audio/playback/end
 * @desc    End playback session
 * @access  Protected (Authenticated users only)
 * @body    { sessionId: string, reason?, finalPosition? }
 * @returns { success: boolean, data: { session: PlaybackSession, viewRecorded: boolean } }
 */
router.post("/playback/end", verifyToken, apiRateLimiter, endPlayback);

/**
 * @route   GET /api/audio/playback/history
 * @desc    Get playback history for user
 * @access  Protected (Authenticated users only)
 * @query   { page?, limit?, includeInactive? }
 * @returns { success: boolean, data: PlaybackSession[], pagination: object }
 */
router.get("/playback/history", verifyToken, apiRateLimiter, getPlaybackHistory);

/**
 * @route   GET /api/audio/playback/last-position/:trackId
 * @desc    Get last playback position for a track
 * @access  Protected (Authenticated users only)
 * @param   { trackId: string } - MongoDB ObjectId of the track
 * @returns { success: boolean, data: { position: number, progressPercentage: number } | null }
 */
router.get(
  "/playback/last-position/:trackId",
  verifyToken,
  apiRateLimiter,
  async (req, res): Promise<void> => {
    try {
      const { trackId } = req.params;
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      // Get active playback session for this track
      const { PlaybackSession } = await import("../models/playbackSession.model");
      const { Types } = await import("mongoose");

      const session: any = await PlaybackSession.findOne({
        userId: new Types.ObjectId(userId),
        mediaId: new Types.ObjectId(trackId),
        isActive: true,
      }).lean();

      if (!session) {
        res.status(200).json({
          success: true,
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          position: session.currentPosition || 0,
          progressPercentage: session.progressPercentage || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to get last position",
        error: error.message,
      });
    }
  }
);

// ============================================================================
// AUDIO LIBRARY ROUTES
// ============================================================================

/**
 * @route   GET /api/audio/library
 * @desc    Get user's audio library (saved songs)
 * @access  Protected (Authenticated users only)
 * @returns { success: boolean, data: Song[] }
 */
router.get(
  "/library",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(60, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserAudioLibrary
);

export default router;

