const mongoose = require("mongoose");
const axios = require("axios");
const BibleBook = require("../dist/models/bible.model.js").BibleBook;
const BibleChapter = require("../dist/models/bible.model.js").BibleChapter;
const BibleVerse = require("../dist/models/bible.model.js").BibleVerse;

// Configuration
const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  TIMEOUT: 15000,
  DELAY_BETWEEN_REQUESTS: 1000,
};

// Alternative Bible APIs
const BIBLE_APIS = {
  // Primary API (World English Bible)
  bibleApi: {
    base: "https://bible-api.com",
    format: (book, chapter) => `${book}+${chapter}`,
    parseResponse: data => data.verses || [],
  },

  // Bible Gateway API (Alternative)
  bibleGateway: {
    base: "https://www.biblegateway.com/passage",
    format: (book, chapter) => `?search=${book}+${chapter}&version=WEB`,
    parseResponse: html => {
      // This would need HTML parsing - simplified for now
      return [];
    },
  },

  // ESV API (Alternative)
  esvApi: {
    base: "https://api.esv.org/v3/passage/text",
    format: (book, chapter) =>
      `?q=${book}+${chapter}&include-headings=false&include-footnotes=false&include-verse-numbers=true&include-short-copyright=false&include-passage-references=false`,
    headers: {
      Authorization: "Token YOUR_ESV_API_KEY", // Would need actual API key
    },
    parseResponse: data => {
      if (data.passages && data.passages[0]) {
        const text = data.passages[0];
        // Parse ESV format - simplified
        return [];
      }
      return [];
    },
  },

  // Bible.com API (Alternative)
  bibleCom: {
    base: "https://www.bible.com/api/bible",
    format: (book, chapter) => `/WEB/${book}/${chapter}`,
    parseResponse: data => data.verses || [],
  },
};

// Known missing chapters from the previous run
const MISSING_CHAPTERS = [
  // Old Testament
  { book: "1 Chronicles", chapter: 1 },
  { book: "1 Chronicles", chapter: 17 },
  { book: "1 Chronicles", chapter: 18 },
  { book: "2 Chronicles", chapter: 5 },
  { book: "2 Chronicles", chapter: 21 },
  { book: "Esther", chapter: 7 },
  { book: "Job", chapter: 13 },
  { book: "Job", chapter: 29 },
  { book: "Psalms", chapter: 3 },
  { book: "Psalms", chapter: 19 },
  { book: "Psalms", chapter: 35 },
  { book: "Psalms", chapter: 51 },
  { book: "Psalms", chapter: 67 },
  { book: "Psalms", chapter: 83 },
  { book: "Psalms", chapter: 108 },
  { book: "Psalms", chapter: 109 },
  { book: "Psalms", chapter: 125 },
  { book: "Psalms", chapter: 141 },
  { book: "Isaiah", chapter: 1 },
  { book: "Isaiah", chapter: 17 },
  { book: "Isaiah", chapter: 33 },
  { book: "Isaiah", chapter: 49 },
  { book: "Isaiah", chapter: 50 },
  { book: "Isaiah", chapter: 66 },
  { book: "Jeremiah", chapter: 18 },
  { book: "Jeremiah", chapter: 34 },
  { book: "Jeremiah", chapter: 50 },
  { book: "Ezekiel", chapter: 9 },
  { book: "Ezekiel", chapter: 40 },
  { book: "Daniel", chapter: 8 },
  { book: "Hosea", chapter: 12 },
  { book: "Hosea", chapter: 13 },
  { book: "Habakkuk", chapter: 3 },

  // New Testament
  { book: "Matthew", chapter: 8 },
  { book: "Matthew", chapter: 24 },
  { book: "Mark", chapter: 12 },
  { book: "Luke", chapter: 12 },
  { book: "John", chapter: 4 },
  { book: "John", chapter: 20 },
  { book: "Acts", chapter: 15 },
  { book: "Acts", chapter: 16 },
  { book: "Romans", chapter: 4 },
  { book: "Ephesians", chapter: 6 },
  { book: "Hebrews", chapter: 1 },
];

