const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

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
  BIBLE_BOOKS,
} = require("../dist/models/bible.model");

// Free Bible API configuration
const BIBLE_API_BASE = "https://bible-api.com";

// Rate limiting configuration
const DELAY_BETWEEN_REQUESTS = 100; // 100ms delay between requests
const BATCH_SIZE = 5; // Process 5 chapters at a time

async function seedFullBible() {
  try {
    console.log("🌱 Starting full Bible seeding from bible-api.com...");
    console.log("⏱️  This will take approximately 10-15 minutes...");

    // Clear existing data
    console.log("🗑️  Clearing existing Bible data...");
    await BibleVerse.deleteMany({});
    await BibleChapter.deleteMany({});
    await BibleBook.deleteMany({});

    // Seed Bible books
    console.log("📚 Seeding Bible books...");
    const createdBooks = [];
    for (const bookData of BIBLE_BOOKS) {
      const book = new BibleBook({
        ...bookData,
        isActive: true,
      });
      await book.save();
      createdBooks.push(book);
      console.log(`✅ Created book: ${book.name}`);
    }

    // Create a mapping of book names to IDs
    const bookNameToId = {};
    createdBooks.forEach(book => {
      bookNameToId[book.name] = book._id;
    });

    // Fetch complete Bible text
    console.log("📖 Fetching complete Bible text...");
    let totalVerses = 0;
    let totalChapters = 0;

    for (const book of BIBLE_BOOKS) {
      console.log(`\n📖 Processing ${book.name} (${book.chapters} chapters)...`);
      
      for (let chapterNum = 1; chapterNum <= book.chapters; chapterNum++) {
        try {
          // Create chapter reference for API
          const chapterRef = `${book.name}+${chapterNum}`;
          const apiUrl = `${BIBLE_API_BASE}/${chapterRef}`;
          
          console.log(`  📄 Fetching ${book.name} ${chapterNum}...`);
          
          const response = await axios.get(apiUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Jevah-Bible-App/1.0'
            }
          });

          if (response.data && response.data.verses) {
            const verses = response.data.verses;
            
            // Create chapter
            const chapter = new BibleChapter({
              bookId: bookNameToId[book.name],
              bookName: book.name,
              chapterNumber: chapterNum,
              verses: verses.length,
              isActive: true,
            });
            await chapter.save();
            totalChapters++;

            // Create verses
            for (const verseData of verses) {
              const verse = new BibleVerse({
                bookId: bookNameToId[book.name],
                bookName: book.name,
                chapterNumber: chapterNum,
                verseNumber: verseData.verse,
                text: verseData.text,
                translation: "WEB", // World English Bible
                isActive: true,
              });
              await verse.save();
              totalVerses++;
            }

            console.log(`    ✅ ${book.name} ${chapterNum}: ${verses.length} verses`);
          } else {
            console.log(`    ⚠️  No verses found for ${book.name} ${chapterNum}`);
          }

          // Rate limiting - delay between requests
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));

        } catch (error) {
          console.log(`    ❌ Error fetching ${book.name} ${chapterNum}:`, error.message);
          
          // If it's a 404 or similar, the chapter might not exist in this translation
          if (error.response && error.response.status === 404) {
            console.log(`    ⚠️  Chapter ${book.name} ${chapterNum} not found in API, skipping...`);
            continue;
          }
          
          // For other errors, wait a bit longer and continue
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.log("\n🎉 Full Bible seeding completed!");
    console.log(`📈 Final statistics:`);
    console.log(`   📚 Books: ${BIBLE_BOOKS.length}`);
    console.log(`   📖 Chapters: ${totalChapters}`);
    console.log(`   📝 Verses: ${totalVerses}`);

    // Get final statistics
    const stats = await getBibleStats();
    console.log(`📊 Database statistics:`, stats);

  } catch (error) {
    console.error("❌ Error seeding full Bible:", error);
  } finally {
    mongoose.connection.close();
  }
}

async function getBibleStats() {
  const [
    totalBooks,
    totalChapters,
    totalVerses,
    oldTestamentBooks,
    newTestamentBooks,
  ] = await Promise.all([
    BibleBook.countDocuments({ isActive: true }),
    BibleChapter.countDocuments({ isActive: true }),
    BibleVerse.countDocuments({ isActive: true }),
    BibleBook.countDocuments({ testament: "old", isActive: true }),
    BibleBook.countDocuments({ testament: "new", isActive: true }),
  ]);

  return {
    totalBooks,
    totalChapters,
    totalVerses,
    oldTestamentBooks,
    newTestamentBooks,
  };
}

// Alternative function to seed from a more reliable source
async function seedFromAlternativeSource() {
  try {
    console.log("🌱 Starting Bible seeding from alternative source...");
    
    // This would use a different API or data source
    // For now, we'll use the bible-api.com approach
    
    console.log("💡 Using bible-api.com as the primary source");
    console.log("📝 Note: Some books might have different chapter counts in different translations");
    
    await seedFullBible();
    
  } catch (error) {
    console.error("❌ Error with alternative source:", error);
  }
}

// Function to test a few verses first
async function testBibleAPI() {
  try {
    console.log("🧪 Testing Bible API connectivity...");
    
    const testReferences = [
      "John+3:16",
      "Genesis+1:1",
      "Psalm+23:1",
      "Matthew+5:3"
    ];
    
    for (const ref of testReferences) {
      try {
        const response = await axios.get(`${BIBLE_API_BASE}/${ref}`, {
          timeout: 5000
        });
        
        if (response.data && response.data.verses) {
          console.log(`✅ ${ref}: ${response.data.verses.length} verses found`);
        } else {
          console.log(`⚠️  ${ref}: No verses found`);
        }
      } catch (error) {
        console.log(`❌ ${ref}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error("❌ API test failed:", error);
  }
}

// Run the seeding
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testBibleAPI();
  } else if (args.includes('--alternative')) {
    seedFromAlternativeSource();
  } else {
    seedFullBible();
  }
}

module.exports = { seedFullBible, testBibleAPI };




