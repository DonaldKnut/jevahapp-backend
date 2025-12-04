const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled models
const { Forum } = require("../dist/models/forum.model");
const { Types } = require("mongoose");

async function debugForumData() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB\n");

    // Get all forums (non-categories)
    const forums = await Forum.find({ isCategory: false });
    
    console.log("=".repeat(60));
    console.log("DEBUGGING FORUM DATA");
    console.log("=".repeat(60));
    console.log(`Found ${forums.length} forums:\n`);
    
    for (const forum of forums) {
      console.log(`Forum: "${forum.title}"`);
      console.log(`  _id: ${forum._id}`);
      console.log(`  categoryId: ${forum.categoryId}`);
      console.log(`  categoryId type: ${forum.categoryId ? forum.categoryId.constructor.name : 'null'}`);
      console.log(`  categoryId string: ${forum.categoryId ? String(forum.categoryId) : 'null'}`);
      console.log(`  isCategory: ${forum.isCategory}`);
      console.log(`  isActive: ${forum.isActive}`);
      
      // Try to find the category
      if (forum.categoryId) {
        const category = await Forum.findById(forum.categoryId);
        console.log(`  Category found: ${category ? `"${category.title}" (${category._id})` : 'NOT FOUND'}`);
        console.log(`  Category isCategory: ${category ? category.isCategory : 'N/A'}`);
        
        // Test query
        const testQuery = {
          isCategory: false,
          categoryId: new Types.ObjectId(String(forum.categoryId)),
          isActive: true
        };
        const testResult = await Forum.find(testQuery);
        console.log(`  Test query matches: ${testResult.length} forums`);
        console.log(`  Test query categoryId matches: ${testResult.some(f => String(f._id) === String(forum._id))}`);
      }
      
      console.log();
    }
    
    // Test specific category
    console.log("=".repeat(60));
    console.log("TESTING SPECIFIC CATEGORY QUERY");
    console.log("=".repeat(60));
    
    const fellowshipCategory = await Forum.findOne({ title: "Fellowship & Community" });
    if (fellowshipCategory) {
      console.log(`\nCategory: "${fellowshipCategory.title}"`);
      console.log(`  _id: ${fellowshipCategory._id}`);
      console.log(`  _id string: ${String(fellowshipCategory._id)}`);
      
      // Test query with ObjectId
      const query1 = {
        isCategory: false,
        categoryId: fellowshipCategory._id,
        isActive: true
      };
      const result1 = await Forum.find(query1);
      console.log(`\nQuery with category._id (ObjectId): ${result1.length} forums`);
      
      // Test query with new ObjectId
      const query2 = {
        isCategory: false,
        categoryId: new Types.ObjectId(String(fellowshipCategory._id)),
        isActive: true
      };
      const result2 = await Forum.find(query2);
      console.log(`Query with new ObjectId(string): ${result2.length} forums`);
      
      // Test query with string
      const query3 = {
        isCategory: false,
        categoryId: String(fellowshipCategory._id),
        isActive: true
      };
      const result3 = await Forum.find(query3);
      console.log(`Query with string: ${result3.length} forums`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

debugForumData()
  .then(() => {
    console.log("\n🎉 Debug completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Debug failed:", error);
    process.exit(1);
  });

