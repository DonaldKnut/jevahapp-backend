"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getCommentary = exports.getCrossReferences = exports.getReadingPlans = exports.getBibleStats = exports.getPopularVerses = exports.getVerseOfTheDay = exports.getRandomVerse = exports.getAvailableTranslations = exports.advancedSearchBible = exports.searchBible = exports.getVerseRange = exports.getVerse = exports.getVerses = exports.getChapter = exports.getChapters = exports.getBook = exports.getBooksByTestament = exports.getAllBooks = void 0;
const bible_service_1 = __importDefault(require("../service/bible.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Get all Bible books
 */
const getAllBooks = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const books = yield bible_service_1.default.getAllBooks();
        response.status(200).json({
            success: true,
            data: books,
            count: books.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get all books error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get Bible books",
        });
    }
});
exports.getAllBooks = getAllBooks;
/**
 * Get books by testament
 */
const getBooksByTestament = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { testament } = request.params;
        if (!["old", "new"].includes(testament)) {
            response.status(400).json({
                success: false,
                message: "Invalid testament. Must be 'old' or 'new'",
            });
            return;
        }
        const books = yield bible_service_1.default.getBooksByTestament(testament);
        response.status(200).json({
            success: true,
            data: books,
            count: books.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get books by testament error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get books by testament",
        });
    }
});
exports.getBooksByTestament = getBooksByTestament;
/**
 * Get a specific book
 */
const getBook = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookName } = request.params;
        const book = yield bible_service_1.default.getBookByName(bookName);
        if (book) {
            response.status(200).json({
                success: true,
                data: book,
            });
        }
        else {
            response.status(404).json({
                success: false,
                message: "Book not found",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Get book error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get book",
        });
    }
});
exports.getBook = getBook;
/**
 * Get chapters for a book
 */
const getChapters = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookName } = request.params;
        const chapters = yield bible_service_1.default.getChaptersByBook(bookName);
        response.status(200).json({
            success: true,
            data: chapters,
            count: chapters.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get chapters error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get chapters",
        });
    }
});
exports.getChapters = getChapters;
/**
 * Get a specific chapter
 */
const getChapter = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookName, chapterNumber } = request.params;
        const chapterNum = parseInt(chapterNumber);
        if (isNaN(chapterNum) || chapterNum < 1) {
            response.status(400).json({
                success: false,
                message: "Invalid chapter number",
            });
            return;
        }
        const chapter = yield bible_service_1.default.getChapter(bookName, chapterNum);
        if (chapter) {
            // Get actual verse count from database
            const verseCount = yield bible_service_1.default.getVerseCount(bookName, chapterNum);
            response.status(200).json({
                success: true,
                data: Object.assign(Object.assign({}, chapter.toObject()), { actualVerseCount: verseCount }),
            });
        }
        else {
            response.status(404).json({
                success: false,
                message: "Chapter not found",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Get chapter error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get chapter",
        });
    }
});
exports.getChapter = getChapter;
/**
 * Get verses for a chapter
 */
const getVerses = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookName, chapterNumber } = request.params;
        const { translation = "WEB" } = request.query; // Default to WEB
        const chapterNum = parseInt(chapterNumber);
        if (isNaN(chapterNum) || chapterNum < 1) {
            response.status(400).json({
                success: false,
                message: "Invalid chapter number",
            });
            return;
        }
        const verses = yield bible_service_1.default.getVersesByChapter(bookName, chapterNum, translation);
        response.status(200).json({
            success: true,
            data: verses,
            count: verses.length,
            translation: translation.toUpperCase(),
        });
    }
    catch (error) {
        logger_1.default.error("Get verses error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get verses",
        });
    }
});
exports.getVerses = getVerses;
/**
 * Get a specific verse
 */
