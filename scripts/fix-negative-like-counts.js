#!/usr/bin/env node
/**
 * Repair negative like counts in MongoDB (from stale Redis fast-path / analytics backlog).
 *
 * Usage: node scripts/fix-negative-like-counts.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function fixNegativeLikeCounts() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB\n");

  const media = mongoose.connection.collection("media");
  const copyrightFree = mongoose.connection.collection("copyrightfreesongs");

  const mediaNegTotal = await media.countDocuments({ totalLikes: { $lt: 0 } });
  const mediaNegLike = await media.countDocuments({ likeCount: { $lt: 0 } });
  const cfNegLike = await copyrightFree.countDocuments({ likeCount: { $lt: 0 } });

  console.log("Before fix:");
  console.log(`  media.totalLikes < 0: ${mediaNegTotal}`);
  console.log(`  media.likeCount < 0: ${mediaNegLike}`);
  console.log(`  copyrightfreesongs.likeCount < 0: ${cfNegLike}`);

  if (mediaNegTotal > 0) {
    const r = await media.updateMany({ totalLikes: { $lt: 0 } }, [{ $set: { totalLikes: 0 } }]);
    console.log(`\nFixed media.totalLikes: ${r.modifiedCount}`);
  }

  if (mediaNegLike > 0) {
    const r = await media.updateMany({ likeCount: { $lt: 0 } }, [{ $set: { likeCount: 0 } }]);
    console.log(`Fixed media.likeCount: ${r.modifiedCount}`);
  }

  if (cfNegLike > 0) {
    const r = await copyrightFree.updateMany(
      { likeCount: { $lt: 0 } },
      [{ $set: { likeCount: 0 } }]
    );
    console.log(`Fixed copyrightfreesongs.likeCount: ${r.modifiedCount}`);
  }

  if (mediaNegTotal === 0 && mediaNegLike === 0 && cfNegLike === 0) {
    console.log("\nNo negative counts found — nothing to fix.");
  } else {
    console.log("\nDone. Re-sync Redis counters by liking/unliking once per hot post, or flush post:*:likes keys.");
  }

  await mongoose.disconnect();
}

fixNegativeLikeCounts().catch(err => {
  console.error(err);
  process.exit(1);
});
