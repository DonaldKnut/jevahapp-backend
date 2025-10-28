"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bible_controller_1 = require("../controllers/bible.controller");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Public endpoints - no authentication required
// Books
// GET /api/bible/books - Get all Bible books
router.get("/books", rateLimiter_1.apiRateLimiter, bible_controller_1.getAllBooks);
// GET /api/bible/books/testament/:testament - Get books by testament (old/new)
router.get("/books/testament/:testament", rateLimiter_1.apiRateLimiter, bible_controller_1.getBooksByTestament);
// GET /api/bible/books/:bookName - Get a specific book
router.get("/books/:bookName", rateLimiter_1.apiRateLimiter, bible_controller_1.getBook);
// Chapters
// GET /api/bible/books/:bookName/chapters - Get all chapters for a book
router.get("/books/:bookName/chapters", rateLimiter_1.apiRateLimiter, bible_controller_1.getChapters);
// GET /api/bible/books/:bookName/chapters/:chapterNumber - Get a specific chapter
router.get("/books/:bookName/chapters/:chapterNumber", rateLimiter_1.apiRateLimiter, bible_controller_1.getChapter);
// Verses
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses - Get all verses for a chapter
router.get("/books/:bookName/chapters/:chapterNumber/verses", rateLimiter_1.apiRateLimiter, bible_controller_1.getVerses);
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber - Get a specific verse
router.get("/books/:bookName/chapters/:chapterNumber/verses/:verseNumber", rateLimiter_1.apiRateLimiter, bible_controller_1.getVerse);
// Search and Discovery
// GET /api/bible/search?q=query&book=bookName&testament=old|new&limit=50&offset=0 - Search Bible text
router.get("/search", rateLimiter_1.apiRateLimiter, bible_controller_1.searchBible);
// GET /api/bible/search/advanced?q=query&book=bookName&testament=old|new&limit=20 - Advanced AI-powered search
router.get("/search/advanced", rateLimiter_1.apiRateLimiter, bible_controller_1.advancedSearchBible);
// GET /api/bible/translations - Get available translations
router.get("/translations", rateLimiter_1.apiRateLimiter, bible_controller_1.getAvailableTranslations);
// Verse range endpoint - MUST come before other /verses routes
// GET /api/bible/verses/range/:reference - Get a range of verses (e.g., "John 3:16-18")
router.get("/verses/range/:reference", rateLimiter_1.apiRateLimiter, bible_controller_1.getVerseRange);
// Random, daily, popular verses
// GET /api/bible/verses/random - Get a random verse
router.get("/verses/random", rateLimiter_1.apiRateLimiter, bible_controller_1.getRandomVerse);
// GET /api/bible/verses/daily - Get verse of the day
router.get("/verses/daily", rateLimiter_1.apiRateLimiter, bible_controller_1.getVerseOfTheDay);
// GET /api/bible/verses/popular?limit=10 - Get popular verses
router.get("/verses/popular", rateLimiter_1.apiRateLimiter, bible_controller_1.getPopularVerses);
// Statistics and Information
// GET /api/bible/stats - Get Bible statistics
router.get("/stats", rateLimiter_1.apiRateLimiter, bible_controller_1.getBibleStats);
// GET /api/bible/reading-plans - Get available reading plans
router.get("/reading-plans", rateLimiter_1.apiRateLimiter, bible_controller_1.getReadingPlans);
// Study Tools
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/cross-references - Get cross-references
router.get("/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/cross-references", rateLimiter_1.apiRateLimiter, bible_controller_1.getCrossReferences);
// GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/commentary - Get commentary
router.get("/books/:bookName/chapters/:chapterNumber/verses/:verseNumber/commentary", rateLimiter_1.apiRateLimiter, bible_controller_1.getCommentary);
exports.default = router;
