/**
 * Seed Copyright-Free Songs
 * 
 * This script seeds the database with default copyright-free songs
 * for the Audio Library System (YouTube Audio Library Style).
 * 
 * Usage:
 *   node scripts/seed-copyright-free-songs.js
 *   node scripts/seed-copyright-free-songs.js --clear  (to clear existing songs)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

// Import compiled models
const { Media } = require("../dist/models/media.model");
const { User } = require("../dist/models/user.model");

// Set to true to delete all existing copyright-free songs and reseed from scratch
const CLEAR_EXISTING_SONGS =
  process.argv.includes("--clear") || process.argv.includes("-c");

/**
 * Default copyright-free songs to seed
 * 
 * Note: You need to upload the actual audio files to Cloudflare R2 or your CDN
 * and update the fileUrl and thumbnailUrl with the actual URLs.
 * 
 * For now, these are placeholder URLs - update them with your actual file locations.
 */
const defaultCopyrightFreeSongs = [
  {
    title: "Peaceful Worship",
    description: "A calming worship song perfect for meditation and prayer",
    contentType: "music",
    category: "worship",
    fileUrl: "https://your-cdn-url.com/audio/peaceful-worship.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/peaceful-worship.jpg",
    speaker: "Jevah Music",
    year: 2024,
    duration: 180, // 3 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["worship", "peace", "meditation"],
    tags: ["worship", "peaceful", "meditation", "prayer"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Joyful Praise",
    description: "An uplifting praise song to celebrate and worship",
    contentType: "music",
    category: "worship",
    fileUrl: "https://your-cdn-url.com/audio/joyful-praise.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/joyful-praise.jpg",
    speaker: "Jevah Music",
    year: 2024,
    duration: 210, // 3.5 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["worship", "praise", "joy"],
    tags: ["worship", "praise", "joyful", "celebration"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Heavenly Hymn",
    description: "A classic hymn arrangement with modern instrumentation",
    contentType: "music",
    category: "worship",
    fileUrl: "https://your-cdn-url.com/audio/heavenly-hymn.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/heavenly-hymn.jpg",
    speaker: "Jevah Choir",
    year: 2024,
    duration: 240, // 4 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["worship", "hymn", "traditional"],
    tags: ["hymn", "traditional", "choir", "worship"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Grateful Heart",
    description: "A song of gratitude and thanksgiving",
    contentType: "music",
    category: "inspiration",
    fileUrl: "https://your-cdn-url.com/audio/grateful-heart.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/grateful-heart.jpg",
    speaker: "Jevah Music",
    year: 2024,
    duration: 195, // 3.25 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["gratitude", "thanksgiving", "inspiration"],
    tags: ["gratitude", "thanksgiving", "inspiration", "praise"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Blessed Assurance",
    description: "A confident declaration of faith and hope",
    contentType: "music",
    category: "inspiration",
    fileUrl: "https://your-cdn-url.com/audio/blessed-assurance.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/blessed-assurance.jpg",
    speaker: "Jevah Music",
    year: 2024,
    duration: 225, // 3.75 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["faith", "hope", "assurance"],
    tags: ["faith", "hope", "assurance", "confidence"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Youth Anthem",
    description: "An energetic song for youth worship and gatherings",
    contentType: "music",
    category: "youth",
    fileUrl: "https://your-cdn-url.com/audio/youth-anthem.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/youth-anthem.jpg",
    speaker: "Jevah Youth",
    year: 2024,
    duration: 200, // 3.33 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["youth", "worship", "energy"],
    tags: ["youth", "energetic", "worship", "praise"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Morning Devotion",
    description: "Perfect for morning prayers and devotionals",
    contentType: "music",
    category: "worship",
    fileUrl: "https://your-cdn-url.com/audio/morning-devotion.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/morning-devotion.jpg",
    speaker: "Jevah Music",
    year: 2024,
    duration: 270, // 4.5 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["devotion", "morning", "prayer"],
    tags: ["devotion", "morning", "prayer", "worship"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Grace Abounds",
    description: "A beautiful song about God's abundant grace",
    contentType: "music",
    category: "worship",
    fileUrl: "https://your-cdn-url.com/audio/grace-abounds.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/grace-abounds.jpg",
    speaker: "Jevah Music",
    year: 2024,
    duration: 210, // 3.5 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["grace", "worship", "love"],
    tags: ["grace", "worship", "love", "mercy"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Victory March",
    description: "A triumphant song celebrating victory in Christ",
    contentType: "music",
    category: "inspiration",
    fileUrl: "https://your-cdn-url.com/audio/victory-march.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/victory-march.jpg",
    speaker: "Jevah Music",
    year: 2024,
    duration: 240, // 4 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["victory", "triumph", "celebration"],
    tags: ["victory", "triumph", "celebration", "praise"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
  {
    title: "Quiet Reflection",
    description: "Instrumental piece for quiet reflection and meditation",
    contentType: "music",
    category: "worship",
    fileUrl: "https://your-cdn-url.com/audio/quiet-reflection.mp3",
    thumbnailUrl: "https://your-cdn-url.com/thumbnails/quiet-reflection.jpg",
    speaker: "Jevah Instrumental",
    year: 2024,
    duration: 300, // 5 minutes
    isPublicDomain: true,
    moderationStatus: "approved",
    topics: ["meditation", "reflection", "instrumental"],
    tags: ["instrumental", "meditation", "reflection", "peace"],
    viewCount: 0,
    listenCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
  },
];

async function seedCopyrightFreeSongs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB\n");

    // Find or create admin user for songs uploaded by admin
    console.log("📋 Setting up admin user...");
    let adminUser = await User.findOne({
      $or: [{ email: "admin@jevah.com" }, { role: "admin" }],
    });

    if (!adminUser) {
      // Create admin user if doesn't exist
      adminUser = await User.create({
        firstName: "Admin",
        lastName: "User",
        email: "admin@jevah.com",
        username: "jevah_admin",
        role: "admin",
        password: "TempPassword123!", // Should be changed after first login
        isEmailVerified: true,
        isProfileComplete: true,
      });
      console.log("✅ Created admin user:", adminUser.email);
    } else {
      console.log(`✅ Using existing admin user: ${adminUser.email}\n`);
    }

    // Clear existing copyright-free songs if requested
    if (CLEAR_EXISTING_SONGS) {
      console.log("🗑️  Clearing existing copyright-free songs...");
      const deleteResult = await Media.deleteMany({
        isPublicDomain: true,
        contentType: { $in: ["music", "audio"] },
      });
      console.log(
        `✅ Removed ${deleteResult.deletedCount} existing copyright-free songs\n`
      );
    }

    // Check if songs already exist
    const existingSongs = await Media.find({
      isPublicDomain: true,
      contentType: { $in: ["music", "audio"] },
      title: { $in: defaultCopyrightFreeSongs.map((s) => s.title) },
    });

    if (existingSongs.length > 0 && !CLEAR_EXISTING_SONGS) {
      console.log(
        `⚠️  Found ${existingSongs.length} existing copyright-free songs.`
      );
      console.log(
        "   Use --clear flag to remove existing songs and reseed:\n   node scripts/seed-copyright-free-songs.js --clear\n"
      );
      console.log("Existing songs:");
      existingSongs.forEach((song) => {
        console.log(`   - ${song.title}`);
      });
      return;
    }

    // Insert new songs with admin as uploader
    console.log("🎵 Seeding copyright-free songs...\n");
    const songsToInsert = defaultCopyrightFreeSongs.map((song) => ({
      ...song,
      uploadedBy: adminUser._id,
      fileMimeType: "audio/mpeg",
      isHidden: false,
    }));

    const inserted = await Media.insertMany(songsToInsert);
    console.log(`✅ Successfully seeded ${inserted.length} copyright-free songs:\n`);

    inserted.forEach((song, index) => {
      console.log(
        `   ${index + 1}. ${song.title} - ${song.speaker} (${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, "0")})`
      );
      console.log(`      Category: ${song.category} | Tags: ${song.tags.join(", ")}`);
    });

    console.log("\n📊 Summary:");
    console.log(`   Total songs seeded: ${inserted.length}`);
    console.log(`   Uploaded by: ${adminUser.email} (Admin)`);
    console.log(`   All songs marked as: isPublicDomain = true, moderationStatus = approved`);

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

    console.log("\n📈 Songs by category:");
    stats.forEach((stat) => {
      console.log(`   ${stat._id}: ${stat.count} songs`);
    });

    console.log("\n🎉 Copyright-free songs seeding completed successfully!\n");
    console.log("💡 Next steps:");
    console.log("   1. Upload actual audio files to Cloudflare R2 or your CDN");
    console.log("   2. Update fileUrl and thumbnailUrl in the database");
    console.log("   3. Or use the admin upload endpoint to add songs with files:");
    console.log("      POST /api/audio/copyright-free (Admin only)");
  } catch (error) {
    console.error("❌ Error seeding copyright-free songs:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("✅ Database connection closed\n");
  }
}

// Run the seeding function
if (require.main === module) {
  seedCopyrightFreeSongs()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

module.exports = { seedCopyrightFreeSongs, defaultCopyrightFreeSongs };

