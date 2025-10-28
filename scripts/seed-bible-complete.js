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

// Bible API configuration
const BIBLE_API_BASE = "https://api.scripture.api.bible/v1";
const BIBLE_API_KEY = process.env.BIBLE_API_KEY || "your-api-key-here";

// Alternative: Use a free Bible API
const FREE_BIBLE_API = "https://bible-api.com";

async function seedBibleDataComplete() {
  try {
    console.log("🌱 Starting complete Bible data seeding...");

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

    // Seed with sample data first
    console.log("📖 Seeding with sample data...");
    await seedSampleData(bookNameToId);

    // Try to fetch additional data from free Bible API
    console.log("🌐 Attempting to fetch additional data from Bible API...");
    await fetchAdditionalBibleData(bookNameToId);

    console.log("🎉 Bible data seeding completed!");

    // Get final statistics
    const stats = await getBibleStats();
    console.log(`📈 Final database statistics:`, stats);
  } catch (error) {
    console.error("❌ Error seeding Bible data:", error);
  } finally {
    mongoose.connection.close();
  }
}

async function seedSampleData(bookNameToId) {
  // Comprehensive sample data covering popular verses
  const sampleData = {
    Genesis: {
      1: {
        1: "In the beginning, God created the heavens and the earth.",
        2: "The earth was formless and empty. Darkness was on the surface of the deep. God's Spirit was hovering over the surface of the waters.",
        3: 'God said, "Let there be light," and there was light.',
        4: "God saw the light, and saw that it was good. God divided the light from the darkness.",
        5: 'God called the light "day", and the darkness he called "night". There was evening and there was morning, one day.',
        26: 'God said, "Let us make man in our image, after our likeness: and let them have dominion over the fish of the sea, and over the birds of the sky, and over the livestock, and over all the earth, and over every creeping thing that creeps on the earth."',
        27: "God created man in his own image. In God's image he created him; male and female he created them.",
        28: 'God blessed them. God said to them, "Be fruitful, multiply, fill the earth, and subdue it. Have dominion over the fish of the sea, over the birds of the sky, and over every living thing that moves on the earth."',
      },
    },
    Exodus: {
      20: {
        1: "God spoke all these words, saying,",
        2: '"I am the LORD your God, who brought you out of the land of Egypt, out of the house of bondage.',
        3: "You shall have no other gods before me.",
        4: "You shall not make for yourselves an idol, nor any image of anything that is in heaven above, or that is in the earth beneath, or that is in the water under the earth:",
        5: 'you shall not bow yourself down to them, nor serve them, for I, the LORD your God, am a jealous God, visiting the iniquity of the fathers on the children, on the third and on the fourth generation of those who hate me,"',
      },
    },
    Psalm: {
      1: {
        1: "Blessed is the man who doesn't walk in the counsel of the wicked, nor stand in the way of sinners, nor sit in the seat of scoffers;",
        2: "but his delight is in the LORD's law. On his law he meditates day and night.",
        3: "He will be like a tree planted by the streams of water, that brings forth its fruit in its season, whose leaf also does not wither. Whatever he does shall prosper.",
      },
      23: {
        1: "The LORD is my shepherd; I shall not want.",
        2: "He makes me lie down in green pastures. He leads me beside still waters.",
        3: "He restores my soul. He guides me in the paths of righteousness for his name's sake.",
        4: "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.",
        5: "You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.",
        6: "Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in the LORD's house forever.",
      },
      91: {
        1: "He who dwells in the secret place of the Most High will rest in the shadow of the Almighty.",
        2: 'I will say of the LORD, "He is my refuge and my fortress; my God, in whom I trust."',
        3: "For he will deliver you from the snare of the fowler, and from the deadly pestilence.",
        4: "He will cover you with his feathers. Under his wings you will take refuge. His faithfulness is your shield and rampart.",
      },
    },
    Proverbs: {
      3: {
        5: "Trust in the LORD with all your heart, and don't lean on your own understanding.",
        6: "In all your ways acknowledge him, and he will make your paths straight.",
        7: "Don't be wise in your own eyes. Fear the LORD, and depart from evil.",
      },
      16: {
        3: "Commit your works to the LORD, and your plans shall be established.",
        9: "A man's heart plans his course, but the LORD directs his steps.",
      },
    },
    Isaiah: {
      40: {
        31: "But those who wait for the LORD will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.",
      },
      53: {
        5: "But he was pierced for our transgressions. He was crushed for our iniquities. The punishment that brought our peace was on him; and by his wounds we are healed.",
        6: "All we like sheep have gone astray. Everyone has turned to his own way; and the LORD has laid on him the iniquity of us all.",
      },
    },
    Jeremiah: {
      29: {
        11: "For I know the thoughts that I think toward you, says the LORD, thoughts of peace, and not of evil, to give you hope in your latter end.",
        12: "You shall call on me, and you shall go and pray to me, and I will listen to you.",
        13: "You shall seek me, and find me, when you search for me with all your heart.",
      },
    },
    Matthew: {
      5: {
        3: "Blessed are the poor in spirit, for theirs is the Kingdom of Heaven.",
        4: "Blessed are those who mourn, for they shall be comforted.",
        5: "Blessed are the gentle, for they shall inherit the earth.",
        6: "Blessed are those who hunger and thirst after righteousness, for they shall be filled.",
        7: "Blessed are the merciful, for they shall obtain mercy.",
        8: "Blessed are the pure in heart, for they shall see God.",
        9: "Blessed are the peacemakers, for they shall be called children of God.",
        10: "Blessed are those who have been persecuted for righteousness' sake, for theirs is the Kingdom of Heaven.",
      },
      6: {
        9: "Pray like this: 'Our Father in heaven, may your name be kept holy.",
        10: "Let your Kingdom come. Let your will be done, as in heaven, so on earth.",
        11: "Give us today our daily bread.",
        12: "Forgive us our debts, as we also forgive our debtors.",
        13: "Bring us not into temptation, but deliver us from the evil one. For yours is the Kingdom, the power, and the glory forever. Amen.'",
      },
      28: {
        19: "Go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit,",
        20: "teaching them to observe all things that I commanded you. Behold, I am with you always, even to the end of the age.",
      },
    },
    Mark: {
      10: {
        27: 'Looking at them, Jesus said, "With men it is impossible, but not with God, for all things are possible with God."',
      },
    },
    Luke: {
      2: {
        11: "For there is born to you today, in David's city, a Savior, who is Christ the Lord.",
        14: '"Glory to God in the highest, on earth peace, good will toward men."',
      },
    },
    John: {
      1: {
        1: "In the beginning was the Word, and the Word was with God, and the Word was God.",
        2: "The same was in the beginning with God.",
        3: "All things were made through him. Without him was not anything made that has been made.",
        4: "In him was life, and the life was the light of men.",
        5: "The light shines in the darkness, and the darkness hasn't overcome it.",
        14: "The Word became flesh, and lived among us. We saw his glory, such glory as of the one and only Son of the Father, full of grace and truth.",
      },
      3: {
        16: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
        17: "For God didn't send his Son into the world to judge the world, but that the world should be saved through him.",
        18: "He who believes in him is not judged. He who doesn't believe has been judged already, because he has not believed in the name of the one and only Son of God.",
      },
      14: {
        6: 'Jesus said to him, "I am the way, the truth, and the life. No one comes to the Father, except through me."',
        27: "Peace I leave with you. My peace I give to you; not as the world gives, I give to you. Don't let your heart be troubled, neither let it be fearful.",
      },
    },
    Acts: {
      1: {
        8: 'But you will receive power when the Holy Spirit has come upon you. You will be witnesses to me in Jerusalem, in all Judea and Samaria, and to the uttermost parts of the earth."',
      },
    },
    Romans: {
      3: {
        23: "for all have sinned, and fall short of the glory of God;",
        24: "being justified freely by his grace through the redemption that is in Christ Jesus;",
      },
      6: {
        23: "For the wages of sin is death, but the free gift of God is eternal life in Christ Jesus our Lord.",
      },
      8: {
        28: "We know that all things work together for good for those who love God, to those who are called according to his purpose.",
        29: "For whom he foreknew, he also predestined to be conformed to the image of his Son, that he might be the firstborn among many brothers.",
        30: "Whom he predestined, those he also called. Whom he called, those he also justified. Whom he justified, those he also glorified.",
      },
      10: {
        9: "that if you will confess with your mouth that Jesus is Lord, and believe in your heart that God raised him from the dead, you will be saved.",
        10: "For with the heart, one believes unto righteousness; and with the mouth confession is made unto salvation.",
      },
    },
    "1 Corinthians": {
      13: {
        4: "Love is patient and is kind; love doesn't envy. Love doesn't brag, is not proud,",
        5: "doesn't behave itself inappropriately, doesn't seek its own way, is not provoked, takes no account of evil;",
        6: "doesn't rejoice in unrighteousness, but rejoices with the truth;",
        7: "bears all things, believes all things, hopes all things, endures all things.",
        8: "Love never fails. But where there are prophecies, they will be done away with. Where there are various languages, they will cease. Where there is knowledge, it will be done away with.",
        13: "But now faith, hope, and love remain—these three. The greatest of these is love.",
      },
    },
    "2 Corinthians": {
      5: {
        17: "Therefore if anyone is in Christ, he is a new creation. The old things have passed away. Behold, all things have become new.",
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
      6: {
        10: "Finally, be strong in the Lord, and in the strength of his might.",
        11: "Put on the whole armor of God, that you may be able to stand against the wiles of the devil.",
      },
    },
    Philippians: {
      4: {
        13: "I can do all things through Christ, who strengthens me.",
        19: "My God will supply every need of yours according to his riches in glory in Christ Jesus.",
      },
    },
    Colossians: {
      3: {
        23: "Whatever you do, work heartily, as for the Lord, and not for men,",
      },
    },
    "1 Thessalonians": {
      5: {
        17: "Pray without ceasing.",
      },
    },
    "2 Timothy": {
      3: {
        16: "Every Scripture is God-breathed and profitable for teaching, for reproof, for correction, and for instruction in righteousness,",
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
    "1 Peter": {
      5: {
        7: "casting all your worries on him, because he cares for you.",
      },
    },
    "1 John": {
      4: {
        8: "He who doesn't love doesn't know God, for God is love.",
        19: "We love him, because he first loved us.",
      },
    },
    Revelation: {
      3: {
        20: "Behold, I stand at the door and knock. If anyone hears my voice and opens the door, then I will come in to him, and will dine with him, and he with me.",
      },
    },
  };

  let totalVerses = 0;

  for (const [bookName, chapters] of Object.entries(sampleData)) {
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

  console.log(`✅ Created ${totalVerses} sample verses`);
}

async function fetchAdditionalBibleData(bookNameToId) {
  // This function would fetch additional data from a Bible API
  // For now, we'll just log that we would do this
  console.log("📡 Would fetch additional data from Bible API here");
  console.log("💡 To get complete Bible data, you can:");
  console.log("   1. Use the Scripture API (api.scripture.api.bible)");
  console.log("   2. Use the Bible API (bible-api.com)");
  console.log("   3. Import from a Bible JSON file");
  console.log("   4. Use the World English Bible (WEB) data");
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
  seedBibleDataComplete();
}

module.exports = { seedBibleDataComplete };
