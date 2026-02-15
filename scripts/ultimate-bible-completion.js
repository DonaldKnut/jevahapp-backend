const mongoose = require("mongoose");
const axios = require("axios");

// Load environment variables
require("dotenv").config();

// Import models
const {
  BibleBook,
  BibleChapter,
  BibleVerse,
} = require("../dist/models/bible.model");

// Configuration
const CONFIG = {
  MAX_RETRIES: 2,
  RETRY_DELAY: 1500,
  TIMEOUT: 10000,
  DELAY_BETWEEN_REQUESTS: 800,
};

// Multiple Bible API sources
const BIBLE_SOURCES = [
  {
    name: "Bible API (Primary)",
    base: "https://bible-api.com",
    format: (book, chapter) => `${book}+${chapter}`,
    parseResponse: data => {
      if (data.verses && Array.isArray(data.verses)) {
        return data.verses.map(v => ({
          verse: v.verse,
          text: v.text,
        }));
      }
      return [];
    },
  },
  {
    name: "Bible.com API",
    base: "https://www.bible.com/api/bible",
    format: (book, chapter) => `/WEB/${book}/${chapter}`,
    parseResponse: data => {
      if (data.verses && Array.isArray(data.verses)) {
        return data.verses.map(v => ({
          verse: v.verse,
          text: v.text,
        }));
      }
      return [];
    },
  },
  {
    name: "Bible Gateway (Web)",
    base: "https://www.biblegateway.com/passage",
    format: (book, chapter) =>
      `?search=${book}+${chapter}&version=WEB&format=json`,
    parseResponse: data => {
      // This would need proper HTML parsing
      return [];
    },
  },
];

// Manual verse entries for critical missing verses
const MANUAL_VERSES = {
  "John 3:16":
    "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
  "Genesis 1:1": "In the beginning, God created the heavens and the earth.",
  "Psalm 23:1": "The Lord is my shepherd; I shall not want.",
  "Romans 8:28":
    "We know that all things work together for good for those who love God, to those who are called according to his purpose.",
  "Philippians 4:13": "I can do all things through Christ, who strengthens me.",
  "Jeremiah 29:11":
    "For I know the thoughts that I think toward you, says the Lord, thoughts of peace, and not of evil, to give you hope in your latter end.",
  "Proverbs 3:5-6":
    "Trust in the Lord with all your heart, and don't lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.",
  "Matthew 28:19-20":
    "Go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, teaching them to observe all things that I commanded you. Behold, I am with you always, even to the end of the age.",
  "1 Corinthians 13:4-7":
    "Love is patient and is kind; love doesn't envy. Love doesn't brag, is not proud, doesn't behave itself inappropriately, doesn't seek its own way, is not provoked, takes no account of evil; doesn't rejoice in unrighteousness, but rejoices with the truth; bears all things, believes all things, hopes all things, endures all things.",
  "Ephesians 2:8-9":
    "For by grace you have been saved through faith, and that not of yourselves; it is the gift of God, not of works, that no one would boast.",
  "Isaiah 40:31":
    "But those who wait for the Lord will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.",
  "Matthew 6:9-13":
    "Pray like this: 'Our Father in heaven, may your name be kept holy. Let your Kingdom come. Let your will be done, as in heaven, so on earth. Give us today our daily bread. Forgive us our debts, as we also forgive our debtors. Bring us not into temptation, but deliver us from the evil one. For yours is the Kingdom, the power, and the glory forever. Amen.'",
  "John 14:6":
    "Jesus said to him, 'I am the way, the truth, and the life. No one comes to the Father, except through me.'",
  "Romans 3:23": "For all have sinned, and fall short of the glory of God;",
  "2 Corinthians 5:17":
    "Therefore if anyone is in Christ, he is a new creation. The old things have passed away. Behold, all things have become new.",
  "Galatians 5:22-23":
    "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faith, gentleness, and self-control. Against such things there is no law.",
  "Hebrews 11:1":
    "Now faith is assurance of things hoped for, proof of things not seen.",
  "James 1:2-3":
    "Count it all joy, my brothers, when you fall into various temptations, knowing that the testing of your faith produces endurance.",
  "1 John 4:8": "He who doesn't love doesn't know God, for God is love.",
  "Revelation 3:20":
    "Behold, I stand at the door and knock. If anyone hears my voice and opens the door, then I will come in to him, and will dine with him, and he with me.",
};

