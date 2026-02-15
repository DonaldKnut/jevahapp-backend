const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();

const { BibleVerse, BIBLE_BOOKS } = require("../dist/models/bible.model");

// Popular books to seed first (smaller, more likely to be complete)
const POPULAR_BOOKS = [
  "Psalms", "Proverbs", "John", "Matthew", "Luke", "Acts", "Romans", 
  "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
  "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John",
  "2 John", "3 John", "Jude", "Revelation"
];

const TRANSLATIONS = [
  { code: "KJV", name: "King James Version" },
  { code: "ASV", name: "American Standard Version" },
  { code: "DARBY", name: "Darby Translation" },
];

async function fetchVerse(bookName, chapter, verse, translation) {
  try {
    const url = `https://bible-api.com/${bookName}+${chapter}:${verse}?translation=${translation.toLowerCase()}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    if (response.data && response.data.text) {
      return response.data.text.trim();
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function seedPopularBooks() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to database\n");

  for (const translation of TRANSLATIONS) {
    console.log(`\n📖 Seeding ${translation.name} (${translation.code})...`);
    
    let totalAdded = 0;
    let totalSkipped = 0;
    
    for (const bookName of POPULAR_BOOKS) {
      const book = BIBLE_BOOKS.find(b => b.name === bookName);
      if (!book) continue;
      
      console.log(`\n  📚 Processing ${bookName}...`);
      
      for (let chapterNum = 1; chapterNum <= book.chapters; chapterNum++) {
        // Get existing WEB verses for this chapter
        const existingVerses = await BibleVerse.find({
          bookName: bookName,
          chapterNumber: chapterNum,
          translation: "WEB",
          isActive: true,
        }).sort({ verseNumber: 1 });

        if (existingVerses.length === 0) {
          console.log(`    ⏭️  Skipping ${bookName} ${chapterNum} (no WEB verses)`);
          continue;
        }

        console.log(`    📄 ${bookName} ${chapterNum} (${existingVerses.length} verses)...`);

        for (const verse of existingVerses) {
          // Check if this translation already exists
          const existing = await BibleVerse.findOne({
            bookName: bookName,
            chapterNumber: chapterNum,
            verseNumber: verse.verseNumber,
            translation: translation.code,
          });

          if (existing) {
            totalSkipped++;
            continue;
          }

          // Fetch verse text
          const verseText = await fetchVerse(bookName, chapterNum, verse.verseNumber, translation.code);

          if (!verseText || verseText.length < 5) {
            totalSkipped++;
            continue;
          }

          // Create new verse
          const newVerse = new BibleVerse({
            bookId: verse.bookId,
            bookName: bookName,
            chapterNumber: chapterNum,
            verseNumber: verse.verseNumber,
            text: verseText,
            translation: translation.code,
            isActive: true,
          });

          await newVerse.save();
          totalAdded++;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    console.log(`\n✅ ${translation.name} complete!`);
    console.log(`   Added: ${totalAdded}`);
    console.log(`   Skipped: ${totalSkipped}`);
  }

  // Show final counts
  console.log("\n📊 Final translation counts:");
  const counts = await BibleVerse.aggregate([
    { $group: { _id: "$translation", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  counts.forEach(t => {
    console.log(`  ${t._id}: ${t.count.toLocaleString()} verses`);
  });

  await mongoose.connection.close();
  console.log("\n🎉 Popular books seeding complete!");
}

seedPopularBooks().catch(console.error);















