const mongoose = require("mongoose");
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

// Sample Bible data structure (WEB - World English Bible)
// This is a simplified version. In production, you would fetch the complete WEB data
const sampleBibleData = {
  Genesis: {
    1: {
      1: "In the beginning, God created the heavens and the earth.",
      2: "The earth was formless and empty. Darkness was on the surface of the deep. God's Spirit was hovering over the surface of the waters.",
      3: 'God said, "Let there be light," and there was light.',
      4: "God saw the light, and saw that it was good. God divided the light from the darkness.",
      5: 'God called the light "day", and the darkness he called "night". There was evening and there was morning, one day.',
    },
    2: {
      1: "The heavens, the earth, and all their vast array were finished.",
      2: "On the seventh day God finished his work which he had made; and he rested on the seventh day from all his work which he had made.",
      3: "God blessed the seventh day, and made it holy, because he rested in it from all his work of creation which he had made.",
    },
  },
  John: {
    1: {
      1: "In the beginning was the Word, and the Word was with God, and the Word was God.",
      2: "The same was in the beginning with God.",
      3: "All things were made through him. Without him was not anything made that has been made.",
      4: "In him was life, and the life was the light of men.",
      5: "The light shines in the darkness, and the darkness hasn't overcome it.",
    },
    3: {
      16: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
      17: "For God didn't send his Son into the world to judge the world, but that the world should be saved through him.",
      18: "He who believes in him is not judged. He who doesn't believe has been judged already, because he has not believed in the name of the one and only Son of God.",
    },
  },
  Psalm: {
    23: {
      1: "The LORD is my shepherd; I shall not want.",
      2: "He makes me lie down in green pastures. He leads me beside still waters.",
      3: "He restores my soul. He guides me in the paths of righteousness for his name's sake.",
      4: "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.",
      5: "You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.",
      6: "Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in the LORD's house forever.",
    },
  },
  Romans: {
    8: {
      28: "We know that all things work together for good for those who love God, to those who are called according to his purpose.",
      29: "For whom he foreknew, he also predestined to be conformed to the image of his Son, that he might be the firstborn among many brothers.",
      30: "Whom he predestined, those he also called. Whom he called, those he also justified. Whom he justified, those he also glorified.",
    },
  },
  Jeremiah: {
    29: {
      11: "For I know the thoughts that I think toward you, says the LORD, thoughts of peace, and not of evil, to give you hope in your latter end.",
      12: "You shall call on me, and you shall go and pray to me, and I will listen to you.",
      13: "You shall seek me, and find me, when you search for me with all your heart.",
    },
  },
  Philippians: {
    4: {
      13: "I can do all things through Christ, who strengthens me.",
      19: "My God will supply every need of yours according to his riches in glory in Christ Jesus.",
    },
  },
  Matthew: {
    28: {
      19: "Go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit,",
      20: "teaching them to observe all things that I commanded you. Behold, I am with you always, even to the end of the age.",
    },
  },
};

async function seedBibleData() {
  try {
    console.log("🌱 Starting Bible data seeding...");

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

    // Seed chapters and verses
    console.log("📖 Seeding chapters and verses...");
    let totalVerses = 0;

    for (const [bookName, chapters] of Object.entries(sampleBibleData)) {
      const bookId = bookNameToId[bookName];
      if (!bookId) {
        console.log(`⚠️  Book not found in BIBLE_BOOKS: ${bookName}`);
        continue;
      }

      for (const [chapterNum, verses] of Object.entries(chapters)) {
        const chapterNumber = parseInt(chapterNum);
        const verseNumbers = Object.keys(verses)
          .map(Number)
          .sort((a, b) => a - b);
        const maxVerse = Math.max(...verseNumbers);

        // Create chapter
        const chapter = new BibleChapter({
          bookId,
          bookName,
          chapterNumber,
          verses: maxVerse,
          isActive: true,
        });
        await chapter.save();
        console.log(`✅ Created chapter: ${bookName} ${chapterNumber}`);

        // Create verses
        for (const [verseNum, text] of Object.entries(verses)) {
          const verseNumber = parseInt(verseNum);
          const verse = new BibleVerse({
            bookId,
            bookName,
            chapterNumber,
            verseNumber,
            text,
            translation: "WEB",
            isActive: true,
          });
          await verse.save();
          totalVerses++;
        }
      }
    }

    // Create additional sample data for more books
    console.log("📝 Creating additional sample data...");
    await createAdditionalSampleData(bookNameToId);

    console.log("🎉 Bible data seeding completed!");
    console.log(`📊 Statistics:`);
    console.log(`   - Books: ${createdBooks.length}`);
    console.log(`   - Total verses: ${totalVerses}`);

    // Get final statistics
    const stats = await getBibleStats();
    console.log(`📈 Final database statistics:`, stats);
  } catch (error) {
    console.error("❌ Error seeding Bible data:", error);
  } finally {
    mongoose.connection.close();
  }
}

