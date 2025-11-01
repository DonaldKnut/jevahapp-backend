const mongoose = require("mongoose");
require("dotenv").config();

/**
 * Fix Bible verse indexes to support multiple translations
 * Drops old unique indexes and allows new ones with translation field
 */
async function fixIndexes() {
  try {
    console.log("🔧 Fixing Bible verse indexes...");

    // Connect to database
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to database");

    const db = mongoose.connection.db;
    const collection = db.collection("bibleverses");

    // Get existing indexes
    const indexes = await collection.indexes();
    console.log("\n📋 Current indexes:");
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Drop old unique indexes that don't include translation
    console.log("\n🗑️  Dropping old indexes...");

    try {
      await collection.dropIndex("bookId_1_chapterNumber_1_verseNumber_1");
      console.log("   ✅ Dropped: bookId_1_chapterNumber_1_verseNumber_1");
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log(
          "   ⏭️  Index not found: bookId_1_chapterNumber_1_verseNumber_1"
        );
      } else {
        console.log(`   ⚠️  Error dropping index: ${error.message}`);
      }
    }

    try {
      await collection.dropIndex("bookName_1_chapterNumber_1_verseNumber_1");
      console.log("   ✅ Dropped: bookName_1_chapterNumber_1_verseNumber_1");
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log(
          "   ⏭️  Index not found: bookName_1_chapterNumber_1_verseNumber_1"
        );
      } else {
        console.log(`   ⚠️  Error dropping index: ${error.message}`);
      }
    }

    // Create new indexes with translation
    console.log("\n🔨 Creating new indexes with translation...");

    await collection.createIndex(
      { bookId: 1, chapterNumber: 1, verseNumber: 1, translation: 1 },
      {
        unique: true,
        name: "bookId_1_chapterNumber_1_verseNumber_1_translation_1",
      }
    );
    console.log(
      "   ✅ Created: bookId_1_chapterNumber_1_verseNumber_1_translation_1"
    );

    await collection.createIndex(
      { bookName: 1, chapterNumber: 1, verseNumber: 1, translation: 1 },
      {
        unique: true,
        name: "bookName_1_chapterNumber_1_verseNumber_1_translation_1",
      }
    );
    console.log(
      "   ✅ Created: bookName_1_chapterNumber_1_verseNumber_1_translation_1"
    );

    // Show final indexes
    const finalIndexes = await collection.indexes();
    console.log("\n📋 Final indexes:");
    finalIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log("\n✅ Index fix complete!");
    console.log(
      "   You can now run: node scripts/seed-multiple-translations.js"
    );
  } catch (error) {
    console.error("❌ Error fixing indexes:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
  }
}

// Run the script
fixIndexes()
  .then(() => {
    console.log("\n🏁 Script completed!");
    process.exit(0);
  })
  .catch(error => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });






