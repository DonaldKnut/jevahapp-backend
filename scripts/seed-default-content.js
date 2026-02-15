const mongoose = require("mongoose");
require("dotenv").config();

// Import the Media model
const { Media } = require("../dist/models/media.model");

// Nigerian Gospel Creator Profiles
const nigerianCreators = [
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89c01"),
    firstName: "Sinach",
    lastName: "Osinachukwu",
    email: "sinach@jevahapp.com",
    username: "sinach_official",
    role: "content_creator",
    isVerifiedCreator: true,
    avatar: "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
  },
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89c02"),
    firstName: "Kefee",
    lastName: "Obareki",
    email: "kefee@jevahapp.com",
    username: "kefee_official",
    role: "content_creator",
    isVerifiedCreator: true,
    avatar: "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
  },
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89c03"),
    firstName: "Pastor",
    lastName: "Adeboye",
    email: "adeboye@jevahapp.com",
    username: "pastor_adeboye",
    role: "content_creator",
    isVerifiedCreator: true,
    avatar: "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
  },
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89c04"),
    firstName: "Pastor",
    lastName: "Kumuyi",
    email: "kumuyi@jevahapp.com",
    username: "pastor_kumuyi",
    role: "content_creator",
    isVerifiedCreator: true,
    avatar: "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
  },
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89c05"),
    firstName: "Pastor",
    lastName: "Oyedepo",
    email: "oyedepo@jevahapp.com",
    username: "pastor_oyedepo",
    role: "content_creator",
    isVerifiedCreator: true,
    avatar: "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
  },
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89c06"),
    firstName: "Jevah",
    lastName: "Ministries",
    email: "ministries@jevahapp.com",
    username: "jevah_ministries",
    role: "content_creator",
    isVerifiedCreator: true,
    avatar: "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
  }
];

// Cloudflare R2 Base URLs
const R2_BASE_URL = "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah";
const THUMBNAIL_BASE_URL = "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362";

