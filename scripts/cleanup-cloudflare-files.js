#!/usr/bin/env node

/**
 * Cloudflare Files Cleanup Script (Preserving Default Content)
 *
 * This script removes all media entries from the database that use Cloudflare URLs
 * EXCEPT for default onboarding content (isDefaultContent: true).
 *
 * Usage: node scripts/cleanup-cloudflare-files.js [--dry-run] [--include-default]
 *
 * Options:
 *   --dry-run         Show what would be deleted without actually deleting
 *   --include-default Also delete default onboarding content (NOT recommended)
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
    thumbnail: String,
    isDefaultContent: Boolean,
    isOnboardingContent: Boolean,
    createdAt: Date,
    updatedAt: Date,
  },
  { collection: "media" }
);

const Media = mongoose.model("Media", mediaSchema);

// Check if URL is from Cloudflare R2
function isCloudflareUrl(url) {
  if (!url) return false;
  return (
    url.includes("cloudflarestorage.com") ||
    url.includes("r2.cloudflarestorage.com") ||
    url.includes("X-Amz-Algorithm") ||
    url.includes("X-Amz-Signature") ||
    url.includes("X-Amz-Credential")
  );
}

// Main cleanup function
async function cleanupCloudflareFiles(dryRun = false, includeDefault = false) {
  try {
    console.log("🔍 Searching for Cloudflare files in database...");

    // Build query based on options
    let query = {
      $or: [
        { fileUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { thumbnailUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { thumbnail: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { fileUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        { thumbnailUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        { thumbnail: { $regex: /X-Amz-Algorithm/, $options: "i" } },
      ],
    };

    // Exclude default content unless explicitly requested
    if (!includeDefault) {
      query.isDefaultContent = { $ne: true };
      console.log("🛡️  Preserving default onboarding content");
    } else {
      console.log("⚠️  WARNING: Will also delete default onboarding content!");
    }

    // Find all media with Cloudflare URLs
    const cloudflareMedia = await Media.find(query);

    console.log(
      `📊 Found ${cloudflareMedia.length} media entries with Cloudflare URLs`
    );

    if (cloudflareMedia.length === 0) {
      console.log("✅ No Cloudflare files found in database");
      return;
    }

    // Separate default content from user content
    const defaultContent = cloudflareMedia.filter(
      media => media.isDefaultContent
    );
    const userContent = cloudflareMedia.filter(
      media => !media.isDefaultContent
    );

    // Show details of what will be deleted
    console.log("\n📋 Files to be deleted:");
    console.log("=".repeat(80));

    if (userContent.length > 0) {
      console.log(`\n👤 USER CONTENT (${userContent.length} items):`);
      userContent.forEach((media, index) => {
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
    }

    if (defaultContent.length > 0) {
      console.log(`\n🏠 DEFAULT CONTENT (${defaultContent.length} items):`);
      defaultContent.forEach((media, index) => {
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
    }

    if (dryRun) {
      console.log("🔍 DRY RUN MODE - No files were actually deleted");
      console.log(`📊 Would delete ${cloudflareMedia.length} media entries`);
      if (defaultContent.length > 0 && !includeDefault) {
        console.log(
          `🛡️  ${defaultContent.length} default content items would be preserved`
        );
      }
      return;
    }

    // Confirm deletion
    console.log(
      "⚠️  WARNING: This will permanently delete these media entries from your database!"
    );
    console.log("⚠️  Make sure you have a backup before proceeding.");

    if (defaultContent.length > 0 && !includeDefault) {
      console.log(
        `🛡️  ${defaultContent.length} default content items will be preserved`
      );
    }

    console.log("\n🗑️  Deleting Cloudflare media entries...");

    const deleteResult = await Media.deleteMany(query);

    console.log(
      `✅ Successfully deleted ${deleteResult.deletedCount} media entries`
    );

    // Also check for any remaining Cloudflare references
    const remainingCount = await Media.countDocuments({
      $or: [
        { fileUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { thumbnailUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { thumbnail: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { fileUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        { thumbnailUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        { thumbnail: { $regex: /X-Amz-Algorithm/, $options: "i" } },
      ],
    });

    if (remainingCount === 0) {
      console.log(
        "🎉 All Cloudflare files have been successfully removed from the database!"
      );
    } else {
      console.log(
        `⚠️  ${remainingCount} Cloudflare files still remain in the database`
      );

      // Check if remaining are default content
      const remainingDefault = await Media.countDocuments({
        $or: [
          { fileUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
          { thumbnailUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
          { thumbnail: { $regex: /cloudflarestorage\.com/, $options: "i" } },
          { fileUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
          { thumbnailUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
          { thumbnail: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        ],
        isDefaultContent: true,
      });

      if (remainingDefault > 0) {
        console.log(
          `🛡️  ${remainingDefault} of these are default onboarding content (preserved)`
        );
      }
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

// Show statistics
async function showStatistics() {
  try {
    console.log("\n📊 DATABASE STATISTICS:");
    console.log("=".repeat(50));

    const totalMedia = await Media.countDocuments();
    const cloudflareMedia = await Media.countDocuments({
      $or: [
        { fileUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { thumbnailUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { thumbnail: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { fileUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        { thumbnailUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        { thumbnail: { $regex: /X-Amz-Algorithm/, $options: "i" } },
      ],
    });

    const defaultContent = await Media.countDocuments({
      isDefaultContent: true,
    });

    const cloudflareDefault = await Media.countDocuments({
      $or: [
        { fileUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { thumbnailUrl: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { thumbnail: { $regex: /cloudflarestorage\.com/, $options: "i" } },
        { fileUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        { thumbnailUrl: { $regex: /X-Amz-Algorithm/, $options: "i" } },
        { thumbnail: { $regex: /X-Amz-Algorithm/, $options: "i" } },
      ],
      isDefaultContent: true,
    });

    const userCloudflare = cloudflareMedia - cloudflareDefault;

    console.log(`📁 Total media entries: ${totalMedia}`);
    console.log(`☁️  Total Cloudflare entries: ${cloudflareMedia}`);
    console.log(`   ├─ User content: ${userCloudflare}`);
    console.log(`   └─ Default content: ${cloudflareDefault}`);
    console.log(`🏠 Total default content: ${defaultContent}`);
    console.log(`🗑️  Would delete: ${userCloudflare} user entries`);
  } catch (error) {
    console.error("❌ Error getting statistics:", error);
  }
}

// Main execution
async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const includeDefault = process.argv.includes("--include-default");

  console.log(
    "🧹 Cloudflare Files Cleanup Script (Preserving Default Content)"
  );
  console.log("==============================================================");

  if (isDryRun) {
    console.log("🔍 Running in DRY RUN mode - no files will be deleted");
  }

  if (includeDefault) {
    console.log("⚠️  WARNING: Will also delete default onboarding content!");
  } else {
    console.log("🛡️  Default onboarding content will be preserved");
  }

  try {
    await connectDB();
    await showStatistics();
    await cleanupCloudflareFiles(isDryRun, includeDefault);
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

module.exports = { cleanupCloudflareFiles, isCloudflareUrl };
