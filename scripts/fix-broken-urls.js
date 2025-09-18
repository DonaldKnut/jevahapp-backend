#!/usr/bin/env node

/**
 * Fix Broken URLs Script
 *
 * This script fixes URLs that were generated with the incorrect R2_CUSTOM_DOMAIN
 * and converts them to the proper Cloudflare R2 format.
 *
 * Usage:
 *   node scripts/fix-broken-urls.js [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without actually updating the database
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevahapp"
    );
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

// Media model (simplified)
const mediaSchema = new mongoose.Schema(
  {
    title: String,
    fileUrl: String,
    thumbnailUrl: String,
    thumbnail: String,
    contentType: String,
    createdAt: Date,
    updatedAt: Date,
  },
  { collection: "media" }
);

const Media = mongoose.model("Media", mediaSchema);

/**
 * Check if a URL is broken (uses the invalid custom domain)
 */
function isBrokenUrl(url) {
  if (!url) return false;

  // Check if it uses the broken custom domain
  return url.includes("bDp9npjM_CVBCOUtyrsgKjLle3shpuJ64W_y7DYY");
}

/**
 * Convert broken URL to correct R2 format
 */
function fixUrl(brokenUrl) {
  if (!brokenUrl || !isBrokenUrl(brokenUrl)) {
    return brokenUrl;
  }

  try {
    const url = new URL(brokenUrl);
    const pathname = url.pathname;

    // Extract the object key from the path
    // Format: /media-videos/filename.mp4 or /media-thumbnails/filename.jpg
    const objectKey = pathname.startsWith("/") ? pathname.slice(1) : pathname;

    // Generate correct R2 URL
    const accountId =
      process.env.R2_ACCOUNT_ID || "870e0e55f75d0d9434531d7518f57e92";
    const bucketName = process.env.R2_BUCKET || "jevah";

    return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
  } catch (error) {
    console.error("Error fixing URL:", brokenUrl, error.message);
    return brokenUrl;
  }
}

/**
 * Main function to fix broken URLs
 */
async function fixBrokenUrls(dryRun = false) {
  try {
    console.log("🔍 Searching for media with broken URLs...");

    // Find all media items
    const allMedia = await Media.find({}).lean();
    console.log(`📊 Found ${allMedia.length} total media items`);

    // Filter media with broken URLs
    const brokenMedia = allMedia.filter(media => {
      return (
        isBrokenUrl(media.fileUrl) ||
        isBrokenUrl(media.thumbnailUrl) ||
        isBrokenUrl(media.thumbnail)
      );
    });

    console.log(`🚨 Found ${brokenMedia.length} media items with broken URLs`);

    if (brokenMedia.length === 0) {
      console.log("✅ No broken URLs found!");
      return;
    }

    console.log("\n📋 Media items with broken URLs:");
    console.log("=".repeat(80));

    const updates = [];

    brokenMedia.forEach((media, index) => {
      console.log(
        `\n${index + 1}. ${media.title || "Untitled"} (${media.contentType})`
      );
      console.log(`   ID: ${media._id}`);

      const updateData = { _id: media._id };
      let hasChanges = false;

      // Check and fix fileUrl
      if (isBrokenUrl(media.fileUrl)) {
        const fixedUrl = fixUrl(media.fileUrl);
        updateData.fileUrl = fixedUrl;
        console.log(`   File URL: ${media.fileUrl}`);
        console.log(`   Fixed to: ${fixedUrl}`);
        hasChanges = true;
      }

      // Check and fix thumbnailUrl
      if (isBrokenUrl(media.thumbnailUrl)) {
        const fixedUrl = fixUrl(media.thumbnailUrl);
        updateData.thumbnailUrl = fixedUrl;
        console.log(`   Thumbnail URL: ${media.thumbnailUrl}`);
        console.log(`   Fixed to: ${fixedUrl}`);
        hasChanges = true;
      }

      // Check and fix thumbnail field
      if (isBrokenUrl(media.thumbnail)) {
        const fixedUrl = fixUrl(media.thumbnail);
        updateData.thumbnail = fixedUrl;
        console.log(`   Thumbnail: ${media.thumbnail}`);
        console.log(`   Fixed to: ${fixedUrl}`);
        hasChanges = true;
      }

      if (hasChanges) {
        updates.push(updateData);
      }
    });

    if (updates.length === 0) {
      console.log("\n✅ No valid updates found");
      return;
    }

    if (dryRun) {
      console.log("\n🔍 DRY RUN MODE - No URLs were actually updated");
      console.log(`📊 Would update ${updates.length} media entries`);
      return;
    }

    console.log("\n🔄 Updating URLs to correct R2 format...");

    let updatedCount = 0;

    for (const update of updates) {
      const { _id, ...updateFields } = update;

      try {
        await Media.updateOne(
          { _id },
          {
            $set: updateFields,
            $setOnInsert: { updatedAt: new Date() },
          }
        );
        updatedCount++;
        console.log(`✅ Updated media ${_id}`);
      } catch (error) {
        console.error(`❌ Failed to update media ${_id}:`, error.message);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} media entries`);
    console.log("✅ All broken URLs have been fixed!");
  } catch (error) {
    console.error("❌ Error fixing broken URLs:", error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("🚀 Fix Broken URLs Script");
  console.log("=".repeat(50));

  if (dryRun) {
    console.log("🔍 Running in DRY RUN mode - no changes will be made");
  }

  try {
    await connectToDatabase();
    await fixBrokenUrls(dryRun);
  } catch (error) {
    console.error("❌ Script failed:", error.message);
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

module.exports = { fixBrokenUrls, isBrokenUrl, fixUrl };
