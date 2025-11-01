const mongoose = require("mongoose");
const axios = require("axios");

// Load environment variables
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
);

// Import models
const {
  BibleBook,
  BibleChapter,
  BibleVerse,
} = require("../dist/models/bible.model");

// Configuration
const CONFIG = {
  DELAY_BETWEEN_REQUESTS: 300, // 300ms delay between requests
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  TIMEOUT: 20000, // 20 seconds timeout
  BIBLE_API_BASE: "https://bible-api.com",
};

// Missing chapters from the error log
const MISSING_CHAPTERS = [
  // Old Testament
  { book: "Genesis", chapter: 3 },
  { book: "Exodus", chapter: 12 },
  { book: "Numbers", chapter: 32 },
  { book: "Numbers", chapter: 35 },
  { book: "Numbers", chapter: 36 },
  { book: "Deuteronomy", chapter: 24 },
  { book: "Deuteronomy", chapter: 25 },
  { book: "Deuteronomy", chapter: 26 },
  { book: "Deuteronomy", chapter: 28 },
  { book: "Joshua", chapter: 3 },
  { book: "Joshua", chapter: 4 },
  { book: "Joshua", chapter: 5 },
  { book: "Joshua", chapter: 6 },
  { book: "Joshua", chapter: 7 },
  { book: "Joshua", chapter: 8 },
  { book: "1 Kings", chapter: 2 },
  { book: "1 Kings", chapter: 12 },
  { book: "1 Kings", chapter: 13 },
  { book: "1 Kings", chapter: 18 },
  { book: "2 Kings", chapter: 2 },
  { book: "2 Kings", chapter: 4 },
  { book: "Psalms", chapter: 78 },
  { book: "Jeremiah", chapter: 23 },
  { book: "Ezekiel", chapter: 37 },
  { book: "Ezekiel", chapter: 38 },
  { book: "Hosea", chapter: 9 },
  { book: "Amos", chapter: 8 },
  { book: "Nahum", chapter: 3 },
  { book: "Romans", chapter: 11 },
  { book: "Romans", chapter: 12 },
  { book: "Romans", chapter: 13 },
  { book: "Romans", chapter: 16 },
  { book: "Hebrews", chapter: 13 },
  { book: "Luke", chapter: 17 },

  // New Testament
  { book: "Matthew", chapter: 5 },
  { book: "Acts", chapter: 8 },
  { book: "Acts", chapter: 15 },
  { book: "Acts", chapter: 24 },
];

