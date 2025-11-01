const mongoose = require("mongoose");
const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();

// Import models
const {
  BibleBook,
  BibleChapter,
  BibleVerse,
  BIBLE_BOOKS,
} = require("../dist/models/bible.model");

// Bible translation sources (free and legal)
const TRANSLATIONS = [
  // WEB skipped - already seeded
  {
    code: "KJV",
    name: "King James Version",
    api: "bible-api.com",
    priority: 2,
  },
  {
    code: "ASV",
    name: "American Standard Version",
    api: "bible-api.com",
    priority: 3,
  },
  {
    code: "DARBY",
    name: "Darby Translation",
    api: "bible-api.com",
    priority: 4,
  },
  // YLT seems to have issues with API - skip for now
  // {
  //   code: "YLT",
  //   name: "Young's Literal Translation",
  //   api: "bible-api.com",
  //   priority: 5,
  // },
];

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 500; // 500ms between requests (increase to avoid rate limits)
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds between retries

/**
 * Fetch verse from bible-api.com with translation
 */
async function fetchVerseFromAPI(
  bookName,
  chapter,
  verse,
  translation = "WEB"
) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // bible-api.com supports translations via URL: book+chapter?translation=kjv
      const url = `https://bible-api.com/${bookName}+${chapter}:${verse}?translation=${translation.toLowerCase()}`;

      const response = await axios.get(url, {
        timeout: 15000,
        headers: { "User-Agent": "Jevah-Bible-App/1.0" },
      });

      if (response.data) {
        // API can return text directly or in verses array
        if (response.data.text) {
          return response.data.text.trim();
        } else if (
          response.data.verses &&
          response.data.verses[0] &&
          response.data.verses[0].text
        ) {
          return response.data.verses[0].text.trim();
        }
      }
      return null;
    } catch (error) {
      lastError = error;

      // If 404, translation not supported - don't retry
      if (error.response && error.response.status === 404) {
        return null;
      }

      // For connection errors or rate limits, retry
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve =>
          setTimeout(resolve, RETRY_DELAY * attempt)
        );
        continue;
      }

      // Final attempt failed
      return null;
    }
  }

  return null;
}

/**
 * Alternative: Fetch from Bible Gateway (for scraping)
 */
async function fetchVerseFromBibleGateway(
  bookName,
  chapter,
  verse,
  translation = "WEB"
) {
  try {
    // Note: This is for educational purposes. Always respect ToS and use APIs when possible.
    const url = `https://www.biblegateway.com/passage/?search=${bookName}+${chapter}:${verse}&version=${translation}`;

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);
    const verseText = $(`.version-${translation} .text`).first().text().trim();

    if (verseText) {
      return verseText;
    }

    // Alternative selector
    const altText = $(".passage-text p").first().text().trim();
    return altText || null;
  } catch (error) {
    console.log(`   ⚠️  Bible Gateway failed for ${translation}`);
    return null;
  }
}

/**
 * Seed a specific translation for all verses
 */