// Sample Nigerian Gospel Content Data with Real URLs
const defaultContent = [
  // Gospel Music
  {
    title: "Great Are You Lord - Sinach",
    description: "Powerful worship song by Nigerian gospel artist Sinach",
    contentType: "music",
    category: "worship",
    fileUrl: `${R2_BASE_URL}/music/sinach-great-are-you-lord.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/sinach-great-are-you-lord.jpg`,
    topics: ["worship", "praise", "gospel", "christian"],
    uploadedBy: nigerianCreators[0]._id, // Sinach
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
    fileUrl: `${R2_BASE_URL}/music/sinach-way-maker.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/sinach-way-maker.jpg`,
    topics: ["worship", "praise", "gospel", "christian", "faith"],
    uploadedBy: nigerianCreators[0]._id, // Sinach
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
    fileUrl: `${R2_BASE_URL}/music/sinach-i-know-who-i-am.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/sinach-i-know-who-i-am.jpg`,
    topics: ["inspiration", "gospel", "christian"],
    uploadedBy: nigerianCreators[0]._id, // Sinach
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
    fileUrl: `${R2_BASE_URL}/music/sinach-name-of-jesus.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/sinach-name-of-jesus.jpg`,
    topics: ["worship", "jesus", "gospel", "christian"],
    uploadedBy: nigerianCreators[0]._id, // Sinach
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 1800, // 30 minutes
    isDownloadable: false,
  },
  {
    title: "Rejoice - Kefee",
    description: "Joyful gospel song by Kefee",
    contentType: "music",
    category: "inspiration",
    fileUrl: `${R2_BASE_URL}/music/kefee-rejoice.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/kefee-rejoice.jpg`,
    topics: ["joy", "inspiration", "gospel", "christian"],
    uploadedBy: nigerianCreators[1]._id, // Kefee
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 255, // 4.25 minutes
    isDownloadable: true,
  },

  // Sermons
  {
    title: "Walking in Victory - Pastor Kumuyi",
    description: "Message on living a victorious Christian life",
    contentType: "sermon",
    category: "teachings",
    fileUrl: `${R2_BASE_URL}/sermons/kumuyi-walking-in-victory.mp4`,
    fileMimeType: "video/mp4",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/kumuyi-walking-in-victory.jpg`,
    topics: ["sermon", "christian", "victory"],
    uploadedBy: nigerianCreators[3]._id, // Pastor Kumuyi
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
    fileUrl: `${R2_BASE_URL}/sermons/oyedepo-prayer-changes-everything.mp4`,
    fileMimeType: "video/mp4",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/oyedepo-prayer-changes-everything.jpg`,
    topics: ["prayer", "sermon", "christian"],
    uploadedBy: nigerianCreators[4]._id, // Pastor Oyedepo
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 2700, // 45 minutes
    isDownloadable: false,
  },
  {
    title: "The Power of Faith - Pastor Adeboye",
    description: "Inspiring sermon on faith and miracles",
    contentType: "sermon",
    category: "teachings",
    fileUrl: `${R2_BASE_URL}/sermons/adeboye-power-of-faith.mp4`,
    fileMimeType: "video/mp4",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/adeboye-power-of-faith.jpg`,
    topics: ["faith", "sermon", "christian", "miracles"],
    uploadedBy: nigerianCreators[2]._id, // Pastor Adeboye
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 1800, // 30 minutes
    isDownloadable: false,
  },

  // Audio Books/Devotionals
  {
    title: "Daily Devotional - Morning Prayer",
    description: "Start your day with prayer and reflection",
    contentType: "devotional",
    category: "inspiration",
    fileUrl: `${R2_BASE_URL}/devotionals/morning-prayer-devotional.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/morning-prayer-devotional.jpg`,
    topics: ["prayer", "christian", "devotional"],
    uploadedBy: nigerianCreators[5]._id, // Jevah Ministries
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
    fileUrl: `${R2_BASE_URL}/devotionals/evening-gratitude-devotional.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/evening-gratitude-devotional.jpg`,
    topics: ["gratitude", "christian", "devotional"],
    uploadedBy: nigerianCreators[5]._id, // Jevah Ministries
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 480, // 8 minutes
    isDownloadable: true,
  },

  // Short Audio Clips
  {
    title: "Quick Encouragement - 2 Minutes",
    description: "A quick word of encouragement for your day",
    contentType: "audio",
    category: "inspiration",
    fileUrl: `${R2_BASE_URL}/audio/quick-encouragement.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/quick-encouragement.jpg`,
    topics: ["inspiration", "christian", "encouragement"],
    uploadedBy: nigerianCreators[5]._id, // Jevah Ministries
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
    fileUrl: `${R2_BASE_URL}/audio/bible-verse-day.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/bible-verse-day.jpg`,
    topics: ["bible study", "inspiration", "christian"],
    uploadedBy: nigerianCreators[5]._id, // Jevah Ministries
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
    fileUrl: `${R2_BASE_URL}/audio/prayer-for-peace.mp3`,
    fileMimeType: "audio/mpeg",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/prayer-for-peace.jpg`,
    topics: ["prayer", "peace", "christian"],
    uploadedBy: nigerianCreators[5]._id, // Jevah Ministries
    isDefaultContent: true,
    isOnboardingContent: true,
    duration: 180, // 3 minutes
    isDownloadable: true,
  },

  // E-books
  {
    title: "The Power of Positive Thinking - Christian Edition",
    description: "Biblical principles for positive thinking",
    contentType: "ebook",
    category: "inspiration",
    fileUrl: `${R2_BASE_URL}/books/power-of-positive-thinking.pdf`,
    fileMimeType: "application/pdf",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/positive-thinking-book.jpg`,
    topics: ["inspiration", "christian", "positive thinking"],
    uploadedBy: nigerianCreators[5]._id, // Jevah Ministries
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },
  {
    title: "Prayer Guide for Beginners",
    description: "A comprehensive guide to prayer for new believers",
    contentType: "ebook",
    category: "teachings",
    fileUrl: `${R2_BASE_URL}/books/prayer-guide-beginners.pdf`,
    fileMimeType: "application/pdf",
    thumbnailUrl: `${THUMBNAIL_BASE_URL}/prayer-guide.jpg`,
    topics: ["prayer", "christian", "beginners"],
    uploadedBy: nigerianCreators[5]._id, // Jevah Ministries
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  }
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

    // Insert default content
    const result = await Media.insertMany(defaultContent);
    console.log(`Successfully seeded ${result.length} default content items`);

    // Log the seeded content
    result.forEach(item => {
      console.log(`- ${item.title} (${item.contentType}) by ${item.uploadedBy}`);
    });

    console.log("\n✅ Default content seeding completed successfully!");
    console.log("📱 Frontend can now display proper creator names and URLs");
    console.log("🔗 All content points to Cloudflare R2 storage");
    console.log("🖼️ Thumbnails use Cloudinary URLs");

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
