/**
 * Seed Copyright-Free Songs from assets/audio folder
 * 
 * This script:
 * 1. Reads all audio files from assets/audio/
 * 2. Maps them to their artists (provided mapping)
 * 3. Assigns images from assets/images/ (one per song)
 * 4. Uploads everything to Cloudflare R2
 * 5. Seeds them into the database
 * 
 * Usage:
 *   npm run build
 *   node scripts/seed-copyright-free-from-assets.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// Import compiled models and services
const { Media } = require("../dist/models/media.model");
const { User } = require("../dist/models/user.model");

// Import FileUploadService - it's exported as an instance (not a class)
const fileUploadService = require("../dist/service/fileUpload.service").default;

// Paths
const AUDIO_FOLDER = path.join(__dirname, "../assets/audio");
const IMAGES_FOLDER = path.join(__dirname, "../assets/images");

// Simple MIME type detection
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    // Audio
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return mimeMap[ext] || "application/octet-stream";
}

// Convert filename to readable title
function filenameToTitle(filename) {
  let nameWithoutExt = path.basename(filename, path.extname(filename));
  
  // Remove numbers and IDs at the end
  nameWithoutExt = nameWithoutExt.replace(/-\d+$/g, "");
  
  // Remove common prefixes/suffixes
  nameWithoutExt = nameWithoutExt.replace(/xx-?/gi, "");
  nameWithoutExt = nameWithoutExt.replace(/by-?/gi, "");
  
  // Special handling for known patterns
  const specialCases = {
    "call-to-worship-engelis": "Call To Worship",
    "gospel-train": "Gospel Train",
    "you-restore-my-soul": "You Restore My Soul",
    "the-wind-gospel-pop-vocals": "The Wind Gospel",
    "in-the-name-of-jesus-Tadashikeiji": "In The Name Of Jesus",
    "holy-holy-holy": "Holy Holy Holy",
    "he-is-risen-matthew-28": "He Is Risen",
    "agbani-lagbatan-by-oliverkeyz-featuring-folake-jesu": "Agbani Lagbatan",
    "davidestifinopray3": "Davidest Ifinopray",
    "gospel-worship-christian-church-music-amazing-grace": "Amazing Grace",
    "gospel-worship-christian-church": "Gospel Worship",
    "glory-hallelujah": "Glory Hallelujah",
    "davidest-salvation": "Salvation",
    "rise-in-glory": "Rise In Glory",
  };
  
  // Check for special cases
  for (const [key, value] of Object.entries(specialCases)) {
    if (nameWithoutExt.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Default: convert to title case
  return nameWithoutExt
    .split("-")
    .map((word) => {
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Song to Artist mapping (as provided by user)
 */
const SONG_ARTIST_MAPPING = {
  "call-to-worship-xx-engelis.mp3": "Engelis",
  "gospel-train-367419.mp3": "Traditional Gospel",
  "you-restore-my-soul-413723.mp3": "Tune Melody Media",
  "the-wind-gospel-pop-vocals-341410.mp3": "Gospel Pop Vocals",
  "in-the-name-of-jesus-Tadashikeiji.mp3": "Tadashikeiji",
  "holy-holy-holy-438720.mp3": "Misselle",
  "he-is-risen-matthew-28-441357.mp3": "Misselle",
  "agbani-lagbatan-by-oliverkeyz-featuring-folake-jesu-198779.mp3": "TuneMelodyMedia",
  "davidestifinopray3-391582.mp3": "Davidest",
  "gospel-worship-christian-church-music-amazing-grace-347221.mp3": "Tunetank",
  "gospel-worship-christian-church-348450.mp3": "Tunetank",
  "glory-hallelujah-397698.mp3": "Lilex",
  "davidest-salvation-406000.mp3": "Davidest",
  "rise-in-glory-394237.mp3": "Lilex",
};

/**
 * Get category from filename or title
 */
function getCategory(filename, title) {
  const lower = filename.toLowerCase();
  if (lower.includes("worship")) return "worship";
  if (lower.includes("gospel")) return "worship";
  if (lower.includes("holy") || lower.includes("resurrection") || lower.includes("risen")) return "worship";
  if (lower.includes("pray") || lower.includes("prayer")) return "worship";
  if (lower.includes("salvation") || lower.includes("restore")) return "inspiration";
  return "worship"; // Default
}

/**
 * Get topics from title/filename (using only valid topics from Media model)
 */
