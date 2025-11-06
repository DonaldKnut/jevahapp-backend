const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();

const { BibleVerse, BIBLE_BOOKS } = require("../dist/models/bible.model");

async function testSeed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to database\n");

  const book = BIBLE_BOOKS[0]; // Genesis
  const chapter = 1;
  const translation = "KJV";

  console.log(`Testing: ${book.name} ${chapter} with ${translation}\n`);

  // Get existing WEB verses
  const existingVerses = await BibleVerse.find({
    bookName: book.name,
    chapterNumber: chapter,
    translation: "WEB",
    isActive: true,
  })
    .sort({ verseNumber: 1 })
    .limit(5);

  console.log(`Found ${existingVerses.length} WEB verses to seed\n`);

  for (const verse of existingVerses.slice(0, 3)) {
    const url = `https://bible-api.com/${book.name}+${chapter}:${verse.verseNumber}?translation=${translation.toLowerCase()}`;

    try {
      const response = await axios.get(url, { timeout: 10000 });

      if (response.data && response.data.text) {
        const text = response.data.text.trim();
        console.log(`✅ ${book.name} ${chapter}:${verse.verseNumber}`);
        console.log(`   ${text.substring(0, 60)}...\n`);

        // Check if KJV already exists
        const existing = await BibleVerse.findOne({
          bookName: book.name,
          chapterNumber: chapter,
          verseNumber: verse.verseNumber,
          translation: translation,
        });

        if (existing) {
          console.log("   ⏭️  Already exists\n");
        } else {
          // Create new
          const newVerse = new BibleVerse({
            bookId: verse.bookId,
            bookName: book.name,
            chapterNumber: chapter,
            verseNumber: verse.verseNumber,
            text: text,
            translation: translation,
            isActive: true,
          });
          await newVerse.save();
          console.log("   ✅ Saved!\n");
        }
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  await mongoose.connection.close();
  console.log("✅ Test complete!");
}

testSeed().catch(console.error);











