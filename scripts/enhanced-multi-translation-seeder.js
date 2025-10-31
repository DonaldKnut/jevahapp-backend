const mongoose = require("mongoose");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Import models
const {
  BibleBook,
  BibleChapter,
  BibleVerse,
  BIBLE_BOOKS,
} = require("../dist/models/bible.model");

// Enhanced translation sources with multiple APIs
const TRANSLATIONS = [
  // Existing translations
  {
    code: "KJV",
    name: "King James Version",
    sources: [
      { api: "bible-api.com", priority: 1, rateLimit: 500 },
      { api: "bible-gateway", priority: 2, rateLimit: 1000 }
    ],
    priority: 2,
  },
  {
    code: "ASV",
    name: "American Standard Version",
    sources: [
      { api: "bible-api.com", priority: 1, rateLimit: 500 }
    ],
    priority: 3,
  },
  {
    code: "DARBY",
    name: "Darby Translation",
    sources: [
      { api: "bible-api.com", priority: 1, rateLimit: 500 }
    ],
    priority: 4,
  },
  // New translations with compliant sources
  {
    code: "NIV",
    name: "New International Version",
    sources: [
      { api: "bible-gateway", priority: 1, rateLimit: 2000 },
      { api: "bible-api.com", priority: 2, rateLimit: 1000 }
    ],
    priority: 5,
  },
  {
    code: "AMP",
    name: "Amplified Bible",
    sources: [
      { api: "bible-gateway", priority: 1, rateLimit: 2000 }
    ],
    priority: 6,
  },
  {
    code: "ESV",
    name: "English Standard Version",
    sources: [
      { api: "bible-gateway", priority: 1, rateLimit: 2000 }
    ],
    priority: 7,
  },
  {
    code: "NLT",
    name: "New Living Translation",
    sources: [
      { api: "bible-gateway", priority: 1, rateLimit: 2000 }
    ],
    priority: 8,
  },
  {
    code: "NASB",
    name: "New American Standard Bible",
    sources: [
      { api: "bible-gateway", priority: 1, rateLimit: 2000 }
    ],
    priority: 9,
  }
];

// Configuration
const CONFIG = {
  BATCH_SIZE: 50, // Process verses in batches
  DELAY_BETWEEN_BATCHES: 2000, // 2 seconds between batches
  DELAY_BETWEEN_REQUESTS: 1000, // 1 second between individual requests
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000, // 5 seconds between retries
  RESUME_FROM_BOOK: null, // Set to book name to resume from specific book
  RESUME_FROM_CHAPTER: null, // Set to chapter number to resume from specific chapter
  PROGRESS_FILE: "translation-seeding-progress.json",
  LOG_FILE: "translation-seeding.log"
};

// Progress tracking
let progress = {
  startTime: new Date(),
  translations: {},
  currentBook: null,
  currentChapter: null,
  totalProcessed: 0,
  totalAdded: 0,
  totalUpdated: 0,
  totalSkipped: 0,
  errors: []
};

// Load progress if resuming
function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      const data = fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf8');
      progress = { ...progress, ...JSON.parse(data) };
      console.log(`📂 Resuming from previous session...`);
      console.log(`   Last book: ${progress.currentBook || 'None'}`);
      console.log(`   Last chapter: ${progress.currentChapter || 'None'}`);
    }
  } catch (error) {
    console.log(`⚠️  Could not load progress file: ${error.message}`);
  }
}

// Save progress
function saveProgress() {
  try {
    fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.log(`⚠️  Could not save progress: ${error.message}`);
  }
}

// Logging
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  try {
    fs.appendFileSync(CONFIG.LOG_FILE, logMessage + '\n');
  } catch (error) {
    // Ignore logging errors
  }
}

// Enhanced API fetchers
class BibleAPIFetcher {
  constructor() {
    this.rateLimiters = new Map();
  }

  getRateLimiter(api, delay) {
    if (!this.rateLimiters.has(api)) {
      this.rateLimiters.set(api, { lastRequest: 0, delay });
    }
    return this.rateLimiters.get(api);
  }

