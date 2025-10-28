"use strict";
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
const bible_model_1 = require("../models/bible.model");
const logger_1 = __importDefault(require("../utils/logger"));
class BibleService {
    /**
     * Get all Bible books
     */
    getAllBooks() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const books = yield bible_model_1.BibleBook.find({ isActive: true }).sort({ order: 1 });
                return books;
            }
            catch (error) {
                logger_1.default.error("Failed to get all Bible books:", error);
                return [];
            }
        });
    }
    /**
     * Get books by testament
     */
    getBooksByTestament(testament) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const books = yield bible_model_1.BibleBook.find({
                    testament,
                    isActive: true,
                }).sort({ order: 1 });
                return books;
            }
            catch (error) {
                logger_1.default.error("Failed to get books by testament:", error);
                return [];
            }
        });
    }
    /**
     * Get a specific book by name or abbreviation
     */
    getBookByName(bookName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const book = yield bible_model_1.BibleBook.findOne({
                    $or: [
                        { name: { $regex: new RegExp(`^${bookName}$`, "i") } },
                        { abbreviation: { $regex: new RegExp(`^${bookName}$`, "i") } },
                    ],
                    isActive: true,
                });
                return book;
            }
            catch (error) {
                logger_1.default.error("Failed to get book by name:", error);
                return null;
            }
        });
    }
    /**
     * Get chapters for a specific book
     */
    getChaptersByBook(bookName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const chapters = yield bible_model_1.BibleChapter.find({
                    bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
                    isActive: true,
                }).sort({ chapterNumber: 1 });
                return chapters;
            }
            catch (error) {
                logger_1.default.error("Failed to get chapters by book:", error);
                return [];
            }
        });
    }
    /**
     * Get a specific chapter
     */
    getChapter(bookName, chapterNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const chapter = yield bible_model_1.BibleChapter.findOne({
                    bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
                    chapterNumber,
                    isActive: true,
                });
                return chapter;
            }
            catch (error) {
                logger_1.default.error("Failed to get chapter:", error);
                return null;
            }
        });
    }
    /**
     * Get verse count for a chapter
     */
    getVerseCount(bookName, chapterNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield bible_model_1.BibleVerse.countDocuments({
                    bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
                    chapterNumber,
                    isActive: true,
                });
                return count;
            }
            catch (error) {
                logger_1.default.error("Failed to get verse count:", error);
                return 0;
            }
        });
    }
    /**
     * Get verses for a specific chapter
     */
    getVersesByChapter(bookName, chapterNumber, translation) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = {
                    bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
                    chapterNumber,
                    isActive: true,
                };
                // Filter by translation if provided
                if (translation) {
                    query.translation = translation.toUpperCase();
                }
                const verses = yield bible_model_1.BibleVerse.find(query).sort({ verseNumber: 1 });
                return verses;
            }
            catch (error) {
                logger_1.default.error("Failed to get verses by chapter:", error);
                return [];
            }
        });
    }
    /**
     * Get a specific verse
     */
    getVerse(bookName, chapterNumber, verseNumber, translation) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = {
                    bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
                    chapterNumber,
                    verseNumber,
                    isActive: true,
                };
                // Filter by translation if provided
                if (translation) {
                    query.translation = translation.toUpperCase();
                }
                const verse = yield bible_model_1.BibleVerse.findOne(query);
                return verse;
            }
            catch (error) {
                logger_1.default.error("Failed to get verse:", error);
                return null;
            }
        });
    }
    /**
     * Get a range of verses
     */
    getVerseRange(range) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { bookName, startChapter, startVerse, endChapter, endVerse } = range;
                const query = {
                    bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
                    isActive: true,
                };
                if (endChapter && endChapter !== startChapter) {
                    // Cross-chapter range
                    query.$or = [
                        {
                            chapterNumber: startChapter,
                            verseNumber: { $gte: startVerse },
                        },
                        {
                            chapterNumber: { $gt: startChapter, $lt: endChapter },
                        },
                        {
                            chapterNumber: endChapter,
                            verseNumber: { $lte: endVerse || 999 },
                        },
                    ];
                }
                else {
                    // Single chapter range
                    query.chapterNumber = startChapter;
                    query.verseNumber = { $gte: startVerse };
                    if (endVerse) {
                        query.verseNumber.$lte = endVerse;
                    }
                }
                const verses = yield bible_model_1.BibleVerse.find(query).sort({
                    chapterNumber: 1,
                    verseNumber: 1,
                });
                return verses;
            }
            catch (error) {
                logger_1.default.error("Failed to get verse range:", error);
                return [];
            }
        });
    }
    /**
     * Search Bible text
     */
    searchBible(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { query, book, testament, limit = 50, offset = 0 } = options;
                const searchQuery = {
                    $text: { $search: query },
                    isActive: true,
                };
                if (book) {
                    // Try to match book name or abbreviation (e.g., "pro" -> "Proverbs" or "Pro")
                    const matchingBooks = yield bible_model_1.BibleBook.find({
                        $or: [
                            { name: { $regex: new RegExp(`^${book}`, "i") } }, // Starts with (e.g., "pro" matches "Proverbs")
                            { abbreviation: { $regex: new RegExp(`^${book}`, "i") } }, // Abbreviation match (e.g., "pro" matches "Pro")
                        ],
                        isActive: true,
                    }).select("name");
                    if (matchingBooks.length > 0) {
                        // Use the first matching book name
                        const bookName = matchingBooks[0].name;
                        searchQuery.bookName = { $regex: new RegExp(`^${bookName}$`, "i") };
                    }
                    else {
                        // Fallback to exact match if no abbreviation/partial match found
                        searchQuery.bookName = { $regex: new RegExp(`^${book}$`, "i") };
                    }
                }
                if (testament) {
                    // Get book IDs for the testament
                    const books = yield bible_model_1.BibleBook.find({
                        testament,
                        isActive: true,
                    }).select("_id");
                    const bookIds = books.map(b => b._id);
                    searchQuery.bookId = { $in: bookIds };
                }
                const verses = yield bible_model_1.BibleVerse.find(searchQuery)
                    .populate("bookId", "name abbreviation testament")
                    .sort({ score: { $meta: "textScore" } })
                    .limit(limit)
                    .skip(offset);
                // Get chapters for the verses
                const results = [];
                for (const verse of verses) {
                    const chapter = yield bible_model_1.BibleChapter.findOne({
                        bookName: verse.bookName,
                        chapterNumber: verse.chapterNumber,
                        isActive: true,
                    });
                    results.push({
                        verse: verse,
                        book: verse.bookId,
                        chapter: chapter || {},
                    });
                }
                return results;
            }
            catch (error) {
                logger_1.default.error("Failed to search Bible:", error);
                return [];
            }
        });
    }
    /**
     * Get random verse
     */
    getRandomVerse() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const verse = yield bible_model_1.BibleVerse.aggregate([
                    { $match: { isActive: true } },
                    { $sample: { size: 1 } },
                ]);
                return verse.length > 0 ? verse[0] : null;
            }
            catch (error) {
                logger_1.default.error("Failed to get random verse:", error);
                return null;
            }
        });
    }
    /**
     * Get verse of the day (based on date)
     */
    getVerseOfTheDay() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const today = new Date();
                const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
                    (1000 * 60 * 60 * 24));
                // Use day of year to get a consistent verse for the day
                const verse = yield bible_model_1.BibleVerse.aggregate([
                    { $match: { isActive: true } },
                    { $skip: dayOfYear % 31102 }, // 31102 is approximate total verses
                    { $limit: 1 },
                ]);
                return verse.length > 0 ? verse[0] : null;
            }
            catch (error) {
                logger_1.default.error("Failed to get verse of the day:", error);
                return null;
            }
        });
    }
    /**
     * Get popular verses (most searched or referenced)
     */
    getPopularVerses() {
        return __awaiter(this, arguments, void 0, function* (limit = 10) {
            try {
                // For now, return some well-known verses
                // In a real implementation, you'd track verse popularity
                const popularReferences = [
                    { bookName: "John", chapterNumber: 3, verseNumber: 16 },
                    { bookName: "Jeremiah", chapterNumber: 29, verseNumber: 11 },
                    { bookName: "Romans", chapterNumber: 8, verseNumber: 28 },
                    { bookName: "Philippians", chapterNumber: 4, verseNumber: 13 },
                    { bookName: "Psalm", chapterNumber: 23, verseNumber: 1 },
                    { bookName: "Proverbs", chapterNumber: 3, verseNumber: 5 },
                    { bookName: "Matthew", chapterNumber: 28, verseNumber: 19 },
                    { bookName: "1 Corinthians", chapterNumber: 13, verseNumber: 4 },
                    { bookName: "Galatians", chapterNumber: 5, verseNumber: 22 },
                    { bookName: "Ephesians", chapterNumber: 2, verseNumber: 8 },
                ];
                const verses = [];
                for (const ref of popularReferences.slice(0, limit)) {
                    const verse = yield this.getVerse(ref.bookName, ref.chapterNumber, ref.verseNumber);
                    if (verse)
                        verses.push(verse);
                }
                return verses;
            }
            catch (error) {
                logger_1.default.error("Failed to get popular verses:", error);
                return [];
            }
        });
    }
    /**
     * Get Bible statistics
     */
    getBibleStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [totalBooks, totalChapters, totalVerses, oldTestamentBooks, newTestamentBooks, oldTestamentChapters, newTestamentChapters, oldTestamentVerses, newTestamentVerses,] = yield Promise.all([
                    bible_model_1.BibleBook.countDocuments({ isActive: true }),
                    bible_model_1.BibleChapter.countDocuments({ isActive: true }),
                    bible_model_1.BibleVerse.countDocuments({ isActive: true }),
                    bible_model_1.BibleBook.countDocuments({ testament: "old", isActive: true }),
                    bible_model_1.BibleBook.countDocuments({ testament: "new", isActive: true }),
                    bible_model_1.BibleChapter.countDocuments({ testament: "old", isActive: true }),
                    bible_model_1.BibleChapter.countDocuments({ testament: "new", isActive: true }),
                    bible_model_1.BibleVerse.countDocuments({ testament: "old", isActive: true }),
                    bible_model_1.BibleVerse.countDocuments({ testament: "new", isActive: true }),
                ]);
                return {
                    totalBooks,
                    totalChapters,
                    totalVerses,
                    oldTestamentBooks,
                    newTestamentBooks,
                    oldTestamentChapters,
                    newTestamentChapters,
                    oldTestamentVerses,
                    newTestamentVerses,
                };
            }
            catch (error) {
                logger_1.default.error("Failed to get Bible stats:", error);
                return {
                    totalBooks: 0,
                    totalChapters: 0,
                    totalVerses: 0,
                    oldTestamentBooks: 0,
                    newTestamentBooks: 0,
                    oldTestamentChapters: 0,
                    newTestamentChapters: 0,
                    oldTestamentVerses: 0,
                    newTestamentVerses: 0,
                };
            }
        });
    }
    /**
     * Parse Bible reference (e.g., "John 3:16", "Genesis 1:1-3")
     */
    parseBibleReference(reference) {
        try {
            // Remove extra spaces and normalize
            const cleanRef = reference.trim().replace(/\s+/g, " ");
            // Match patterns like "John 3:16", "Genesis 1:1-3", "Psalm 23:1-6"
            const patterns = [
                // Book Chapter:Verse-Verse (e.g., "John 3:16-18")
                /^(.+?)\s+(\d+):(\d+)-(\d+)$/,
                // Book Chapter:Verse (e.g., "John 3:16")
                /^(.+?)\s+(\d+):(\d+)$/,
                // Book Chapter (e.g., "John 3")
                /^(.+?)\s+(\d+)$/,
            ];
            for (const pattern of patterns) {
                const match = cleanRef.match(pattern);
                if (match) {
                    const [, bookName, chapterStr, startVerseStr, endVerseStr] = match;
                    return {
                        bookName: bookName.trim(),
                        startChapter: parseInt(chapterStr),
                        startVerse: startVerseStr ? parseInt(startVerseStr) : 1,
                        endVerse: endVerseStr ? parseInt(endVerseStr) : undefined,
                    };
                }
            }
            return null;
        }
        catch (error) {
            logger_1.default.error("Failed to parse Bible reference:", error);
            return null;
        }
    }
    /**
     * Get reading plans
     */
    getReadingPlans() {
        return [
            {
                id: "bible-in-year",
                name: "Bible in a Year",
                description: "Read through the entire Bible in 365 days",
                duration: 365,
                readings: [], // Would be populated with daily readings
            },
            {
                id: "new-testament-30",
                name: "New Testament in 30 Days",
                description: "Read through the New Testament in 30 days",
                duration: 30,
                readings: [], // Would be populated with daily readings
            },
            {
                id: "psalms-proverbs",
                name: "Psalms and Proverbs",
                description: "Read through Psalms and Proverbs monthly",
                duration: 30,
                readings: [], // Would be populated with daily readings
            },
        ];
    }
    /**
     * Get available translations
     */
    getAvailableTranslations() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const translations = yield bible_model_1.BibleVerse.aggregate([
                    { $match: { isActive: true } },
                    {
                        $group: {
                            _id: "$translation",
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { count: -1 } },
                ]);
                // Map translation codes to names
                const translationNames = {
                    WEB: "World English Bible",
                    KJV: "King James Version",
                    ASV: "American Standard Version",
                    NIV: "New International Version",
                    AMP: "Amplified Bible",
                    DARBY: "Darby Translation",
                    YLT: "Young's Literal Translation",
                    ESV: "English Standard Version",
                    NASB: "New American Standard Bible",
                    NLT: "New Living Translation",
                };
                return translations.map((t) => ({
                    code: t._id,
                    name: translationNames[t._id] || t._id,
                    count: t.count,
                }));
            }
            catch (error) {
                logger_1.default.error("Failed to get translations:", error);
                return [{ code: "WEB", name: "World English Bible", count: 0 }];
            }
        });
    }
    /**
     * Get cross-references for a verse (placeholder - would need external API)
     */
    getCrossReferences(bookName, chapterNumber, verseNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would typically use an external cross-reference API
                // For now, return empty array
                return [];
            }
            catch (error) {
                logger_1.default.error("Failed to get cross-references:", error);
                return [];
            }
        });
    }
    /**
     * Get commentary for a verse (placeholder - would need external API)
     */
    getCommentary(bookName, chapterNumber, verseNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would typically use an external commentary API
                // For now, return null
                return null;
            }
            catch (error) {
                logger_1.default.error("Failed to get commentary:", error);
                return null;
            }
        });
    }
}
exports.default = new BibleService();
