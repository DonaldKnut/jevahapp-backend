const mongoose = require("mongoose");
require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const mime = require("mime-types");

// Import compiled models
const { CopyrightFreeSong } = require("../dist/models/copyrightFreeSong.model");
const { User } = require("../dist/models/user.model");
const fileUploadService = require("../dist/service/fileUpload.service").default;

const AUDIO_ASSETS_PATH = path.join(__dirname, "../assets/audio");
const IMAGE_ASSETS_PATH = path.join(__dirname, "../assets/images");

// Default avatar for seeded creators
const DEFAULT_AVATAR =
  "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/user-avatars/jevah-hq.jpeg";

// Seed creators (only used to attribute uploadedBy with real names)
const creators = [
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000001"),
    firstName: "Engelis",
    lastName: "",
    email: "engelis@jevahapp.com",
    username: "engelis_official",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000002"),
    firstName: "Traditional",
    lastName: "Gospel",
    email: "traditional@jevahapp.com",
    username: "traditional_gospel",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000003"),
    firstName: "Tune Melody",
    lastName: "Media",
    email: "tunemelody@jevahapp.com",
    username: "tunemelody_media",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000004"),
    firstName: "Gospel Pop",
    lastName: "Vocals",
    email: "gospelpop@jevahapp.com",
    username: "gospel_pop_vocals",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000005"),
    firstName: "Tadashikeiji",
    lastName: "",
    email: "tadashikeiji@jevahapp.com",
    username: "tadashikeiji",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000006"),
    firstName: "Misselle",
    lastName: "",
    email: "misselle@jevahapp.com",
    username: "misselle",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000007"),
    firstName: "Davidest",
    lastName: "",
    email: "davidest@jevahapp.com",
    username: "davidest",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000008"),
    firstName: "Tunetank",
    lastName: "",
    email: "tunetank@jevahapp.com",
    username: "tunetank",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000009"),
    firstName: "Lilex",
    lastName: "",
    email: "lilex@jevahapp.com",
    username: "lilex",
    avatar: DEFAULT_AVATAR,
  },
  {
    _id: new mongoose.Types.ObjectId("750000000000000000000010"),
    firstName: "Jevah",
    lastName: "HQ",
    email: "hq@jevahapp.com",
    username: "jevah_hq",
    avatar: DEFAULT_AVATAR,
  },
];

// Helper to pick creator by name for readability
const C = {
  engelis: creators[0]._id,
  traditionalGospel: creators[1]._id,
  tuneMelodyMedia: creators[2]._id,
  gospelPopVocals: creators[3]._id,
  tadashikeiji: creators[4]._id,
  misselle: creators[5]._id,
  davidest: creators[6]._id,
  tunetank: creators[7]._id,
  lilex: creators[8]._id,
  hq: creators[9]._id,
};

// Song to Artist mapping (as provided by user)
const SONG_ARTIST_MAPPING = {
  "call-to-worship-xx-engelis.mp3": { singer: "Engelis", uploadedBy: C.engelis },
  "gospel-train-367419.mp3": { singer: "Traditional Gospel", uploadedBy: C.traditionalGospel },
  "you-restore-my-soul-413723.mp3": { singer: "Tune Melody Media", uploadedBy: C.tuneMelodyMedia },
  "the-wind-gospel-pop-vocals-341410.mp3": { singer: "Gospel Pop Vocals", uploadedBy: C.gospelPopVocals },
  "in-the-name-of-jesus-Tadashikeiji.mp3": { singer: "Tadashikeiji", uploadedBy: C.tadashikeiji },
  "holy-holy-holy-438720.mp3": { singer: "Misselle", uploadedBy: C.misselle },
  "he-is-risen-matthew-28-441357.mp3": { singer: "Misselle", uploadedBy: C.misselle },
  "agbani-lagbatan-by-oliverkeyz-featuring-folake-jesu-198779.mp3": { singer: "Tune Melody Media", uploadedBy: C.tuneMelodyMedia },
  "davidestifinopray3-391582.mp3": { singer: "Davidest", uploadedBy: C.davidest },
  "gospel-worship-christian-church-music-amazing-grace-347221.mp3": { singer: "Tunetank", uploadedBy: C.tunetank },
  "gospel-worship-christian-church-348450.mp3": { singer: "Tunetank", uploadedBy: C.tunetank },
  "glory-hallelujah-397698.mp3": { singer: "Lilex", uploadedBy: C.lilex },
  "davidest-salvation-406000.mp3": { singer: "Davidest", uploadedBy: C.davidest },
  "rise-in-glory-394237.mp3": { singer: "Lilex", uploadedBy: C.lilex },
};