  async waitForRateLimit(api, delay) {
    const limiter = this.getRateLimiter(api, delay);
    const now = Date.now();
    const timeSinceLastRequest = now - limiter.lastRequest;
    
    if (timeSinceLastRequest < delay) {
      const waitTime = delay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    limiter.lastRequest = Date.now();
  }

  async fetchFromBibleAPI(bookName, chapter, verse, translation) {
    try {
      await this.waitForRateLimit('bible-api.com', 500);
      
      const url = `https://bible-api.com/${bookName}+${chapter}:${verse}?translation=${translation.toLowerCase()}`;
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { "User-Agent": "Jevah-Bible-App/1.0" },
      });

      if (response.data?.text) {
        return response.data.text.trim();
      } else if (response.data?.verses?.[0]?.text) {
        return response.data.verses[0].text.trim();
      }
      return null;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Translation not supported
      }
      throw error;
    }
  }

  async fetchFromBibleGateway(bookName, chapter, verse, translation) {
    try {
      await this.waitForRateLimit('bible-gateway', 2000);
      
      // Note: This is a simplified implementation
      // In production, you'd need proper web scraping with respect to ToS
      const url = `https://www.biblegateway.com/passage/?search=${bookName}+${chapter}:${verse}&version=${translation}`;
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      // Simple text extraction - in production, use proper HTML parsing
      const textMatch = response.data.match(/<span class="text[^"]*"[^>]*>([^<]+)<\/span>/);
      if (textMatch && textMatch[1]) {
        return textMatch[1].trim();
      }
      
      return null;
    } catch (error) {
      log(`Bible Gateway error for ${translation}: ${error.message}`, 'WARN');
      return null;
    }
  }

  async fetchVerse(bookName, chapter, verse, translation) {
    const translationConfig = TRANSLATIONS.find(t => t.code === translation);
    if (!translationConfig) {
      throw new Error(`Unknown translation: ${translation}`);
    }

    let lastError = null;
    
    for (const source of translationConfig.sources) {
      try {
        let text = null;
        
        if (source.api === 'bible-api.com') {
          text = await this.fetchFromBibleAPI(bookName, chapter, verse, translation);
        } else if (source.api === 'bible-gateway') {
          text = await this.fetchFromBibleGateway(bookName, chapter, verse, translation);
        }
        
        if (text && text.length > 5) {
          return text;
        }
      } catch (error) {
        lastError = error;
        log(`Source ${source.api} failed for ${translation}: ${error.message}`, 'WARN');
        continue;
      }
    }
    
    if (lastError) {
      throw lastError;
    }
    
    return null;
  }
}

