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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BIBLE_BOOKS = exports.BibleVerse = exports.BibleChapter = exports.BibleBook = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Bible Book Schema
const bibleBookSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true,
    },
    abbreviation: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true,
    },
    testament: {
        type: String,
        enum: ["old", "new"],
        required: true,
        index: true,
    },
    order: {
        type: Number,
        required: true,
        unique: true,
        index: true,
    },
    chapters: {
        type: Number,
        required: true,
        min: 1,
    },
    description: {
        type: String,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, {
    timestamps: true,
});
// Bible Chapter Schema
const bibleChapterSchema = new mongoose_1.Schema({
    bookId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "BibleBook",
        required: true,
        index: true,
    },
    bookName: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    chapterNumber: {
        type: Number,
        required: true,
        min: 1,
    },
    verses: {
        type: Number,
        required: true,
        min: 1,
    },
    summary: {
        type: String,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, {
    timestamps: true,
});
// Bible Verse Schema
const bibleVerseSchema = new mongoose_1.Schema({
    bookId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "BibleBook",
        required: true,
        index: true,
    },
    bookName: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    chapterNumber: {
        type: Number,
        required: true,
        min: 1,
        index: true,
    },
    verseNumber: {
        type: Number,
        required: true,
        min: 1,
        index: true,
    },
    text: {
        type: String,
        required: true,
        trim: true,
    },
    translation: {
        type: String,
        required: true,
        default: "WEB",
        index: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
}, {
    timestamps: true,
});
// Create compound indexes for efficient queries
bibleChapterSchema.index({ bookId: 1, chapterNumber: 1 }, { unique: true });
bibleVerseSchema.index({ bookId: 1, chapterNumber: 1, verseNumber: 1, translation: 1 }, { unique: true });
bibleVerseSchema.index({ bookName: 1, chapterNumber: 1, verseNumber: 1, translation: 1 }, { unique: true });
// Text search index for verse content
bibleVerseSchema.index({ text: "text" });
// Export models
exports.BibleBook = mongoose_1.default.models.BibleBook ||
    mongoose_1.default.model("BibleBook", bibleBookSchema);
exports.BibleChapter = mongoose_1.default.models.BibleChapter ||
    mongoose_1.default.model("BibleChapter", bibleChapterSchema);
exports.BibleVerse = mongoose_1.default.models.BibleVerse ||
    mongoose_1.default.model("BibleVerse", bibleVerseSchema);
// Bible Books Data (66 books of the Bible)
exports.BIBLE_BOOKS = [
    // Old Testament
    {
        name: "Genesis",
        abbreviation: "Gen",
        testament: "old",
        order: 1,
        chapters: 50,
    },
    {
        name: "Exodus",
        abbreviation: "Exo",
        testament: "old",
        order: 2,
        chapters: 40,
    },
    {
        name: "Leviticus",
        abbreviation: "Lev",
        testament: "old",
        order: 3,
        chapters: 27,
    },
    {
        name: "Numbers",
        abbreviation: "Num",
        testament: "old",
        order: 4,
        chapters: 36,
    },
    {
        name: "Deuteronomy",
        abbreviation: "Deu",
        testament: "old",
        order: 5,
        chapters: 34,
    },
    {
        name: "Joshua",
        abbreviation: "Jos",
        testament: "old",
        order: 6,
        chapters: 24,
    },
    {
        name: "Judges",
        abbreviation: "Jdg",
        testament: "old",
        order: 7,
        chapters: 21,
    },
    {
        name: "Ruth",
        abbreviation: "Rut",
        testament: "old",
        order: 8,
        chapters: 4,
    },
    {
        name: "1 Samuel",
        abbreviation: "1Sa",
        testament: "old",
        order: 9,
        chapters: 31,
    },
    {
        name: "2 Samuel",
        abbreviation: "2Sa",
        testament: "old",
        order: 10,
        chapters: 24,
    },
    {
        name: "1 Kings",
        abbreviation: "1Ki",
        testament: "old",
        order: 11,
        chapters: 22,
    },
    {
        name: "2 Kings",
        abbreviation: "2Ki",
        testament: "old",
        order: 12,
        chapters: 25,
    },
    {
        name: "1 Chronicles",
        abbreviation: "1Ch",
        testament: "old",
        order: 13,
        chapters: 29,
    },
    {
        name: "2 Chronicles",
        abbreviation: "2Ch",
        testament: "old",
        order: 14,
        chapters: 36,
    },
    {
        name: "Ezra",
        abbreviation: "Ezr",
        testament: "old",
        order: 15,
        chapters: 10,
    },
    {
        name: "Nehemiah",
        abbreviation: "Neh",
        testament: "old",
        order: 16,
        chapters: 13,
    },
    {
        name: "Esther",
        abbreviation: "Est",
        testament: "old",
        order: 17,
        chapters: 10,
    },
    {
        name: "Job",
        abbreviation: "Job",
        testament: "old",
        order: 18,
        chapters: 42,
    },
    {
        name: "Psalms",
        abbreviation: "Psa",
        testament: "old",
        order: 19,
        chapters: 150,
    },
    {
        name: "Proverbs",
        abbreviation: "Pro",
        testament: "old",
        order: 20,
        chapters: 31,
    },
    {
        name: "Ecclesiastes",
        abbreviation: "Ecc",
        testament: "old",
        order: 21,
        chapters: 12,
    },
    {
        name: "Song of Solomon",
        abbreviation: "Sng",
        testament: "old",
        order: 22,
        chapters: 8,
    },
    {
        name: "Isaiah",
        abbreviation: "Isa",
        testament: "old",
        order: 23,
        chapters: 66,
    },
    {
        name: "Jeremiah",
        abbreviation: "Jer",
        testament: "old",
        order: 24,
        chapters: 52,
    },
    {
        name: "Lamentations",
        abbreviation: "Lam",
        testament: "old",
        order: 25,
        chapters: 5,
    },
    {
        name: "Ezekiel",
        abbreviation: "Eze",
        testament: "old",
        order: 26,
        chapters: 48,
    },
    {
        name: "Daniel",
        abbreviation: "Dan",
        testament: "old",
        order: 27,
        chapters: 12,
    },
    {
        name: "Hosea",
        abbreviation: "Hos",
        testament: "old",
        order: 28,
        chapters: 14,
    },
    {
        name: "Joel",
        abbreviation: "Joe",
        testament: "old",
        order: 29,
        chapters: 3,
    },
    {
        name: "Amos",
        abbreviation: "Amo",
        testament: "old",
        order: 30,
        chapters: 9,
    },
    {
        name: "Obadiah",
        abbreviation: "Oba",
        testament: "old",
        order: 31,
        chapters: 1,
    },
    {
        name: "Jonah",
        abbreviation: "Jon",
        testament: "old",
        order: 32,
        chapters: 4,
    },
    {
        name: "Micah",
        abbreviation: "Mic",
        testament: "old",
        order: 33,
        chapters: 7,
    },
    {
        name: "Nahum",
        abbreviation: "Nah",
        testament: "old",
        order: 34,
        chapters: 3,
    },
    {
        name: "Habakkuk",
        abbreviation: "Hab",
        testament: "old",
        order: 35,
        chapters: 3,
    },
    {
        name: "Zephaniah",
        abbreviation: "Zep",
        testament: "old",
        order: 36,
        chapters: 3,
    },
    {
        name: "Haggai",
        abbreviation: "Hag",
        testament: "old",
        order: 37,
        chapters: 2,
    },
    {
        name: "Zechariah",
        abbreviation: "Zec",
        testament: "old",
        order: 38,
        chapters: 14,
    },
    {
        name: "Malachi",
        abbreviation: "Mal",
        testament: "old",
        order: 39,
        chapters: 4,
    },
    // New Testament
    {
        name: "Matthew",
        abbreviation: "Mat",
        testament: "new",
        order: 40,
        chapters: 28,
    },
    {
        name: "Mark",
        abbreviation: "Mar",
        testament: "new",
        order: 41,
        chapters: 16,
    },
    {
        name: "Luke",
        abbreviation: "Luk",
        testament: "new",
        order: 42,
        chapters: 24,
    },
    {
        name: "John",
        abbreviation: "Joh",
        testament: "new",
        order: 43,
        chapters: 21,
    },
    {
        name: "Acts",
        abbreviation: "Act",
        testament: "new",
        order: 44,
        chapters: 28,
    },
    {
        name: "Romans",
        abbreviation: "Rom",
        testament: "new",
        order: 45,
        chapters: 16,
    },
    {
        name: "1 Corinthians",
        abbreviation: "1Co",
        testament: "new",
        order: 46,
        chapters: 16,
    },
    {
        name: "2 Corinthians",
        abbreviation: "2Co",
        testament: "new",
        order: 47,
        chapters: 13,
    },
    {
        name: "Galatians",
        abbreviation: "Gal",
        testament: "new",
        order: 48,
        chapters: 6,
    },
    {
        name: "Ephesians",
        abbreviation: "Eph",
        testament: "new",
        order: 49,
        chapters: 6,
    },
    {
        name: "Philippians",
        abbreviation: "Phi",
        testament: "new",
        order: 50,
        chapters: 4,
    },
    {
        name: "Colossians",
        abbreviation: "Col",
        testament: "new",
        order: 51,
        chapters: 4,
    },
    {
        name: "1 Thessalonians",
        abbreviation: "1Th",
        testament: "new",
        order: 52,
        chapters: 5,
    },
    {
        name: "2 Thessalonians",
        abbreviation: "2Th",
        testament: "new",
        order: 53,
        chapters: 3,
    },
    {
        name: "1 Timothy",
        abbreviation: "1Ti",
        testament: "new",
        order: 54,
        chapters: 6,
    },
    {
        name: "2 Timothy",
        abbreviation: "2Ti",
        testament: "new",
        order: 55,
        chapters: 4,
    },
    {
        name: "Titus",
        abbreviation: "Tit",
        testament: "new",
        order: 56,
        chapters: 3,
    },
    {
        name: "Philemon",
        abbreviation: "Phm",
        testament: "new",
        order: 57,
        chapters: 1,
    },
    {
        name: "Hebrews",
        abbreviation: "Heb",
        testament: "new",
        order: 58,
        chapters: 13,
    },
    {
        name: "James",
        abbreviation: "Jam",
        testament: "new",
        order: 59,
        chapters: 5,
    },
    {
        name: "1 Peter",
        abbreviation: "1Pe",
        testament: "new",
        order: 60,
        chapters: 5,
    },
    {
        name: "2 Peter",
        abbreviation: "2Pe",
        testament: "new",
        order: 61,
        chapters: 3,
    },
    {
        name: "1 John",
        abbreviation: "1Jo",
        testament: "new",
        order: 62,
        chapters: 5,
    },
    {
        name: "2 John",
        abbreviation: "2Jo",
        testament: "new",
        order: 63,
        chapters: 1,
    },
    {
        name: "3 John",
        abbreviation: "3Jo",
        testament: "new",
        order: 64,
        chapters: 1,
    },
    {
        name: "Jude",
        abbreviation: "Jud",
        testament: "new",
        order: 65,
        chapters: 1,
    },
    {
        name: "Revelation",
        abbreviation: "Rev",
        testament: "new",
        order: 66,
        chapters: 22,
    },
];
