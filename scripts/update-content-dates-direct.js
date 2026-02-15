const mongoose = require("mongoose");
require("dotenv").config();

async function updateDatesDirect() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("Connected to MongoDB\n");

    const db = mongoose.connection.db;

    const updates = [
      {
        title: "Understanding True Manhood _ Dr. Myles Munroe on Manhood _ MunroeGlobal.com",
        date: "2024-12-05T10:00:00Z",
        name: "Myles Monroe sermon",
      },
      {
        title:
          "YOU WILL TAKE FASTING & PRAYER SERIOUSLY AFTER HEARING THIS - POWER OF FASTING - APOSTLE AROME OSAYI",
        date: "2024-12-12T14:30:00Z",
        name: "Arome Osayi sermon",
      },
      {
        title: "JUGULAR JUGULAR - Lawrence Oyor ft Greatman Takit",
        date: "2024-12-18T16:00:00Z",
        name: "Lawrence Oyor music video",
      },
      {
        title: "Sermon - Ayo Olayiwola",
        date: "2024-12-22T11:15:00Z",
        name: "Ayo Olayiwola sermon",
      },
    ];

    for (const update of updates) {
      const result = await db.collection("media").updateOne(
        { title: update.title },
        {
          $set: {
            createdAt: new Date(update.date),
            updatedAt: new Date(update.date),
          },
        }
      );
      console.log(`✅ Updated ${update.name}:`, result.modifiedCount);
    }

    console.log("\n✅ All dates updated to December 2024 (last month)");
  } catch (err) {
    console.error("Error updating dates:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

if (require.main === module) {
  updateDatesDirect();
}

module.exports = { updateDatesDirect };

