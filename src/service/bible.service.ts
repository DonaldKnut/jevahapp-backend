import {
  BibleBook,
  BibleChapter,
  BibleVerse,
  IBibleBook,
  IBibleChapter,
  IBibleVerse,
  IBibleSearchResult,
  BIBLE_BOOKS,
} from "../models/bible.model";
import logger from "../utils/logger";

export interface BibleSearchOptions {
  query: string;
  book?: string;
  testament?: "old" | "new";
  limit?: number;
  offset?: number;
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
    chapterNumber: number
  ): Promise<number> {
    try {
      const count = await BibleVerse.countDocuments({
        bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
        chapterNumber,
        isActive: true,
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
        bookName: { $regex: new RegExp(`^${bookName}$`, "i") },
        chapterNumber,
        isActive: true,
      };

      // Filter by translation if provided
      if (translation) {
        query.translation = translation.toUpperCase();
      }

      const verses = await BibleVerse.find(query).sort({ verseNumber: 1 });
      return verses;
    } catch (error) {
      logger.error("Failed to get verses by chapter:", error);
      return [];
    }
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
        query.translation = translation.toUpperCase();
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
  async getVerseRange(range: BibleVerseRange): Promise<IBibleVerse[]> {
    try {
      const { bookName, startChapter, startVerse, endChapter, endVerse } =
        range;

      const query: any = {
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
  ): Promise<IBibleSearchResult[]> {
    try {
      const { query, book, testament, limit = 50, offset = 0 } = options;

      const searchQuery: any = {
        $text: { $search: query },
        isActive: true,
      };

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

      const verses = await BibleVerse.find(searchQuery)
        .populate("bookId", "name abbreviation testament")
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .skip(offset);

      // Get chapters for the verses
      const results: IBibleSearchResult[] = [];
      for (const verse of verses) {
        const chapter = await BibleChapter.findOne({
          bookName: verse.bookName,
          chapterNumber: verse.chapterNumber,
          isActive: true,
        });

        results.push({
          verse: verse as IBibleVerse,
          book: verse.bookId as any,
          chapter: chapter || ({} as IBibleChapter),
        });
      }

      return results;
    } catch (error) {
      logger.error("Failed to search Bible:", error);
      return [];
    }
  }

  /**
   * Get random verse
   */
  async getRandomVerse(): Promise<IBibleVerse | null> {
    try {
      const verse = await BibleVerse.aggregate([
        { $match: { isActive: true } },
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
  async getVerseOfTheDay(): Promise<IBibleVerse | null> {
    try {
      const today = new Date();
      const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Use day of year to get a consistent verse for the day
      const verse = await BibleVerse.aggregate([
        { $match: { isActive: true } },
        { $skip: dayOfYear % 31102 }, // 31102 is approximate total verses
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
  async getPopularVerses(limit: number = 10): Promise<IBibleVerse[]> {
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
          ref.verseNumber
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
   * Get available translations
   */
  async getAvailableTranslations(): Promise<
    Array<{ code: string; name: string; count: number }>
  > {
    try {
      const translations = await BibleVerse.aggregate([
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
      const translationNames: { [key: string]: string } = {
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

      return translations.map(t => ({
        code: t._id,
        name: translationNames[t._id] || t._id,
        count: t.count,
      }));
    } catch (error) {
      logger.error("Failed to get translations:", error);
      return [{ code: "WEB", name: "World English Bible", count: 0 }];
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
