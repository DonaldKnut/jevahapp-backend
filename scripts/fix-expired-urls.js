#!/usr/bin/env node

/**
 * Fix Expired URLs Script
 *
 * This script updates existing media entries in the database to use permanent public URLs
 * instead of expired signed URLs from Cloudflare R2.
 *
 * Usage: node scripts/fix-expired-urls.js [--dry-run]
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
    createdAt: Date,
    updatedAt: Date,
  },
  { collection: "media" }
);

const Media = mongoose.model("Media", mediaSchema);

// Check if URL is a signed URL (contains AWS signature parameters)
function isSignedUrl(url) {
  if (!url) return false;
  return (
    url.includes("X-Amz-Algorithm") ||
    url.includes("X-Amz-Signature") ||
    url.includes("X-Amz-Credential")
  );
}

// Extract object key from signed URL
function extractObjectKeyFromSignedUrl(url) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");

    // Remove empty parts and find the object key
    const nonEmptyParts = pathParts.filter(part => part.length > 0);

    // For R2 URLs, the format is usually: /bucket-name/object-key
    if (nonEmptyParts.length >= 2) {
      // Skip the bucket name and get the rest as object key
      return nonEmptyParts.slice(1).join("/");
    }

    return null;
  } catch (error) {
    console.error("Error parsing URL:", url, error);
    return null;
  }
}

// Generate permanent public URL from object key
function generatePublicUrl(objectKey) {
  const customDomain = process.env.R2_CUSTOM_DOMAIN;

  if (customDomain) {
    return `https://${customDomain}/${objectKey}`;
  }

  // Fallback to Cloudflare R2 public URL format
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET;

  if (!accountId || !bucketName) {
    throw new Error(
      "R2_CUSTOM_DOMAIN or R2_ACCOUNT_ID and R2_BUCKET must be configured"
    );
  }

  return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
}

// Main fix function
async function fixExpiredUrls(dryRun = false) {
  try {
    console.log("🔍 Searching for media with signed URLs...");

    // Find all media with signed URLs
    const signedUrlMedia = await Media.find({
      $or: [
        {
          fileUrl: {
            $regex: /X-Amz-Algorithm|X-Amz-Signature|X-Amz-Credential/,
            $options: "i",
          },
        },
        {
          thumbnailUrl: {
            $regex: /X-Amz-Algorithm|X-Amz-Signature|X-Amz-Credential/,
            $options: "i",
          },
        },
        {
          thumbnail: {
            $regex: /X-Amz-Algorithm|X-Amz-Signature|X-Amz-Credential/,
            $options: "i",
          },
        },
      ],
    });

    console.log(
      `📊 Found ${signedUrlMedia.length} media entries with signed URLs`
    );

    if (signedUrlMedia.length === 0) {
      console.log("✅ No signed URLs found in database");
      return;
    }

    // Show details of what will be updated
    console.log("\n📋 URLs to be updated:");
    console.log("=".repeat(80));

    const updates = [];

    signedUrlMedia.forEach((media, index) => {
      console.log(
        `${index + 1}. ${media.title || "Untitled"} (${media.contentType})`
      );
      console.log(`   ID: ${media._id}`);

      const updateData = { _id: media._id };

      // Check fileUrl
      if (isSignedUrl(media.fileUrl)) {
        const objectKey = extractObjectKeyFromSignedUrl(media.fileUrl);
        if (objectKey) {
          const newUrl = generatePublicUrl(objectKey);
          updateData.fileUrl = newUrl;
          console.log(`   File URL: ${media.fileUrl} → ${newUrl}`);
        }
      }

      // Check thumbnailUrl
      if (isSignedUrl(media.thumbnailUrl)) {
        const objectKey = extractObjectKeyFromSignedUrl(media.thumbnailUrl);
        if (objectKey) {
          const newUrl = generatePublicUrl(objectKey);
          updateData.thumbnailUrl = newUrl;
          console.log(`   Thumbnail URL: ${media.thumbnailUrl} → ${newUrl}`);
        }
      }

      // Check thumbnail field
      if (isSignedUrl(media.thumbnail)) {
        const objectKey = extractObjectKeyFromSignedUrl(media.thumbnail);
        if (objectKey) {
          const newUrl = generatePublicUrl(objectKey);
          updateData.thumbnail = newUrl;
          console.log(`   Thumbnail: ${media.thumbnail} → ${newUrl}`);
        }
      }

      if (Object.keys(updateData).length > 1) {
        // More than just _id
        updates.push(updateData);
      }

      console.log("");
    });

    if (updates.length === 0) {
      console.log("✅ No valid updates found");
      return;
    }

    if (dryRun) {
      console.log("🔍 DRY RUN MODE - No URLs were actually updated");
      console.log(`📊 Would update ${updates.length} media entries`);
      return;
    }

    console.log("\n🔄 Updating URLs to permanent public URLs...");

    let updatedCount = 0;

    for (const update of updates) {
      const { _id, ...updateFields } = update;

      try {
        await Media.findByIdAndUpdate(_id, {
          $set: {
            ...updateFields,
            updatedAt: new Date(),
          },
        });

        updatedCount++;
        console.log(`✅ Updated ${_id}`);
      } catch (error) {
        console.error(`❌ Failed to update ${_id}:`, error.message);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} media entries`);

    // Verify the updates
    const remainingSignedUrls = await Media.countDocuments({
      $or: [
        {
          fileUrl: {
            $regex: /X-Amz-Algorithm|X-Amz-Signature|X-Amz-Credential/,
            $options: "i",
          },
        },
        {
          thumbnailUrl: {
            $regex: /X-Amz-Algorithm|X-Amz-Signature|X-Amz-Credential/,
            $options: "i",
          },
        },
        {
          thumbnail: {
            $regex: /X-Amz-Algorithm|X-Amz-Signature|X-Amz-Credential/,
            $options: "i",
          },
        },
      ],
    });

    if (remainingSignedUrls === 0) {
      console.log(
        "🎉 All signed URLs have been successfully converted to permanent public URLs!"
      );
    } else {
      console.log(
        `⚠️  ${remainingSignedUrls} signed URLs still remain in the database`
      );
    }
  } catch (error) {
    console.error("❌ Error during URL fix:", error);
    throw error;
  }
}

// Main execution
async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("🔧 Fix Expired URLs Script");
  console.log("==========================");

  if (isDryRun) {
    console.log("🔍 Running in DRY RUN mode - no URLs will be updated");
  }

  try {
    await connectDB();
    await fixExpiredUrls(isDryRun);
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

module.exports = {
  fixExpiredUrls,
  isSignedUrl,
  extractObjectKeyFromSignedUrl,
  generatePublicUrl,
};
