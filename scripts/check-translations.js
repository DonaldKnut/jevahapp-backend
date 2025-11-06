const mongoose = require("mongoose");
require("dotenv").config();

const { BibleVerse } = require("../dist/models/bible.model");

async function checkTranslations() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to database\n");

  const counts = await BibleVerse.aggregate([
    { $group: { _id: "$translation", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log("📊 Current translations in database:");
  console.log("=====================================");
  counts.forEach(t => {
    console.log(`  ${t._id}: ${t.count.toLocaleString()} verses`);
  });

  const total = counts.reduce((sum, t) => sum + t.count, 0);
  console.log(`\n  Total: ${total.toLocaleString()} verses`);

  await mongoose.connection.close();
}

checkTranslations().catch(console.error);









