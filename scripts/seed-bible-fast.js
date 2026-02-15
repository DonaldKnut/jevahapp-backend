const mongoose = require("mongoose");
const fs = require("fs");

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

// Pre-built Bible data - this is much faster than API calls
const BIBLE_DATA = {
  "Genesis": {
    "1": {
      "1": "In the beginning, God created the heavens and the earth.",
      "2": "The earth was formless and empty. Darkness was on the surface of the deep. God's Spirit was hovering over the surface of the waters.",
      "3": 'God said, "Let there be light," and there was light.',
      "4": "God saw the light, and saw that it was good. God divided the light from the darkness.",
      "5": 'God called the light "day", and the darkness he called "night". There was evening and there was morning, one day.',
      "6": 'God said, "Let there be an expanse in the middle of the waters, and let it divide the waters from the waters."',
      "7": "God made the expanse, and divided the waters which were under the expanse from the waters which were above the expanse; and it was so.",
      "8": 'God called the expanse "sky". There was evening and there was morning, a second day.',
      "9": 'God said, "Let the waters under the sky be gathered together to one place, and let the dry land appear;" and it was so.',
      "10": 'God called the dry land "earth", and the gathering together of the waters he called "seas". God saw that it was good.',
      "11": 'God said, "Let the earth put forth grass, herbs yielding seed, and fruit trees bearing fruit after their kind, with its seed in it, on the earth;" and it was so.',
      "12": "The earth brought forth grass, herbs yielding seed after their kind, and trees bearing fruit, with its seed in it, after their kind; and God saw that it was good.",
      "13": "There was evening and there was morning, a third day.",
      "14": 'God said, "Let there be lights in the expanse of sky to divide the day from the night; and let them be for signs, and for seasons, and for days and years;',
      "15": "and let them be for lights in the expanse of sky to give light on the earth;" and it was so.",
      "16": "God made the two great lights: the greater light to rule the day, and the lesser light to rule the night. He also made the stars.",
      "17": "God set them in the expanse of sky to give light to the earth,",
      "18": "and to rule over the day and over the night, and to divide the light from the darkness. God saw that it was good.",
      "19": "There was evening and there was morning, a fourth day.",
      "20": 'God said, "Let the waters abound with living creatures, and let birds fly above the earth in the open expanse of sky."',
      "21": "God created the large sea creatures, and every living creature that moves, with which the waters swarmed, after their kind, and every winged bird after its kind. God saw that it was good.",
      "22": "God blessed them, saying, "Be fruitful, and multiply, and fill the waters in the seas, and let birds multiply on the earth."",
      "23": "There was evening and there was morning, a fifth day.",
      "24": 'God said, "Let the earth bring forth living creatures after their kind, livestock, creeping things, and animals of the earth after their kind;" and it was so.',
      "25": "God made the animals of the earth after their kind, and the livestock after their kind, and everything that creeps on the ground after its kind. God saw that it was good.",
      "26": 'God said, "Let us make man in our image, after our likeness: and let them have dominion over the fish of the sea, and over the birds of the sky, and over the livestock, and over all the earth, and over every creeping thing that creeps on the earth."',
      "27": "God created man in his own image. In God's image he created him; male and female he created them.",
      "28": 'God blessed them. God said to them, "Be fruitful, multiply, fill the earth, and subdue it. Have dominion over the fish of the sea, over the birds of the sky, and over every living thing that moves on the earth."',
      "29": 'God said, "Behold, I have given you every herb yielding seed, which is on the surface of all the earth, and every tree, which bears fruit yielding seed. It will be your food.',
      "30": "To every animal of the earth, and to every bird of the sky, and to everything that creeps on the earth, in which there is life, I have given every green herb for food;" and it was so.",
      "31": "God saw everything that he had made, and, behold, it was very good. There was evening and there was morning, a sixth day."
    }
  },
  "John": {
    "1": {
      "1": "In the beginning was the Word, and the Word was with God, and the Word was God.",
      "2": "The same was in the beginning with God.",
      "3": "All things were made through him. Without him was not anything made that has been made.",
      "4": "In him was life, and the life was the light of men.",
      "5": "The light shines in the darkness, and the darkness hasn't overcome it.",
      "6": "There came a man, sent from God, whose name was John.",
      "7": "The same came as a witness, that he might testify about the light, that all might believe through him.",
      "8": "He was not the light, but was sent that he might testify about the light.",
      "9": "The true light that enlightens everyone was coming into the world.",
      "10": "He was in the world, and the world was made through him, and the world didn't recognize him.",
      "11": "He came to his own, and those who were his own didn't receive him.",
      "12": "But as many as received him, to them he gave the right to become God's children, to those who believe in his name:",
      "13": "who were born not of blood, nor of the will of the flesh, nor of the will of man, but of God.",
      "14": "The Word became flesh, and lived among us. We saw his glory, such glory as of the one and only Son of the Father, full of grace and truth.",
      "15": "John testified about him. He cried out, saying, "This was he of whom I said, 'He who comes after me has surpassed me, for he was before me.'"",
      "16": "From his fullness we all received grace upon grace.",
      "17": "For the law was given through Moses. Grace and truth came through Jesus Christ.",
      "18": "No one has seen God at any time. The one and only Son, who is in the bosom of the Father, he has declared him."
    },
    "3": {
      "1": "Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews.",
      "2": "The same came to him by night, and said to him, "Rabbi, we know that you are a teacher come from God, for no one can do these signs that you do, unless God is with him."",
      "3": "Jesus answered him, "Most certainly, I tell you, unless one is born anew, he can't see God's Kingdom."",
      "4": "Nicodemus said to him, "How can a man be born when he is old? Can he enter a second time into his mother's womb, and be born?"",
      "5": "Jesus answered, "Most certainly I tell you, unless one is born of water and spirit, he can't enter into God's Kingdom.",
      "6": "That which is born of the flesh is flesh. That which is born of the Spirit is spirit.",
      "7": "Don't marvel that I said to you, 'You must be born anew.'",
      "8": "The wind blows where it wants to, and you hear its sound, but don't know where it comes from and where it is going. So is everyone who is born of the Spirit."",
      "9": "Nicodemus answered him, "How can these things be?"",
      "10": "Jesus answered him, "Are you the teacher of Israel, and don't understand these things?",
      "11": "Most certainly I tell you, we speak that which we know, and testify of that which we have seen, and you don't receive our witness.",
      "12": "If I told you earthly things and you don't believe, how will you believe if I tell you heavenly things?",
      "13": "No one has ascended into heaven, but he who descended out of heaven, the Son of Man, who is in heaven.",
      "14": "As Moses lifted up the serpent in the wilderness, even so must the Son of Man be lifted up,",
      "15": "that whoever believes in him should not perish, but have eternal life.",
      "16": "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
      "17": "For God didn't send his Son into the world to judge the world, but that the world should be saved through him.",
      "18": "He who believes in him is not judged. He who doesn't believe has been judged already, because he has not believed in the name of the one and only Son of God.",
      "19": "This is the judgment, that the light has come into the world, and men loved the darkness rather than the light; for their works were evil.",
      "20": "For everyone who does evil hates the light, and doesn't come to the light, lest his works would be exposed.",
      "21": "But he who does the truth comes to the light, that his works may be revealed, that they have been done in God."
    }
  },
  "Psalms": {
    "23": {
      "1": "The LORD is my shepherd; I shall not want.",
      "2": "He makes me lie down in green pastures. He leads me beside still waters.",
      "3": "He restores my soul. He guides me in the paths of righteousness for his name's sake.",
      "4": "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.",
      "5": "You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over.",
      "6": "Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in the LORD's house forever."
    },
    "91": {
      "1": "He who dwells in the secret place of the Most High will rest in the shadow of the Almighty.",
      "2": 'I will say of the LORD, "He is my refuge and my fortress; my God, in whom I trust."',
      "3": "For he will deliver you from the snare of the fowler, and from the deadly pestilence.",
      "4": "He will cover you with his feathers. Under his wings you will take refuge. His faithfulness is your shield and rampart.",
      "5": "You shall not be afraid of the terror by night, nor of the arrow that flies by day;",
      "6": "nor of the pestilence that walks in darkness, nor of the destruction that wastes at noonday.",
      "7": "A thousand may fall at your side, and ten thousand at your right hand; but it will not come near you.",
      "8": "You will only look with your eyes, and see the recompense of the wicked.",
      "9": "Because you have made the LORD your refuge, and the Most High your dwelling place,",
      "10": "no evil shall happen to you, neither shall any plague come near your dwelling.",
      "11": "For he will put his angels in charge of you, to guard you in all your ways.",
      "12": "They will bear you up in their hands, so that you won't dash your foot against a stone.",
      "13": "You will tread on the lion and cobra. You will trample the young lion and the serpent underfoot.",
      "14": "Because he has set his love on me, therefore I will deliver him. I will set him on high, because he has known my name.",
      "15": "He will call on me, and I will answer him. I will be with him in trouble. I will deliver him, and honor him.",
      "16": "I will satisfy him with long life, and show him my salvation."
    }
  }
};

