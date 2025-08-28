const mongoose = require("mongoose");
require("dotenv").config();

// Import the Media model
const { Media } = require("../dist/models/media.model");

// Sample Nigerian Gospel Content Data
const defaultContent = [
  // Gospel Music
  {
    title: "Great Are You Lord - Sinach",
    description: "Powerful worship song by Nigerian gospel artist Sinach",
    contentType: "music",
    category: "worship",
    fileUrl: "https://example.com/audio/great-are-you-lord-sinach.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/great-are-you-lord.jpg",
    topics: ["worship", "praise", "gospel", "christian"],
    uploadedBy: null, // Will be set to a default admin user
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 240, // 4 minutes
    isDownloadable: true,
  },
  {
    title: "Way Maker - Sinach",
    description: "International hit gospel song by Sinach",
    contentType: "music",
    category: "worship",
    fileUrl: "https://example.com/audio/way-maker-sinach.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/way-maker.jpg",
    topics: ["worship", "praise", "gospel", "christian", "faith"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 300, // 5 minutes
    isDownloadable: true,
  },
  {
    title: "I Know Who I Am - Sinach",
    description: "Identity-affirming gospel song",
    contentType: "music",
    category: "inspiration",
    fileUrl: "https://example.com/audio/i-know-who-i-am-sinach.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/i-know-who-i-am.jpg",
    topics: ["inspiration", "gospel", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 270, // 4.5 minutes
    isDownloadable: true,
  },
  {
    title: "The Name of Jesus - Sinach",
    description: "Powerful declaration of Jesus' name",
    contentType: "music",
    category: "worship",
    fileUrl: "https://example.com/audio/the-name-of-jesus-sinach.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/the-name-of-jesus.jpg",
    topics: ["worship", "gospel", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 285, // 4.75 minutes
    isDownloadable: true,
  },
  {
    title: "Rejoice - Kefee",
    description: "Joyful gospel song by Kefee",
    contentType: "music",
    category: "inspiration",
    fileUrl: "https://example.com/audio/rejoice-kefee.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/rejoice-kefee.jpg",
    topics: ["joy", "inspiration", "gospel", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 255, // 4.25 minutes
    isDownloadable: true,
  },

  // Gospel Videos/Sermons
  {
    title: "The Power of Faith - Pastor Adeboye",
    description: "Inspiring sermon on faith and miracles",
    contentType: "sermon",
    category: "teachings",
    fileUrl: "https://example.com/videos/power-of-faith-adeboye.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl: "https://example.com/thumbnails/power-of-faith.jpg",
    topics: ["faith", "sermon", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 1800, // 30 minutes
    isDownloadable: false,
  },
  {
    title: "Walking in Victory - Pastor Kumuyi",
    description: "Message on living a victorious Christian life",
    contentType: "sermon",
    category: "teachings",
    fileUrl: "https://example.com/videos/walking-in-victory-kumuyi.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl: "https://example.com/thumbnails/walking-in-victory.jpg",
    topics: ["sermon", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 2400, // 40 minutes
    isDownloadable: false,
  },
  {
    title: "Prayer Changes Everything - Pastor Oyedepo",
    description: "Powerful teaching on the importance of prayer",
    contentType: "sermon",
    category: "teachings",
    fileUrl: "https://example.com/videos/prayer-changes-everything-oyedepo.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://example.com/thumbnails/prayer-changes-everything.jpg",
    topics: ["prayer", "sermon", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 2700, // 45 minutes
    isDownloadable: false,
  },

  // Audio Books/Devotionals
  {
    title: "Daily Devotional - Morning Prayer",
    description: "Start your day with prayer and reflection",
    contentType: "devotional",
    category: "inspiration",
    fileUrl: "https://example.com/audio/morning-prayer-devotional.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/morning-prayer.jpg",
    topics: ["prayer", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 600, // 10 minutes
    isDownloadable: true,
  },
  {
    title: "Evening Reflection - Gratitude",
    description: "End your day with gratitude and thanksgiving",
    contentType: "devotional",
    category: "inspiration",
    fileUrl: "https://example.com/audio/evening-gratitude-devotional.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/evening-gratitude.jpg",
    topics: ["christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 480, // 8 minutes
    isDownloadable: true,
  },

  // E-books
  {
    title: "The Power of Positive Thinking - Christian Edition",
    description: "Biblical principles for positive thinking",
    contentType: "ebook",
    category: "inspiration",
    fileUrl: "https://example.com/books/power-of-positive-thinking.pdf",
    fileMimeType: "application/pdf",
    thumbnailUrl: "https://example.com/thumbnails/positive-thinking-book.jpg",
    coverImageUrl: "https://example.com/covers/positive-thinking-cover.jpg",
    topics: ["inspiration", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },
  {
    title: "Prayer Guide for Beginners",
    description: "A comprehensive guide to prayer for new believers",
    contentType: "ebook",
    category: "teachings",
    fileUrl: "https://example.com/books/prayer-guide-beginners.pdf",
    fileMimeType: "application/pdf",
    thumbnailUrl: "https://example.com/thumbnails/prayer-guide.jpg",
    coverImageUrl: "https://example.com/covers/prayer-guide-cover.jpg",
    topics: ["prayer", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },

  // Short Audio Clips (like Samsung's Horizon)
  {
    title: "Quick Encouragement - 2 Minutes",
    description: "A quick word of encouragement for your day",
    contentType: "audio",
    category: "inspiration",
    fileUrl: "https://example.com/audio/quick-encouragement.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/quick-encouragement.jpg",
    topics: ["inspiration", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 120, // 2 minutes
    isDownloadable: true,
  },
  {
    title: "Bible Verse of the Day",
    description: "Daily Bible verse with brief reflection",
    contentType: "audio",
    category: "inspiration",
    fileUrl: "https://example.com/audio/bible-verse-day.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/bible-verse-day.jpg",
    topics: ["bible study", "inspiration", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 90, // 1.5 minutes
    isDownloadable: true,
  },
  {
    title: "Prayer for Peace",
    description: "A calming prayer for inner peace",
    contentType: "audio",
    category: "inspiration",
    fileUrl: "https://example.com/audio/prayer-for-peace.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl: "https://example.com/thumbnails/prayer-for-peace.jpg",
    topics: ["prayer", "peace", "christian"],
    uploadedBy: null,
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 180, // 3 minutes
    isDownloadable: true,
  },
];

async function seedDefaultContent() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("Connected to MongoDB");

    // Check if default content already exists
    const existingContent = await Media.find({ isDefaultContent: true });
    if (existingContent.length > 0) {
      console.log(
        `Found ${existingContent.length} existing default content items. Skipping seeding.`
      );
      return;
    }

    // Create a default admin user ID (you'll need to replace this with an actual admin user ID)
    const defaultAdminId = new mongoose.Types.ObjectId();

    // Add uploadedBy field to all content
    const contentWithUploader = defaultContent.map(item => ({
      ...item,
      uploadedBy: defaultAdminId,
    }));

    // Insert default content
    const result = await Media.insertMany(contentWithUploader);
    console.log(`Successfully seeded ${result.length} default content items`);

    // Log the seeded content
    result.forEach(item => {
      console.log(`- ${item.title} (${item.contentType})`);
    });
  } catch (error) {
    console.error("Error seeding default content:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the seeder
if (require.main === module) {
  seedDefaultContent();
}

module.exports = { seedDefaultContent };
