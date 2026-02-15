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

    console.log("\n✅ All performance indexes created successfully!");
    console.log("\n📊 Index Summary:");
    
    const collections = ["media", "users", "polls", "forums", "libraries"];
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

