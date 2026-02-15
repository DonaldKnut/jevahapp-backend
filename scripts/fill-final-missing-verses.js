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

// Specific missing verses that need to be filled
const MISSING_VERSES = {
  "Acts 8:40":
    "But Philip was found at Azotus. Passing through, he preached the Good News to all the cities, until he came to Caesarea.",
  "Acts 15:41":
    "He went through Syria and Cilicia, strengthening the assemblies.",
  "Acts 24:27":
    "But when two years were fulfilled, Felix was succeeded by Porcius Festus, and desiring to gain favor with the Jews, Felix left Paul in bonds.",
  "Romans 16:25":
    "Now to him who is able to establish you according to my Good News and the preaching of Jesus Christ, according to the revelation of the mystery which has been kept secret through long ages,",
};

async function fillFinalMissingVerses() {
  try {
    console.log("🎯 Filling final missing verses...");

    mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to database");

    let added = 0;
    let errors = 0;

    for (const [reference, text] of Object.entries(MISSING_VERSES)) {
      try {
        console.log(`\n📝 Processing ${reference}...`);

        // Parse reference
        const parts = reference.split(" ");
        const bookName = parts[0];
        const chapterVerse = parts[1].split(":");
        const chapterNumber = parseInt(chapterVerse[0]);
        const verseNumber = parseInt(chapterVerse[1]);

        // Check if verse already exists
        const existing = await BibleVerse.findOne({
          bookName,
          chapterNumber,
          verseNumber,
          isActive: true,
        });

        if (existing) {
          console.log(`   ✅ Verse already exists`);
          continue;
        }

        // Get book ID
        const book = await BibleBook.findOne({
          name: bookName,
          isActive: true,
        });
        if (!book) {
          console.log(`   ❌ Book not found: ${bookName}`);
          errors++;
          continue;
        }

        // Create the verse
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
        console.log(`   ✅ Added: "${text.substring(0, 50)}..."`);
        added++;

        // Update chapter verse count
        const chapter = await BibleChapter.findOne({
          bookId: book._id,
          chapterNumber,
          isActive: true,
        });

        if (chapter) {
          const newVerseCount = await BibleVerse.countDocuments({
            bookId: book._id,
            chapterNumber,
            isActive: true,
          });

          if (newVerseCount > chapter.verses) {
            chapter.verses = newVerseCount;
            await chapter.save();
            console.log(`   📊 Updated chapter verse count: ${chapter.verses}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errors++;
      }
    }

    console.log("\n🎉 Final missing verses processing completed!");
    console.log(`✅ Successfully added: ${added}`);
    console.log(`❌ Errors: ${errors}`);

    // Final statistics
    const stats = await getFinalStats();
    console.log(`\n📊 FINAL STATISTICS:`);
    console.log(`📚 Books: ${stats.totalBooks}`);
    console.log(`📖 Chapters: ${stats.totalChapters}`);
    console.log(`📝 Verses: ${stats.totalVerses}`);
    console.log(
      `🎯 Completion Rate: ${Math.round((stats.totalVerses / 31102) * 100)}%`
    );

    if (stats.totalVerses >= 31100) {
      console.log(
        "\n🎊 CONGRATULATIONS! Your Bible dataset is now COMPLETE! 🎊"
      );
    }
  } catch (error) {
    console.error("❌ Error in final completion process:", error);
  } finally {
    await mongoose.connection.close();
  }
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

// Run the final completion
if (require.main === module) {
  fillFinalMissingVerses();
}

module.exports = { fillFinalMissingVerses };

