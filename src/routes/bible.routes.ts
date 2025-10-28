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

const router = Router();

// Public endpoints - no authentication required

// Books
// GET /api/bible/books - Get all Bible books
router.get("/books", apiRateLimiter, getAllBooks);

// GET /api/bible/books/testament/:testament - Get books by testament (old/new)
router.get("/books/testament/:testament", apiRateLimiter, getBooksByTestament);

// GET /api/bible/books/:bookName - Get a specific book
router.get("/books/:bookName", apiRateLimiter, getBook);

// Chapters
// GET /api/bible/books/:bookName/chapters - Get all chapters for a book
router.get("/books/:bookName/chapters", apiRateLimiter, getChapters);

// GET /api/bible/books/:bookName/chapters/:chapterNumber - Get a specific chapter
router.get(
  "/books/:bookName/chapters/:chapterNumber",
  apiRateLimiter,
  getChapter
);

// Verses
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses - Get all verses for a chapter
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses",
  apiRateLimiter,
  getVerses
);

// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber - Get a specific verse
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses/:verseNumber",
  apiRateLimiter,
  getVerse
);

// Search and Discovery
// GET /api/bible/search?q=query&book=bookName&testament=old|new&limit=50&offset=0 - Search Bible text
router.get("/search", apiRateLimiter, searchBible);

// GET /api/bible/search/advanced?q=query&book=bookName&testament=old|new&limit=20 - Advanced AI-powered search
router.get("/search/advanced", apiRateLimiter, advancedSearchBible);

// GET /api/bible/translations - Get available translations
router.get("/translations", apiRateLimiter, getAvailableTranslations);

// Verse range endpoint - MUST come before other /verses routes
// GET /api/bible/verses/range/:reference - Get a range of verses (e.g., "John 3:16-18")
router.get("/verses/range/:reference", apiRateLimiter, getVerseRange);

// Random, daily, popular verses
// GET /api/bible/verses/random - Get a random verse
router.get("/verses/random", apiRateLimiter, getRandomVerse);

// GET /api/bible/verses/daily - Get verse of the day
router.get("/verses/daily", apiRateLimiter, getVerseOfTheDay);

// GET /api/bible/verses/popular?limit=10 - Get popular verses
router.get("/verses/popular", apiRateLimiter, getPopularVerses);

// Statistics and Information
// GET /api/bible/stats - Get Bible statistics
router.get("/stats", apiRateLimiter, getBibleStats);

// GET /api/bible/reading-plans - Get available reading plans
router.get("/reading-plans", apiRateLimiter, getReadingPlans);

// Study Tools
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/cross-references - Get cross-references
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/cross-references",
  apiRateLimiter,
  getCrossReferences
);

// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/commentary - Get commentary
router.get(
  "/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/commentary",
  apiRateLimiter,
  getCommentary
);

export default router;
