const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled models
const { Forum } = require("../dist/models/forum.model");
const { User } = require("../dist/models/user.model");

async function fixForumCategories() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB\n");

    // Find or create admin user
    let adminUser = await User.findOne({
      $or: [
        { email: "admin@jevah.com" },
        { role: "admin" }
      ]
    });

    if (!adminUser) {
      console.log("⚠️  No admin user found. Creating one...");
      adminUser = await User.create({
        firstName: "Admin",
        lastName: "User",
        email: "admin@jevah.com",
        username: "jevah_admin",
        role: "admin",
        password: "TempPassword123!",
        isEmailVerified: true,
        isProfileComplete: true,
      });
      console.log("✅ Created admin user\n");
    }

    console.log("=".repeat(60));
    console.log("FIXING FORUM CATEGORIES");
    console.log("=".repeat(60));
    console.log();

    // Step 1: Handle duplicates first (delete duplicates, keep the oldest one)
    console.log("Step 1: Handling duplicate titles...");
    const allForums = await Forum.find({}).sort({ createdAt: 1 });
    const titleMap = {};
    let deletedDuplicates = 0;
    
    for (const forum of allForums) {
      const title = forum.title;
      if (!titleMap[title]) {
        titleMap[title] = forum;
      } else {
        // Duplicate found - check if both are categories
        const existing = titleMap[title];
        const bothAreCategories = (!existing.categoryId || existing.categoryId === null) && 
                                  (!forum.categoryId || forum.categoryId === null);
        
        if (bothAreCategories) {
          // Keep the older one, delete the duplicate
          console.log(`⚠️  Found duplicate category: "${title}"`);
          console.log(`   Keeping: ${existing._id} (created: ${existing.createdAt})`);
          console.log(`   Deleting: ${forum._id} (created: ${forum.createdAt})`);
          await Forum.findByIdAndDelete(forum._id);
          deletedDuplicates++;
        } else {
          // One might be a forum, keep both but fix their structure
          titleMap[title] = existing; // Keep the first one
        }
      }
    }
    
    if (deletedDuplicates > 0) {
      console.log(`✅ Deleted ${deletedDuplicates} duplicate categories\n`);
    } else {
      console.log(`✅ No duplicates found\n`);
    }

    // Step 2: Fix all categories (ensure isCategory: true, categoryId: null)
    console.log("Step 2: Fixing categories...");
    const remainingForums = await Forum.find({});
    
    let fixedCategories = 0;
    let fixedForums = 0;
    
    for (const forum of remainingForums) {
      // Check if this should be a category (has no categoryId or categoryId is null)
      const shouldBeCategory = !forum.categoryId || forum.categoryId === null;
      
      if (shouldBeCategory) {
        // This should be a category
        if (forum.isCategory !== true || forum.categoryId) {
          try {
            forum.isCategory = true;
            forum.categoryId = null;
            if (!forum.createdBy) {
              forum.createdBy = adminUser._id;
            }
            await forum.save();
            console.log(`✅ Fixed category: "${forum.title}"`);
            fixedCategories++;
          } catch (error) {
            if (error.code === 11000) {
              // Duplicate key error - this shouldn't happen after step 1, but handle it
              console.log(`⚠️  Skipped duplicate: "${forum.title}" (${forum._id})`);
            } else {
              throw error;
            }
          }
        }
      } else {
        // This should be a forum (has a categoryId)
        if (forum.isCategory !== false) {
          forum.isCategory = false;
          await forum.save();
          console.log(`✅ Fixed forum: "${forum.title}"`);
          fixedForums++;
        }
      }
    }

    console.log(`\n✅ Fixed ${fixedCategories} categories`);
    console.log(`✅ Fixed ${fixedForums} forums\n`);

    // Step 3: Fix orphaned forums (reassign to "General Discussion" or delete)
    console.log("Step 3: Fixing orphaned forums...");
    const forums = await Forum.find({ isCategory: false });
    const generalDiscussionCategory = await Forum.findOne({
      title: "General Discussion",
      isCategory: true
    });
    
    let fixedOrphaned = 0;
    let deletedOrphaned = 0;
    
    for (const forum of forums) {
      if (!forum.categoryId) {
        // Forum has no categoryId - assign to General Discussion or delete
        if (generalDiscussionCategory) {
          forum.categoryId = generalDiscussionCategory._id;
          await forum.save();
          console.log(`✅ Reassigned orphaned forum "${forum.title}" to "General Discussion"`);
          fixedOrphaned++;
        } else {
          // No General Discussion category, delete the orphaned forum
          await Forum.findByIdAndDelete(forum._id);
          console.log(`⚠️  Deleted orphaned forum "${forum.title}" (no valid category found)`);
          deletedOrphaned++;
        }
        continue;
      }
      
      const category = await Forum.findById(forum.categoryId);
      if (!category || category.isCategory !== true) {
        // Category doesn't exist or is not a valid category
        if (generalDiscussionCategory) {
          forum.categoryId = generalDiscussionCategory._id;
          await forum.save();
          console.log(`✅ Reassigned orphaned forum "${forum.title}" to "General Discussion"`);
          fixedOrphaned++;
        } else {
          await Forum.findByIdAndDelete(forum._id);
          console.log(`⚠️  Deleted orphaned forum "${forum.title}" (invalid category)`);
          deletedOrphaned++;
        }
      }
    }
    
    if (fixedOrphaned > 0 || deletedOrphaned > 0) {
      console.log(`\n✅ Fixed ${fixedOrphaned} orphaned forums`);
      console.log(`⚠️  Deleted ${deletedOrphaned} orphaned forums\n`);
    } else {
      console.log(`✅ No orphaned forums found\n`);
    }

    // Step 4: Verify all categories
    console.log("Step 4: Verifying categories...");
    const categories = await Forum.find({
      isCategory: true,
      $or: [
        { categoryId: null },
        { categoryId: { $exists: false } }
      ]
    });

    console.log(`Found ${categories.length} valid categories:\n`);
    categories.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. "${cat.title}" (${cat._id})`);
    });

    // Step 5: Verify all forums
    console.log("\nStep 5: Verifying forums...");
    const allForumsAfterFix = await Forum.find({
      isCategory: false
    });

    console.log(`Found ${allForumsAfterFix.length} forums:\n`);
    
    // Group by category
    const forumsByCategory = {};
    for (const forum of allForumsAfterFix) {
      if (!forum.categoryId) continue;
      const catId = String(forum.categoryId);
      if (!forumsByCategory[catId]) {
        forumsByCategory[catId] = [];
      }
      forumsByCategory[catId].push(forum);
    }

    for (const [catId, forumList] of Object.entries(forumsByCategory)) {
      const category = await Forum.findById(catId);
      const categoryName = category ? category.title : `Unknown (${catId})`;
      console.log(`\n   📁 Category: "${categoryName}"`);
      console.log(`      Forums: ${forumList.length}`);
      forumList.forEach((forum, idx) => {
        console.log(`      ${idx + 1}. "${forum.title}" (${forum._id})`);
      });
    }

    // Step 6: Final check for orphaned forums
    console.log("\nStep 6: Final check for orphaned forums...");
    const orphanedForums = [];
    for (const forum of allForumsAfterFix) {
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
      console.log("✅ No orphaned forums found");
    } else {
      console.log(`⚠️  Found ${orphanedForums.length} orphaned forums:`);
      orphanedForums.forEach((forum, idx) => {
        console.log(`   ${idx + 1}. "${forum.title}" (${forum._id})`);
        console.log(`      categoryId: ${forum.categoryId || 'null'}`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Categories: ${categories.length}`);
    console.log(`Forums: ${allForumsAfterFix.length}`);
    console.log(`Orphaned Forums: ${orphanedForums.length}`);
    console.log(`Deleted Duplicates: ${deletedDuplicates}`);
    console.log(`Fixed Categories: ${fixedCategories}`);
    console.log(`Fixed Forums: ${fixedForums}`);
    console.log(`Fixed Orphaned: ${fixedOrphaned}`);
    console.log(`Deleted Orphaned: ${deletedOrphaned}`);
    console.log("=".repeat(60));
    console.log("\n✅ Fix completed!");

  } catch (error) {
    console.error("❌ Error fixing forum categories:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the fix function
fixForumCategories()
  .then(() => {
    console.log("\n🎉 Script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });

