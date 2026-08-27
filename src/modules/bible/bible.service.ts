import crypto from "crypto";
import {
  BibleBook,
  BibleChapter,
  BibleVerse,
  IBibleBook,
  IBibleChapter,
  IBibleVerse,
  IBibleSearchResult,
  BIBLE_BOOKS,
} from "../../models/bible.model";
import logger from "../../utils/logger";
import {
  DEFAULT_TRANSLATION_ID,
  UnknownTranslationError,
  shapeCatalogItem,
  toPublicTranslationId,
  toStorageTranslationCode,
  type TranslationCatalogItem,
} from "./bibleTranslations";
import { loadPackManifest } from "./biblePack";

export interface BibleSearchOptions {
  query: string;
  book?: string;
  testament?: "old" | "new";
  limit?: number;
  offset?: number;
  translation?: string;
}

export interface BibleBookVerses {
  bookName: string;
  translation: string;
  chapters: {
    chapterNumber: number;
    verses: { verseNumber: number; text: string }[];
  }[];
}

export interface BibleVerseRange {
  bookName: string;
  startChapter: number;
  startVerse: number;
  endChapter?: number;
  endVerse?: number;
}

export interface BibleReadingPlan {
  id: string;
  name: string;
  description: string;
  duration: number; // days
  readings: {
    day: number;
    bookName: string;
    startChapter: number;
    startVerse: number;
    endChapter: number;
    endVerse: number;
  }[];
}

/**
 * Corpus fingerprints per translation. Cached briefly so the catalog stays cheap;
 * a re-import surfaces within the TTL and moves clients onto fresh `?v=` URLs.
 */
const corpusVersionCache = new Map<string, { value: string; at: number }>();
const CORPUS_VERSION_TTL_MS = 10 * 60 * 1000;

/** name/abbrev (lowercased) -> canonical BibleBook.name. Built once per process. */
let bookNameIndex: Map<string, string> | null = null;
let bookNameIndexAt = 0;
const BOOK_NAME_INDEX_TTL_MS = 60 * 60 * 1000;

async function loadBookNameIndex(): Promise<Map<string, string>> {
  const now = Date.now();
  if (bookNameIndex && now - bookNameIndexAt < BOOK_NAME_INDEX_TTL_MS) {
    return bookNameIndex;
  }
  const map = new Map<string, string>();
  try {
    const books = await BibleBook.find({ isActive: true }).select(
      "name abbreviation"
    );
    for (const b of books) {
      map.set(String(b.name).toLowerCase(), b.name);
      if (b.abbreviation) map.set(String(b.abbreviation).toLowerCase(), b.name);
    }
  } catch (error) {
    logger.error("Failed to build Bible book name index:", error);
    return bookNameIndex || map;
  }
  bookNameIndex = map;
  bookNameIndexAt = now;
  return map;
}

/**
 * Exact-match filter when the name is known, so Mongo can use the
 * (translation, bookName, chapterNumber) index. Case-insensitive regex cannot.
 */
