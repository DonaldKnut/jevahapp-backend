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
  DELAY_BETWEEN_REQUESTS: 500, // 500ms delay between requests
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  TIMEOUT: 20000, // 20 seconds timeout
  BIBLE_API_BASE: "https://bible-api.com",
};

async function replacePlaceholders() {
  try {
    console.log("🔧 Starting to replace placeholder verses...");

    // Find all placeholder verses
    const placeholders = await BibleVerse.find({
      text: { $regex: "data not available", $options: "i" },
    });

    console.log(
      `📊 Found ${placeholders.length} placeholder verses to replace`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const placeholder of placeholders) {
      try {
        console.log(
          `\n📖 Processing ${placeholder.bookName} ${placeholder.chapterNumber}:${placeholder.verseNumber}...`
        );

        // Fetch the chapter from API
        const verses = await fetchChapterFromAPI(
          placeholder.bookName,
          placeholder.chapterNumber
        );

        if (verses && verses.length > 0) {
          // Find the specific verse
          const verseData = verses.find(
            v => v.verse === placeholder.verseNumber
          );

          if (verseData) {
            // Update the verse with real text
            await BibleVerse.updateOne(
              { _id: placeholder._id },
              {
                text: verseData.text,
                updatedAt: new Date(),
              }
            );

            console.log(
              `✅ Updated ${placeholder.bookName} ${placeholder.chapterNumber}:${placeholder.verseNumber}`
            );
            successCount++;
          } else {
            console.log(
              `⚠️  Verse ${placeholder.verseNumber} not found in API response for ${placeholder.bookName} ${placeholder.chapterNumber}`
            );
            errorCount++;
          }
        } else {
          console.log(
            `⚠️  No verses found for ${placeholder.bookName} ${placeholder.chapterNumber}`
          );
          errorCount++;
        }

        // Rate limiting
        await new Promise(resolve =>
          setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS)
        );
      } catch (error) {
        console.log(
          `❌ Error processing ${placeholder.bookName} ${placeholder.chapterNumber}:${placeholder.verseNumber}: ${error.message}`
        );
        errorCount++;
      }
    }

    console.log("\n🎉 Placeholder replacement completed!");
    console.log(`✅ Successfully replaced: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    // Check final status
    const remainingPlaceholders = await BibleVerse.countDocuments({
      text: { $regex: "data not available", $options: "i" },
    });
    console.log(`📝 Remaining placeholders: ${remainingPlaceholders}`);

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

// Function to check placeholders
async function checkPlaceholders() {
  try {
    console.log("🔍 Checking for placeholder verses...");

    const placeholders = await BibleVerse.find({
      text: { $regex: "data not available", $options: "i" },
    });

    console.log(`📝 Found ${placeholders.length} placeholder verses:`);
    placeholders.forEach(v => {
      console.log(`   ${v.bookName} ${v.chapterNumber}:${v.verseNumber}`);
    });

    if (placeholders.length === 0) {
      console.log("✅ No placeholder verses found!");
    }

    return placeholders;
  } catch (error) {
    console.log("❌ Error checking placeholders:", error.message);
    return [];
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    checkPlaceholders().then(() => process.exit(0));
  } else if (args.includes("--help")) {
    console.log(`
🔧 Replace Placeholder Verses Script

Usage:
  node scripts/replace-placeholders.js           # Replace placeholder verses
  node scripts/replace-placeholders.js --check  # Check placeholders
  node scripts/replace-placeholders.js --help   # Show this help

This script will:
✅ Find verses with placeholder text
✅ Fetch real content from bible-api.com
✅ Replace placeholders with actual Bible text
✅ Handle rate limiting and errors
✅ Provide progress updates
    `);
  } else {
    replacePlaceholders();
  }
}

module.exports = { replacePlaceholders, checkPlaceholders };












