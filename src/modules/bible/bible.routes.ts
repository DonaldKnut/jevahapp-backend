import { Router } from "express";
import {
  getAllBooks,
  getBooksByTestament,
  getBook,
  getChapters,
  getChapter,
  getVerses,
  getVerse,
  getVerseRange,
  searchBible,
  advancedSearchBible,
  getRandomVerse,
  getVerseOfTheDay,
  getPopularVerses,
  getBibleStats,
  getReadingPlans,
  getCrossReferences,
  getCommentary,
  getAvailableTranslations,
  getTranslationManifest,
  getTranslationPack,
  getBookVerses,
  getPackManifestByQuery,
} from "./bible.controller";
import { apiRateLimiter } from "../../middleware/rateLimiter";
import { cacheMiddleware } from "../../middleware/cache.middleware";
import { scriptureCacheHeaders } from "./scriptureCache.middleware";

const router = Router();

/**
 * Immutable scripture text (books, chapters, verses). Safe to cache at a CDN
 * edge for a year; a translation's text never changes in place.
 */
const immutableScripture = scriptureCacheHeaders();

/**
 * Pack gating depends on the client profile (Lite has a pack size cap), which
 * arrives in a header. Without these in the cache key, one profile's verdict
 * would be replayed to the other.
 */
const PACK_VARY_HEADERS = ["X-Jevah-Client", "X-Client-Profile"];

// Public endpoints - no authentication required

// Books
// GET /api/bible/books - Get all Bible books
router.get(
  "/books",
  apiRateLimiter,
  immutableScripture,
  cacheMiddleware(3600), // 1 hour - Bible books don't change
  getAllBooks
);

// GET /api/bible/books/testament/:testament - Get books by testament (old/new)
router.get(
  "/books/testament/:testament",
  apiRateLimiter,
  immutableScripture,
  cacheMiddleware(3600), // 1 hour
  getBooksByTestament
);

// GET /api/bible/books/:bookName - Get a specific book
router.get(
  "/books/:bookName",
  apiRateLimiter,
  immutableScripture,
  cacheMiddleware(3600), // 1 hour
  getBook
);

// GET /api/bible/books/:bookName/verses - Whole book in one request.
// Deliberately not Redis-cached: a whole book is up to ~1.5 MB and the
// immutable headers let the CDN absorb repeat traffic instead.
router.get(
  "/books/:bookName/verses",
  apiRateLimiter,
  immutableScripture,
  getBookVerses
);

// Chapters
// GET /api/bible/books/:bookName/chapters - Get all chapters for a book
router.get(
  "/books/:bookName/chapters",
  apiRateLimiter,
  immutableScripture,
  cacheMiddleware(3600), // 1 hour
  getChapters
);

// GET /api/bible/books/:bookName/chapters/:chapterNumber - Get a specific chapter
// Deprecated: superseded by /books/:bookName/verses. Kept for old clients.
router.get(
  "/books/:bookName/chapters/:chapterNumber",
  apiRateLimiter,
  immutableScripture,
  cacheMiddleware(3600), // 1 hour
  getChapter
);

// Verses
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses - Get all verses for a chapter
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses",
  apiRateLimiter,
  immutableScripture,
  cacheMiddleware(3600), // 1 hour
  getVerses
);

// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber - Get a specific verse
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses/:verseNumber",
  apiRateLimiter,
  immutableScripture,
  cacheMiddleware(3600), // 1 hour
  getVerse
);

// Search and Discovery
// GET /api/bible/search?q=query&book=bookName&testament=old|new&limit=50&offset=0 - Search Bible text
router.get(
  "/search",
  apiRateLimiter,
  cacheMiddleware(60), // 1 minute for search results
  searchBible
);

// GET /api/bible/search/advanced?q=query&book=bookName&testament=old|new&limit=20 - Advanced AI-powered search
router.get(
  "/search/advanced",
  apiRateLimiter,
  cacheMiddleware(60), // 1 minute for advanced search
  advancedSearchBible
);

// GET /api/bible/translations - Get available translations
router.get(
  "/translations/:id/manifest",
  apiRateLimiter,
  cacheMiddleware(60, undefined, { varyByHeaders: PACK_VARY_HEADERS }),
  getTranslationManifest
);
router.get(
  "/translations/:id/pack",
  apiRateLimiter,
  getTranslationPack
);
router.get(
  "/translations",
  apiRateLimiter,
  cacheMiddleware(120),
  getAvailableTranslations
);

// GET /api/bible/packs?translation=web - flat pack manifest alias
router.get(
  "/packs",
  apiRateLimiter,
  cacheMiddleware(60, undefined, { varyByHeaders: PACK_VARY_HEADERS }),
  getPackManifestByQuery
);

// Verse range endpoint - MUST come before other /verses routes
// GET /api/bible/verses/range/:reference - Get a range of verses (e.g., "John 3:16-18")
router.get(
  "/verses/range/:reference",
  apiRateLimiter,
  immutableScripture,
  cacheMiddleware(3600), // 1 hour
  getVerseRange
);

// Random, daily, popular verses
// GET /api/bible/verses/random - Get a random verse
router.get(
  "/verses/random",
  apiRateLimiter,
  cacheMiddleware(300), // 5 minutes for random verses
  getRandomVerse
);

// GET /api/bible/verses/daily - Get verse of the day
router.get(
  "/verses/daily",
  apiRateLimiter,
  cacheMiddleware(86400), // 24 hours - verse of the day changes daily
  getVerseOfTheDay
);

// GET /api/bible/verses/popular?limit=10 - Get popular verses
router.get(
  "/verses/popular",
  apiRateLimiter,
  cacheMiddleware(300), // 5 minutes
  getPopularVerses
);

// Statistics and Information
// GET /api/bible/stats - Get Bible statistics
router.get(
  "/stats",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getBibleStats
);

// GET /api/bible/reading-plans - Get available reading plans
router.get(
  "/reading-plans",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getReadingPlans
);

// Study Tools
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/cross-references - Get cross-references
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/cross-references",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getCrossReferences
);

// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/commentary - Get commentary
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/commentary",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getCommentary
);

export default router;