function getTopics(filename, title) {
  // Valid topics from Media model validation
  const validTopics = [
    "faith", "healing", "grace", "prayer", "maturity", "spiritual growth",
    "worship", "inspiration", "gospel", "sunday-service", "christian",
    "bible study", "testimony", "evangelism", "family", "marriage",
    "youth", "children", "music ministry", "praise", "sermon", "teaching",
    "discipleship", "leadership", "community", "outreach", "missions",
    "prayer meeting", "fellowship", "celebration", "repentance", "forgiveness",
    "love", "hope", "joy", "peace", "patience", "kindness", "goodness",
    "faithfulness", "gentleness", "self-control"
  ];
  
  const topics = [];
  const lower = filename.toLowerCase() + " " + title.toLowerCase();
  
  // Map keywords to valid topics
  if (lower.includes("worship")) topics.push("worship");
  if (lower.includes("gospel")) topics.push("gospel");
  if (lower.includes("praise") || lower.includes("hallelujah")) topics.push("praise");
  if (lower.includes("holy")) topics.push("worship");
  if (lower.includes("jesus") || lower.includes("resurrection") || lower.includes("risen")) topics.push("faith");
  if (lower.includes("pray") || lower.includes("prayer")) topics.push("prayer");
  if (lower.includes("restore") || lower.includes("salvation")) topics.push("faith"); // Use "faith" instead of "salvation"
  if (lower.includes("glory")) topics.push("praise");
  if (lower.includes("inspiration") || lower.includes("inspire")) topics.push("inspiration");
  if (lower.includes("testimony")) topics.push("testimony");
  
  // Remove duplicates and ensure all are valid
  const uniqueTopics = [...new Set(topics.filter(topic => validTopics.includes(topic)))];
  
  return uniqueTopics.length > 0 ? uniqueTopics : ["worship", "praise"];
}

/**
 * Main seeding function
 */
