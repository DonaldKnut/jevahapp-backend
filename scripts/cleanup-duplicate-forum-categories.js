const mongoose = require("mongoose");
require("dotenv").config();

const { Forum } = require("../dist/models/forum.model");

async function cleanupDuplicateForumCategories() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app";
  console.log(`🔌 Connecting to MongoDB at ${mongoUri}`);

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  // Find duplicate categories (matched by case-sensitive title)
  const duplicateGroups = await Forum.aggregate([
    { $match: { isCategory: true } },
    {
      $group: {
        _id: "$title",
        ids: { $push: "$_id" },
        createdAt: { $push: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (!duplicateGroups.length) {
    console.log("🎉 No duplicate forum categories detected. Nothing to clean up.");
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    return;
  }

  console.log(`⚠️  Found ${duplicateGroups.length} duplicate title group(s). Cleaning up...`);

  let removedCount = 0;
  for (const group of duplicateGroups) {
    const { _id: title, ids } = group;
    const categories = await Forum.find({ _id: { $in: ids } }).sort({ createdAt: 1 });

    if (!categories.length) {
      continue;
    }

    const [categoryToKeep, ...duplicatesToRemove] = categories;
    console.log(`➡️  Keeping "${categoryToKeep.title}" (${categoryToKeep._id}) created at ${categoryToKeep.createdAt}`);

    for (const duplicate of duplicatesToRemove) {
      await Forum.deleteOne({ _id: duplicate._id });
      removedCount++;
      console.log(`   ❌ Removed duplicate "${duplicate.title}" (${duplicate._id}) created at ${duplicate.createdAt}`);
    }
  }

  console.log(`\n📊 Cleanup summary:
   • Duplicate groups processed: ${duplicateGroups.length}
   • Entries removed: ${removedCount}
   • Entries retained: ${duplicateGroups.length}`);

  await mongoose.disconnect();
  console.log("\n🔌 Disconnected from MongoDB");
  console.log("✅ Duplicate forum categories cleanup completed!");
}

cleanupDuplicateForumCategories()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Cleanup failed:", error);
    mongoose.disconnect().finally(() => process.exit(1));
  });





