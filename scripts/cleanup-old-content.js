const mongoose = require("mongoose");
require("dotenv").config();

// Import the Media model
const { Media } = require("../dist/models/media.model");

async function cleanupOldContent() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("Connected to MongoDB");

    // Find and remove all old placeholder content
    const oldContent = await Media.find({
      $or: [
        { fileUrl: { $regex: /example\.com/ } },
        { thumbnailUrl: { $regex: /example\.com/ } },
        { uploadedBy: null, isDefaultContent: true }
      ]
    });

    if (oldContent.length === 0) {
      console.log("✅ No old placeholder content found to remove");
      return;
    }

    console.log(`Found ${oldContent.length} old placeholder content items to remove`);

    // Log what we're removing
    oldContent.forEach(item => {
      console.log(`- Removing: ${item.title} (${item.contentType})`);
    });

    // Remove all old content
    const deleteResult = await Media.deleteMany({
      $or: [
        { fileUrl: { $regex: /example\.com/ } },
        { thumbnailUrl: { $regex: /example\.com/ } },
        { uploadedBy: null, isDefaultContent: true }
      ]
    });

    console.log(`✅ Successfully removed ${deleteResult.deletedCount} old content items`);
    console.log("🗑️ Database cleaned of placeholder content");

  } catch (error) {
    console.error("Error cleaning up old content:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupOldContent();
}
