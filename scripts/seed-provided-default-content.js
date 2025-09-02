const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled models
const { Media } = require("../dist/models/media.model");
const { User } = require("../dist/models/user.model");

// Default avatar for seeded creators
const DEFAULT_AVATAR =
  "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/user-avatars/jevah-hq.jpeg";

// Seed creators (only used to attribute uploadedBy with real names)
const creators = [
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000001"),
    firstName: "Kefee",
    lastName: "Obareki",
    email: "kefee@jevahapp.com",
    username: "kefee_official",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000002"),
    firstName: "Enoch",
    lastName: "Adeboye",
    email: "adeboye@jevahapp.com",
    username: "pastor_adeboye",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000003"),
    firstName: "William",
    lastName: "Kumuyi",
    email: "kumuyi@jevahapp.com",
    username: "pastor_kumuyi",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000004"),
    firstName: "Chris",
    lastName: "Oyakhilome",
    email: "chris@jevahapp.com",
    username: "pastor_chris",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000005"),
    firstName: "Arome",
    lastName: "Osayi",
    email: "arome@jevahapp.com",
    username: "apostle_arome",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000006"),
    firstName: "Joshua",
    lastName: "Selman",
    email: "selman@jevahapp.com",
    username: "apostle_selman",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000007"),
    firstName: "Jevah",
    lastName: "HQ",
    email: "hq@jevahapp.com",
    username: "jevah_hq",
    avatar: DEFAULT_AVATAR,
  },
];

// Helper to pick creator by name for readability
const C = {
  kefee: creators[0]._id,
  adeboye: creators[1]._id,
  kumuyi: creators[2]._id,
  chris: creators[3]._id,
  arome: creators[4]._id,
  selman: creators[5]._id,
  hq: creators[6]._id,
};

