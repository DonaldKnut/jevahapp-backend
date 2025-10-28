const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();

// Import models
const { BibleBook, BibleChapter, BibleVerse } = require("../dist/models/bible.model");

// Bible API configuration - Multiple sources
const BIBLE_API_SOURCES = [
  { name: "bible-api.com", url: "https://bible-api.com/jude+1" },
  { name: "api.bible", url: "https://api.scripture.api.bible/v1/bibles/de4e12af7f28f599-02/books/65JUD/chapters/1" },
];

const DELAY_BETWEEN_REQUESTS = 500; // 500ms delay

// Manual entry for Jude 1 (all 25 verses) - World English Bible (WEB)
const JUDE_MANUAL_VERSES = [
  { verse: 1, text: "Jude, a servant of Jesus Christ, and brother of James, to those who are called, sanctified by God the Father, and kept for Jesus Christ:" },
  { verse: 2, text: "May mercy, peace, and love be multiplied to you." },
  { verse: 3, text: "Beloved, while I was very eager to write to you about our common salvation, I was constrained to write to you exhorting you to contend earnestly for the faith which was once for all delivered to the saints." },
  { verse: 4, text: "For there are certain men who crept in secretly, even those who were long ago written about for this condemnation: ungodly men, turning the grace of our God into indecency, and denying our only Master, God, and Lord, Jesus Christ." },
  { verse: 5, text: "Now I want to remind you, though you already know this, that the Lord, having saved a people out of the land of Egypt, afterward destroyed those who didn't believe." },
  { verse: 6, text: "Angels who didn't keep their first domain, but deserted their own dwelling place, he has kept in everlasting bonds under darkness for the judgment of the great day." },
  { verse: 7, text: "Even as Sodom and Gomorrah and the cities around them, having in the same way as these given themselves over to sexual immorality and gone after strange flesh, are set forth as an example, suffering the punishment of eternal fire." },
  { verse: 8, text: "Yet in the same way, these also in their dreaming defile the flesh, despise authority, and slander celestial beings." },
  { verse: 9, text: "But Michael, the archangel, when contending with the devil and arguing about the body of Moses, dared not bring against him an abusive condemnation, but said, \"May the Lord rebuke you!\"" },
  { verse: 10, text: "But these speak evil of whatever things they don't know. What they understand naturally, like the creatures without reason, they are destroyed in these things." },
  { verse: 11, text: "Woe to them! For they went in the way of Cain, and ran riotously in the error of Balaam for hire, and perished in Korah's rebellion." },
  { verse: 12, text: "These are hidden rocky reefs in your love feasts when they feast with you, shepherds who without fear feed themselves; clouds without water, carried along by winds; autumn leaves without fruit, twice dead, plucked up by the roots;" },
  { verse: 13, text: "wild waves of the sea, foaming out their own shame; wandering stars, for whom the blackness of darkness has been reserved forever." },
  { verse: 14, text: "About these also Enoch, the seventh from Adam, prophesied, saying, \"Behold, the Lord came with ten thousands of his holy ones," },
  { verse: 15, text: "to execute judgment on all, and to convict all the ungodly of all their works of ungodliness which they have done in an ungodly way, and of all the hard things which ungodly sinners have spoken against him.\"" },
  { verse: 16, text: "These are murmurers and complainers, walking after their lusts (and their mouth speaks proud things), showing respect of persons to gain advantage." },
  { verse: 17, text: "But you, beloved, remember the words which have been spoken before by the apostles of our Lord Jesus Christ." },
  { verse: 18, text: "They said to you that \"In the last time there will be mockers, walking after their own ungodly lusts.\"" },
  { verse: 19, text: "These are those who cause divisions, and are sensual, not having the Spirit." },
  { verse: 20, text: "But you, beloved, keep building up yourselves on your most holy faith, praying in the Holy Spirit." },
  { verse: 21, text: "Keep yourselves in the love of God, looking for the mercy of our Lord Jesus Christ to eternal life." },
  { verse: 22, text: "On some have compassion, making a distinction," },
  { verse: 23, text: "and some save, snatching them out of the fire with fear, hating even the clothing stained by the flesh." },
  { verse: 24, text: "Now to him who is able to keep them from stumbling, and to present you faultless before the presence of his glory in great joy," },
  { verse: 25, text: "to God our Savior, who alone is wise, be glory and majesty, dominion and power, both now and forever. Amen." },
];

async function scrapeJudeFromBibleGateway() {
  // Since web scraping is complex and may violate ToS, we'll use manual entry
  // Return empty array to trigger manual entry fallback
  return [];
}

