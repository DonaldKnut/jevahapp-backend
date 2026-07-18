#!/usr/bin/env node
/**
 * Remove legacy permanent notification dedupeKeys:
 *   like:{actor}:{recipient}:{contentType}:{contentId}
 *   follow:{follower}:{following}
 *
 * New like keys are like:{likeObjectId}. Follow notifications no longer use dedupeKey.
 *
 * Usage:
 *   node scripts/cleanup-legacy-notification-dedupe-keys.js
 *   node scripts/cleanup-legacy-notification-dedupe-keys.js --dry-run
 */

require("dotenv").config();
const mongoose = require("mongoose");

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI (or MONGO_URI) is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const notifications = mongoose.connection.collection("notifications");

  // Legacy like: like:userId:userId:type:contentId (5 colon-separated parts after split → 4 colons)
  // New like: like:{24-hex ObjectId}
  // Legacy follow: follow:userId:userId
  const filter = {
    $or: [
      {
        dedupeKey: {
          $regex: /^like:[a-f0-9]{24}:[a-f0-9]{24}:[a-z_]+:[a-f0-9]{24}$/i,
        },
      },
      {
        dedupeKey: {
          $regex: /^follow:[a-f0-9]{24}:[a-f0-9]{24}$/i,
        },
      },
    ],
  };

  const count = await notifications.countDocuments(filter);
  console.log(`Legacy permanent dedupeKeys found: ${count} (dryRun=${DRY_RUN})`);

  if (count === 0) {
    await mongoose.disconnect();
    return;
  }

  if (DRY_RUN) {
    const sample = await notifications.find(filter).project({ dedupeKey: 1 }).limit(10).toArray();
    for (const doc of sample) {
      console.log(`  would unset ${doc._id} key=${doc.dedupeKey}`);
    }
  } else {
    const r = await notifications.updateMany(filter, { $unset: { dedupeKey: "" } });
    console.log(`Unset dedupeKey on ${r.modifiedCount} notifications`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