// Function to get MIME type from file extension
function getMimeType(filename) {
  return mime.lookup(filename) || "application/octet-stream";
}

// Convert filename to readable title
function filenameToTitle(filename) {
  const nameWithoutExt = path.basename(filename, path.extname(filename));
  return nameWithoutExt
    .replace(/-\d+|-by-|-featuring-|\d+/g, " ")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace(/Xx|XX/g, "")
    .trim();
}

async function seedNewCopyrightFreeSongs() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB");

    // Upsert creator user accounts
    console.log("📋 Setting up admin user profiles...");
    for (const c of creators) {
      await User.updateOne(
        { _id: c._id },
        {
          $set: {
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            provider: "email",
            role: "admin",
            avatar: c.avatar,
            avatarUpload: c.avatar,
          },
        },
        { upsert: true }
      );
    }
    console.log(`✅ Creator profiles ready: ${creators.length}`);

    // Clear existing copyright-free songs
    console.log("🗑️  Clearing existing copyright-free songs...");
    const deleteResult = await CopyrightFreeSong.deleteMany({});
    console.log(`✅ Removed ${deleteResult.deletedCount} existing songs.`);

    const audioFiles = await fs.readdir(AUDIO_ASSETS_PATH);
    const imageFiles = await fs.readdir(IMAGE_ASSETS_PATH);

    const songsToSeed = [];
    let imageIndex = 0;

    for (const audioFilename of audioFiles) {
      if (audioFilename.endsWith(".mp3")) {
        const audioFilePath = path.join(AUDIO_ASSETS_PATH, audioFilename);
        const audioBuffer = await fs.readFile(audioFilePath);
        const audioMimeType = getMimeType(audioFilename);

        // Assign an image sequentially
        const thumbnailFilename = imageFiles[imageIndex % imageFiles.length];
        const thumbnailFilePath = path.join(IMAGE_ASSETS_PATH, thumbnailFilename);
        const thumbnailBuffer = await fs.readFile(thumbnailFilePath);
        const thumbnailMimeType = getMimeType(thumbnailFilename);

        imageIndex++;

        console.log(`📤 [${songsToSeed.length + 1}/${audioFiles.filter(f => f.endsWith('.mp3')).length}] Processing: ${audioFilename}...`);

        // Upload audio file to R2
        console.log(`   📤 Uploading audio to Cloudflare R2...`);
        const audioUploadResult = await fileUploadService.uploadMedia(
          audioBuffer,
          "media-music",
          audioMimeType
        );

        // Upload thumbnail to R2
        console.log(`   📤 Uploading thumbnail to Cloudflare R2...`);
        const thumbnailUploadResult = await fileUploadService.uploadMedia(
          thumbnailBuffer,
          "media-thumbnails",
          thumbnailMimeType
        );

        const title = filenameToTitle(audioFilename);
        const songMapping = SONG_ARTIST_MAPPING[audioFilename] || {
          singer: "Jevah HQ",
          uploadedBy: C.hq,
        };

        songsToSeed.push({
          title,
          singer: songMapping.singer,
          uploadedBy: songMapping.uploadedBy,
          fileUrl: audioUploadResult.secure_url,
          thumbnailUrl: thumbnailUploadResult.secure_url,
          duration: 180, // Placeholder duration
          likeCount: Math.floor(Math.random() * 100),
          shareCount: Math.floor(Math.random() * 50),
        });

        console.log(`   ✅ Song created: ${title} by ${songMapping.singer}`);
      }
    }

    if (songsToSeed.length > 0) {
      console.log(`\n📤 Inserting ${songsToSeed.length} copyright-free songs into the database...`);
      const insertedSongs = await CopyrightFreeSong.insertMany(songsToSeed);
      console.log(`✅ Successfully seeded ${insertedSongs.length} copyright-free songs.\n`);
      
      insertedSongs.forEach((song) => {
        console.log(`   ✓ ${song.title} by ${song.singer}`);
      });
    } else {
      console.log("⚠️  No MP3 files found in assets/audio to seed.");
    }

    console.log("\n🎉 Copyright-free song seeding completed!");
  } catch (error) {
    console.error("❌ Error seeding copyright-free songs:", error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
    console.log("✅ Database connection closed");
  }
}

seedNewCopyrightFreeSongs();

