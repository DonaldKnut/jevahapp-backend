/**
 * One-time migration: Enforce viewCount >= likeCount for copyright-free songs.
 * Sets viewCount = likeCount for any song where likeCount > viewCount.
 *
 * Companion to: docs/COPYRIGHT_FREE_MUSIC_FIXES.md (§1.1)
 *
 * Usage:
 *   node scripts/fix-copyright-free-view-count-invariant.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const CopyrightFreeSongSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    singer: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fileUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    category: { type: String, trim: true },
    likeCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    duration: { type: Number },
  },
  { timestamps: true }
);

const CopyrightFreeSong =
  mongoose.models.CopyrightFreeSong ||
  mongoose.model("CopyrightFreeSong", CopyrightFreeSongSchema);

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI or MONGO_URI in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message);
    if (err.code === "ECONNREFUSED" || (err.message && err.message.includes("ECONNREFUSED"))) {
      console.error("\nTips:");
      console.error("  - Check cluster name in your URI (e.g. tevahdb vs jevahdb).");
      console.error("  - Ensure you have internet access and DNS is working.");
      console.error("  - If using mongodb+srv://, try from another network or use a standard URI with host:port.");
    }
    process.exit(1);
  }
  console.log("Connected to MongoDB");

  const cursor = CopyrightFreeSong.find({}).lean().cursor();
  let updated = 0;
  let processed = 0;

  for await (const doc of cursor) {
    processed++;
    const viewCount = doc.viewCount ?? 0;
    const likeCount = doc.likeCount ?? 0;
    if (likeCount > viewCount) {
      await CopyrightFreeSong.updateOne(
        { _id: doc._id },
        { $set: { viewCount: likeCount } }
      );
      updated++;
      console.log(`  ${doc._id}: viewCount ${viewCount} -> ${likeCount} (likes: ${likeCount})`);
    }
  }

  console.log(`Done. Processed ${processed} songs, updated ${updated}.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
