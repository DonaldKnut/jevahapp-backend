#!/usr/bin/env node

/**
 * Cleanup Orphaned Users Script
 *
 * This script helps clean up user records that were created during failed registration attempts
 * where email sending failed but the user record was still created (before our fixes).
 *
 * Usage: node scripts/cleanup-orphaned-users.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Import the User model
const { User } = require("../dist/models/user.model");

const cleanupOrphanedUsers = async () => {
  console.log("🧹 Starting cleanup of orphaned user records...\n");

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Find users that:
    // 1. Are not email verified
    // 2. Have no verification code (or expired verification code)
    // 3. Were created more than 24 hours ago
    // 4. Have provider "email" (not OAuth users)

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const orphanedUsers = await User.find({
      isEmailVerified: false,
      provider: "email",
      createdAt: { $lt: cutoffDate },
      $or: [
        { verificationCode: { $exists: false } },
        { verificationCode: null },
        { verificationCodeExpires: { $lt: new Date() } },
      ],
    });

    console.log(`📊 Found ${orphanedUsers.length} orphaned user records\n`);

    if (orphanedUsers.length === 0) {
      console.log("✅ No orphaned users found. Database is clean!");
      return;
    }

    // Display orphaned users
    console.log("📋 Orphaned Users Found:");
    orphanedUsers.forEach((user, index) => {
      console.log(
        `  ${index + 1}. ${user.email} (Created: ${user.createdAt.toISOString()})`
      );
    });
    console.log("");

    // Ask for confirmation (in production, you might want to add a --force flag)
    console.log(
      "⚠️  WARNING: This will permanently delete these user records!"
    );
    console.log(
      "   These users likely failed to receive verification emails during registration."
    );
    console.log(
      "   Only proceed if you're sure these are truly orphaned records.\n"
    );

    // For safety, we'll just show what would be deleted
    // Uncomment the deletion code below if you want to actually delete
    console.log("🔍 DRY RUN MODE: Showing what would be deleted");
    console.log(
      "   To actually delete, uncomment the deletion code in this script.\n"
    );

    /*
    // Uncomment this section to actually delete the orphaned users
    console.log("🗑️  Deleting orphaned user records...");
    
    const deleteResult = await User.deleteMany({
      _id: { $in: orphanedUsers.map(user => user._id) }
    });

    console.log(`✅ Successfully deleted ${deleteResult.deletedCount} orphaned user records`);
    */

    // Also check for users with expired verification codes that are still unverified
    const expiredVerificationUsers = await User.find({
      isEmailVerified: false,
      provider: "email",
      verificationCodeExpires: { $lt: new Date() },
      verificationCode: { $exists: true, $ne: null },
    });

    console.log(
      `📊 Found ${expiredVerificationUsers.length} users with expired verification codes\n`
    );

    if (expiredVerificationUsers.length > 0) {
      console.log("📋 Users with Expired Verification Codes:");
      expiredVerificationUsers.forEach((user, index) => {
        console.log(
          `  ${index + 1}. ${user.email} (Expired: ${user.verificationCodeExpires.toISOString()})`
        );
      });
      console.log("");

      console.log("💡 Recommendation: Consider implementing a cleanup job to:");
      console.log("   1. Remove expired verification codes");
      console.log("   2. Send reminder emails to users with expired codes");
      console.log("   3. Optionally delete very old unverified accounts");
    }

    console.log("\n🎉 Cleanup analysis completed!");
    console.log("\n📝 Recommendations:");
    console.log("1. Monitor email delivery rates in production");
    console.log("2. Set up alerts for email sending failures");
    console.log("3. Consider implementing a retry mechanism for failed emails");
    console.log("4. Add logging to track registration success/failure rates");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
};

// Run the cleanup
cleanupOrphanedUsers().catch(console.error);