async function seedBibleFast() {
  try {
    console.log("🚀 Starting FAST Bible seeding...");
    console.log("⚡ This will take less than 30 seconds!");

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
    }
    console.log(`✅ Created ${createdBooks.length} books`);

    // Create a mapping of book names to IDs
    const bookNameToId = {};
    createdBooks.forEach(book => {
      bookNameToId[book.name] = book._id;
    });

    // Seed with comprehensive Bible data
    console.log("📖 Seeding Bible chapters and verses...");
    let totalVerses = 0;
    let totalChapters = 0;

    for (const [bookName, chapters] of Object.entries(BIBLE_DATA)) {
      const bookId = bookNameToId[bookName];
      if (!bookId) {
        console.log(`⚠️  Book not found: ${bookName}`);
        continue;
      }

      for (const [chapterNum, verses] of Object.entries(chapters)) {
        const chapterNumber = parseInt(chapterNum);
        const verseNumbers = Object.keys(verses).map(Number).sort((a, b) => a - b);
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
        totalChapters++;

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

    console.log("\n🎉 FAST Bible seeding completed!");
    console.log(`📈 Statistics:`);
    console.log(`   📚 Books: ${createdBooks.length}`);
    console.log(`   📖 Chapters: ${totalChapters}`);
    console.log(`   📝 Verses: ${totalVerses}`);

    // Test a few key verses
    console.log("\n🧪 Testing key verses...");
    const john316 = await BibleVerse.findOne({
      bookName: "John",
      chapterNumber: 3,
      verseNumber: 16,
      isActive: true
    });
    
    if (john316) {
      console.log(`✅ John 3:16: "${john316.text}"`);
    }

    const genesis11 = await BibleVerse.findOne({
      bookName: "Genesis",
      chapterNumber: 1,
      verseNumber: 1,
      isActive: true
    });
    
    if (genesis11) {
      console.log(`✅ Genesis 1:1: "${genesis11.text}"`);
    }

    console.log("\n🚀 Your Bible app is now ready with key verses!");
    console.log("💡 To get the complete Bible, run the full seeding script later");

  } catch (error) {
    console.error("❌ Error in fast Bible seeding:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the fast seeding
if (require.main === module) {
  seedBibleFast();
}

module.exports = { seedBibleFast };




