async function completeJude() {
  try {
    console.log("🌱 Completing Book of Jude...");
    
    // Connect to database
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to database");

    // Find Jude book
    const judeBook = await BibleBook.findOne({ name: "Jude" });
    if (!judeBook) {
      console.log("❌ Book of Jude not found in database");
      return;
    }

    console.log(`📖 Found book: ${judeBook.name} (${judeBook.chapters} chapters)`);

    // Check current state
    const existingVerses = await BibleVerse.countDocuments({ bookName: "Jude" });
    console.log(`📊 Current verses in database: ${existingVerses}`);

    // Fetch from API - Try multiple sources, then web scraping
    console.log("\n🌐 Attempting to fetch Jude chapter 1...");
    
    let verses = [];
    
    // Try bible-api.com first
    try {
      console.log("   Trying bible-api.com...");
      const response = await axios.get("https://bible-api.com/jude+1", {
        timeout: 15000,
        headers: { 'User-Agent': 'Jevah-Bible-App/1.0' }
      });
      
      if (response.data && response.data.verses && response.data.verses.length > 1) {
        verses = response.data.verses;
        console.log(`   ✅ bible-api.com: ${verses.length} verses`);
      } else {
        console.log("   ⚠️  bible-api.com returned insufficient data");
      }
    } catch (error) {
      console.log(`   ❌ bible-api.com failed: ${error.message}`);
    }

    // If still no data, try web scraping from Bible Gateway
    if (verses.length <= 1) {
      console.log("\n🌐 Trying web scraping from Bible Gateway...");
      try {
        verses = await scrapeJudeFromBibleGateway();
      } catch (error) {
        console.log(`   ❌ Web scraping failed: ${error.message}`);
      }
    }

    // If API failed, use manual entry
    if (verses.length <= 1) {
      console.log("\n📝 Using manual entry for Jude (all 25 verses)...");
      verses = JUDE_MANUAL_VERSES;
    }

    console.log(`✅ Processing ${verses.length} verses`);

    // Check or create chapter
    let chapter = await BibleChapter.findOne({ 
      bookName: "Jude", 
      chapterNumber: 1 
    });

    if (!chapter) {
      chapter = new BibleChapter({
        bookId: judeBook._id,
        bookName: "Jude",
        chapterNumber: 1,
        verses: verses.length,
        isActive: true,
      });
      await chapter.save();
      console.log("✅ Created chapter 1");
    } else {
      console.log("✅ Chapter 1 already exists");
    }

    // Process verses
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const verseData of verses) {
      const verseNumber = parseInt(verseData.verse);
      
      if (!verseNumber || !verseData.text || verseData.text.trim() === "") {
        console.log(`   ⚠️  Skipping invalid verse: ${verseData.verse}`);
        skippedCount++;
        continue;
      }

      // Check if verse exists
      const existingVerse = await BibleVerse.findOne({
        bookName: "Jude",
        chapterNumber: 1,
        verseNumber: verseNumber,
      });

      if (existingVerse) {
        // Check if text is incomplete or empty
        if (!existingVerse.text || existingVerse.text.trim() === "" || existingVerse.text === "..." || existingVerse.text.length < 10) {
          // Update existing verse with complete text
          existingVerse.text = verseData.text.trim();
          existingVerse.translation = "WEB";
          existingVerse.isActive = true;
          await existingVerse.save();
          updatedCount++;
          console.log(`   ✏️  Updated verse ${verseNumber}: ${verseData.text.substring(0, 50)}...`);
        } else {
          skippedCount++;
        }
      } else {
        // Create new verse
        const verse = new BibleVerse({
          bookId: judeBook._id,
          bookName: "Jude",
          chapterNumber: 1,
          verseNumber: verseNumber,
          text: verseData.text.trim(),
          translation: "WEB",
          isActive: true,
        });
        await verse.save();
        addedCount++;
        console.log(`   ✅ Added verse ${verseNumber}: ${verseData.text.substring(0, 50)}...`);
      }
    }

    // Final statistics
    const finalCount = await BibleVerse.countDocuments({ bookName: "Jude" });
    
    console.log("\n📊 COMPLETION SUMMARY:");
    console.log("================================");
    console.log(`✅ Verses added: ${addedCount}`);
    console.log(`✏️  Verses updated: ${updatedCount}`);
    console.log(`⏭️  Verses skipped: ${skippedCount}`);
    console.log(`📖 Total verses in Jude: ${finalCount}`);
    
    if (finalCount === 25) {
      console.log("\n🎉 SUCCESS! Jude is now complete with all 25 verses!");
    } else {
      console.log(`\n⚠️  Warning: Expected 25 verses, found ${finalCount}`);
    }

    // Display a sample verse
    const sampleVerse = await BibleVerse.findOne({ 
      bookName: "Jude", 
      chapterNumber: 1, 
      verseNumber: 3 
    });
    
    if (sampleVerse) {
      console.log("\n📖 Sample verse (Jude 1:3):");
      console.log(`   "${sampleVerse.text}"`);
    }

  } catch (error) {
    console.error("❌ Error completing Jude:", error.message);
    if (error.response) {
      console.error("   API Response:", error.response.status, error.response.statusText);
      console.error("   Data:", JSON.stringify(error.response.data).substring(0, 200));
    }
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
  }
}

// Run the script
if (require.main === module) {
  completeJude()
    .then(() => {
      console.log("\n🏁 Script completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

module.exports = { completeJude };