const getVerse = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookName, chapterNumber, verseNumber } = request.params;
        const { translation = "WEB" } = request.query; // Default to WEB
        const chapterNum = parseInt(chapterNumber);
        const verseNum = parseInt(verseNumber);
        if (isNaN(chapterNum) || chapterNum < 1) {
            response.status(400).json({
                success: false,
                message: "Invalid chapter number",
            });
            return;
        }
        if (isNaN(verseNum) || verseNum < 1) {
            response.status(400).json({
                success: false,
                message: "Invalid verse number",
            });
            return;
        }
        const verse = yield bible_service_1.default.getVerse(bookName, chapterNum, verseNum, translation);
        if (verse) {
            response.status(200).json({
                success: true,
                data: verse,
                translation: translation.toUpperCase(),
            });
        }
        else {
            response.status(404).json({
                success: false,
                message: `Verse not found in ${translation.toUpperCase()} translation`,
            });
        }
    }
    catch (error) {
        logger_1.default.error("Get verse error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get verse",
        });
    }
});
exports.getVerse = getVerse;
/**
 * Get a range of verses
 */
const getVerseRange = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { reference } = request.params;
        // Decode URL-encoded reference (e.g., "Romans%208:28-31" -> "Romans 8:28-31")
        let decodedReference;
        try {
            decodedReference = decodeURIComponent(reference);
        }
        catch (decodeError) {
            // If decoding fails (invalid encoding), use the original reference
            decodedReference = reference;
        }
        const range = bible_service_1.default.parseBibleReference(decodedReference);
        if (!range) {
            response.status(400).json({
                success: false,
                message: "Invalid Bible reference format. Use format like 'John 3:16' or 'Genesis 1:1-3'",
            });
            return;
        }
        const verses = yield bible_service_1.default.getVerseRange(range);
        response.status(200).json({
            success: true,
            data: verses,
            count: verses.length,
            reference: range,
        });
    }
    catch (error) {
        logger_1.default.error("Get verse range error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get verse range",
        });
    }
});
exports.getVerseRange = getVerseRange;
/**
 * Search Bible text
 */
const searchBible = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, book, testament, limit = 50, offset = 0 } = request.query;
        if (!q || typeof q !== "string") {
            response.status(400).json({
                success: false,
                message: "Search query is required",
            });
            return;
        }
        const searchOptions = {
            query: q,
            book: book,
            testament: testament,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0,
        };
        const results = yield bible_service_1.default.searchBible(searchOptions);
        response.status(200).json({
            success: true,
            data: results,
            count: results.length,
            query: searchOptions,
        });
    }
    catch (error) {
        logger_1.default.error("Search Bible error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to search Bible",
        });
    }
});
exports.searchBible = searchBible;
/**
 * Advanced AI-powered Bible search
 * Understands natural language queries
 */
const advancedSearchBible = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, book, testament, limit = 20 } = request.query;
        if (!q || typeof q !== "string") {
            response.status(400).json({
                success: false,
                message: "Search query is required",
            });
            return;
        }
        // Import AI search service
        const aiBibleSearchService = (yield Promise.resolve().then(() => __importStar(require("../service/aiBibleSearch.service")))).default;
        const searchOptions = {
            limit: parseInt(limit) || 20,
            book: book,
            testament: testament,
        };
        const aiResults = yield aiBibleSearchService.advancedSearch(q, searchOptions);
        // Transform results for frontend
        const transformedResults = aiResults.results.map(result => ({
            _id: result.verse._id,
            bookName: result.verse.bookName,
            chapterNumber: result.verse.chapterNumber,
            verseNumber: result.verse.verseNumber,
            text: result.verse.text,
            highlightedText: result.highlightedText, // Text with matched terms highlighted
            relevanceScore: result.relevanceScore,
            matchedTerms: result.matchedTerms,
            explanation: result.explanation, // AI explanation of why this matches
        }));
        response.status(200).json({
            success: true,
            data: transformedResults,
            count: transformedResults.length,
            queryInterpretation: aiResults.queryInterpretation, // What AI thinks user is looking for
            suggestedVerses: aiResults.suggestedVerses, // AI-suggested specific verse references
            searchTerms: aiResults.searchTerms,
            isAIEnhanced: true,
        });
    }
    catch (error) {
        logger_1.default.error("Advanced AI search error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to perform advanced search",
        });
    }
});
exports.advancedSearchBible = advancedSearchBible;
/**
 * Get available translations
 */
