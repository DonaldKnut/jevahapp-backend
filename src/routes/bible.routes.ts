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
} from "../controllers/bible.controller";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { cacheMiddleware } from "../middleware/cache.middleware";

const router = Router();

// Public endpoints - no authentication required

// Books
// GET /api/bible/books - Get all Bible books
router.get(
  "/books",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour - Bible books don't change
  getAllBooks
);

// GET /api/bible/books/testament/:testament - Get books by testament (old/new)
router.get(
  "/books/testament/:testament",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getBooksByTestament
);

// GET /api/bible/books/:bookName - Get a specific book
router.get(
  "/books/:bookName",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getBook
);

// Chapters
// GET /api/bible/books/:bookName/chapters - Get all chapters for a book
router.get(
  "/books/:bookName/chapters",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getChapters
);

// GET /api/bible/books/:bookName/chapters/:chapterNumber - Get a specific chapter
router.get(
  "/books/:bookName/chapters/:chapterNumber",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getChapter
);

// Verses
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses - Get all verses for a chapter
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour
  getVerses
);

// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber - Get a specific verse
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses/:verseNumber",
  apiRateLimiter,
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
  "/translations",
  apiRateLimiter,
  cacheMiddleware(3600), // 1 hour - translations don't change often
  getAvailableTranslations
);

// Verse range endpoint - MUST come before other /verses routes
// GET /api/bible/verses/range/:reference - Get a range of verses (e.g., "John 3:16-18")
router.get(
  "/verses/range/:reference",
  apiRateLimiter,
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
