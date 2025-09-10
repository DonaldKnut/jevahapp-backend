const mongoose = require("mongoose");
const Media = require("./dist/models/media.model").default;

async function checkSeededContent() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("Connected to MongoDB");

    // Check for default content
    const defaultContent = await Media.find({
      isDefaultContent: true,
      isOnboardingContent: true,
    }).populate("uploadedBy", "firstName lastName username email avatar");

    console.log(`\n📊 Found ${defaultContent.length} default content items:`);

    if (defaultContent.length === 0) {
      console.log("❌ No default content found in database!");
      console.log("\n🔧 To fix this, run one of these scripts:");
      console.log("   node scripts/seed-default-content.js");
      console.log("   node scripts/seed-provided-default-content.js");
      console.log("   node scripts/reset-default-content.js");
    } else {
      console.log("\n✅ Default content found:");
      defaultContent.forEach((item, index) => {
        const author = item.uploadedBy
          ? `${item.uploadedBy.firstName} ${item.uploadedBy.lastName}`
          : "Unknown Author";
        console.log(
          `  ${index + 1}. ${item.title} (${item.contentType}) by ${author}`
        );
      });
    }

    // Check total media count
    const totalMedia = await Media.countDocuments();
    console.log(`\n📈 Total media items in database: ${totalMedia}`);
  } catch (error) {
    console.error("Error checking seeded content:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the check
if (require.main === module) {
  checkSeededContent();
}

module.exports = { checkSeededContent };