async function createAdditionalSampleData(bookNameToId) {
  // Add more sample verses for popular books
  const additionalData = {
    Proverbs: {
      3: {
        5: "Trust in the LORD with all your heart, and don't lean on your own understanding.",
        6: "In all your ways acknowledge him, and he will make your paths straight.",
      },
    },
    "1 Corinthians": {
      13: {
        4: "Love is patient and is kind; love doesn't envy. Love doesn't brag, is not proud,",
        5: "doesn't behave itself inappropriately, doesn't seek its own way, is not provoked, takes no account of evil;",
        6: "doesn't rejoice in unrighteousness, but rejoices with the truth;",
        7: "bears all things, believes all things, hopes all things, endures all things.",
        8: "Love never fails. But where there are prophecies, they will be done away with. Where there are various languages, they will cease. Where there is knowledge, it will be done away with.",
      },
    },
    Galatians: {
      5: {
        22: "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faith,",
        23: "gentleness, and self-control. Against such things there is no law.",
      },
    },
    Ephesians: {
      2: {
        8: "For by grace you have been saved through faith, and that not of yourselves; it is the gift of God,",
        9: "not of works, that no one would boast.",
      },
    },
    Hebrews: {
      11: {
        1: "Now faith is assurance of things hoped for, proof of things not seen.",
        6: "Without faith it is impossible to be well pleasing to him, for he who comes to God must believe that he exists, and that he is a rewarder of those who seek him.",
      },
    },
    James: {
      1: {
        2: "Count it all joy, my brothers, when you fall into various temptations,",
        3: "knowing that the testing of your faith produces endurance.",
      },
    },
  };

  let additionalVerses = 0;

  for (const [bookName, chapters] of Object.entries(additionalData)) {
    const bookId = bookNameToId[bookName];
    if (!bookId) continue;

    for (const [chapterNum, verses] of Object.entries(chapters)) {
      const chapterNumber = parseInt(chapterNum);

      // Check if chapter exists, if not create it
      let chapter = await BibleChapter.findOne({
        bookName,
        chapterNumber,
        isActive: true,
      });

      if (!chapter) {
        const verseNumbers = Object.keys(verses)
          .map(Number)
          .sort((a, b) => a - b);
        const maxVerse = Math.max(...verseNumbers);

        chapter = new BibleChapter({
          bookId,
          bookName,
          chapterNumber,
          verses: maxVerse,
          isActive: true,
        });
        await chapter.save();
      }

      // Create verses
      for (const [verseNum, text] of Object.entries(verses)) {
        const verseNumber = parseInt(verseNum);

        // Check if verse already exists
        const existingVerse = await BibleVerse.findOne({
          bookName,
          chapterNumber,
          verseNumber,
          isActive: true,
        });

        if (!existingVerse) {
          const verse = new BibleVerse({
            bookId,
            bookName,
            chapterNumber,
            verseNumber,
            text,
            translation: "WEB",
            isActive: true,
          });
          await verse.save();
          additionalVerses++;
        }
      }
    }
  }

  console.log(`✅ Added ${additionalVerses} additional verses`);
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

// Run the seeding
if (require.main === module) {
  seedBibleData();
}

module.exports = { seedBibleData };
