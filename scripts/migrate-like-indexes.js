#!/usr/bin/env node
/**
 * Idempotent Like index migration for Atlas / any MongoDB.
 *
 * 1. Preview post-backfill collisions (dry-run accurate)
 * 2. Backfill missing contentType → "media"
 * 3. Dedupe (userId, contentType, contentId) — keep oldest
 * 4. Drop legacy unique { contentId: 1, userId: 1 } if present
 * 5. Ensure named indexes with matching key/options
 *
 * Usage:
 *   node scripts/migrate-like-indexes.js
 *   node scripts/migrate-like-indexes.js --dry-run
 */

require("dotenv").config();
const mongoose = require("mongoose");
const {
  findLegacyUniqueIndex,
  findNamedIndex,
  findDuplicateGroups,
  validateDesiredIndexes,
  DESIRED_INDEXES,
} = require("./lib/migrateLikeIndexes");

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI (or MONGO_URI) is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const likes = mongoose.connection.collection("likes");
  console.log(`Connected. dryRun=${DRY_RUN}\n`);

  const before = await likes.countDocuments();
  console.log(`Like documents: ${before}`);

  // Load docs for collision preview (needed for accurate dry-run after backfill)
  const allDocs = await likes
    .find(
      {},
      { projection: { userId: 1, contentType: 1, contentId: 1, createdAt: 1 } }
    )
    .toArray();

  const missingType = allDocs.filter(
    d => d.contentType == null || d.contentType === ""
  ).length;
  console.log(`Missing contentType: ${missingType}`);

  const collisionPreview = findDuplicateGroups(
    allDocs.map(d => ({
      ...d,
      contentType: d.contentType || "media",
    }))
  );
  console.log(
    `Duplicate groups after contentType backfill (preview): ${collisionPreview.length}`
  );
  for (const g of collisionPreview.slice(0, 20)) {
    console.log(
      `  would keep=${g.keep} remove=${g.remove.length} user=${g.userId} type=${g.contentType} content=${g.contentId}`
    );
  }
  if (collisionPreview.length > 20) {
    console.log(`  ... and ${collisionPreview.length - 20} more`);
  }

  if (missingType > 0 && !DRY_RUN) {
    const r = await likes.updateMany(
      {
        $or: [
          { contentType: { $exists: false } },
          { contentType: null },
          { contentType: "" },
        ],
      },
      { $set: { contentType: "media" } }
    );
    console.log(`Backfilled contentType=media: ${r.modifiedCount}`);
  }

  // Live dedupe (post-backfill)
  let deleted = 0;
  if (!DRY_RUN) {
    const afterBackfill = await likes
      .find(
        {},
        { projection: { userId: 1, contentType: 1, contentId: 1, createdAt: 1 } }
      )
      .toArray();
    const groups = findDuplicateGroups(afterBackfill);
    for (const group of groups) {
      if (group.remove.length === 0) continue;
      const r = await likes.deleteMany({ _id: { $in: group.remove } });
      deleted += r.deletedCount || 0;
    }
    console.log(`Deleted duplicate likes: ${deleted}`);
  } else {
    deleted = collisionPreview.reduce((n, g) => n + g.remove.length, 0);
    console.log(`Would delete duplicate likes: ${deleted}`);
  }

  const indexes = await likes.indexes();
  console.log("\nCurrent indexes:");
  for (const idx of indexes) {
    console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique}`);
  }

  const validation = validateDesiredIndexes(indexes);
  if (!validation.ok) {
    console.error("\nNamed index definition mismatch:");
    for (const e of validation.errors) console.error(`  ${e}`);
    if (!DRY_RUN) {
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  const legacy = findLegacyUniqueIndex(indexes);
  if (legacy) {
    console.log(`\nFound legacy unique index: ${legacy.name}`);
    if (!DRY_RUN) {
      await likes.dropIndex(legacy.name);
      console.log(`Dropped ${legacy.name}`);
    } else {
      console.log(`Would drop ${legacy.name}`);
    }
  } else {
    console.log("\nNo legacy {contentId,userId} unique index found.");
  }

  const maybeOldNamed = indexes.find(
    idx =>
      idx.name === "contentId_1_userId_1" ||
      (idx.unique &&
        Object.keys(idx.key || {}).length === 2 &&
        idx.key.contentId === 1 &&
        idx.key.userId === 1)
  );
  if (maybeOldNamed && (!legacy || maybeOldNamed.name !== legacy.name)) {
    console.log(`Also found candidate legacy index: ${maybeOldNamed.name}`);
    if (!DRY_RUN) {
      try {
        await likes.dropIndex(maybeOldNamed.name);
        console.log(`Dropped ${maybeOldNamed.name}`);
      } catch (e) {
        console.warn(`Could not drop ${maybeOldNamed.name}: ${e.message}`);
      }
    }
  }

  for (const { key, options } of DESIRED_INDEXES) {
    const existing = findNamedIndex(await likes.indexes(), options.name);
    if (existing) {
      if (
        JSON.stringify(existing.key) !== JSON.stringify(key) ||
        !!existing.unique !== !!options.unique
      ) {
        console.error(
          `Refusing to create ${options.name}: existing definition mismatches desired`
        );
        if (!DRY_RUN) {
          await mongoose.disconnect();
          process.exit(1);
        }
      } else {
        console.log(`Index already exists: ${options.name}`);
      }
      continue;
    }
    if (DRY_RUN) {
      console.log(`Would create index ${options.name}: ${JSON.stringify(key)}`);
    } else {
      await likes.createIndex(key, options);
      console.log(`Created index ${options.name}`);
    }
  }

  const after = await likes.countDocuments();
  console.log(`\nDone. Like documents before=${before} after=${after}`);
  console.log("Indexes now:");
  for (const idx of await likes.indexes()) {
    console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} unique=${!!idx.unique}`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