async function ultimateBibleCompletion() {
  try {
    console.log("🚀 Starting ULTIMATE Bible completion process...");
    console.log("📚 Using multiple API sources + manual entries");

    mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to database");

    // First, let's identify what's actually missing
    const missingData = await identifyMissingData();
    console.log(`\n📊 Analysis Results:`);
    console.log(
      `   📖 Missing chapters: ${missingData.missingChapters.length}`
    );
    console.log(
      `   📝 Incomplete chapters: ${missingData.incompleteChapters.length}`
    );
    console.log(
      `   🔍 Total issues: ${missingData.missingChapters.length + missingData.incompleteChapters.length}`
    );

    let successCount = 0;
    let errorCount = 0;

    // Process missing chapters
    for (const missing of missingData.missingChapters) {
      const result = await processMissingChapter(missing);
      if (result.success) {
        successCount++;
        console.log(
          `✅ ${missing.book} ${missing.chapter}: ${result.versesAdded} verses added`
        );
      } else {
        errorCount++;
        console.log(`❌ ${missing.book} ${missing.chapter}: ${result.error}`);
      }

      await new Promise(resolve =>
        setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS)
      );
    }

    // Process incomplete chapters
    for (const incomplete of missingData.incompleteChapters) {
      const result = await processIncompleteChapter(incomplete);
      if (result.success) {
        successCount++;
        console.log(
          `✅ ${incomplete.book} ${incomplete.chapter}: ${result.versesAdded} verses added`
        );
      } else {
        errorCount++;
        console.log(
          `❌ ${incomplete.book} ${incomplete.chapter}: ${result.error}`
        );
      }

      await new Promise(resolve =>
        setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS)
      );
    }

    // Add manual verses for critical passages
    console.log("\n📝 Adding critical manual verses...");
    const manualResult = await addManualVerses();
    console.log(`✅ Added ${manualResult.added} manual verses`);

    console.log("\n🎉 ULTIMATE Bible completion finished!");
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Manual verses added: ${manualResult.added}`);

    // Final statistics
    const stats = await getFinalStats();
    console.log(`\n📊 FINAL STATISTICS:`);
    console.log(`📚 Books: ${stats.totalBooks}`);
    console.log(`📖 Chapters: ${stats.totalChapters}`);
    console.log(`📝 Verses: ${stats.totalVerses}`);
    console.log(
      `🎯 Completion Rate: ${Math.round((stats.totalVerses / 31102) * 100)}%`
    );
  } catch (error) {
    console.error("❌ Error in ultimate completion process:", error);
  } finally {
    await mongoose.connection.close();
  }
}

async function identifyMissingData() {
  const books = await BibleBook.find({ isActive: true }).sort({ order: 1 });
  const missingChapters = [];
  const incompleteChapters = [];

  for (const book of books) {
    const expectedChapters = book.chapters;
    const existingChapters = await BibleChapter.find({
      bookId: book._id,
      isActive: true,
    });

    // Find missing chapters
    const existingNumbers = existingChapters.map(c => c.chapterNumber);
    for (let i = 1; i <= expectedChapters; i++) {
      if (!existingNumbers.includes(i)) {
        missingChapters.push({ book: book.name, chapter: i, bookId: book._id });
      }
    }

    // Find incomplete chapters
    for (const chapter of existingChapters) {
      const verseCount = await BibleVerse.countDocuments({
        bookId: book._id,
        chapterNumber: chapter.chapterNumber,
        isActive: true,
      });

      if (verseCount < chapter.verses) {
        incompleteChapters.push({
          book: book.name,
          chapter: chapter.chapterNumber,
          bookId: book._id,
          expected: chapter.verses,
          actual: verseCount,
          missing: chapter.verses - verseCount,
        });
      }
    }
  }

  return { missingChapters, incompleteChapters };
}

async function processMissingChapter(missing) {
  try {
    console.log(
      `\n📖 Processing missing chapter: ${missing.book} ${missing.chapter}`
    );

    // Try each API source
    for (const source of BIBLE_SOURCES) {
      try {
        console.log(`   🔍 Trying ${source.name}...`);
        const verses = await fetchFromSource(
          source,
          missing.book,
          missing.chapter
        );

        if (verses && verses.length > 0) {
          await saveChapter(
            missing.bookId,
            missing.book,
            missing.chapter,
            verses
          );
          return {
            success: true,
            versesAdded: verses.length,
            source: source.name,
          };
        }
      } catch (error) {
        console.log(`   ⚠️  ${source.name} failed: ${error.message}`);
      }
    }

    // If all APIs fail, create placeholder
    await createPlaceholderChapter(
      missing.bookId,
      missing.book,
      missing.chapter
    );
    return { success: false, error: "All APIs failed, created placeholder" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function processIncompleteChapter(incomplete) {
  try {
    console.log(
      `\n📖 Processing incomplete chapter: ${incomplete.book} ${incomplete.chapter} (${incomplete.actual}/${incomplete.expected})`
    );

    // Try to get the missing verses
    for (const source of BIBLE_SOURCES) {
      try {
        const verses = await fetchFromSource(
          source,
          incomplete.book,
          incomplete.chapter
        );

        if (verses && verses.length > 0) {
          // Add only the missing verses
          const existingVerses = await BibleVerse.find({
            bookId: incomplete.bookId,
            chapterNumber: incomplete.chapter,
            isActive: true,
          }).select("verseNumber");

          const existingNumbers = existingVerses.map(v => v.verseNumber);
          const newVerses = verses.filter(
            v => !existingNumbers.includes(v.verse)
          );

          if (newVerses.length > 0) {
            await saveVerses(
              incomplete.bookId,
              incomplete.book,
              incomplete.chapter,
              newVerses
            );
            return {
              success: true,
              versesAdded: newVerses.length,
              source: source.name,
            };
          }
        }
      } catch (error) {
        console.log(`   ⚠️  ${source.name} failed: ${error.message}`);
      }
    }

    return { success: false, error: "Could not fetch missing verses" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function fetchFromSource(source, bookName, chapterNumber) {
  const url = source.base + source.format(bookName, chapterNumber);

  const response = await axios.get(url, {
    timeout: CONFIG.TIMEOUT,
    headers: {
      "User-Agent": "Jevah-Bible-App/1.0",
      Accept: "application/json",
    },
  });

  return source.parseResponse(response.data);
}

async function saveChapter(bookId, bookName, chapterNumber, verses) {
  // Create chapter
  const chapter = new BibleChapter({
    bookId,
    bookName,
    chapterNumber,
    verses: verses.length,
    isActive: true,
  });
  await chapter.save();

  // Save verses
  await saveVerses(bookId, bookName, chapterNumber, verses);
}

async function saveVerses(bookId, bookName, chapterNumber, verses) {
  for (const verseData of verses) {
    const verse = new BibleVerse({
      bookId,
      bookName,
      chapterNumber,
      verseNumber: verseData.verse,
      text: verseData.text,
      translation: "WEB",
      isActive: true,
    });
    await verse.save();
  }
}

async function createPlaceholderChapter(bookId, bookName, chapterNumber) {
  const chapter = new BibleChapter({
    bookId,
    bookName,
    chapterNumber,
    verses: 1,
    isActive: true,
  });
  await chapter.save();

  const verse = new BibleVerse({
    bookId,
    bookName,
    chapterNumber,
    verseNumber: 1,
    text: `[PLACEHOLDER] ${bookName} ${chapterNumber}:1 - Manual entry required`,
    translation: "WEB",
    isActive: true,
  });
  await verse.save();
}

async function addManualVerses() {
  let added = 0;

  for (const [reference, text] of Object.entries(MANUAL_VERSES)) {
    try {
      // Parse reference (e.g., "John 3:16" or "1 Corinthians 13:4-7")
      const parts = reference.split(" ");
      let bookName, chapterNumber, verseNumber;

      if (parts.length === 2) {
        // Simple case: "John 3:16"
        bookName = parts[0];
        const chapterVerse = parts[1].split(":");
        chapterNumber = parseInt(chapterVerse[0]);
        verseNumber = parseInt(chapterVerse[1]);
      } else if (parts.length === 3) {
        // Complex case: "1 Corinthians 13:4-7"
        bookName = `${parts[0]} ${parts[1]}`;
        const chapterVerse = parts[2].split(":");
        chapterNumber = parseInt(chapterVerse[0]);
        verseNumber = parseInt(chapterVerse[1]);
      } else {
        console.log(`   ⚠️  Skipping complex reference: ${reference}`);
        continue;
      }

      // Check if verse already exists
      const existing = await BibleVerse.findOne({
        bookName,
        chapterNumber,
        verseNumber,
        isActive: true,
      });

      if (!existing) {
        // Get book ID
        const book = await BibleBook.findOne({
          name: bookName,
          isActive: true,
        });
        if (book) {
          const verse = new BibleVerse({
            bookId: book._id,
            bookName,
            chapterNumber,
            verseNumber,
            text,
            translation: "WEB",
            isActive: true,
          });
          await verse.save();
          added++;
          console.log(`   ✅ Added ${reference}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Failed to add ${reference}: ${error.message}`);
    }
  }

  return { added };
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

// Run the ultimate completion
if (require.main === module) {
  ultimateBibleCompletion();
}

module.exports = { ultimateBibleCompletion };
