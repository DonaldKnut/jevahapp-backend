/**
 * Seed Copyright-Free Songs with File Upload
 * 
 * This script:
 * 1. Reads audio files and thumbnails from a local folder
 * 2. Uploads them to Cloudflare R2
 * 3. Seeds them into the database
 * 
 * Folder Structure:
 *   seeds/copyright-free-songs/
 *     ├── song1/
 *     │   ├── audio.mp3
 *     │   └── thumbnail.jpg
 *     ├── song2/
 *     │   ├── audio.mp3
 *     │   └── thumbnail.jpg
 *     └── ...
 * 
 * Usage:
 *   npm run build
 *   node scripts/seed-copyright-free-with-upload.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
// Simple MIME type detection (no external dependency needed)
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

// Import compiled models and services
const { Media } = require("../dist/models/media.model");
const { User } = require("../dist/models/user.model");
const FileUploadService = require("../dist/service/fileUpload.service").default;

// Folder containing songs (relative to project root)
const SONGS_FOLDER = path.join(__dirname, "../seeds/copyright-free-songs");

/**
 * Default song metadata
 * Update these or create a metadata.json file in each song folder
 */
const defaultSongMetadata = {
  category: "worship",
  speaker: "Jevah Music",
  year: 2024,
  topics: ["worship", "praise"],
  tags: ["worship", "praise"],
};

/**
 * Read song metadata from folder or use defaults
 */
function getSongMetadata(songFolder, songName) {
  const metadataPath = path.join(songFolder, "metadata.json");
  
  if (fs.existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      return {
        ...defaultSongMetadata,
        ...metadata,
        title: metadata.title || songName,
      };
    } catch (error) {
      console.warn(`⚠️  Error reading metadata.json in ${songName}:`, error.message);
    }
  }
  
  // Use folder name as title if no metadata
  return {
    ...defaultSongMetadata,
    title: songName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  };
}

/**
 * Find audio and thumbnail files in a folder
 */
