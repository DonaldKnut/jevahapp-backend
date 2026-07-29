import { Router } from "express";
import {
  getAllSongs as getCopyrightFreeSongsNew,
  getSongById as getCopyrightFreeSongNew,
  streamSong as streamCopyrightFreeSong,
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
} from "../../controllers/copyrightFreeSong.controller";
import {
  getUserAudioLibrary,
  downloadCopyrightFreeSong,
} from "../../controllers/audio.controller";
import { verifyToken } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/role.middleware";
import { apiRateLimiter } from "../../middleware/rateLimiter";
import { cacheMiddleware } from "../../middleware/cache.middleware";
import { deprecatedEndpoint } from "../../middleware/deprecation.middleware";

const router = Router();

/**
 * @route   GET /api/audio/copyright-free
 * @desc    Get all copyright-free songs (Public)
 * @access  Public (No authentication required)
 */
router.get(
  "/copyright-free",
  apiRateLimiter,
  cacheMiddleware(30),
  getCopyrightFreeSongsNew
);

/**
 * @route   GET /api/audio/copyright-free/:songId/stream
 * @desc    Redirect to the actual CDN audio URL (Public)
 * @access  Public (No authentication required)
 */
router.get(
  "/copyright-free/:songId/stream",
  apiRateLimiter,
  cacheMiddleware(60),
  streamCopyrightFreeSong
);

/**
 * @route   GET /api/audio/copyright-free/:songId
 * @desc    Get a single copyright-free song (Public)
 * @access  Public (No authentication required)
 */
router.get(
  "/copyright-free/:songId",
  apiRateLimiter,
  cacheMiddleware(60),
  getCopyrightFreeSongNew
);

/**
 * @route   GET /api/audio/copyright-free/search
 * @desc    Search copyright-free songs (Public)
 * @access  Public (No authentication required)
 */
router.get(
  "/copyright-free/search",
  apiRateLimiter,
  cacheMiddleware(15),
  searchCopyrightFreeSongsNew
);

/**
 * @route   GET /api/audio/copyright-free/search/suggestions
 * @desc    Get search suggestions/autocomplete (Public)
 * @access  Public (No authentication required)
 */
router.get(
  "/copyright-free/search/suggestions",
  apiRateLimiter,
  cacheMiddleware(15),
  getSearchSuggestionsCopyrightFree
);

/**
 * @route   GET /api/audio/copyright-free/search/trending
 * @desc    Get trending searches (Public)
 * @access  Public (No authentication required)
 */
router.get(
  "/copyright-free/search/trending",
  apiRateLimiter,
  cacheMiddleware(60),
  getTrendingSearchesCopyrightFree
);

/**
 * @route   GET /api/audio/copyright-free/categories
 * @desc    Get categories for copyright-free songs (Public)
 * @access  Public (No authentication required)
 */
router.get(
  "/copyright-free/categories",
  apiRateLimiter,
  cacheMiddleware(120),
  getCopyrightFreeCategories
);

/**
 * @route   POST /api/audio/copyright-free
 * @desc    Create a copyright-free song (Admin Only)
 * @access  Protected (Admin only)
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
 * Prefer POST /api/audio/copyright-free/:songId/view
 */
router.post(
  "/copyright-free/:songId/playback/track",
  deprecatedEndpoint("POST /api/audio/copyright-free/:songId/view"),
  verifyToken,
  apiRateLimiter,
  trackCopyrightFreeSongPlayback
);

/**
 * @route   POST /api/audio/copyright-free/:songId/view
 * @desc    Record view for a copyright-free song (one view per user per song)
 * @access  Protected (Authenticated users only)
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
 */
router.post(
  "/copyright-free/:songId/save",
  verifyToken,
  apiRateLimiter,
  toggleSaveCopyrightFreeSong
);

/**
 * @route   GET /api/audio/library
 * @desc    Get user's audio library (saved songs)
 * @access  Protected (Authenticated users only)
 */
router.get(
  "/library",
  verifyToken,
  apiRateLimiter,
  cacheMiddleware(60, undefined, { allowAuthenticated: true, varyByUserId: true }),
  getUserAudioLibrary
);

export default router;
