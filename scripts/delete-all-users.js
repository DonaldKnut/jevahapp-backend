#!/usr/bin/env node

/**
 * Delete All Users Script
 * 
 * ⚠️ WARNING: This script will DELETE ALL USERS from the database.
 * This will force everyone to sign up again.
 * 
 * Usage:
 *   node scripts/delete-all-users.js                    # Dry run (shows what would be deleted)
 *   node scripts/delete-all-users.js --force             # Actually delete all users
 *   node scripts/delete-all-users.js --keep-admins       # Delete all except admin users
 *   node scripts/delete-all-users.js --force --keep-admins # Delete non-admins only
 */

require("dotenv").config();
const mongoose = require("mongoose");
const readline = require("readline");

// Import models (only import what exists)
const { User } = require("../dist/models/user.model");
const { Media } = require("../dist/models/media.model");
const { Bookmark } = require("../dist/models/bookmark.model");
const { Playlist } = require("../dist/models/playlist.model");
const { Notification } = require("../dist/models/notification.model");
const { RefreshToken } = require("../dist/models/refreshToken.model");
const { MediaInteraction } = require("../dist/models/mediaInteraction.model");
const { CopyrightFreeSongInteraction } = require("../dist/models/copyrightFreeSongInteraction.model");
const { PlaybackSession } = require("../dist/models/playbackSession.model");
const { UserViewedMedia } = require("../dist/models/userViewedMedia.model");
const { Library } = require("../dist/models/library.model");
const { Subscription } = require("../dist/models/subscription.model");
const { PaymentTransaction } = require("../dist/models/payment.model");
const { Group } = require("../dist/models/group.model");
const { ForumPost } = require("../dist/models/forumPost.model");
const { ForumThread } = require("../dist/models/forumThread.model");
const { PrayerPost } = require("../dist/models/prayerPost.model");
const { Message } = require("../dist/models/message.model");
const { Conversation } = require("../dist/models/conversation.model");

// Try to import Comment if it exists
let Comment = null;
try {
  Comment = require("../dist/models/comment.model").Comment;
} catch (e) {
  // Comment model doesn't exist, skip it
}

// Parse command line arguments
const args = process.argv.slice(2);
const isForce = args.includes("--force");
const keepAdmins = args.includes("--keep-admins");
const skipConfirmation = args.includes("--yes");
const keepEmailIndex = args.findIndex(arg => arg === "--keep-email");
const keepEmail = keepEmailIndex !== -1 && args[keepEmailIndex + 1] ? args[keepEmailIndex + 1] : null;

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

