const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled models
const { Forum } = require("../dist/models/forum.model");

async function diagnoseForumIssues() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB\n");

    // 1. Check all categories
    console.log("=".repeat(60));
    console.log("1. CHECKING CATEGORIES");
    console.log("=".repeat(60));
    
    const categories = await Forum.find({
      $or: [
        { isCategory: true },
        { categoryId: null },
        { categoryId: { $exists: false } }
      ]
    }).sort({ createdAt: 1 });

    console.log(`Found ${categories.length} categories:\n`);
    
    let invalidCategories = 0;
    categories.forEach((cat, index) => {
      const isValid = cat.isCategory === true && (!cat.categoryId || cat.categoryId === null);
      if (!isValid) invalidCategories++;
      
      console.log(`${index + 1}. "${cat.title}"`);
      console.log(`   _id: ${cat._id}`);
      console.log(`   isCategory: ${cat.isCategory} ${cat.isCategory !== true ? '❌' : '✅'}`);
      console.log(`   categoryId: ${cat.categoryId || 'null'} ${cat.categoryId ? '❌' : '✅'}`);
      console.log(`   isActive: ${cat.isActive}`);
      console.log(`   Status: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    });

    if (invalidCategories > 0) {
      console.log(`⚠️  WARNING: ${invalidCategories} categories have invalid structure!\n`);
    }

    // 2. Check all forums (non-categories)
    console.log("=".repeat(60));
    console.log("2. CHECKING FORUMS (NON-CATEGORIES)");
    console.log("=".repeat(60));
    
    const forums = await Forum.find({
      isCategory: false
    }).sort({ createdAt: -1 });

    console.log(`Found ${forums.length} forums:\n`);
    
    if (forums.length === 0) {
      console.log("⚠️  No forums found in database!\n");
    } else {
      forums.forEach((forum, index) => {
        const isValid = forum.isCategory === false && forum.categoryId !== null && forum.categoryId !== undefined;
        
        console.log(`${index + 1}. "${forum.title}"`);
        console.log(`   _id: ${forum._id}`);
        console.log(`   isCategory: ${forum.isCategory} ${forum.isCategory !== false ? '❌' : '✅'}`);
        console.log(`   categoryId: ${forum.categoryId || 'null'} ${!forum.categoryId ? '❌' : '✅'}`);
        console.log(`   isActive: ${forum.isActive}`);
        console.log(`   Status: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
      });
    }

    // 3. Group forums by category
    console.log("=".repeat(60));
    console.log("3. FORUMS GROUPED BY CATEGORY");
    console.log("=".repeat(60));
    
    for (const category of categories) {
      const categoryForums = await Forum.find({
        isCategory: false,
        categoryId: category._id,
        isActive: true
      }).sort({ createdAt: -1 });

      console.log(`\n📁 Category: "${category.title}" (${category._id})`);
      console.log(`   Forums: ${categoryForums.length}`);
      
      if (categoryForums.length === 0) {
        console.log("   ⚠️  No forums found for this category");
      } else {
        categoryForums.forEach((forum, idx) => {
          console.log(`   ${idx + 1}. "${forum.title}" (${forum._id})`);
          console.log(`      Created: ${forum.createdAt}`);
        });
      }
    }

    // 4. Check for orphaned forums (forums with invalid categoryId)
    console.log("\n" + "=".repeat(60));
    console.log("4. CHECKING FOR ORPHANED FORUMS");
    console.log("=".repeat(60));
    
    const allForums = await Forum.find({ isCategory: false });
    const orphanedForums = [];
    
    for (const forum of allForums) {
      if (!forum.categoryId) {
        orphanedForums.push(forum);
        continue;
      }
      
      const category = await Forum.findById(forum.categoryId);
      if (!category || category.isCategory !== true) {
        orphanedForums.push(forum);
      }
    }
    
    if (orphanedForums.length === 0) {
      console.log("✅ No orphaned forums found\n");
    } else {
      console.log(`⚠️  Found ${orphanedForums.length} orphaned forums:\n`);
      orphanedForums.forEach((forum, idx) => {
        console.log(`${idx + 1}. "${forum.title}" (${forum._id})`);
        console.log(`   categoryId: ${forum.categoryId || 'null'}`);
      });
    }

    // 5. Fix invalid categories (skip duplicates to avoid errors)
    console.log("\n" + "=".repeat(60));
    console.log("5. FIXING INVALID CATEGORIES");
    console.log("=".repeat(60));
    
    let fixedCount = 0;
    let skippedDuplicates = 0;
    
    for (const cat of categories) {
      if (cat.isCategory !== true || cat.categoryId) {
        try {
          cat.isCategory = true;
          cat.categoryId = null;
          await cat.save();
          console.log(`✅ Fixed: "${cat.title}"`);
          fixedCount++;
        } catch (error) {
          if (error.code === 11000) {
            // Duplicate key error - skip it
            console.log(`⚠️  Skipped duplicate: "${cat.title}" (${cat._id})`);
            skippedDuplicates++;
          } else {
            throw error;
          }
        }
      }
    }
    
    if (fixedCount === 0 && skippedDuplicates === 0) {
      console.log("✅ All categories are valid\n");
    } else {
      if (fixedCount > 0) {
        console.log(`\n✅ Fixed ${fixedCount} categories`);
      }
      if (skippedDuplicates > 0) {
        console.log(`⚠️  Skipped ${skippedDuplicates} duplicates (run fix script to handle them)`);
      }
      console.log();
    }

    // Summary
    console.log("=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Categories: ${categories.length} (${categories.length - invalidCategories} valid)`);
    console.log(`Forums: ${forums.length}`);
    console.log(`Orphaned Forums: ${orphanedForums.length}`);
    console.log(`Fixed Categories: ${fixedCount}`);
    if (skippedDuplicates > 0) {
      console.log(`Skipped Duplicates: ${skippedDuplicates}`);
    }
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error diagnosing forum issues:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the diagnostic function
diagnoseForumIssues()
  .then(() => {
    console.log("\n🎉 Diagnostic completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Diagnostic failed:", error);
    process.exit(1);
  });

