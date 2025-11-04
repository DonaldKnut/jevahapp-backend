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

async function completeAllVerses() {
  try {
    console.log("🔧 Starting to complete ALL verses for ALL chapters...");
    
    const books = await BibleBook.find({ isActive: true }).sort({ order: 1 });
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    for (const book of books) {
      console.log(`\n📖 Processing ${book.name} (${book.chapters} chapters)...`);
      
      for (let chapterNum = 1; chapterNum <= book.chapters; chapterNum++) {
        try {
          totalProcessed++;
          
          // Check current verse count
          const currentVerses = await BibleVerse.find({
            bookId: book._id,
            chapterNumber: chapterNum,
            isActive: true
          });
          
          // Fetch complete chapter from API
          const apiVerses = await fetchChapterFromAPI(book.name, chapterNum);
          
          if (apiVerses && apiVerses.length > 0) {
            // Check if we need to add missing verses
            const currentVerseNumbers = currentVerses.map(v => v.verseNumber);
            const apiVerseNumbers = apiVerses.map(v => v.verse);
            const missingVerses = apiVerseNumbers.filter(num => !currentVerseNumbers.includes(num));
            
            if (missingVerses.length > 0) {
              console.log(`  📝 ${book.name} ${chapterNum}: Adding ${missingVerses.length} missing verses`);
              
              // Add missing verses
              for (const verseNum of missingVerses) {
                const verseData = apiVerses.find(v => v.verse === verseNum);
                if (verseData) {
                  const verse = new BibleVerse({
                    bookId: book._id,
                    bookName: book.name,
                    chapterNumber: chapterNum,
                    verseNumber: verseNum,
                    text: verseData.text,
                    translation: "WEB",
                    isActive: true,
                  });
                  await verse.save();
                  totalUpdated++;
                }
              }
            } else {
              console.log(`  ✅ ${book.name} ${chapterNum}: Complete (${currentVerses.length} verses)`);
            }
            
            // Update chapter verse count if needed
            const chapter = await BibleChapter.findOne({
              bookId: book._id,
              chapterNumber: chapterNum,
              isActive: true
            });
            
            if (chapter && chapter.verses !== apiVerses.length) {
              await BibleChapter.updateOne(
                { _id: chapter._id },
                { verses: apiVerses.length }
              );
              console.log(`  📊 Updated chapter verse count: ${chapter.verses} → ${apiVerses.length}`);
            }
          } else {
            console.log(`  ⚠️  ${book.name} ${chapterNum}: No data from API`);
            totalErrors++;
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS));

        } catch (error) {
          console.log(`  ❌ Error in ${book.name} ${chapterNum}: ${error.message}`);
          totalErrors++;
        }
      }
    }

    console.log("\n🎉 Complete verses processing finished!");
    console.log(`📊 Statistics:`);
    console.log(`   📖 Chapters processed: ${totalProcessed}`);
    console.log(`   📝 Verses added: ${totalUpdated}`);
    console.log(`   ❌ Errors: ${totalErrors}`);

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

      if (response.data && response.data.verses && response.data.verses.length > 0) {
        return response.data.verses;
      } else {
        throw new Error("No verses found in response");
      }
      
    } catch (error) {
      retries++;
      
      if (retries >= CONFIG.MAX_RETRIES) {
        console.log(`    ⚠️  Failed to fetch ${bookName} ${chapterNumber} after ${CONFIG.MAX_RETRIES} attempts`);
        return null;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * retries));
    }
  }
  
  return null;
}

async function getFinalStats() {
  const [
    totalBooks,
    totalChapters,
    totalVerses,
  ] = await Promise.all([
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

// Function to check completeness
async function checkCompleteness() {
  try {
    console.log("🔍 Checking Bible completeness...");
    
    const books = await BibleBook.find({ isActive: true }).sort({ order: 1 });
    let incompleteChapters = [];
    let totalExpectedVerses = 0;
    let totalActualVerses = 0;
    
    for (const book of books) {
      const chapters = await BibleChapter.find({ bookId: book._id, isActive: true });
      
      for (const chapter of chapters) {
        const verseCount = await BibleVerse.countDocuments({
          bookId: book._id,
          chapterNumber: chapter.chapterNumber,
          isActive: true
        });
        
        totalExpectedVerses += chapter.verses;
        totalActualVerses += verseCount;
        
        if (verseCount < chapter.verses) {
          incompleteChapters.push({
            book: book.name,
            chapter: chapter.chapterNumber,
            expected: chapter.verses,
            actual: verseCount,
            missing: chapter.verses - verseCount
          });
        }
      }
    }
    
    console.log(`📊 Completeness Report:`);
    console.log(`   📚 Books: ${books.length}`);
    console.log(`   📖 Chapters: ${books.reduce((sum, book) => sum + book.chapters, 0)}`);
    console.log(`   📝 Expected verses: ${totalExpectedVerses}`);
    console.log(`   📝 Actual verses: ${totalActualVerses}`);
    console.log(`   📊 Completion rate: ${Math.round((totalActualVerses / totalExpectedVerses) * 100)}%`);
    
    if (incompleteChapters.length > 0) {
      console.log(`\n⚠️  Incomplete chapters (${incompleteChapters.length}):`);
      incompleteChapters.slice(0, 10).forEach(c => {
        console.log(`   ${c.book} ${c.chapter}: ${c.actual}/${c.expected} (missing ${c.missing})`);
      });
      
      if (incompleteChapters.length > 10) {
        console.log(`   ... and ${incompleteChapters.length - 10} more`);
      }
    } else {
      console.log(`\n✅ All chapters are complete!`);
    }
    
    return incompleteChapters;
    
  } catch (error) {
    console.log('❌ Error checking completeness:', error.message);
    return [];
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--check')) {
    checkCompleteness().then(() => process.exit(0));
  } else if (args.includes('--help')) {
    console.log(`
🔧 Complete All Bible Verses Script

Usage:
  node scripts/complete-all-verses.js           # Complete all verses
  node scripts/complete-all-verses.js --check  # Check completeness
  node scripts/complete-all-verses.js --help   # Show this help

This script will:
✅ Check every chapter for missing verses
✅ Fetch complete data from bible-api.com
✅ Add any missing verses
✅ Update chapter verse counts
✅ Provide detailed progress and statistics
    `);
  } else {
    completeAllVerses();
  }
}

module.exports = { completeAllVerses, checkCompleteness };