const deleteAllUsers = async () => {
  console.log("🚨 DELETE ALL USERS SCRIPT\n");
  console.log("=" .repeat(60));
  
  if (keepEmail) {
    console.log(`📋 Mode: Delete all users EXCEPT: ${keepEmail}`);
  } else if (keepAdmins) {
    console.log("📋 Mode: Delete all users EXCEPT admins");
  } else {
    console.log("📋 Mode: Delete ALL users (including admins)");
  }
  
  if (!isForce) {
    console.log("🔍 DRY RUN MODE: No users will be deleted\n");
  } else {
    console.log("⚠️  LIVE MODE: Users WILL be permanently deleted!\n");
  }
  
  console.log("=" .repeat(60) + "\n");

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB\n");

    // Build query - exclude specific email or admins
    let userQuery = {};
    let keepUserEmail = null;
    
    if (keepEmail) {
      // Keep specific user by email
      keepUserEmail = keepEmail;
      userQuery = { email: { $ne: keepEmail } };
      console.log(`📋 Mode: Delete all users EXCEPT: ${keepEmail}`);
    } else if (keepAdmins) {
      // Keep all admins
      userQuery = { role: { $ne: "admin" } };
      console.log("📋 Mode: Delete all users EXCEPT admins");
    } else {
      console.log("📋 Mode: Delete ALL users (including admins)");
    }

    // Get user count
    const totalUsers = await User.countDocuments({});
    const usersToDelete = await User.countDocuments(userQuery);
    
    // Check if keep email exists
    const keepUser = keepEmail ? await User.findOne({ email: keepEmail }) : null;
    const keepUserCount = keepUser ? 1 : 0;
    const adminCount = keepAdmins && !keepEmail ? await User.countDocuments({ role: "admin" }) : 0;

    console.log("📊 User Statistics:");
    console.log(`   Total users in database: ${totalUsers}`);
    if (keepEmail) {
      if (keepUser) {
        console.log(`   User to keep: ${keepEmail} (${keepUser.firstName || ""} ${keepUser.lastName || ""})`);
      } else {
        console.log(`   ⚠️  WARNING: User with email ${keepEmail} not found!`);
      }
      console.log(`   Users to delete: ${usersToDelete}`);
    } else if (keepAdmins) {
      console.log(`   Admin users (will be kept): ${adminCount}`);
      console.log(`   Users to delete: ${usersToDelete}`);
    } else {
      console.log(`   Users to delete: ${usersToDelete}`);
    }
    console.log("");

    if (usersToDelete === 0) {
      console.log("✅ No users to delete. Database is clean!");
      return;
    }

    // Get sample users
    const sampleUsers = await User.find(userQuery).limit(5).select("email firstName lastName role createdAt");
    console.log("📋 Sample users that will be deleted:");
    sampleUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.firstName || ""} ${user.lastName || ""}) - Role: ${user.role || "none"} - Created: ${user.createdAt.toISOString()}`);
    });
    if (usersToDelete > 5) {
      console.log(`   ... and ${usersToDelete - 5} more users`);
    }
    console.log("");

    // Count related data
    console.log("📊 Related Data Statistics:");
    
    const userIds = await User.find(userQuery).select("_id").lean();
    const userIdArray = userIds.map(u => u._id);
    
    const stats = {
      media: await Media.countDocuments({ uploadedBy: { $in: userIdArray } }),
      comments: Comment ? await Comment.countDocuments({ userId: { $in: userIdArray } }) : 0,
      bookmarks: await Bookmark.countDocuments({ user: { $in: userIdArray } }),
      playlists: await Playlist.countDocuments({ userId: { $in: userIdArray } }),
      notifications: await Notification.countDocuments({ user: { $in: userIdArray } }),
      refreshTokens: await RefreshToken.countDocuments({ userId: { $in: userIdArray } }),
      mediaInteractions: await MediaInteraction.countDocuments({ user: { $in: userIdArray } }),
      playbackSessions: await PlaybackSession.countDocuments({ userId: { $in: userIdArray } }),
      userViewedMedia: await UserViewedMedia.countDocuments({ user: { $in: userIdArray } }),
      library: await Library.countDocuments({ userId: { $in: userIdArray } }),
      subscriptions: await Subscription.countDocuments({ userId: { $in: userIdArray } }),
      payments: await PaymentTransaction.countDocuments({ userId: { $in: userIdArray } }),
      groups: await Group.countDocuments({ userId: { $in: userIdArray } }),
      forumPosts: await ForumPost.countDocuments({ userId: { $in: userIdArray } }),
      forumThreads: await ForumThread.countDocuments({ authorId: { $in: userIdArray } }),
      prayerPosts: await PrayerPost.countDocuments({ authorId: { $in: userIdArray } }),
    };

    console.log(`   Media items: ${stats.media}`);
    console.log(`   Comments: ${stats.comments}`);
    console.log(`   Bookmarks: ${stats.bookmarks}`);
    console.log(`   Playlists: ${stats.playlists}`);
    console.log(`   Notifications: ${stats.notifications}`);
    console.log(`   Refresh tokens: ${stats.refreshTokens}`);
    console.log(`   Media interactions: ${stats.mediaInteractions}`);
    console.log(`   Playback sessions: ${stats.playbackSessions}`);
    console.log(`   User viewed media: ${stats.userViewedMedia}`);
    console.log(`   Library items: ${stats.library}`);
    console.log(`   Subscriptions: ${stats.subscriptions}`);
    console.log(`   Payment transactions: ${stats.payments}`);
    console.log(`   Groups: ${stats.groups}`);
    console.log(`   Forum posts: ${stats.forumPosts}`);
    console.log(`   Forum threads: ${stats.forumThreads}`);
    console.log(`   Prayer posts: ${stats.prayerPosts}`);
    console.log("");

    // Safety confirmation
    if (!isForce) {
      console.log("🔍 DRY RUN MODE - No changes will be made");
      console.log("   To actually delete users, run with --force flag:");
      console.log("   node scripts/delete-all-users.js --force");
      if (keepAdmins) {
        console.log("   node scripts/delete-all-users.js --force --keep-admins");
      }
      return;
    }

    // Final confirmation
    console.log("⚠️  WARNING: This will permanently delete:");
    console.log(`   - ${usersToDelete} user accounts`);
    console.log(`   - All related data (comments, bookmarks, playlists, etc.)`);
    console.log(`   - All user-uploaded media`);
    console.log("");
    
    if (!keepAdmins && !keepEmail) {
      console.log("⚠️  WARNING: This will also delete ADMIN users!");
      console.log("   Consider using --keep-admins to preserve admin accounts");
      console.log("   Or use --keep-email <email> to keep a specific user");
      console.log("");
    }
    
    if (keepEmail && !keepUser) {
      console.log("⚠️  ERROR: Cannot proceed - user to keep not found!");
      console.log(`   Email: ${keepEmail}`);
      return;
    }

    let confirmation = "DELETE ALL USERS";
    if (!skipConfirmation) {
      confirmation = await askQuestion("Type 'DELETE ALL USERS' to confirm: ");
      
      if (confirmation !== "DELETE ALL USERS") {
        console.log("❌ Deletion cancelled. No users were deleted.");
        return;
      }
    } else {
      console.log("✅ Auto-confirmed (--yes flag used)");
    }

    console.log("\n🗑️  Starting deletion process...\n");

    // Delete related data first (to avoid foreign key issues)
    console.log("1️⃣  Deleting related data...");
    
    const deleteOperations = [
      { model: Bookmark, query: { user: { $in: userIdArray } }, name: "Bookmarks" },
      { model: Playlist, query: { userId: { $in: userIdArray } }, name: "Playlists" },
      { model: Notification, query: { user: { $in: userIdArray } }, name: "Notifications" },
      { model: RefreshToken, query: { userId: { $in: userIdArray } }, name: "Refresh Tokens" },
      { model: MediaInteraction, query: { user: { $in: userIdArray } }, name: "Media Interactions" },
      { model: CopyrightFreeSongInteraction, query: { userId: { $in: userIdArray } }, name: "Copyright Song Interactions" },
      { model: PlaybackSession, query: { userId: { $in: userIdArray } }, name: "Playback Sessions" },
      { model: UserViewedMedia, query: { user: { $in: userIdArray } }, name: "User Viewed Media" },
      { model: Library, query: { userId: { $in: userIdArray } }, name: "Library Items" },
      { model: Subscription, query: { userId: { $in: userIdArray } }, name: "Subscriptions" },
      { model: PaymentTransaction, query: { userId: { $in: userIdArray } }, name: "Payment Transactions" },
      { model: ForumPost, query: { userId: { $in: userIdArray } }, name: "Forum Posts" },
      { model: ForumThread, query: { authorId: { $in: userIdArray } }, name: "Forum Threads" },
      { model: PrayerPost, query: { authorId: { $in: userIdArray } }, name: "Prayer Posts" },
      { model: Message, query: { $or: [{ senderId: { $in: userIdArray } }, { receiverId: { $in: userIdArray } }] }, name: "Messages" },
      { model: Conversation, query: { $or: [{ participants: { $in: userIdArray } }] }, name: "Conversations" },
    ];

    for (const op of deleteOperations) {
      try {
        if (!op.model) {
          console.log(`   ⏭️  Skipping ${op.name} (model not available)`);
          continue;
        }
        const result = await op.model.deleteMany(op.query);
        console.log(`   ✅ Deleted ${result.deletedCount} ${op.name}`);
      } catch (error) {
        console.log(`   ⚠️  Error deleting ${op.name}: ${error.message}`);
      }
    }
    
    // Handle Comments separately if model exists
    if (Comment) {
      try {
        const commentResult = await Comment.deleteMany({ userId: { $in: userIdArray } });
        console.log(`   ✅ Deleted ${commentResult.deletedCount} Comments`);
      } catch (error) {
        console.log(`   ⚠️  Error deleting Comments: ${error.message}`);
      }
    }

    // Handle Groups separately (more complex)
    try {
      const groups = await Group.find({ userId: { $in: userIdArray } });
      for (const group of groups) {
        // Remove user from members if they're a member
        group.members = group.members.filter(m => !userIdArray.some(id => id.equals(m.userId)));
        if (group.members.length === 0) {
          await Group.findByIdAndDelete(group._id);
        } else {
          await group.save();
        }
      }
      console.log(`   ✅ Processed ${groups.length} Groups`);
    } catch (error) {
      console.log(`   ⚠️  Error processing Groups: ${error.message}`);
    }

    // Delete user-uploaded media (optional - you might want to keep media)
    // IMPORTANT: Exclude default/onboarding content from deletion
    console.log("\n2️⃣  Handling user-uploaded media...");
    const userMedia = await Media.find({ 
      uploadedBy: { $in: userIdArray },
      // CRITICAL: Don't delete default/onboarding content
      isDefaultContent: { $ne: true },
      isOnboardingContent: { $ne: true }
    });
    const defaultContentCount = await Media.countDocuments({ 
      uploadedBy: { $in: userIdArray },
      $or: [
        { isDefaultContent: true },
        { isOnboardingContent: true }
      ]
    });
    
    console.log(`   Found ${userMedia.length} user-uploaded media items (excluding default content)`);
    if (defaultContentCount > 0) {
      console.log(`   ⛔ Preserving ${defaultContentCount} default/onboarding content items`);
    }
    
    let mediaConfirmation = "yes"; // Default to yes when --yes flag is used
    if (!skipConfirmation) {
      mediaConfirmation = await askQuestion("   Delete user-uploaded media? (yes/no, default: no): ");
    } else {
      console.log("   ✅ Auto-deleting user-uploaded media (--yes flag used)");
      console.log("   🛡️  Default/onboarding content will be preserved");
    }
    
    if (mediaConfirmation.toLowerCase() === "yes") {
      // Delete files from storage first (only for non-default content)
      for (const media of userMedia) {
        if (media.fileObjectKey) {
          try {
            const fileUploadService = require("../dist/service/fileUpload.service").default;
            await fileUploadService.deleteMedia(media.fileObjectKey);
          } catch (error) {
            console.log(`   ⚠️  Error deleting media file ${media.fileObjectKey}: ${error.message}`);
          }
        }
        if (media.thumbnailObjectKey) {
          try {
            const fileUploadService = require("../dist/service/fileUpload.service").default;
            await fileUploadService.deleteMedia(media.thumbnailObjectKey);
          } catch (error) {
            console.log(`   ⚠️  Error deleting thumbnail ${media.thumbnailObjectKey}: ${error.message}`);
          }
        }
      }
      // Only delete non-default content
      const mediaResult = await Media.deleteMany({ 
        uploadedBy: { $in: userIdArray },
        isDefaultContent: { $ne: true },
        isOnboardingContent: { $ne: true }
      });
      console.log(`   ✅ Deleted ${mediaResult.deletedCount} user media items (excluding default content)`);
      console.log(`   🛡️  Preserved default/onboarding content for frontend`);
    } else {
      console.log("   ⏭️  Skipping media deletion (media will remain but uploadedBy will be invalid)");
    }

    // Finally, delete users
    console.log("\n3️⃣  Deleting users...");
    const userResult = await User.deleteMany(userQuery);
    console.log(`   ✅ Deleted ${userResult.deletedCount} users`);

    // Final stats
    const remainingUsers = await User.countDocuments({});
    console.log("\n📊 Final Statistics:");
    console.log(`   Remaining users: ${remainingUsers}`);
    if (keepAdmins && remainingUsers > 0) {
      const remainingAdmins = await User.countDocuments({ role: "admin" });
      console.log(`   Remaining admins: ${remainingAdmins}`);
    }

    console.log("\n✅ Deletion completed successfully!");
    console.log("\n📝 Next Steps:");
    console.log("   1. All users must sign up again");
    console.log("   2. User-uploaded content may need cleanup");
    console.log("   3. Consider running database cleanup scripts");

  } catch (error) {
    console.error("❌ Deletion failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    rl.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
};

// Run the script
deleteAllUsers().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});