// Batch processing
async function processBatch(verses, translation, fetcher) {
  const promises = verses.map(async (verse) => {
    try {
      // Check if translation already exists
      const existingTranslation = await BibleVerse.findOne({
        bookName: verse.bookName,
        chapterNumber: verse.chapterNumber,
        verseNumber: verse.verseNumber,
        translation: translation,
      });

      if (existingTranslation && existingTranslation.text && existingTranslation.text.trim().length > 10) {
        progress.totalSkipped++;
        return { status: 'skipped', verse };
      }

      // Fetch verse text
      const verseText = await fetcher.fetchVerse(
        verse.bookName,
        verse.chapterNumber,
        verse.verseNumber,
        translation
      );

      if (!verseText || verseText.trim().length < 5) {
        progress.totalSkipped++;
        return { status: 'no_text', verse };
      }

      if (existingTranslation) {
        // Update existing
        existingTranslation.text = verseText;
        await existingTranslation.save();
        progress.totalUpdated++;
        return { status: 'updated', verse };
      } else {
        // Create new
        const newVerse = new BibleVerse({
          bookId: verse.bookId,
          bookName: verse.bookName,
          chapterNumber: verse.chapterNumber,
          verseNumber: verse.verseNumber,
          text: verseText,
          translation: translation,
          isActive: true,
        });
        await newVerse.save();
        progress.totalAdded++;
        return { status: 'added', verse };
      }
    } catch (error) {
      log(`Error processing verse ${verse.bookName} ${verse.chapterNumber}:${verse.verseNumber}: ${error.message}`, 'ERROR');
      progress.errors.push({
        verse: `${verse.bookName} ${verse.chapterNumber}:${verse.verseNumber}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return { status: 'error', verse, error: error.message };
    }
  });

  return Promise.all(promises);
}

// Main seeding function for a translation
async function seedTranslation(translationCode, translationName) {
  try {
    log(`\n📖 Starting ${translationName} (${translationCode}) seeding...`);
    
    const fetcher = new BibleAPIFetcher();
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Initialize progress for this translation
    if (!progress.translations[translationCode]) {
      progress.translations[translationCode] = {
        startTime: new Date(),
        booksProcessed: 0,
        totalBooks: BIBLE_BOOKS.length,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      };
    }

    const translationProgress = progress.translations[translationCode];

    for (const book of BIBLE_BOOKS) {
      // Resume logic
      if (CONFIG.RESUME_FROM_BOOK && book.name !== CONFIG.RESUME_FROM_BOOK) {
        continue;
      }
      if (CONFIG.RESUME_FROM_BOOK && book.name === CONFIG.RESUME_FROM_BOOK) {
        CONFIG.RESUME_FROM_BOOK = null; // Clear resume flag
      }

      progress.currentBook = book.name;
      log(`\n  📚 Processing ${book.name}...`);

      for (let chapterNum = 1; chapterNum <= book.chapters; chapterNum++) {
        // Resume logic for chapters
        if (CONFIG.RESUME_FROM_CHAPTER && chapterNum < CONFIG.RESUME_FROM_CHAPTER) {
          continue;
        }
        if (CONFIG.RESUME_FROM_CHAPTER && chapterNum === CONFIG.RESUME_FROM_CHAPTER) {
          CONFIG.RESUME_FROM_CHAPTER = null; // Clear resume flag
        }

        progress.currentChapter = chapterNum;
        saveProgress(); // Save progress after each chapter

        // Get existing WEB verses for this chapter
        const existingVerses = await BibleVerse.find({
          bookName: book.name,
          chapterNumber: chapterNum,
          translation: "WEB",
          isActive: true,
        }).sort({ verseNumber: 1 });

        if (existingVerses.length === 0) {
          log(`    ⏭️  Skipping ${book.name} ${chapterNum} (no WEB verses found)`);
          continue;
        }

        log(`    📄 ${book.name} ${chapterNum} (${existingVerses.length} verses)...`);

        // Process verses in batches
        for (let i = 0; i < existingVerses.length; i += CONFIG.BATCH_SIZE) {
          const batch = existingVerses.slice(i, i + CONFIG.BATCH_SIZE);
          const results = await processBatch(batch, translationCode, fetcher);
          
          // Update counters
          results.forEach(result => {
            if (result.status === 'added') totalAdded++;
            else if (result.status === 'updated') totalUpdated++;
            else if (result.status === 'skipped') totalSkipped++;
            else if (result.status === 'error') totalErrors++;
          });

          progress.totalProcessed += batch.length;
          translationProgress.added = totalAdded;
          translationProgress.updated = totalUpdated;
          translationProgress.skipped = totalSkipped;
          translationProgress.errors = totalErrors;

          // Progress update
          const progressPercent = Math.round((i + batch.length) / existingVerses.length * 100);
          log(`      📊 Chapter ${chapterNum}: ${progressPercent}% (${i + batch.length}/${existingVerses.length} verses)`);

          // Delay between batches
          if (i + CONFIG.BATCH_SIZE < existingVerses.length) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
          }
        }

        // Delay between chapters
        if (chapterNum < book.chapters) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
        }
      }

      translationProgress.booksProcessed++;
      log(`  ✅ Completed ${book.name} (${translationProgress.booksProcessed}/${translationProgress.totalBooks} books)`);
    }

    translationProgress.endTime = new Date();
    translationProgress.duration = translationProgress.endTime - translationProgress.startTime;

    log(`\n✅ ${translationName} seeding complete!`);
    log(`   Added: ${totalAdded}`);
    log(`   Updated: ${totalUpdated}`);
    log(`   Skipped: ${totalSkipped}`);
    log(`   Errors: ${totalErrors}`);
    log(`   Duration: ${Math.round(translationProgress.duration / 1000)}s`);

    return { added: totalAdded, updated: totalUpdated, skipped: totalSkipped, errors: totalErrors };
  } catch (error) {
    log(`❌ Error seeding ${translationCode}: ${error.message}`, 'ERROR');
    return { added: 0, updated: 0, skipped: 0, errors: 1 };
  }
}

// Main function
async function seedMultipleTranslations() {
  try {
    log("🌱 Starting Enhanced Multiple Translation Seeding...");
    log(`Configuration: Batch size ${CONFIG.BATCH_SIZE}, Delay ${CONFIG.DELAY_BETWEEN_BATCHES}ms`);

    // Load previous progress
    loadProgress();

    // Connect to database
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    log("✅ Connected to database");

    const results = {};

    // Seed each translation
    for (const translation of TRANSLATIONS) {
      const result = await seedTranslation(translation.code, translation.name);
      results[translation.code] = result;
      
      // Save progress after each translation
      saveProgress();
    }

    // Final statistics
    log("\n\n📊 FINAL STATISTICS:");
    log("======================================");

    for (const [code, result] of Object.entries(results)) {
      const translation = TRANSLATIONS.find(t => t.code === code);
      log(`\n${translation.name} (${code}):`);
      log(`  ✅ Added: ${result.added}`);
      log(`  ✏️  Updated: ${result.updated}`);
      log(`  ⏭️  Skipped: ${result.skipped}`);
      log(`  ❌ Errors: ${result.errors}`);
    }

    // Get final counts per translation
    log("\n\n📈 VERSE COUNTS BY TRANSLATION:");
    for (const translation of TRANSLATIONS) {
      const count = await BibleVerse.countDocuments({
        translation: translation.code,
        isActive: true,
      });
      log(`  ${translation.name} (${translation.code}): ${count.toLocaleString()} verses`);
    }

    const totalDuration = Date.now() - progress.startTime.getTime();
    log(`\n🎉 Multiple translation seeding completed in ${Math.round(totalDuration / 1000)}s!`);
    
    // Clean up progress file
    try {
      fs.unlinkSync(CONFIG.PROGRESS_FILE);
    } catch (error) {
      // Ignore cleanup errors
    }

  } catch (error) {
    log(`❌ Critical error: ${error.message}`, 'ERROR');
    throw error;
  } finally {
    await mongoose.connection.close();
    log("\n✅ Database connection closed");
  }
}

// Run the script
if (require.main === module) {
  seedMultipleTranslations()
    .then(() => {
      log("\n🏁 Script completed successfully!");
      process.exit(0);
    })
    .catch(error => {
      log(`❌ Script failed: ${error.message}`, 'ERROR');
      process.exit(1);
    });
}

module.exports = { seedMultipleTranslations, TRANSLATIONS, CONFIG };