const getAvailableTranslations = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get unique translations from database
        const translations = yield bible_service_1.default.getAvailableTranslations();
        response.status(200).json({
            success: true,
            data: translations,
            count: translations.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get translations error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get translations",
        });
    }
});
exports.getAvailableTranslations = getAvailableTranslations;
/**
 * Get random verse
 */
const getRandomVerse = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const verse = yield bible_service_1.default.getRandomVerse();
        if (verse) {
            response.status(200).json({
                success: true,
                data: verse,
            });
        }
        else {
            response.status(404).json({
                success: false,
                message: "No verses found",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Get random verse error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get random verse",
        });
    }
});
exports.getRandomVerse = getRandomVerse;
/**
 * Get verse of the day
 */
const getVerseOfTheDay = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const verse = yield bible_service_1.default.getVerseOfTheDay();
        if (verse) {
            response.status(200).json({
                success: true,
                data: verse,
                date: new Date().toISOString().split("T")[0],
            });
        }
        else {
            response.status(404).json({
                success: false,
                message: "No verse of the day found",
            });
        }
    }
    catch (error) {
        logger_1.default.error("Get verse of the day error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get verse of the day",
        });
    }
});
exports.getVerseOfTheDay = getVerseOfTheDay;
/**
 * Get popular verses
 */
const getPopularVerses = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { limit = 10 } = request.query;
        const limitNum = parseInt(limit) || 10;
        const verses = yield bible_service_1.default.getPopularVerses(limitNum);
        response.status(200).json({
            success: true,
            data: verses,
            count: verses.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get popular verses error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get popular verses",
        });
    }
});
exports.getPopularVerses = getPopularVerses;
/**
 * Get Bible statistics
 */
const getBibleStats = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield bible_service_1.default.getBibleStats();
        response.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        logger_1.default.error("Get Bible stats error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get Bible statistics",
        });
    }
});
exports.getBibleStats = getBibleStats;
/**
 * Get reading plans
 */
const getReadingPlans = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const plans = bible_service_1.default.getReadingPlans();
        response.status(200).json({
            success: true,
            data: plans,
            count: plans.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get reading plans error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get reading plans",
        });
    }
});
exports.getReadingPlans = getReadingPlans;
/**
 * Get cross-references for a verse
 */
const getCrossReferences = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookName, chapterNumber, verseNumber } = request.params;
        const chapterNum = parseInt(chapterNumber);
        const verseNum = parseInt(verseNumber);
        if (isNaN(chapterNum) || chapterNum < 1) {
            response.status(400).json({
                success: false,
                message: "Invalid chapter number",
            });
            return;
        }
        if (isNaN(verseNum) || verseNum < 1) {
            response.status(400).json({
                success: false,
                message: "Invalid verse number",
            });
            return;
        }
        const crossReferences = yield bible_service_1.default.getCrossReferences(bookName, chapterNum, verseNum);
        response.status(200).json({
            success: true,
            data: crossReferences,
            count: crossReferences.length,
        });
    }
    catch (error) {
        logger_1.default.error("Get cross-references error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get cross-references",
        });
    }
});
exports.getCrossReferences = getCrossReferences;
/**
 * Get commentary for a verse
 */
const getCommentary = (request, response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bookName, chapterNumber, verseNumber } = request.params;
        const chapterNum = parseInt(chapterNumber);
        const verseNum = parseInt(verseNumber);
        if (isNaN(chapterNum) || chapterNum < 1) {
            response.status(400).json({
                success: false,
                message: "Invalid chapter number",
            });
            return;
        }
        if (isNaN(verseNum) || verseNum < 1) {
            response.status(400).json({
                success: false,
                message: "Invalid verse number",
            });
            return;
        }
        const commentary = yield bible_service_1.default.getCommentary(bookName, chapterNum, verseNum);
        response.status(200).json({
            success: true,
            data: { commentary },
        });
    }
    catch (error) {
        logger_1.default.error("Get commentary error:", error);
        response.status(500).json({
            success: false,
            message: "Failed to get commentary",
        });
    }
});
exports.getCommentary = getCommentary;