async function seedTranslation(translationCode, translationName) {
  try {
    console.log(`\n📖 Seeding ${translationName} (${translationCode})...`);

    let totalAdded = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const book of BIBLE_BOOKS) {
      console.log(`\n  📚 Processing ${book.name}...`);

      for (let chapterNum = 1; chapterNum <= book.chapters; chapterNum++) {
        // Get existing verses for this chapter
        const existingVerses = await BibleVerse.find({
          bookName: book.name,
          chapterNumber: chapterNum,
          translation: "WEB", // Use WEB as base
          isActive: true,
        }).sort({ verseNumber: 1 });

        if (existingVerses.length === 0) {
          console.log(
            `    ⏭️  Skipping ${book.name} ${chapterNum} (no WEB verses found)`
          );
          continue;
        }

        console.log(
          `    📄 ${book.name} ${chapterNum} (${existingVerses.length} verses)...`
        );

        for (const verse of existingVerses) {
          // Check if this translation already exists
          const existingTranslation = await BibleVerse.findOne({
            bookName: book.name,
            chapterNumber: chapterNum,
            verseNumber: verse.verseNumber,
            translation: translationCode,
          });

          if (
            existingTranslation &&
            existingTranslation.text &&
            existingTranslation.text.trim().length > 10
          ) {
            totalSkipped++;
            continue; // Already exists
          }

          // Fetch verse text for this translation
          let verseText = await fetchVerseFromAPI(
            book.name,
            chapterNum,
            verse.verseNumber,
            translationCode
          );

          // If API fails, try Bible Gateway (optional - uncomment if needed)
          // if (!verseText) {
          //   verseText = await fetchVerseFromBibleGateway(book.name, chapterNum, verse.verseNumber, translationCode);
          // }

          if (!verseText || verseText.trim().length < 5) {
            totalSkipped++;
            console.log(
              `      ⚠️  No text for ${book.name} ${chapterNum}:${verse.verseNumber}`
            );
            continue;
          }

          if (existingTranslation) {
            // Update existing
            existingTranslation.text = verseText;
            await existingTranslation.save();
            totalUpdated++;
          } else {
            // Create new verse with this translation
            const newVerse = new BibleVerse({
              bookId: verse.bookId,
              bookName: book.name,
              chapterNumber: chapterNum,
              verseNumber: verse.verseNumber,
              text: verseText,
              translation: translationCode,
              isActive: true,
            });
            await newVerse.save();
            totalAdded++;
          }

          // Rate limiting
          await new Promise(resolve =>
            setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
          );
        }

        // Progress update
        if (chapterNum % 5 === 0 || chapterNum === book.chapters) {
          console.log(
            `      ✅ Processed ${chapterNum}/${book.chapters} chapters`
          );
        }
      }
    }

    console.log(`\n✅ ${translationName} seeding complete!`);
    console.log(`   Added: ${totalAdded}`);
    console.log(`   Updated: ${totalUpdated}`);
    console.log(`   Skipped: ${totalSkipped}`);

    return { added: totalAdded, updated: totalUpdated, skipped: totalSkipped };
  } catch (error) {
    console.error(`❌ Error seeding ${translationCode}:`, error.message);
    return { added: 0, updated: 0, skipped: 0 };
  }
}

/**
 * Main function to seed multiple translations
 */
async function seedMultipleTranslations() {
  try {
    console.log("🌱 Starting Multiple Translation Seeding...");

    // Connect to database
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to database");

    const results = {};

    // Seed each translation
    for (const translation of TRANSLATIONS) {
      const result = await seedTranslation(translation.code, translation.name);
      results[translation.code] = result;
    }

    // Final statistics
    console.log("\n\n📊 FINAL STATISTICS:");
    console.log("======================================");

    for (const [code, result] of Object.entries(results)) {
      const translation = TRANSLATIONS.find(t => t.code === code);
      console.log(`\n${translation.name} (${code}):`);
      console.log(`  ✅ Added: ${result.added}`);
      console.log(`  ✏️  Updated: ${result.updated}`);
      console.log(`  ⏭️  Skipped: ${result.skipped}`);
    }

    // Get count per translation
    console.log("\n\n📈 VERSE COUNTS BY TRANSLATION:");
    for (const translation of TRANSLATIONS) {
      const count = await BibleVerse.countDocuments({
        translation: translation.code,
        isActive: true,
      });
      console.log(
        `  ${translation.name} (${translation.code}): ${count} verses`
      );
    }

    console.log("\n🎉 Multiple translation seeding completed!");
  } catch (error) {
    console.error("❌ Critical error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
  }
}

// Run the script
if (require.main === module) {
  seedMultipleTranslations()
    .then(() => {
      console.log("\n🏁 Script completed!");
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

module.exports = { seedMultipleTranslations };
