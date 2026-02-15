#!/usr/bin/env node

/**
 * Cloudinary Files Cleanup Script
 *
 * This script removes all media entries from the database that use Cloudinary URLs
 * since you've hit your free quota limit and files are no longer displaying.
 *
 * Usage: node scripts/cleanup-cloudinary-files.js [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

// Define Media schema (simplified for this script)
const mediaSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    contentType: String,
    fileUrl: String,
    thumbnailUrl: String,
    createdAt: Date,
    updatedAt: Date,
  },
  { collection: "media" }
);

const Media = mongoose.model("Media", mediaSchema);

// Check if URL is from Cloudinary
function isCloudinaryUrl(url) {
  if (!url) return false;
  return url.includes("cloudinary.com") || url.includes("res.cloudinary.com");
}

// Main cleanup function
async function cleanupCloudinaryFiles(dryRun = false) {
  try {
    console.log("🔍 Searching for Cloudinary files in database...");

    // Find all media with Cloudinary URLs
    const cloudinaryMedia = await Media.find({
      $or: [
        { fileUrl: { $regex: /cloudinary\.com/, $options: "i" } },
        { thumbnailUrl: { $regex: /cloudinary\.com/, $options: "i" } },
        { thumbnail: { $regex: /cloudinary\.com/, $options: "i" } },
      ],
    });

    console.log(
      `📊 Found ${cloudinaryMedia.length} media entries with Cloudinary URLs`
    );

    if (cloudinaryMedia.length === 0) {
      console.log("✅ No Cloudinary files found in database");
      return;
    }

    // Show details of what will be deleted
    console.log("\n📋 Files to be deleted:");
    console.log("=".repeat(80));

    cloudinaryMedia.forEach((media, index) => {
      console.log(
        `${index + 1}. ${media.title || "Untitled"} (${media.contentType})`
      );
      console.log(`   ID: ${media._id}`);
      console.log(`   File URL: ${media.fileUrl || "N/A"}`);
      console.log(
        `   Thumbnail URL: ${media.thumbnailUrl || media.thumbnail || "N/A"}`
      );
      console.log(`   Created: ${media.createdAt}`);
      console.log("");
    });

    if (dryRun) {
      console.log("🔍 DRY RUN MODE - No files were actually deleted");
      console.log(`📊 Would delete ${cloudinaryMedia.length} media entries`);
      return;
    }

    // Confirm deletion
    console.log(
      "⚠️  WARNING: This will permanently delete these media entries from your database!"
    );
    console.log("⚠️  Make sure you have a backup before proceeding.");

    // In a real script, you might want to add a confirmation prompt here
    // For now, we'll proceed with deletion

    console.log("\n🗑️  Deleting Cloudinary media entries...");

    const deleteResult = await Media.deleteMany({
      $or: [
        { fileUrl: { $regex: /cloudinary\.com/, $options: "i" } },
        { thumbnailUrl: { $regex: /cloudinary\.com/, $options: "i" } },
        { thumbnail: { $regex: /cloudinary\.com/, $options: "i" } },
      ],
    });

    console.log(
      `✅ Successfully deleted ${deleteResult.deletedCount} media entries`
    );

    // Also check for any remaining Cloudinary references
    const remainingCount = await Media.countDocuments({
      $or: [
        { fileUrl: { $regex: /cloudinary\.com/, $options: "i" } },
        { thumbnailUrl: { $regex: /cloudinary\.com/, $options: "i" } },
        { thumbnail: { $regex: /cloudinary\.com/, $options: "i" } },
      ],
    });

    if (remainingCount === 0) {
      console.log(
        "🎉 All Cloudinary files have been successfully removed from the database!"
      );
    } else {
      console.log(
        `⚠️  ${remainingCount} Cloudinary files still remain in the database`
      );
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

// Main execution
async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("🧹 Cloudinary Files Cleanup Script");
  console.log("==================================");

  if (isDryRun) {
    console.log("🔍 Running in DRY RUN mode - no files will be deleted");
  }

  try {
    await connectDB();
    await cleanupCloudinaryFiles(isDryRun);
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { cleanupCloudinaryFiles, isCloudinaryUrl };