async function bookNameFilter(bookName: string): Promise<string | RegExp> {
  const index = await loadBookNameIndex();
  const canonical = index.get(String(bookName || "").trim().toLowerCase());
  if (canonical) return canonical;
  return new RegExp(`^${String(bookName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

class BibleService {
  /**
   * Get all Bible books
   */
  async getAllBooks(): Promise<IBibleBook[]> {
    try {
      const books = await BibleBook.find({ isActive: true }).sort({ order: 1 });
      return books;
    } catch (error) {
      logger.error("Failed to get all Bible books:", error);
      return [];
    }
  }

  /**
   * Get books by testament
   */
  async getBooksByTestament(testament: "old" | "new"): Promise<IBibleBook[]> {
    try {
      const books = await BibleBook.find({
        testament,
        isActive: true,
      }).sort({ order: 1 });
      return books;
    } catch (error) {
      logger.error("Failed to get books by testament:", error);
      return [];
    }
  }

  /**
   * Get a specific book by name or abbreviation
   */
  async getBookByName(bookName: string): Promise<IBibleBook | null> {
    try {
      const book = await BibleBook.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${bookName}$`, "i") } },
          { abbreviation: { $regex: new RegExp(`^${bookName}$`, "i") } },
        ],
        isActive: true,
      });
      return book;
    } catch (error) {
      logger.error("Failed to get book by name:", error);
      return null;
    }
  }

  /**
   * Get chapters for a specific book
   */
  async getChaptersByBook(bookName: string): Promise<IBibleChapter[]> {
    try {
      const chapters = await BibleChapter.find({
        bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
        isActive: true,
      }).sort({ chapterNumber: 1 });
      return chapters;
    } catch (error) {
      logger.error("Failed to get chapters by book:", error);
      return [];
    }
  }

  /**
   * Get a specific chapter
   */
  async getChapter(
    bookName: string,
    chapterNumber: number
  ): Promise<IBibleChapter | null> {
    try {
      const chapter = await BibleChapter.findOne({
        bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
        chapterNumber,
        isActive: true,
      });
      return chapter;
    } catch (error) {
      logger.error("Failed to get chapter:", error);
      return null;
    }
  }

  /**
   * Get verse count for a chapter
   */
  async getVerseCount(
    bookName: string,
    chapterNumber: number,
    translation?: string
  ): Promise<number> {
    try {
      const count = await BibleVerse.countDocuments({
        bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
        chapterNumber,
        isActive: true,
        ...(translation
          ? { translation: toStorageTranslationCode(translation) }
          : {}),
      });
      return count;
    } catch (error) {
      logger.error("Failed to get verse count:", error);
      return 0;
    }
  }

  /**
   * Get verses for a specific chapter
   */
  async getVersesByChapter(
    bookName: string,
    chapterNumber: number,
    translation?: string
  ): Promise<IBibleVerse[]> {
    try {
      const query: any = {
        bookName: await bookNameFilter(bookName),
        chapterNumber,
        isActive: true,
      };

      // Filter by translation if provided
      if (translation) {
        query.translation = toStorageTranslationCode(translation);
      }

      const verses = await BibleVerse.find(query).sort({ verseNumber: 1 });
      return verses;
    } catch (error) {
      logger.error("Failed to get verses by chapter:", error);
      return [];
    }
  }

  /**
   * Every verse of a book, grouped by chapter, in one round trip.
   * Returns null when the book is unknown so the caller can 404.
   */
  async getVersesByBook(
    bookName: string,
    translation: string
  ): Promise<BibleBookVerses | null> {
    const book = await this.getBookByName(bookName);
    if (!book) return null;

    const verses = await BibleVerse.find({
      bookName: book.name,
      translation: toStorageTranslationCode(translation),
      isActive: true,
    })
      .select("chapterNumber verseNumber text")
      .sort({ chapterNumber: 1, verseNumber: 1 })
      .lean();

    const byChapter = new Map<
      number,
      { verseNumber: number; text: string }[]
    >();
    for (const v of verses as any[]) {
      const list = byChapter.get(v.chapterNumber);
      const entry = { verseNumber: v.verseNumber, text: v.text };
      if (list) list.push(entry);
      else byChapter.set(v.chapterNumber, [entry]);
    }

    return {
      bookName: book.name,
      translation: toPublicTranslationId(translation),
      chapters: [...byChapter.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([chapterNumber, chapterVerses]) => ({
          chapterNumber,
          verses: chapterVerses,
        })),
    };
  }

  /**
   * Get a specific verse
   */
  async getVerse(
    bookName: string,
    chapterNumber: number,
    verseNumber: number,
    translation?: string
  ): Promise<IBibleVerse | null> {
    try {
      const query: any = {
        bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
        chapterNumber,
        verseNumber,
        isActive: true,
      };

      // Filter by translation if provided
      if (translation) {
        query.translation = toStorageTranslationCode(translation);
      }

      const verse = await BibleVerse.findOne(query);
      return verse;
    } catch (error) {
      logger.error("Failed to get verse:", error);
      return null;
    }
  }

  /**
   * Get a range of verses
   */
  async getVerseRange(
    range: BibleVerseRange,
    translation?: string
  ): Promise<IBibleVerse[]> {
    try {
      const { bookName, startChapter, startVerse, endChapter, endVerse } =
        range;

      const query: any = {
        bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
        isActive: true,
      };
      if (translation) {
        query.translation = toStorageTranslationCode(translation);
      }

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
      } else {
        // Single chapter range
        query.chapterNumber = startChapter;
        query.verseNumber = { $gte: startVerse };
        if (endVerse) {
          query.verseNumber.$lte = endVerse;
        }
      }

      const verses = await BibleVerse.find(query).sort({
        chapterNumber: 1,
        verseNumber: 1,
      });
      return verses;
    } catch (error) {
      logger.error("Failed to get verse range:", error);
      return [];
    }
  }

  /**
   * Search Bible text
   */
  async searchBible(
    options: BibleSearchOptions
  ): Promise<{
    results: IBibleSearchResult[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const { query, book, testament, limit = 50, offset = 0, translation } =
        options;

      const searchQuery: any = {
        $text: { $search: query },
        isActive: true,
      };
      if (translation) {
        searchQuery.translation = toStorageTranslationCode(translation);
      }

      if (book) {
        // Try to match book name or abbreviation (e.g., "pro" -> "Proverbs" or "Pro")
        const matchingBooks = await BibleBook.find({
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
        } else {
          // Fallback to exact match if no abbreviation/partial match found
          searchQuery.bookName = { $regex: new RegExp(`^${book}$`, "i") };
        }
      }

      if (testament) {
        // Get book IDs for the testament
        const books = await BibleBook.find({
          testament,
          isActive: true,
        }).select("_id");
        const bookIds = books.map(b => b._id);
        searchQuery.bookId = { $in: bookIds };
      }

      const total = await BibleVerse.countDocuments(searchQuery);

      const verses = await BibleVerse.find(searchQuery)
        .populate("bookId", "name abbreviation testament")
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .skip(offset);

      // Chapters for the whole page in one query instead of one per verse.
      const chapterDocs = verses.length
        ? await BibleChapter.find({
            isActive: true,
            $or: verses.map(v => ({
              bookName: v.bookName,
              chapterNumber: v.chapterNumber,
            })),
          })
        : [];
      const chapterByKey = new Map<string, IBibleChapter>();
      for (const c of chapterDocs) {
        chapterByKey.set(`${c.bookName}:${c.chapterNumber}`, c as IBibleChapter);
      }

      const results: IBibleSearchResult[] = verses.map(verse => ({
        verse: verse as IBibleVerse,
        book: verse.bookId as any,
        chapter:
          chapterByKey.get(`${verse.bookName}:${verse.chapterNumber}`) ||
          ({} as IBibleChapter),
      }));

      return { results, total, hasMore: offset + results.length < total };
    } catch (error) {
      logger.error("Failed to search Bible:", error);
      return { results: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get random verse
   */
  async getRandomVerse(translation?: string): Promise<IBibleVerse | null> {
    try {
      const match: Record<string, unknown> = { isActive: true };
      if (translation) {
        match.translation = toStorageTranslationCode(translation);
      }
      const verse = await BibleVerse.aggregate([
        { $match: match },
        { $sample: { size: 1 } },
      ]);
      return verse.length > 0 ? verse[0] : null;
    } catch (error) {
      logger.error("Failed to get random verse:", error);
      return null;
    }
  }

  /**
   * Get verse of the day (based on date)
   */
  async getVerseOfTheDay(translation?: string): Promise<IBibleVerse | null> {
    try {
      const today = new Date();
      const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const match: Record<string, unknown> = { isActive: true };
      if (translation) {
        match.translation = toStorageTranslationCode(translation);
      }
      const verse = await BibleVerse.aggregate([
        { $match: match },
        { $skip: dayOfYear % 31102 },
        { $limit: 1 },
      ]);

      return verse.length > 0 ? verse[0] : null;
    } catch (error) {
      logger.error("Failed to get verse of the day:", error);
      return null;
    }
  }

  /**
   * Get popular verses (most searched or referenced)
   */
  async getPopularVerses(
    limit: number = 10,
    translation?: string
  ): Promise<IBibleVerse[]> {
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

      const verses: IBibleVerse[] = [];
      for (const ref of popularReferences.slice(0, limit)) {
        const verse = await this.getVerse(
          ref.bookName,
          ref.chapterNumber,
          ref.verseNumber,
          translation
        );
        if (verse) verses.push(verse);
      }

      return verses;
    } catch (error) {
      logger.error("Failed to get popular verses:", error);
      return [];
    }
  }

  /**
   * Get Bible statistics
   */
  async getBibleStats(): Promise<{
    totalBooks: number;
    totalChapters: number;
    totalVerses: number;
    oldTestamentBooks: number;
    newTestamentBooks: number;
    oldTestamentChapters: number;
    newTestamentChapters: number;
    oldTestamentVerses: number;
    newTestamentVerses: number;
  }> {
    try {
      const [
        totalBooks,
        totalChapters,
        totalVerses,
        oldTestamentBooks,
        newTestamentBooks,
        oldTestamentChapters,
        newTestamentChapters,
        oldTestamentVerses,
        newTestamentVerses,
      ] = await Promise.all([
        BibleBook.countDocuments({ isActive: true }),
        BibleChapter.countDocuments({ isActive: true }),
        BibleVerse.countDocuments({ isActive: true }),
        BibleBook.countDocuments({ testament: "old", isActive: true }),
        BibleBook.countDocuments({ testament: "new", isActive: true }),
        BibleChapter.countDocuments({ testament: "old", isActive: true }),
        BibleChapter.countDocuments({ testament: "new", isActive: true }),
        BibleVerse.countDocuments({ testament: "old", isActive: true }),
        BibleVerse.countDocuments({ testament: "new", isActive: true }),
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
    } catch (error) {
      logger.error("Failed to get Bible stats:", error);
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
  }

  /**
   * Parse Bible reference (e.g., "John 3:16", "Genesis 1:1-3")
   */
  parseBibleReference(reference: string): BibleVerseRange | null {
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
    } catch (error) {
      logger.error("Failed to parse Bible reference:", error);
      return null;
    }
  }

  /**
   * Get reading plans
   */
  getReadingPlans(): BibleReadingPlan[] {
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
   * Distinct stored translation codes + verse counts (short memory cache).
   */
  private translationInventory:
    | { at: number; counts: Map<string, number> }
    | null = null;

  private async loadTranslationInventory(): Promise<Map<string, number>> {
    const now = Date.now();
    if (
      this.translationInventory &&
      now - this.translationInventory.at < 5 * 60 * 1000
    ) {
      return this.translationInventory.counts;
    }
    const rows = await BibleVerse.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$translation", count: { $sum: 1 } } },
    ]);
    const counts = new Map<string, number>();
    for (const r of rows as Array<{ _id: string; count: number }>) {
      if (r._id) counts.set(String(r._id).toUpperCase(), r.count || 0);
    }
    this.translationInventory = { at: now, counts };
    return counts;
  }

  /**
   * Resolve ?translation= to a public id. Omitted → web (today's corpus).
   * Unknown id → 404.
   */
  async resolveTranslation(raw?: unknown): Promise<string> {
    const omitted =
      raw === undefined || raw === null || String(raw).trim() === "";
    const publicId = omitted
      ? DEFAULT_TRANSLATION_ID
      : toPublicTranslationId(String(raw));
    if (omitted || publicId === DEFAULT_TRANSLATION_ID) {
      return DEFAULT_TRANSLATION_ID;
    }
    const inventory = await this.loadTranslationInventory();
    if (inventory.has(toStorageTranslationCode(publicId))) {
      return publicId;
    }
    throw new UnknownTranslationError(publicId);
  }

  /**
   * Opaque fingerprint of a translation's stored text: verse count plus the
   * newest verse mtime. Any re-import, correction, or reload moves it, which
   * moves clients onto a new `?v=` URL and abandons stale CDN entries.
   * Returns null on failure so callers simply omit `v` (revalidating caching).
   */
  async getCorpusVersion(translation: string): Promise<string | null> {
    const stored = toStorageTranslationCode(translation);
    const cached = corpusVersionCache.get(stored);
    if (cached && Date.now() - cached.at < CORPUS_VERSION_TTL_MS) {
      return cached.value;
    }

    try {
      const [count, newest] = await Promise.all([
        BibleVerse.countDocuments({ translation: stored, isActive: true }),
        BibleVerse.findOne({ translation: stored, isActive: true })
          .select("updatedAt")
          .sort({ updatedAt: -1 })
          .lean(),
      ]);

      if (!count) return null;

      const mtime = (newest as any)?.updatedAt
        ? new Date((newest as any).updatedAt).getTime()
        : 0;
      const value = crypto
        .createHash("sha1")
        .update(`${stored}:${count}:${mtime}`)
        .digest("hex")
        .slice(0, 12);

      corpusVersionCache.set(stored, { value, at: Date.now() });
      return value;
    } catch (error) {
      logger.error("Failed to compute Bible corpus version:", error);
      return null;
    }
  }

  /**
   * Catalog for FE picker. defaultId is always web (production corpus).
   * Licensed translations may appear with offline:false if present in Mongo.
   */
  async getTranslationCatalog(): Promise<{
    defaultId: string;
    translations: TranslationCatalogItem[];
  }> {
    const inventory = await this.loadTranslationInventory();
    const items: TranslationCatalogItem[] = [];

    const seen = new Set<string>();
    const ensure = (stored: string, count: number) => {
      const id = toPublicTranslationId(stored);
      if (seen.has(id)) return;
      seen.add(id);
      items.push(shapeCatalogItem({ storedCode: stored, verseCount: count }));
    };

    ensure("WEB", inventory.get("WEB") || 0);
    for (const [code, count] of inventory.entries()) {
      if (code === "WEB") continue;
      ensure(code, count);
    }

    await Promise.all(
      items.map(async (item, i) => {
        // Fingerprint every listed translation; packs only for unlicensed ones.
        const corpusVersion = await this.getCorpusVersion(item.code);
        let packBytes: number | null = null;
        if (item.license !== "licensed") {
          try {
            const manifest = await loadPackManifest(item.id);
            packBytes = manifest?.bytes || null;
          } catch {
            /* catalog still 200 with offline:false */
          }
        }
        items[i] = shapeCatalogItem({
          storedCode: item.code,
          verseCount: item.verseCount,
          packBytes,
          corpusVersion,
        });
      })
    );

    items.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.abbreviation.localeCompare(b.abbreviation);
    });

    return { defaultId: DEFAULT_TRANSLATION_ID, translations: items };
  }

  /**
   * Get available translations
   */
  async getAvailableTranslations(): Promise<TranslationCatalogItem[]> {
    try {
      const catalog = await this.getTranslationCatalog();
      return catalog.translations;
    } catch (error) {
      logger.error("Failed to get translations:", error);
      return [
        shapeCatalogItem({ storedCode: "WEB", verseCount: 0 }),
      ];
    }
  }

  /**
   * Get cross-references for a verse (placeholder - would need external API)
   */
  async getCrossReferences(
    bookName: string,
    chapterNumber: number,
    verseNumber: number
  ): Promise<IBibleVerse[]> {
    try {
      // This would typically use an external cross-reference API
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error("Failed to get cross-references:", error);
      return [];
    }
  }

  /**
   * Get commentary for a verse (placeholder - would need external API)
   */
  async getCommentary(
    bookName: string,
    chapterNumber: number,
    verseNumber: number
  ): Promise<string | null> {
    try {
      // This would typically use an external commentary API
      // For now, return null
      return null;
    } catch (error) {
      logger.error("Failed to get commentary:", error);
      return null;
    }
  }
}

export default new BibleService();
