const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled Media model
const { Media } = require("../dist/models/media.model");

async function dropOldCopyrightFreeSongs() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB");

    // Delete old copyright-free songs from Media model
    console.log("🗑️  Deleting old copyright-free songs from Media model...");
    const deleteResult = await Media.deleteMany({
      isPublicDomain: true,
      contentType: { $in: ["music", "audio"] },
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} old copyright-free songs from Media model.`);
    console.log("🎉 Cleanup completed!");
  } catch (error) {
    console.error("❌ Error dropping old songs:", error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
    console.log("✅ Database connection closed");
  }
}

dropOldCopyrightFreeSongs();