// Provided default content
const defaultContent = [
  // Music (Kefee)
  {
    title: "Thank You My God - Kefee",
    description: "Gospel music by Kefee",
    contentType: "music",
    category: "worship",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-music/kefee_thank-you-my-god.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/Kefee-2.webp",
    topics: ["worship", "gospel"],
    uploadedBy: C.kefee,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },

  // Sermons (Videos)
  {
    title: "The Power of Faith - Pastor Adeboye",
    description: "Sermon video by Pastor E. A. Adeboye",
    contentType: "videos",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/The%20Power%20of%20Faith%20-%20Pastor%20Adeboye.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/adeboye-enoch-jpeg.webp",
    topics: ["faith", "sermon"],
    uploadedBy: C.adeboye,
    isDefaultContent: true,
    isOnboardingContent: true,
  },
  {
    title: "Walking in Victory - Pastor Kumuyi",
    description: "Sermon video by Pastor W. F. Kumuyi",
    contentType: "videos",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/Walking%20in%20Victory%20--%20Pastor%20kumuyi%20.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/ddf37a3e-a511-4430-af0d-a660f9fc224f.jpg",
    topics: ["faith", "sermon"],
    uploadedBy: C.kumuyi,
    isDefaultContent: true,
    isOnboardingContent: true,
  },

  // Audio (Pastor Chris)
  {
    title: "Control Your Thoughts - Pastor Chris",
    description: "Quick word of encouragement",
    contentType: "audio",
    category: "inspiration",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-music/pastor-chris-oyakhilome-control-your-thoughts.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/pastrchris.jpg",
    topics: ["inspiration", "teaching"],
    uploadedBy: C.chris,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },
  {
    title: "Spiritual Warfare: Understanding Demonic Activity - Pastor Chris",
    description: "Teaching on spiritual warfare",
    contentType: "audio",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-music/Spiritual-Warfare-Understanding-Demonic-Activity-Pastor-Chris-Oyakhilome.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/Pastor-Chris.webp",
    topics: ["faith", "teaching"],
    uploadedBy: C.chris,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },

  // Audio (Arome Osayi)
  {
    title: "This Jesus... The Pattern (2010) - Apostle Arome Osayi",
    description: "Teaching by Apostle Arome Osayi",
    contentType: "audio",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-music/08-This-Jesus...The-Pattern-Tue-26th-Oct.-2010-2.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/AROME-1.jpeg",
    topics: ["teaching"],
    uploadedBy: C.arome,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },

  // Audio (Joshua Selman)
  {
    title: "EPHPHATHA: The Mystery Of Open Doors - Apostle Joshua Selman",
    description: "Teaching on open doors",
    contentType: "audio",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-music/EPHPHATHA-The-Mystery-of-Open-Doors-Apostle-Joshua-Selman-koinonia-Abuja-www.spiritnerds.org_.mp3",
    fileMimeType: "audio/mpeg",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/ca92b62237dad4a46bd9291360c196c5.jpg",
    topics: ["teaching", "faith"],
    uploadedBy: C.selman,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },

  // Ebooks
  {
    title: "In His Face - Bob Sorge",
    description: "A prophetic call to renewed focus",
    contentType: "ebook",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-books/Bob%20Sorge%20-%20In%20His%20face%20_%20a%20prophetic%20call%20to%20renewed%20focus%20(1994%2C%20Oasis%20House%20)%20-%20libgen.li.pdf",
    fileMimeType: "application/pdf",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/inhisface.jpg",
    topics: ["prayer", "discipleship"],
    uploadedBy: C.hq,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },
  {
    title: "God's Chosen Fast - Arthur Wallis",
    description: "A spiritual and practical guide to fasting",
    contentType: "ebook",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-books/Wallis%2C%20Arthur%20-%20God%E2%80%99s%20chosen%20fast%20_%20a%20spiritual%20and%20practical%20guide%20to%20fasting-CLC%20Publ.%20(1999).pdf",
    fileMimeType: "application/pdf",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/Godschosenfast.jpg",
    topics: ["prayer", "discipleship"],
    uploadedBy: C.hq,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },
  {
    title: "Fasting - Jentezen Franklin",
    description: "Opening the door to a deeper, more powerful relationship",
    contentType: "ebook",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-books/Jentezen%20Franklin%20-%20Fasting_%20Opening%20the%20Door%20to%20a%20Deeper%2C%20More%20Intimate%2C%20More%20Powerful%20Relationship%20.pdf",
    fileMimeType: "application/pdf",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/product%20sizing%20for%20web%20(1).png",
    topics: ["prayer", "discipleship"],
    uploadedBy: C.hq,
    isDefaultContent: true,
    isOnboardingContent: true,
    isDownloadable: true,
  },
];

async function seedProvidedDefaults() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("Connected to MongoDB");

    // Upsert creator user accounts to allow populate of uploadedBy with real names
    console.log("Upserting creator profiles...");
    for (const c of creators) {
      await User.updateOne(
        { _id: c._id },
        {
          $set: {
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            provider: "email",
            role: "content_creator",
            isVerifiedCreator: true,
            avatar: DEFAULT_AVATAR,
            avatarUpload: DEFAULT_AVATAR,
          },
        },
        { upsert: true }
      );
    }
    console.log(`Creator profiles ready: ${creators.length}`);

    // Remove any existing default/onboarding content
    const removeResult = await Media.deleteMany({ isDefaultContent: true });
    console.log(`Removed ${removeResult.deletedCount} existing default items`);

    // Insert fresh default content
    const inserted = await Media.insertMany(defaultContent);
    console.log(`Inserted ${inserted.length} provided default items`);

    inserted.forEach(item => {
      console.log(`- ${item.title} [${item.contentType}]`);
    });

    console.log(
      "\n✅ Seeding completed. Public endpoint /api/media/default will now return these items."
    );
  } catch (err) {
    console.error("Error seeding provided defaults:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

if (require.main === module) {
  seedProvidedDefaults();
}

module.exports = { seedProvidedDefaults };
