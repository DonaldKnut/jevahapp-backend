/**
 * Migration Script: Add Categories to Existing Copyright-Free Songs
 * 
 * This script adds a default category to all existing copyright-free songs
 * that don't have a category assigned. It does NOT drop or delete any songs.
 * 
 * Usage:
 *   node scripts/add-categories-to-copyright-free-songs.js
 * 
 * Categories are assigned based on song title/artist name matching:
 * - Songs with "worship" → "Worship"
 * - Songs with "gospel" → "Gospel Music"
 * - Songs with "praise" → "Praise"
 * - Songs with "hymn" → "Hymns"
 * - Default → "Gospel Music"
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Import the model (using compiled JS version)
const CopyrightFreeSongSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    singer: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fileUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    category: { type: String, trim: true, index: true },
    likeCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    duration: { type: Number },
  },
  { timestamps: true }
);

const CopyrightFreeSong =
  mongoose.models.CopyrightFreeSong ||
  mongoose.model("CopyrightFreeSong", CopyrightFreeSongSchema);

/**
 * Determine category based on song title and artist name
 */
function determineCategory(title, singer) {
  const combined = `${title} ${singer}`.toLowerCase();

  if (combined.includes("worship")) {
    return "Worship";
  }
  if (combined.includes("praise")) {
    return "Praise";
  }
  if (combined.includes("hymn") || combined.includes("holy holy")) {
    return "Hymns";
  }
  if (combined.includes("traditional") || combined.includes("classic")) {
    return "Traditional Gospel";
  }
  if (combined.includes("contemporary") || combined.includes("modern")) {
    return "Contemporary Gospel";
  }
  if (combined.includes("choir") || combined.includes("chorus")) {
    return "Gospel Choir";
  }
  if (combined.includes("rock")) {
    return "Christian Rock";
  }
  if (combined.includes("inspiration") || combined.includes("inspire")) {
    return "Inspirational";
  }
  if (combined.includes("spiritual")) {
    return "Spiritual";
  }

  // Default category
  return "Gospel Music";
}

async function addCategoriesToSongs() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI environment variable is not set");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Find all songs without a category (or with null/empty category)
    const songsWithoutCategory = await CopyrightFreeSong.find({
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: "" },
      ],
    });

    console.log(`\n📊 Found ${songsWithoutCategory.length} songs without categories`);

    if (songsWithoutCategory.length === 0) {
      console.log("✅ All songs already have categories assigned!");
      await mongoose.disconnect();
      return;
    }

    // Update songs with categories
    let updatedCount = 0;
    const categoryCounts = {};

    for (const song of songsWithoutCategory) {
      const category = determineCategory(song.title, song.singer);
      
      await CopyrightFreeSong.findByIdAndUpdate(song._id, {
        $set: { category },
      });

      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      updatedCount++;
    }

    console.log(`\n✅ Successfully updated ${updatedCount} songs with categories:\n`);
    
    // Display category distribution
    Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} songs`);
      });

    // Verify: Get all unique categories
    const uniqueCategories = await CopyrightFreeSong.distinct("category", {
      category: { $exists: true, $ne: null, $ne: "" },
    });
    
    console.log(`\n📋 Total unique categories in database: ${uniqueCategories.length}`);
    console.log(`   Categories: ${uniqueCategories.sort().join(", ")}`);

    await mongoose.disconnect();
    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Error during migration:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the migration
addCategoriesToSongs();