async function seedCopyrightFreeSongsFromAssets() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB\n");

    // Check if folders exist
    if (!fs.existsSync(AUDIO_FOLDER)) {
      console.error(`❌ Audio folder not found: ${AUDIO_FOLDER}`);
      return;
    }

    if (!fs.existsSync(IMAGES_FOLDER)) {
      console.error(`❌ Images folder not found: ${IMAGES_FOLDER}`);
      return;
    }

    // Find or create admin user
    console.log("📋 Setting up admin user...");
    let adminUser = await User.findOne({
      $or: [{ email: "admin@jevah.com" }, { role: "admin" }],
    });

    if (!adminUser) {
      adminUser = await User.create({
        firstName: "Admin",
        lastName: "User",
        email: "admin@jevah.com",
        username: "jevah_admin",
        role: "admin",
        password: "TempPassword123!",
        isEmailVerified: true,
        isProfileComplete: true,
      });
      console.log("✅ Created admin user:", adminUser.email);
    } else {
      console.log(`✅ Using existing admin user: ${adminUser.email}\n`);
    }

    // Get all audio files
    const audioFiles = fs
      .readdirSync(AUDIO_FOLDER)
      .filter((file) => /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(file));

    if (audioFiles.length === 0) {
      console.error("❌ No audio files found in assets/audio/");
      return;
    }

    // Get all image files
    const imageFiles = fs
      .readdirSync(IMAGES_FOLDER)
      .filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file));

    if (imageFiles.length === 0) {
      console.error("❌ No image files found in assets/images/");
      return;
    }

    console.log(`🎵 Found ${audioFiles.length} audio files`);
    console.log(`🖼️  Found ${imageFiles.length} image files\n`);

    // Clear existing copyright-free songs from assets (optional)
    const clearExisting = process.argv.includes("--clear");
    if (clearExisting) {
      console.log("🗑️  Clearing existing copyright-free songs...");
      // Note: This will clear ALL copyright-free songs, not just from assets
      // Uncomment if needed:
      // const deleteResult = await Media.deleteMany({
      //   isPublicDomain: true,
      //   contentType: { $in: ["music", "audio"] },
      // });
      // console.log(`✅ Removed ${deleteResult.deletedCount} existing songs\n`);
    }

    console.log("📤 Starting upload and seeding process...\n");

    const uploadService = fileUploadService;
    const results = [];
    let imageIndex = 0; // Cycle through images

    // Process each audio file
    for (let i = 0; i < audioFiles.length; i++) {
      const audioFile = audioFiles[i];
      const audioPath = path.join(AUDIO_FOLDER, audioFile);
      
      // Get or cycle through images (one per song)
      const imageFile = imageFiles[imageIndex % imageFiles.length];
      const imagePath = path.join(IMAGES_FOLDER, imageFile);
      imageIndex++;

      try {
        // Get artist from mapping
        const artist = SONG_ARTIST_MAPPING[audioFile] || "Jevah Music";
        const title = filenameToTitle(audioFile);
        const category = getCategory(audioFile, title);
        const topics = getTopics(audioFile, title);

        console.log(`📤 [${i + 1}/${audioFiles.length}] Processing: ${title}`);
        console.log(`   Artist: ${artist}`);
        console.log(`   Image: ${imageFile}`);

        // Read files
        const audioBuffer = fs.readFileSync(audioPath);
        const imageBuffer = fs.readFileSync(imagePath);
        const audioMimeType = getMimeType(audioPath);
        const imageMimeType = getMimeType(imagePath);

        // Upload audio to R2
        console.log(`   📤 Uploading audio to Cloudflare R2...`);
        const audioUpload = await uploadService.uploadMedia(
          audioBuffer,
          "media-music",
          audioMimeType
        );
        console.log(`   ✅ Audio uploaded: ${path.basename(audioUpload.objectKey)}`);

        // Upload thumbnail to R2
        console.log(`   📤 Uploading thumbnail to Cloudflare R2...`);
        const thumbnailUpload = await uploadService.uploadMedia(
          imageBuffer,
          "media-thumbnails",
          imageMimeType
        );
        console.log(`   ✅ Thumbnail uploaded: ${path.basename(thumbnailUpload.objectKey)}`);

        // Check if song already exists
        const existingSong = await Media.findOne({
          isPublicDomain: true,
          title: title,
          speaker: artist,
        });

        if (existingSong) {
          console.log(`   ⚠️  Song already exists, skipping database creation...`);
          results.push({ title, artist, status: "skipped" });
          continue;
        }

        // Get file size for duration estimation (simplified)
        // Duration will need to be set manually or use a library like music-metadata
        const fileSize = audioBuffer.length;
        const estimatedDuration = Math.max(120, Math.floor(fileSize / 16000)); // Rough estimate

        // Create song in database
        const song = await Media.create({
          title: title,
          description: `${title} by ${artist} - Copyright-free gospel music`,
          contentType: "music",
          category: category,
          fileUrl: audioUpload.secure_url,
          fileMimeType: audioMimeType,
          fileObjectKey: audioUpload.objectKey,
          thumbnailUrl: thumbnailUpload.secure_url,
          thumbnailObjectKey: thumbnailUpload.objectKey,
          speaker: artist,
          year: 2024,
          duration: estimatedDuration,
          topics: topics,
          tags: [...topics, artist.toLowerCase().replace(/\s+/g, "-")],
          uploadedBy: adminUser._id,
          isPublicDomain: true,
          moderationStatus: "approved",
          viewCount: 0,
          listenCount: 0,
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          isHidden: false,
        });

        console.log(`   ✅ Song created in database: ${song.title}`);
        results.push({ title, artist, status: "success" });
        console.log("");
      } catch (error) {
        console.error(`   ❌ Error processing ${audioFile}:`, error.message);
        results.push({ title: audioFile, status: "error", error: error.message });
        console.log("");
      }
    }

    // Summary
    console.log("\n📊 Summary:");
    console.log("=".repeat(50));
    const successCount = results.filter((r) => r.status === "success").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    console.log(`   ✅ Successfully seeded: ${successCount}`);
    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped (already exist): ${skippedCount}`);
    }
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount}`);
      results
        .filter((r) => r.status === "error")
        .forEach((r) => {
          console.log(`      - ${r.title}: ${r.error}`);
        });
    }

    if (successCount > 0) {
      console.log("\n🎉 Copyright-free songs seeding completed!\n");
      console.log("📋 Songs seeded:");
      results
        .filter((r) => r.status === "success")
        .forEach((r) => {
          console.log(`   ✓ ${r.title} by ${r.artist}`);
        });
    }

    // Get statistics
    const stats = await Media.aggregate([
      {
        $match: {
          isPublicDomain: true,
          contentType: { $in: ["music", "audio"] },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      console.log("\n📈 Songs by category:");
      stats.forEach((stat) => {
        console.log(`   ${stat._id || "uncategorized"}: ${stat.count} songs`);
      });
    }

    console.log("\n✅ All done! Songs are ready for users to listen, like, and view.\n");
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("✅ Database connection closed\n");
  }
}

// Run the seeding function
if (require.main === module) {
  seedCopyrightFreeSongsFromAssets()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

module.exports = { seedCopyrightFreeSongsFromAssets };

