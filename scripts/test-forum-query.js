const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled models
const { Forum } = require("../dist/models/forum.model");
const { User } = require("../dist/models/user.model");
const { Types } = require("mongoose");

async function testForumQuery() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB\n");

    // Get all categories
    const categories = await Forum.find({
      isCategory: true,
      $or: [
        { categoryId: null },
        { categoryId: { $exists: false } }
      ],
      isActive: true
    }).sort({ createdAt: 1 });

    console.log("=".repeat(60));
    console.log("TESTING FORUM QUERIES");
    console.log("=".repeat(60));
    console.log();

    for (const category of categories) {
      const categoryId = String(category._id);
      console.log(`\n📁 Testing Category: "${category.title}"`);
      console.log(`   Category ID: ${categoryId}`);
      
      // Test the exact query used in the API
      const query = {
        isCategory: false,
        categoryId: new Types.ObjectId(categoryId),
        isActive: true
      };
      
      console.log(`   Query:`, JSON.stringify({
        isCategory: false,
        categoryId: categoryId,
        isActive: true
      }, null, 2));
      
      // First check raw query without populate
      const rawForums = await Forum.find(query);
      console.log(`   Raw query (no populate): ${rawForums.length} forums`);
      
      if (rawForums.length > 0) {
        rawForums.forEach((forum, idx) => {
          console.log(`   ${idx + 1}. "${forum.title}" (${forum._id})`);
          console.log(`      categoryId: ${forum.categoryId ? String(forum.categoryId) : 'null'}`);
          console.log(`      categoryId type: ${forum.categoryId ? forum.categoryId.constructor.name : 'null'}`);
          console.log(`      isCategory: ${forum.isCategory}`);
          console.log(`      isActive: ${forum.isActive}`);
        });
      }
      
      // Then test with populate
      try {
        const forums = await Forum.find(query)
          .populate("createdBy", "firstName lastName username avatar")
          .populate("categoryId", "title description")
          .sort({ createdAt: -1 });
        
        console.log(`   With populate: ${forums.length} forums`);
        
        if (forums.length === 0 && rawForums.length > 0) {
          console.log(`   ⚠️  WARNING: Populate is filtering out results!`);
        }
      } catch (populateError) {
        console.log(`   ⚠️  Populate error (non-critical): ${populateError.message}`);
      }
      
      if (rawForums.length === 0) {
        console.log(`   ⚠️  No forums found for this category`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("TEST COMPLETE");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error testing forum query:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the test
testForumQuery()
  .then(() => {
    console.log("\n🎉 Test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed:", error);
    process.exit(1);
  });