async function fillMissingVerses() {
  try {
    console.log("🔧 Starting to fill missing verses...");
    console.log(
      `📊 Found ${MISSING_CHAPTERS.length} missing chapters to process`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const missing of MISSING_CHAPTERS) {
      try {
        console.log(`\n📖 Processing ${missing.book} ${missing.chapter}...`);

        // Get the book from database
        const book = await BibleBook.findOne({
          name: missing.book,
          isActive: true,
        });

        if (!book) {
          console.log(`❌ Book not found: ${missing.book}`);
          errorCount++;
          continue;
        }

        // Check if chapter already exists
        const existingChapter = await BibleChapter.findOne({
          bookId: book._id,
          chapterNumber: missing.chapter,
          isActive: true,
        });

        if (existingChapter) {
          console.log(
            `✅ Chapter already exists: ${missing.book} ${missing.chapter}`
          );
          continue;
        }

        // Fetch from API
        const verses = await fetchChapterFromAPI(missing.book, missing.chapter);

        if (verses && verses.length > 0) {
          await saveChapter(book, missing.chapter, verses);
          console.log(
            `✅ ${missing.book} ${missing.chapter}: ${verses.length} verses saved`
          );
          successCount++;
        } else {
          console.log(
            `⚠️  No verses found for ${missing.book} ${missing.chapter}`
          );
          errorCount++;
        }

        // Rate limiting
        await new Promise(resolve =>
          setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS)
        );
      } catch (error) {
        console.log(
          `❌ Error processing ${missing.book} ${missing.chapter}: ${error.message}`
        );
        errorCount++;
      }
    }

    console.log("\n🎉 Missing verses processing completed!");
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    // Get final statistics
    const stats = await getFinalStats();
    console.log("\n📊 Final Statistics:");
    console.log(`📚 Books: ${stats.totalBooks}`);
    console.log(`📖 Chapters: ${stats.totalChapters}`);
    console.log(`📝 Verses: ${stats.totalVerses}`);
  } catch (error) {
    console.error("❌ Critical error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

async function fetchChapterFromAPI(bookName, chapterNumber) {
  let retries = 0;

  while (retries < CONFIG.MAX_RETRIES) {
    try {
      const chapterRef = `${bookName}+${chapterNumber}`;
      const apiUrl = `${CONFIG.BIBLE_API_BASE}/${chapterRef}`;

      const response = await axios.get(apiUrl, {
        timeout: CONFIG.TIMEOUT,
        headers: {
          "User-Agent": "Jevah-Bible-App/1.0",
          Accept: "application/json",
        },
      });

      if (
        response.data &&
        response.data.verses &&
        response.data.verses.length > 0
      ) {
        return response.data.verses;
      } else {
        throw new Error("No verses found in response");
      }
    } catch (error) {
      retries++;

      if (retries >= CONFIG.MAX_RETRIES) {
        console.log(
          `⚠️  Failed to fetch ${bookName} ${chapterNumber} after ${CONFIG.MAX_RETRIES} attempts`
        );
        return null;
      }

      // Wait before retry
      await new Promise(resolve =>
        setTimeout(resolve, CONFIG.RETRY_DELAY * retries)
      );
    }
  }

  return null;
}

async function saveChapter(book, chapterNumber, verses) {
  // Create chapter
  const chapter = new BibleChapter({
    bookId: book._id,
    bookName: book.name,
    chapterNumber: chapterNumber,
    verses: verses.length,
    isActive: true,
  });
  await chapter.save();

  // Create verses
  const versePromises = verses.map(verseData => {
    const verse = new BibleVerse({
      bookId: book._id,
      bookName: book.name,
      chapterNumber: chapterNumber,
      verseNumber: verseData.verse,
      text: verseData.text,
      translation: "WEB",
      isActive: true,
    });
    return verse.save();
  });

  await Promise.all(versePromises);
}

async function getFinalStats() {
  const [totalBooks, totalChapters, totalVerses] = await Promise.all([
    BibleBook.countDocuments({ isActive: true }),
    BibleChapter.countDocuments({ isActive: true }),
    BibleVerse.countDocuments({ isActive: true }),
  ]);

  return {
    totalBooks,
    totalChapters,
    totalVerses,
  };
}

// Function to check what's actually missing
async function checkMissingChapters() {
  try {
    console.log("🔍 Checking for missing chapters...");

    const books = await BibleBook.find({ isActive: true }).sort({ order: 1 });
    let totalMissing = 0;
    const missingList = [];

    for (const book of books) {
      const existingChapters = await BibleChapter.find({
        bookId: book._id,
        isActive: true,
      });
      const existingChapterNumbers = existingChapters
        .map(c => c.chapterNumber)
        .sort((a, b) => a - b);

      const expectedChapters = Array.from(
        { length: book.chapters },
        (_, i) => i + 1
      );
      const missingChapters = expectedChapters.filter(
        num => !existingChapterNumbers.includes(num)
      );

      if (missingChapters.length > 0) {
        console.log(
          `📖 ${book.name}: Missing chapters ${missingChapters.join(", ")}`
        );
        missingChapters.forEach(chapter => {
          missingList.push({ book: book.name, chapter });
        });
        totalMissing += missingChapters.length;
      }
    }

    console.log(`\n📊 Total missing chapters: ${totalMissing}`);

    // Check for placeholder verses
    const placeholderVerses = await BibleVerse.countDocuments({
      text: { $regex: "data not available", $options: "i" },
    });
    console.log(`📝 Placeholder verses: ${placeholderVerses}`);

    return missingList;
  } catch (error) {
    console.log("❌ Error checking missing chapters:", error.message);
    return [];
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    checkMissingChapters().then(() => process.exit(0));
  } else if (args.includes("--help")) {
    console.log(`
🔧 Fill Missing Bible Verses Script

Usage:
  node scripts/fill-missing-verses.js           # Fill missing verses
  node scripts/fill-missing-verses.js --check   # Check what's missing
  node scripts/fill-missing-verses.js --help    # Show this help

This script will:
✅ Fetch missing chapters from bible-api.com
✅ Fill in gaps in your Bible database
✅ Handle rate limiting and errors
✅ Provide progress updates
    `);
  } else {
    fillMissingVerses();
  }
}

module.exports = { fillMissingVerses, checkMissingChapters };










