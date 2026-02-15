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
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000008"),
    firstName: "Johannes",
    lastName: "Doble",
    email: "johannes@jevahapp.com",
    username: "johannes_doble",
    avatar: "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/user-avatars/myles-munroe.jpg",
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000009"),
    firstName: "Ayo",
    lastName: "Olayiwola",
    email: "ayo@jevahapp.com",
    username: "ayo_olayiwola",
    avatar: "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/user-avatars/A%20cena%20da%20Boa%20Sexta-feira%20com%20Jesus%20Cristo_%20_%20imagem%20gerada%20com%20IA.jpeg",
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
  johannes: creators[7]._id,
  ayo: creators[8]._id,
};

// Provided default content
const defaultContent = [
  // 1. Myles Monroe Sermon - uploaded by Johannes Doble
  {
    title: "Understanding True Manhood _ Dr. Myles Munroe on Manhood _ MunroeGlobal.com",
    description: "Sermon by Dr. Myles Munroe on understanding true manhood",
    contentType: "sermon",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/Understanding%20True%20Manhood%20_%20Dr.%20Myles%20Munroe%20on%20Manhood%20_%20MunroeGlobal.com.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/user-avatars/myles-munroe.jpg",
    topics: ["sermon", "leadership", "teaching", "christian"],
    uploadedBy: C.johannes,
    isDefaultContent: true,
    isOnboardingContent: true,
    createdAt: new Date("2024-12-05T10:00:00Z"), // Last month
    updatedAt: new Date("2024-12-05T10:00:00Z"),
  },

  // 2. Arome Osayi Sermon - uploaded by Johannes Doble
  {
    title: "YOU WILL TAKE FASTING & PRAYER SERIOUSLY AFTER HEARING THIS - POWER OF FASTING - APOSTLE AROME OSAYI",
    description: "Sermon by Apostle Arome Osayi on the power of fasting and prayer",
    contentType: "sermon",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/YOU%20WILL%20TAKE%20FASTING%20%26%20PRAYER%20SERIOUSLY%20AFTER%20HEARING%20THIS%20-%20POWER%20OF%20FASTING%20-%20APOSTLE%20AROME%20OSAYI.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/AROME-1.jpeg",
    topics: ["sermon", "prayer", "teaching", "spiritual growth"],
    uploadedBy: C.johannes,
    isDefaultContent: true,
    isOnboardingContent: true,
    createdAt: new Date("2024-12-12T14:30:00Z"), // Last month
    updatedAt: new Date("2024-12-12T14:30:00Z"),
  },

  // 3. Lawrence Oyor Music Video - uploaded by Jevah HQ
  {
    title: "JUGULAR JUGULAR - Lawrence Oyor ft Greatman Takit",
    description: "Music video by Lawrence Oyor featuring Greatman Takit",
    contentType: "videos",
    category: "worship",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/JUGULAR%20JUGULAR%20-%20Lawrence%20Oyor%20ft%20Greatman%20Takit.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1758677253/jevah-hq_tcqmxl.jpg",
    topics: ["worship", "music ministry", "gospel", "christian"],
    uploadedBy: C.hq,
    isDefaultContent: true,
    isOnboardingContent: true,
    createdAt: new Date("2024-12-18T16:00:00Z"), // Last month
    updatedAt: new Date("2024-12-18T16:00:00Z"),
  },

  // 4. Sermon by Ayo Olayiwola
  {
    title: "Sermon - Ayo Olayiwola",
    description: "Sermon by Ayo Olayiwola",
    contentType: "sermon",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/videoplayback.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/user-avatars/A%20cena%20da%20Boa%20Sexta-feira%20com%20Jesus%20Cristo_%20_%20imagem%20gerada%20com%20IA.jpeg",
    topics: ["sermon", "teaching", "christian"],
    uploadedBy: C.ayo,
    isDefaultContent: true,
    isOnboardingContent: true,
    createdAt: new Date("2024-12-22T11:15:00Z"), // Last month
    updatedAt: new Date("2024-12-22T11:15:00Z"),
  },
];

async function seedProvidedDefaults() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("Connected to MongoDB");

    // Check existing default content
    const existingContent = await Media.find({ isDefaultContent: true });
    console.log(`\n📊 Found ${existingContent.length} existing default content items`);
    if (existingContent.length > 0) {
      console.log("Existing items:");
      existingContent.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.title} [${item.contentType}]`);
      });
    }

    // Upsert creator user accounts to allow populate of uploadedBy with real names
    console.log("\n👤 Upserting creator profiles...");
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
            avatar: c.avatar || DEFAULT_AVATAR,
            avatarUpload: c.avatar || DEFAULT_AVATAR,
          },
        },
        { upsert: true }
      );
    }
    console.log(`✅ Creator profiles ready: ${creators.length}`);

    // Check which new items don't already exist (by fileUrl)
    const existingFileUrls = new Set(
      existingContent.map(item => item.fileUrl)
    );
    
    const newContentToAdd = defaultContent.filter(
      item => !existingFileUrls.has(item.fileUrl)
    );

    if (newContentToAdd.length === 0) {
      console.log("\n⚠️  All new content items already exist in database. Nothing to add.");
      return;
    }

    console.log(`\n➕ Adding ${newContentToAdd.length} new content items:`);
    newContentToAdd.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.title} [${item.contentType}]`);
    });

    // Insert only new content
    const inserted = await Media.insertMany(newContentToAdd);
    console.log(`\n✅ Successfully inserted ${inserted.length} new default items`);

    // Show final count
    const finalCount = await Media.countDocuments({ isDefaultContent: true });
    console.log(`\n📈 Total default content items: ${finalCount}`);

    console.log(
      "\n✅ Seeding completed. Public endpoint /api/media/default will now return all items."
    );
  } catch (err) {
    console.error("Error seeding provided defaults:", err);
    throw err;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

if (require.main === module) {
  seedProvidedDefaults();
}

module.exports = { seedProvidedDefaults };
