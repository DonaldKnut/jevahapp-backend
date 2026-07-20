const mongoose = require("mongoose");
require("dotenv").config();

/**
 * Create performance indexes for faster queries
 * Run this script after deploying to production
 */
async function createPerformanceIndexes() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;

    console.log("\n📋 Creating indexes...\n");

    // Media collection indexes
    console.log("📦 Creating media indexes...");
    try {
      await db.collection("media").createIndexes([
        // Text search index
        { key: { title: "text", description: "text" }, name: "text_search" },
        
        // Common query indexes
        { key: { contentType: 1, category: 1, createdAt: -1 }, name: "content_category_date" },
        { key: { uploadedBy: 1, createdAt: -1 }, name: "uploader_date" },
        { key: { isActive: 1, contentType: 1, createdAt: -1 }, name: "active_content_date" },
        
        // Trending/popular indexes
        { key: { viewCount: -1, likeCount: -1, createdAt: -1 }, name: "popularity" },
        { key: { totalViews: -1, totalLikes: -1 }, name: "trending" },
        
        // Filtering indexes
        { key: { category: 1, contentType: 1, isActive: 1 }, name: "filter_active" },
        { key: { topics: 1, contentType: 1 }, name: "topics_content" },
        { key: { contentHash: 1 }, sparse: true },
        {
          key: { "uploadIntent.intentId": 1 },
          unique: true,
          sparse: true,
          name: "upload_intent_id_unique",
        },
        {
          key: { "uploadIntent.stagingKey": 1, "processing.status": 1, createdAt: 1 },
          name: "staging_cleanup",
        },
        {
          key: { "processing.status": 1, "processing.updatedAt": 1 },
          name: "processing_sweeper",
        },
        { key: { publicationState: 1, createdAt: -1 }, name: "publication_state" },
        
        // Live stream indexes
        { key: { isLive: 1, liveStreamStatus: 1, createdAt: -1 }, name: "live_streams" },
      ]);
      console.log("   ✅ Media indexes created");
    } catch (error) {
      console.log(`   ⚠️  Media index error: ${error.message}`);
    }

    // Users collection indexes
    console.log("👥 Creating user indexes...");
    try {
      await db.collection("users").createIndexes([
        { key: { email: 1 }, unique: true, name: "email_unique" },
        { key: { role: 1, createdAt: -1 }, name: "role_date" },
        { key: { isProfileComplete: 1, createdAt: -1 }, name: "profile_complete" },
      ]);
      console.log("   ✅ User indexes created");
    } catch (error) {
      console.log(`   ⚠️  User index error: ${error.message}`);
    }

    // Polls collection indexes
    console.log("📊 Creating poll indexes...");
    try {
      await db.collection("polls").createIndexes([
        { key: { isActive: 1, closesAt: -1 }, name: "active_closes" },
        { key: { authorId: 1, createdAt: -1 }, name: "author_date" },
        { key: { question: "text" }, name: "question_text" },
      ]);
      console.log("   ✅ Poll indexes created");
    } catch (error) {
      console.log(`   ⚠️  Poll index error: ${error.message}`);
    }

    // Forums collection indexes
    console.log("💬 Creating forum indexes...");
    try {
      await db.collection("forums").createIndexes([
        { key: { isActive: 1, createdAt: -1 }, name: "active_date" },
        { key: { createdBy: 1, createdAt: -1 }, name: "creator_date" },
        { key: { title: "text", description: "text" }, name: "forum_text_search" },
      ]);
      console.log("   ✅ Forum indexes created");
    } catch (error) {
      console.log(`   ⚠️  Forum index error: ${error.message}`);
    }

    // Library collection indexes
    console.log("📚 Creating library indexes...");
    try {
      await db.collection("libraries").createIndexes([
        { key: { userId: 1, mediaId: 1, mediaType: 1 }, unique: true, name: "user_media_unique" },
        { key: { userId: 1, addedAt: -1 }, name: "user_date" },
        { key: { userId: 1, isFavorite: 1 }, name: "user_favorite" },
      ]);
      console.log("   ✅ Library indexes created");
    } catch (error) {
      console.log(`   ⚠️  Library index error: ${error.message}`);
    }

    // Engagement collection indexes
    // NOTE: Do NOT recreate obsolete unique {contentId, userId} — that blocks
    // cross-content-type likes. Canonical unique is {userId, contentType, contentId}.
    console.log("❤️  Creating engagement indexes...");
    try {
      await db.collection("likes").createIndexes([
        {
          key: { userId: 1, contentType: 1, contentId: 1 },
          unique: true,
          name: "user_type_content_unique",
        },
        { key: { contentType: 1, contentId: 1 }, name: "type_content" },
        { key: { userId: 1, createdAt: -1 }, name: "user_recent" },
      ]);
      await db.collection("viewevents").createIndexes([
        { key: { contentType: 1, contentId: 1, viewedAt: -1 }, name: "content_viewed" },
        {
          key: { userId: 1, contentType: 1, contentId: 1, windowKey: 1 },
          unique: true,
          partialFilterExpression: { userId: { $type: "objectId" } },
          name: "user_view_dedupe",
        },
      ]);
      await db.collection("shareevents").createIndexes([
        { key: { userId: 1, contentId: 1 }, name: "user_content" },
        { key: { contentId: 1, contentType: 1 }, name: "content_type" },
      ]);
      await db.collection("copyrightfreesonginteractions").createIndexes([
        { key: { userId: 1, songId: 1 }, unique: true, name: "user_song_unique" },
        { key: { songId: 1 }, name: "song_index" },
      ]);
      await db.collection("bookmarks").createIndexes([
        { key: { user: 1, media: 1 }, unique: true, name: "user_media_unique" },
        { key: { user: 1, createdAt: -1 }, name: "user_recent" },
      ]);
      console.log("   ✅ Engagement indexes created");
    } catch (error) {
      console.log(`   ⚠️  Engagement index error: ${error.message}`);
    }

    console.log("📱 Creating push device indexes...");
    try {
      await db.collection("pushdevices").createIndexes([
        { key: { expoToken: 1 }, unique: true, name: "expo_token_unique" },
        { key: { userId: 1, status: 1 }, name: "user_device_status" },
      ]);
      await db.collection("notificationoutboxes").createIndexes([
        { key: { notificationId: 1 }, unique: true, name: "outbox_notification_unique" },
        { key: { status: 1, createdAt: 1 }, name: "outbox_pending" },
      ]);
      console.log("   ✅ Push indexes created");
    } catch (error) {
      console.log(`   ⚠️  Push index error: ${error.message}`);
    }

    console.log("🛡️  Creating moderation decision-reuse indexes...");
    try {
      await db.collection("moderationcases").createIndexes([
        { key: { mediaId: 1, createdAt: -1 } },
        {
          key: {
            contentHash: 1,
            policyVersion: 1,
            promptVersion: 1,
            modelId: 1,
            createdAt: -1,
          },
          sparse: true,
        },
      ]);
      console.log("   ✅ Moderation indexes created");
    } catch (error) {
      console.log(`   ⚠️  Moderation index error: ${error.message}`);
    }

    // Clamp negative like counts (repair stale analytics / Redis drift)
    console.log("🔧 Repairing negative like counts...");
    try {
      const media = db.collection("media");
      const cf = db.collection("copyrightfreesongs");
      const r1 = await media.updateMany({ totalLikes: { $lt: 0 } }, [{ $set: { totalLikes: 0 } }]);
      const r2 = await media.updateMany({ likeCount: { $lt: 0 } }, [{ $set: { likeCount: 0 } }]);
      const r3 = await cf.updateMany({ likeCount: { $lt: 0 } }, [{ $set: { likeCount: 0 } }]);
      const fixed = (r1.modifiedCount || 0) + (r2.modifiedCount || 0) + (r3.modifiedCount || 0);
      console.log(`   ✅ Repaired ${fixed} document(s) with negative like counts`);
    } catch (error) {
      console.log(`   ⚠️  Repair error: ${error.message}`);
    }

    console.log("\n✅ All performance indexes created successfully!");
    console.log("\n📊 Index Summary:");
    
    const collections = [
      "media",
      "users",
      "polls",
      "forums",
      "libraries",
      "likes",
      "viewevents",
      "shareevents",
      "copyrightfreesonginteractions",
      "bookmarks",
      "moderationcases",
    ];
    for (const collectionName of collections) {
      try {
        const indexes = await db.collection(collectionName).indexes();
        console.log(`   ${collectionName}: ${indexes.length} indexes`);
      } catch (error) {
        console.log(`   ${collectionName}: Error getting indexes`);
      }
    }

  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
  }
}

// Run the script
if (require.main === module) {
  createPerformanceIndexes()
    .then(() => {
      console.log("\n🎉 Script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Script failed:", error);
      process.exit(1);
    });
}

module.exports = { createPerformanceIndexes };