function findSongFiles(songFolder) {
  const files = fs.readdirSync(songFolder);
  
  const audioExtensions = [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"];
  const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  
  const audioFile = files.find((file) =>
    audioExtensions.some((ext) => file.toLowerCase().endsWith(ext))
  );
  const thumbnailFile = files.find((file) =>
    imageExtensions.some((ext) => file.toLowerCase().endsWith(ext))
  );
  
  return {
    audio: audioFile ? path.join(songFolder, audioFile) : null,
    thumbnail: thumbnailFile ? path.join(songFolder, thumbnailFile) : null,
  };
}

/**
 * Get audio duration (simplified - would need ffprobe in production)
 */
function getAudioDuration(audioPath) {
  // For now, return null - duration can be set in metadata.json
  // Or use a library like node-ffprobe or music-metadata
  return null;
}

/**
 * Main seeding function
 */
async function seedCopyrightFreeSongsWithUpload() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB\n");

    // Check if songs folder exists
    if (!fs.existsSync(SONGS_FOLDER)) {
      console.log("📁 Creating songs folder...");
      fs.mkdirSync(SONGS_FOLDER, { recursive: true });
      console.log(`✅ Created folder: ${SONGS_FOLDER}\n`);
      console.log("💡 Please add your songs in this structure:");
      console.log("   seeds/copyright-free-songs/");
      console.log("     ├── song1/");
      console.log("     │   ├── audio.mp3");
      console.log("     │   ├── thumbnail.jpg");
      console.log("     │   └── metadata.json (optional)");
      console.log("     └── song2/");
      console.log("         ├── audio.mp3");
      console.log("         └── thumbnail.jpg\n");
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

    // Get all song folders
    const songFolders = fs
      .readdirSync(SONGS_FOLDER)
      .filter((item) => {
        const itemPath = path.join(SONGS_FOLDER, item);
        return fs.statSync(itemPath).isDirectory();
      });

    if (songFolders.length === 0) {
      console.log("⚠️  No song folders found!");
      console.log(`   Please add songs to: ${SONGS_FOLDER}\n`);
      return;
    }

    console.log(`🎵 Found ${songFolders.length} song folder(s)\n`);
    console.log("📤 Starting upload and seeding process...\n");

    const uploadService = new FileUploadService();
    const results = [];

    // Process each song folder
    for (const songFolderName of songFolders) {
      const songFolder = path.join(SONGS_FOLDER, songFolderName);
      const { audio, thumbnail } = findSongFiles(songFolder);

      if (!audio) {
        console.log(`⚠️  Skipping ${songFolderName}: No audio file found`);
        continue;
      }

      if (!thumbnail) {
        console.log(`⚠️  Skipping ${songFolderName}: No thumbnail found (will use placeholder)`);
      }

      try {
        console.log(`📤 Processing: ${songFolderName}`);

        // Get metadata
        const metadata = getSongMetadata(songFolder, songFolderName);

        // Read audio file
        const audioBuffer = fs.readFileSync(audio);
        const audioMimeType = getMimeType(audio);

        // Upload audio to R2
        console.log(`   📤 Uploading audio...`);
        const audioUpload = await uploadService.uploadMedia(
          audioBuffer,
          "media-music",
          audioMimeType
        );
        console.log(`   ✅ Audio uploaded: ${audioUpload.secure_url}`);

        // Upload thumbnail to R2 (if exists)
        let thumbnailUrl = null;
        if (thumbnail) {
          const thumbnailBuffer = fs.readFileSync(thumbnail);
          const thumbnailMimeType = getMimeType(thumbnail);
          
          console.log(`   📤 Uploading thumbnail...`);
          const thumbnailUpload = await uploadService.uploadMedia(
            thumbnailBuffer,
            "media-thumbnails",
            thumbnailMimeType
          );
          thumbnailUrl = thumbnailUpload.secure_url;
          console.log(`   ✅ Thumbnail uploaded: ${thumbnailUrl}`);
        }

        // Get duration (try from metadata or calculate)
        const duration = metadata.duration || getAudioDuration(audio) || 180;

        // Check if song already exists
        const existingSong = await Media.findOne({
          isPublicDomain: true,
          title: metadata.title,
        });

        if (existingSong) {
          console.log(`   ⚠️  Song already exists, skipping...`);
          results.push({ title: metadata.title, status: "skipped" });
          continue;
        }

        // Create song in database
        const song = await Media.create({
          title: metadata.title,
          description: metadata.description || `${metadata.title} - Copyright-free song`,
          contentType: "music",
          category: metadata.category || "worship",
          fileUrl: audioUpload.secure_url,
          fileMimeType: audioMimeType,
          fileObjectKey: audioUpload.objectKey,
          thumbnailUrl: thumbnailUrl || metadata.thumbnailUrl,
          thumbnailObjectKey: thumbnail ? "media-thumbnails/" + path.basename(thumbnail) : null,
          speaker: metadata.speaker || "Jevah Music",
          year: metadata.year || new Date().getFullYear(),
          duration: duration,
          topics: metadata.topics || [],
          tags: metadata.tags || [],
          uploadedBy: adminUser._id,
          isPublicDomain: true,
          moderationStatus: "approved",
          viewCount: 0,
          listenCount: 0,
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
        });

        console.log(`   ✅ Song created: ${song.title}`);
        results.push({ title: song.title, status: "success" });
      } catch (error) {
        console.error(`   ❌ Error processing ${songFolderName}:`, error.message);
        results.push({ title: songFolderName, status: "error", error: error.message });
      }
    }

    // Summary
    console.log("\n📊 Summary:");
    const successCount = results.filter((r) => r.status === "success").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    console.log(`   ✅ Successfully seeded: ${successCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (successCount > 0) {
      console.log("\n🎉 Copyright-free songs seeding completed!\n");
    }
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
  seedCopyrightFreeSongsWithUpload()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

module.exports = { seedCopyrightFreeSongsWithUpload };

