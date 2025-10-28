import { Request, Response } from "express";
import bibleService from "../service/bible.service";
import logger from "../utils/logger";

/**
 * Get all Bible books
 */
export const getAllBooks = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const books = await bibleService.getAllBooks();

    response.status(200).json({
      success: true,
      data: books,
      count: books.length,
    });
  } catch (error) {
    logger.error("Get all books error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get Bible books",
    });
  }
};

/**
 * Get books by testament
 */
export const getBooksByTestament = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { testament } = request.params;

    if (!["old", "new"].includes(testament)) {
      response.status(400).json({
        success: false,
        message: "Invalid testament. Must be 'old' or 'new'",
      });
      return;
    }

    const books = await bibleService.getBooksByTestament(
      testament as "old" | "new"
    );

    response.status(200).json({
      success: true,
      data: books,
      count: books.length,
    });
  } catch (error) {
    logger.error("Get books by testament error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get books by testament",
    });
  }
};

/**
 * Get a specific book
 */
export const getBook = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { bookName } = request.params;
    const book = await bibleService.getBookByName(bookName);

    if (book) {
      response.status(200).json({
        success: true,
        data: book,
      });
    } else {
      response.status(404).json({
        success: false,
        message: "Book not found",
      });
    }
  } catch (error) {
    logger.error("Get book error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get book",
    });
  }
};

/**
 * Get chapters for a book
 */
export const getChapters = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { bookName } = request.params;
    const chapters = await bibleService.getChaptersByBook(bookName);

    response.status(200).json({
      success: true,
      data: chapters,
      count: chapters.length,
    });
  } catch (error) {
    logger.error("Get chapters error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get chapters",
    });
  }
};

/**
 * Get a specific chapter
 */
export const getChapter = async (
  request: Request,
  response: Response
): Promise<void> => {
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

    const chapter = await bibleService.getChapter(bookName, chapterNum);

    if (chapter) {
      // Get actual verse count from database
      const verseCount = await bibleService.getVerseCount(bookName, chapterNum);

      response.status(200).json({
        success: true,
        data: {
          ...chapter.toObject(),
          actualVerseCount: verseCount, // Actual count from verses in DB
        },
      });
    } else {
      response.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }
  } catch (error) {
    logger.error("Get chapter error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get chapter",
    });
  }
};

/**
 * Get verses for a chapter
 */
export const getVerses = async (
  request: Request,
  response: Response
): Promise<void> => {
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

    const verses = await bibleService.getVersesByChapter(bookName, chapterNum);

    response.status(200).json({
      success: true,
      data: verses,
      count: verses.length,
    });
  } catch (error) {
    logger.error("Get verses error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get verses",
    });
  }
};

/**
 * Get a specific verse
 */
export const getVerse = async (
  request: Request,
  response: Response
): Promise<void> => {
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

    const verse = await bibleService.getVerse(bookName, chapterNum, verseNum);

    if (verse) {
      response.status(200).json({
        success: true,
        data: verse,
      });
    } else {
      response.status(404).json({
        success: false,
        message: "Verse not found",
      });
    }
  } catch (error) {
    logger.error("Get verse error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get verse",
    });
  }
};

/**
 * Get a range of verses
 */
export const getVerseRange = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { reference } = request.params;

    // Decode URL-encoded reference (e.g., "Romans%208:28-31" -> "Romans 8:28-31")
    let decodedReference: string;
    try {
      decodedReference = decodeURIComponent(reference);
    } catch (decodeError) {
      // If decoding fails (invalid encoding), use the original reference
      decodedReference = reference;
    }

    const range = bibleService.parseBibleReference(decodedReference);

    if (!range) {
      response.status(400).json({
        success: false,
        message:
          "Invalid Bible reference format. Use format like 'John 3:16' or 'Genesis 1:1-3'",
      });
      return;
    }

    const verses = await bibleService.getVerseRange(range);

    response.status(200).json({
      success: true,
      data: verses,
      count: verses.length,
      reference: range,
    });
  } catch (error) {
    logger.error("Get verse range error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get verse range",
    });
  }
};

