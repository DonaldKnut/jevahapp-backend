const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
);

// Import models
const { BibleFact } = require("../src/models/bibleFact.model");

const bibleFacts = [
  // Creation & Nature
  {
    title: "The First Day of Creation",
    fact: "God created light on the first day, separating it from darkness, before creating the sun, moon, and stars on the fourth day.",
    scripture: "Genesis 1:3-5",
    category: "creation",
    tags: ["creation", "light", "darkness", "genesis"],
    difficulty: "beginner",
  },
  {
    title: "The Number of Stars",
    fact: "The Bible mentions that God knows the number of stars and calls them all by name, showing His infinite knowledge and care.",
    scripture: "Psalm 147:4",
    category: "nature",
    tags: ["stars", "knowledge", "care", "psalm"],
    difficulty: "beginner",
  },

  // Faith & Trust
  {
    title: "Faith as Small as Mustard Seed",
    fact: "Jesus said that faith as small as a mustard seed can move mountains, showing that even tiny faith can accomplish great things.",
    scripture: "Matthew 17:20",
    category: "faith",
    tags: ["faith", "mustard", "mountains", "miracles"],
    difficulty: "beginner",
  },
  {
    title: "Walking on Water",
    fact: "Peter walked on water when he kept his eyes on Jesus, but began to sink when he focused on the storm around him.",
    scripture: "Matthew 14:29-30",
    category: "faith",
    tags: ["peter", "water", "jesus", "trust"],
    difficulty: "intermediate",
  },

  // Love & Relationships
  {
    title: "God's Unfailing Love",
    fact: "The Bible describes God's love as unfailing and everlasting, never ending or changing based on our circumstances.",
    scripture: "Jeremiah 31:3",
    category: "love",
    tags: ["love", "unfailing", "everlasting", "god"],
    difficulty: "beginner",
  },
  {
    title: "Love Your Enemies",
    fact: "Jesus taught to love your enemies and pray for those who persecute you, showing the radical nature of Christian love.",
    scripture: "Matthew 5:44",
    category: "love",
    tags: ["enemies", "prayer", "persecution", "jesus"],
    difficulty: "intermediate",
  },

  // Miracles & Healing
  {
    title: "The Widow's Oil",
    fact: "Elisha helped a widow by multiplying her small jar of oil to fill many vessels, providing for her family's needs.",
    scripture: "2 Kings 4:1-7",
    category: "miracles",
    tags: ["elisha", "widow", "oil", "provision"],
    difficulty: "intermediate",
  },
  {
    title: "Jesus Heals the Blind",
    fact: "Jesus healed a man born blind by making mud with His saliva and telling him to wash in the pool of Siloam.",
    scripture: "John 9:6-7",
    category: "miracles",
    tags: ["jesus", "blind", "healing", "mud"],
    difficulty: "beginner",
  },

  // Wisdom & Proverbs
  {
    title: "The Fear of the Lord",
    fact: "The fear of the Lord is the beginning of wisdom, showing that reverence for God is the foundation of all knowledge.",
    scripture: "Proverbs 9:10",
    category: "wisdom",
    tags: ["fear", "lord", "wisdom", "beginning"],
    difficulty: "beginner",
  },
  {
    title: "A Gentle Answer",
    fact: "A gentle answer turns away wrath, but a harsh word stirs up anger, teaching the power of kind communication.",
    scripture: "Proverbs 15:1",
    category: "wisdom",
    tags: ["gentle", "answer", "wrath", "anger"],
    difficulty: "beginner",
  },

  // Prayer & Worship
  {
    title: "The Lord's Prayer",
    fact: "Jesus taught His disciples the Lord's Prayer as a model for how to pray, including praise, requests, and forgiveness.",
    scripture: "Matthew 6:9-13",
    category: "prayer",
    tags: ["jesus", "prayer", "disciples", "model"],
    difficulty: "beginner",
  },
  {
    title: "Worship in Spirit and Truth",
    fact: "Jesus said true worshipers must worship in spirit and truth, emphasizing the importance of genuine, heartfelt worship.",
    scripture: "John 4:24",
    category: "worship",
    tags: ["worship", "spirit", "truth", "jesus"],
    difficulty: "intermediate",
  },

  // Salvation & Grace
  {
    title: "For God So Loved the World",
    fact: "John 3:16 is often called the 'Gospel in a nutshell' because it summarizes God's plan of salvation through Jesus.",
    scripture: "John 3:16",
    category: "salvation",
    tags: ["god", "loved", "world", "jesus", "salvation"],
    difficulty: "beginner",
  },
  {
    title: "Grace Through Faith",
    fact: "We are saved by grace through faith, not by works, so no one can boast about earning their salvation.",
    scripture: "Ephesians 2:8-9",
    category: "grace",
    tags: ["grace", "faith", "saved", "works"],
    difficulty: "intermediate",
  },

  // Hope & Encouragement
  {
    title: "Plans to Prosper You",
    fact: "God has plans to prosper us and give us hope and a future, showing His loving intentions for His people.",
    scripture: "Jeremiah 29:11",
    category: "hope",
    tags: ["plans", "prosper", "hope", "future"],
    difficulty: "beginner",
  },
  {
    title: "All Things Work Together",
    fact: "All things work together for good for those who love God, providing comfort during difficult times.",
    scripture: "Romans 8:28",
    category: "hope",
    tags: ["things", "work", "good", "love"],
    difficulty: "intermediate",
  },

  // Angels & Spiritual Beings
  {
    title: "Angels as Messengers",
    fact: "The word 'angel' means 'messenger' in Greek, and angels often appear in the Bible to deliver God's messages.",
    scripture: "Luke 1:26-38",
    category: "angels",
    tags: ["angels", "messengers", "greek", "messages"],
    difficulty: "intermediate",
  },
  {
    title: "Guardian Angels",
    fact: "Jesus mentioned that children have angels in heaven who always see the face of the Father, showing God's care.",
    scripture: "Matthew 18:10",
    category: "angels",
    tags: ["children", "angels", "heaven", "father"],
    difficulty: "beginner",
  },

  // End Times & Prophecy
  {
    title: "The Second Coming",
    fact: "Jesus promised to return in the same way He ascended to heaven, giving hope to believers for His second coming.",
    scripture: "Acts 1:11",
    category: "prophecy",
    tags: ["jesus", "return", "ascended", "heaven"],
    difficulty: "intermediate",
  },
  {
    title: "New Heaven and New Earth",
    fact: "God will create a new heaven and new earth where there will be no more death, mourning, or pain.",
    scripture: "Revelation 21:1-4",
    category: "end_times",
    tags: ["new", "heaven", "earth", "death"],
    difficulty: "advanced",
  },

  // Family & Relationships
  {
    title: "Honor Your Parents",
    fact: "The fifth commandment instructs children to honor their father and mother, promising long life as a reward.",
    scripture: "Exodus 20:12",
    category: "family",
    tags: ["honor", "parents", "commandment", "life"],
    difficulty: "beginner",
  },
  {
    title: "Two Become One",
    fact: "In marriage, a man and woman become one flesh, showing the deep spiritual union intended by God.",
    scripture: "Genesis 2:24",
    category: "relationships",
    tags: ["marriage", "one", "flesh", "union"],
    difficulty: "beginner",
  },

  // Money & Work
  {
    title: "The Love of Money",
    fact: "The love of money is the root of all kinds of evil, warning against placing wealth above God.",
    scripture: "1 Timothy 6:10",
    category: "money",
    tags: ["love", "money", "root", "evil"],
    difficulty: "intermediate",
  },
  {
    title: "Work as Unto the Lord",
    fact: "Whatever we do, we should work at it with all our heart, as working for the Lord rather than human masters.",
    scripture: "Colossians 3:23",
    category: "work",
    tags: ["work", "heart", "lord", "masters"],
    difficulty: "beginner",
  },

  // Health & Healing
  {
    title: "Your Body is a Temple",
    fact: "Our bodies are temples of the Holy Spirit, so we should honor God with our bodies through healthy living.",
    scripture: "1 Corinthians 6:19-20",
    category: "health",
    tags: ["body", "temple", "holy", "spirit"],
    difficulty: "intermediate",
  },
  {
    title: "By His Stripes We Are Healed",
    fact: "Jesus was wounded for our transgressions and by His stripes we are healed, showing His sacrifice for our healing.",
    scripture: "Isaiah 53:5",
    category: "healing",
    tags: ["jesus", "wounded", "stripes", "healed"],
    difficulty: "intermediate",
  },

  // Science & Nature
  {
    title: "The Earth Hangs on Nothing",
    fact: "Job 26:7 describes the earth hanging on nothing, which aligns with modern understanding of gravity and space.",
    scripture: "Job 26:7",
    category: "science",
    tags: ["earth", "hangs", "nothing", "gravity"],
    difficulty: "advanced",
  },
  {
    title: "The Water Cycle",
    fact: "Ecclesiastes 1:7 describes the water cycle: 'All streams flow into the sea, yet the sea is never full.'",
    scripture: "Ecclesiastes 1:7",
    category: "nature",
    tags: ["streams", "sea", "water", "cycle"],
    difficulty: "intermediate",
  },

  // Culture & Society
  {
    title: "Salt of the Earth",
    fact: "Jesus called His followers the 'salt of the earth,' meaning they should preserve goodness and add flavor to society.",
    scripture: "Matthew 5:13",
    category: "culture",
    tags: ["salt", "earth", "followers", "goodness"],
    difficulty: "intermediate",
  },
  {
    title: "Light of the World",
    fact: "Jesus also called His followers the 'light of the world,' encouraging them to shine brightly for God.",
    scripture: "Matthew 5:14",
    category: "culture",
    tags: ["light", "world", "followers", "shine"],
    difficulty: "beginner",
  },

  // Forgiveness & Mercy
  {
    title: "Seventy Times Seven",
    fact: "Jesus said to forgive not just seven times, but seventy times seven, showing the unlimited nature of forgiveness.",
    scripture: "Matthew 18:22",
    category: "forgiveness",
    tags: ["forgive", "seven", "seventy", "unlimited"],
    difficulty: "intermediate",
  },
  {
    title: "The Prodigal Son",
    fact: "The father in the Prodigal Son parable represents God's unconditional love and forgiveness for repentant sinners.",
    scripture: "Luke 15:11-32",
    category: "forgiveness",
    tags: ["prodigal", "son", "father", "love"],
    difficulty: "beginner",
  },

  // Covenants & Law
  {
    title: "The Rainbow Covenant",
    fact: "After the flood, God made a covenant with Noah, using the rainbow as a sign that He would never destroy the earth with water again.",
    scripture: "Genesis 9:12-17",
    category: "covenants",
    tags: ["rainbow", "covenant", "noah", "flood"],
    difficulty: "beginner",
  },
  {
    title: "The Ten Commandments",
    fact: "God gave Moses the Ten Commandments on Mount Sinai, establishing the moral law for His people.",
    scripture: "Exodus 20:1-17",
    category: "law",
    tags: ["ten", "commandments", "moses", "sinai"],
    difficulty: "beginner",
  },

  // Church & Ministry
  {
    title: "The Great Commission",
    fact: "Jesus commanded His disciples to go and make disciples of all nations, baptizing and teaching them.",
    scripture: "Matthew 28:19-20",
    category: "ministry",
    tags: ["great", "commission", "disciples", "nations"],
    difficulty: "beginner",
  },
  {
    title: "The Body of Christ",
    fact: "The church is described as the body of Christ, with each member having different gifts and functions.",
    scripture: "1 Corinthians 12:12-27",
    category: "church",
    tags: ["body", "christ", "church", "gifts"],
    difficulty: "intermediate",
  },
];

async function seedBibleFacts() {
  try {
    console.log("🌱 Starting to seed Bible facts...");

    // Clear existing facts
    await BibleFact.deleteMany({});
    console.log("🗑️ Cleared existing Bible facts");

    // Insert new facts
    const insertedFacts = await BibleFact.insertMany(bibleFacts);
    console.log(`✅ Successfully seeded ${insertedFacts.length} Bible facts`);

    // Display statistics
    const stats = await BibleFact.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    console.log("\n📊 Bible Facts by Category:");
    stats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} facts`);
    });

    const difficultyStats = await BibleFact.aggregate([
      {
        $group: {
          _id: "$difficulty",
          count: { $sum: 1 },
        },
      },
    ]);

    console.log("\n📚 Bible Facts by Difficulty:");
    difficultyStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} facts`);
    });

    console.log("\n🎉 Bible facts seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding Bible facts:", error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the seeding function
if (require.main === module) {
  seedBibleFacts();
}

module.exports = { seedBibleFacts };
