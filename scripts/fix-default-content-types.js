#!/usr/bin/env node

/**
 * Fix Default Content Types Script
 *
 * This script fixes inconsistent contentType values in default content.
 * Changes 'ebook' to 'books' to match the database schema.
 *
 * Usage: node scripts/fix-default-content-types.js [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be updated without actually updating
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
  },
  { collection: "media" }
);

const Media = mongoose.model("Media", mediaSchema);

async function fixDefaultContentTypes() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("🔧 FIXING DEFAULT CONTENT TYPES");
  console.log("================================");
  console.log(
    `Mode: ${isDryRun ? "DRY RUN (no changes will be made)" : "LIVE UPDATE"}`
  );
  console.log("");

  try {
    // Find all default content with 'ebook' contentType
    const ebooksToFix = await Media.find({
      isDefaultContent: true,
      contentType: "ebook",
    });

    console.log(`Found ${ebooksToFix.length} e-books to fix:`);
    ebooksToFix.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title} (ID: ${item._id})`);
      console.log(`   Current Type: ${item.contentType}`);
      console.log(
        `   File Extension: ${item.fileUrl ? item.fileUrl.split(".").pop() : "N/A"}`
      );
      console.log(`   Should Be: books`);
      console.log("");
    });

    if (ebooksToFix.length > 0) {
      if (isDryRun) {
        console.log("🔍 DRY RUN: Would update the following:");
        console.log(
          `   - Change contentType from "ebook" to "books" for ${ebooksToFix.length} items`
        );
        console.log("   - This will fix filtering inconsistencies in your app");
      } else {
        console.log('🔄 Updating contentType from "ebook" to "books"...');

        const result = await Media.updateMany(
          { isDefaultContent: true, contentType: "ebook" },
          { $set: { contentType: "books" } }
        );

        console.log(`✅ Updated ${result.modifiedCount} e-books successfully!`);

        // Verify the fix
        console.log("\n🔍 VERIFICATION:");
        const updatedEbooks = await Media.find({
          isDefaultContent: true,
          contentType: "books",
        });

        console.log(
          `Now have ${updatedEbooks.length} items with contentType: "books"`
        );
        updatedEbooks.forEach((item, index) => {
          console.log(`${index + 1}. ${item.title} - ${item.contentType}`);
        });
      }
    } else {
      console.log("✅ No e-books found to fix!");
    }

    // Also check for any other inconsistent content types
    console.log("\n🔍 CHECKING FOR OTHER INCONSISTENCIES:");
    const allDefaultContent = await Media.find({ isDefaultContent: true });

    const inconsistencies = allDefaultContent.filter(item => {
      const hasPdf = item.fileUrl && item.fileUrl.includes(".pdf");
      const hasImage =
        item.fileUrl &&
        (item.fileUrl.includes(".jpg") ||
          item.fileUrl.includes(".png") ||
          item.fileUrl.includes(".jpeg"));
      const hasVideo =
        item.fileUrl &&
        (item.fileUrl.includes(".mp4") ||
          item.fileUrl.includes(".mov") ||
          item.fileUrl.includes(".avi"));
      const hasAudio =
        item.fileUrl &&
        (item.fileUrl.includes(".mp3") ||
          item.fileUrl.includes(".wav") ||
          item.fileUrl.includes(".m4a"));

      const contentType = item.contentType;

      return (
        (hasPdf && contentType !== "books") ||
        (hasImage && contentType !== "images") ||
        (hasVideo && contentType !== "videos") ||
        (hasAudio && contentType !== "audio" && contentType !== "music")
      );
    });

    if (inconsistencies.length > 0) {
      console.log(`⚠️  Found ${inconsistencies.length} other inconsistencies:`);
      inconsistencies.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   Current Type: ${item.contentType}`);
        console.log(
          `   File Extension: ${item.fileUrl ? item.fileUrl.split(".").pop() : "N/A"}`
        );
        console.log(
          `   Should Be: ${
            item.fileUrl && item.fileUrl.includes(".pdf")
              ? "books"
              : item.fileUrl &&
                  (item.fileUrl.includes(".jpg") ||
                    item.fileUrl.includes(".png"))
                ? "images"
                : item.fileUrl &&
                    (item.fileUrl.includes(".mp4") ||
                      item.fileUrl.includes(".mov"))
                  ? "videos"
                  : item.fileUrl &&
                      (item.fileUrl.includes(".mp3") ||
                        item.fileUrl.includes(".wav"))
                    ? "audio"
                    : "unknown"
          }`
        );
        console.log("");
      });
    } else {
      console.log("✅ No other content type inconsistencies found!");
    }
  } catch (error) {
    console.error("❌ Error fixing content types:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Database connection closed");
  }
}

// Run the script
if (require.main === module) {
  connectDB().then(() => {
    fixDefaultContentTypes();
  });
}

module.exports = { fixDefaultContentTypes };