/**
 * Search Bible text
 */
export const searchBible = async (
  request: Request,
  response: Response
): Promise<void> => {
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
      book: book as string,
      testament: testament as "old" | "new",
      limit: parseInt(limit as string) || 50,
      offset: parseInt(offset as string) || 0,
    };

    const results = await bibleService.searchBible(searchOptions);

    response.status(200).json({
      success: true,
      data: results,
      count: results.length,
      query: searchOptions,
    });
  } catch (error) {
    logger.error("Search Bible error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to search Bible",
    });
  }
};

/**
 * Advanced AI-powered Bible search
 * Understands natural language queries
 */
export const advancedSearchBible = async (
  request: Request,
  response: Response
): Promise<void> => {
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
    const aiBibleSearchService = (await import("../service/aiBibleSearch.service")).default;

    const searchOptions = {
      limit: parseInt(limit as string) || 20,
      book: book as string,
      testament: testament as "old" | "new",
    };

    const aiResults = await aiBibleSearchService.advancedSearch(q, searchOptions);

    // Transform results for frontend
    const transformedResults = aiResults.results.map((result) => ({
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
  } catch (error) {
    logger.error("Advanced AI search error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to perform advanced search",
    });
  }
};

/**
 * Get random verse
 */
export const getRandomVerse = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const verse = await bibleService.getRandomVerse();

    if (verse) {
      response.status(200).json({
        success: true,
        data: verse,
      });
    } else {
      response.status(404).json({
        success: false,
        message: "No verses found",
      });
    }
  } catch (error) {
    logger.error("Get random verse error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get random verse",
    });
  }
};

/**
 * Get verse of the day
 */
export const getVerseOfTheDay = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const verse = await bibleService.getVerseOfTheDay();

    if (verse) {
      response.status(200).json({
        success: true,
        data: verse,
        date: new Date().toISOString().split("T")[0],
      });
    } else {
      response.status(404).json({
        success: false,
        message: "No verse of the day found",
      });
    }
  } catch (error) {
    logger.error("Get verse of the day error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get verse of the day",
    });
  }
};

/**
 * Get popular verses
 */
export const getPopularVerses = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { limit = 10 } = request.query;
    const limitNum = parseInt(limit as string) || 10;

    const verses = await bibleService.getPopularVerses(limitNum);

    response.status(200).json({
      success: true,
      data: verses,
      count: verses.length,
    });
  } catch (error) {
    logger.error("Get popular verses error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get popular verses",
    });
  }
};

/**
 * Get Bible statistics
 */
export const getBibleStats = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const stats = await bibleService.getBibleStats();

    response.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Get Bible stats error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get Bible statistics",
    });
  }
};

/**
 * Get reading plans
 */
export const getReadingPlans = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const plans = bibleService.getReadingPlans();

    response.status(200).json({
      success: true,
      data: plans,
      count: plans.length,
    });
  } catch (error) {
    logger.error("Get reading plans error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get reading plans",
    });
  }
};

/**
 * Get cross-references for a verse
 */
export const getCrossReferences = async (
  request: Request,
  response: Response
): Promise<void> => {
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

    const crossReferences = await bibleService.getCrossReferences(
      bookName,
      chapterNum,
      verseNum
    );

    response.status(200).json({
      success: true,
      data: crossReferences,
      count: crossReferences.length,
    });
  } catch (error) {
    logger.error("Get cross-references error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get cross-references",
    });
  }
};

/**
 * Get commentary for a verse
 */
export const getCommentary = async (
  request: Request,
  response: Response
): Promise<void> => {
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

    const commentary = await bibleService.getCommentary(
      bookName,
      chapterNum,
      verseNum
    );

    response.status(200).json({
      success: true,
      data: { commentary },
    });
  } catch (error) {
    logger.error("Get commentary error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get commentary",
    });
  }
};
