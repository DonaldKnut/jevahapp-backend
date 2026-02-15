const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled models
const { Media } = require("../dist/models/media.model");

async function updateDates() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("Connected to MongoDB");

    // Update Myles Monroe sermon by title
    const myles = await Media.updateOne(
      {
        title: "Understanding True Manhood _ Dr. Myles Munroe on Manhood _ MunroeGlobal.com",
      },
      {
        $set: {
          createdAt: new Date("2024-12-05T10:00:00Z"),
          updatedAt: new Date("2024-12-05T10:00:00Z"),
        },
      }
    );
    console.log("✅ Updated Myles Monroe sermon:", myles.modifiedCount);

    // Update Arome Osayi sermon by title
    const arome = await Media.updateOne(
      {
        title: "YOU WILL TAKE FASTING & PRAYER SERIOUSLY AFTER HEARING THIS - POWER OF FASTING - APOSTLE AROME OSAYI",
      },
      {
        $set: {
          createdAt: new Date("2024-12-12T14:30:00Z"),
          updatedAt: new Date("2024-12-12T14:30:00Z"),
        },
      }
    );
    console.log("✅ Updated Arome Osayi sermon:", arome.modifiedCount);

    // Update Lawrence Oyor music video by title
    const lawrence = await Media.updateOne(
      {
        title: "JUGULAR JUGULAR - Lawrence Oyor ft Greatman Takit",
      },
      {
        $set: {
          createdAt: new Date("2024-12-18T16:00:00Z"),
          updatedAt: new Date("2024-12-18T16:00:00Z"),
        },
      }
    );
    console.log("✅ Updated Lawrence Oyor video:", lawrence.modifiedCount);

    // Update Ayo Olayiwola sermon by title
    const ayo = await Media.updateOne(
      {
        title: "Sermon - Ayo Olayiwola",
      },
      {
        $set: {
          createdAt: new Date("2024-12-22T11:15:00Z"),
          updatedAt: new Date("2024-12-22T11:15:00Z"),
        },
      }
    );
    console.log("✅ Updated Ayo Olayiwola sermon:", ayo.modifiedCount);

    console.log("\n✅ All dates updated to December 2024 (last month)");
  } catch (err) {
    console.error("Error updating dates:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

if (require.main === module) {
  updateDates();
}

module.exports = { updateDates };

