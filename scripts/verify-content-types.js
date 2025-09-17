#!/usr/bin/env node

/**
 * Verify Content Types Script
 *
 * This script verifies that all default content has consistent contentType values.
 *
 * Usage: node scripts/verify-content-types.js
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

async function verifyContentTypes() {
  console.log("🔍 FINAL CONTENT TYPE VERIFICATION");
  console.log("===================================");

  try {
    const defaultContent = await Media.find({ isDefaultContent: true });

    console.log(`Found ${defaultContent.length} default content items:`);
    console.log("");

    // Group by content type
    const groupedByType = defaultContent.reduce((acc, item) => {
      const type = item.contentType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(item.title);
      return acc;
    }, {});

    Object.keys(groupedByType).forEach(type => {
      console.log(
        `📚 ${type.toUpperCase()} (${groupedByType[type].length} items):`
      );
      groupedByType[type].forEach(title => {
        console.log(`   - ${title}`);
      });
      console.log("");
    });

    // Check for any remaining inconsistencies
    const inconsistentTypes = defaultContent.filter(item => {
      const hasPdf = item.fileUrl && item.fileUrl.includes(".pdf");
      const hasImage =
        item.fileUrl &&
        (item.fileUrl.includes(".jpg") ||
          item.fileUrl.includes(".png") ||
          item.fileUrl.includes(".jpeg"));
      const contentType = item.contentType;

      return (
        (hasPdf && contentType !== "books") ||
        (hasImage && contentType !== "images")
      );
    });

    if (inconsistentTypes.length === 0) {
      console.log("✅ All content types are now consistent!");
      console.log('✅ E-books now have contentType: "books"');
      console.log("✅ Filtering will work correctly in your app");
    } else {
      console.log(`⚠️  Still have ${inconsistentTypes.length} inconsistencies`);
      inconsistentTypes.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title} - ${item.contentType}`);
      });
    }
  } catch (error) {
    console.error("❌ Error verifying content types:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Database connection closed");
  }
}

// Run the script
if (require.main === module) {
  connectDB().then(() => {
    verifyContentTypes();
  });
}

module.exports = { verifyContentTypes };