async function completeMissingVerses() {
  try {
    console.log("🚀 Starting final Bible completion with alternative APIs...");
    console.log(`📊 Processing ${MISSING_CHAPTERS.length} missing chapters`);

    await mongoose.connect("mongodb://localhost:27017/jevah-app");
    console.log("✅ Connected to database");

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

        // Try multiple APIs
        let verses = null;
        let apiUsed = "";

        // Try primary API first
        verses = await fetchFromAPI("bibleApi", missing.book, missing.chapter);
        if (verses && verses.length > 0) {
          apiUsed = "Bible API";
        } else {
          // Try alternative APIs
          verses = await fetchFromAPI(
            "bibleCom",
            missing.book,
            missing.chapter
          );
          if (verses && verses.length > 0) {
            apiUsed = "Bible.com";
          }
        }

        if (verses && verses.length > 0) {
          await saveChapter(book, missing.chapter, verses);
          console.log(
            `✅ ${missing.book} ${missing.chapter}: ${verses.length} verses saved (${apiUsed})`
          );
          successCount++;
        } else {
          console.log(
            `⚠️  No verses found for ${missing.book} ${missing.chapter} from any API`
          );
          // Create placeholder chapter for manual entry
          await createPlaceholderChapter(book, missing.chapter);
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

    console.log("\n🎉 Final Bible completion finished!");
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Errors/Placeholders: ${errorCount}`);

    // Get final statistics
    const stats = await getFinalStats();
    console.log(`\n📊 Final Statistics:`);
    console.log(`📚 Books: ${stats.totalBooks}`);
    console.log(`📖 Chapters: ${stats.totalChapters}`);
    console.log(`📝 Verses: ${stats.totalVerses}`);
  } catch (error) {
    console.error("❌ Error in completion process:", error);
  } finally {
    await mongoose.connection.close();
  }
}

async function fetchFromAPI(apiName, bookName, chapterNumber) {
  const api = BIBLE_APIS[apiName];
  if (!api) return null;

  let retries = 0;

  while (retries < CONFIG.MAX_RETRIES) {
    try {
      const url = api.base + api.format(bookName, chapterNumber);

      const response = await axios.get(url, {
        timeout: CONFIG.TIMEOUT,
        headers: {
          "User-Agent": "Jevah-Bible-App/1.0",
          Accept: "application/json",
          ...api.headers,
        },
      });

      if (response.data) {
        const verses = api.parseResponse(response.data);
        if (verses && verses.length > 0) {
          return verses;
        }
      }

      throw new Error("No verses found in response");
    } catch (error) {
      retries++;

      if (retries >= CONFIG.MAX_RETRIES) {
        console.log(
          `    ⚠️  ${apiName} failed after ${CONFIG.MAX_RETRIES} attempts`
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
    chapterNumber,
    verses: verses.length,
    isActive: true,
  });
  await chapter.save();

  // Create verses
  for (const verseData of verses) {
    const verse = new BibleVerse({
      bookId: book._id,
      bookName: book.name,
      chapterNumber,
      verseNumber: verseData.verse || verseData.verseNumber,
      text: verseData.text || verseData.content,
      translation: "WEB",
      isActive: true,
    });
    await verse.save();
  }
}

async function createPlaceholderChapter(book, chapterNumber) {
  // Create a placeholder chapter for manual entry
  const chapter = new BibleChapter({
    bookId: book._id,
    bookName: book.name,
    chapterNumber,
    verses: 1, // Placeholder
    isActive: true,
  });
  await chapter.save();

  // Create placeholder verse
  const verse = new BibleVerse({
    bookId: book._id,
    bookName: book.name,
    chapterNumber,
    verseNumber: 1,
    text: `[PLACEHOLDER] ${book.name} ${chapterNumber}:1 - Manual entry required`,
    translation: "WEB",
    isActive: true,
  });
  await verse.save();
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

// Run the completion
if (require.main === module) {
  completeMissingVerses();
}

module.exports = { completeMissingVerses };

