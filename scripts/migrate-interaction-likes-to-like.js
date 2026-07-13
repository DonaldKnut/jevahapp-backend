/**
 * Migration: Interaction likes/favorites + community likes → Like collection
 *
 * Run: node scripts/migrate-interaction-likes-to-like.js
 * Dry run: DRY_RUN=1 node scripts/migrate-interaction-likes-to-like.js
 *
 * Migrates:
 * - Interaction interactionType "like"  → Like (prayer, forum_post, forum_comment, media)
 * - Interaction interactionType "favorite" on media → Like contentType "merch" or "media"
 */

require("dotenv").config();
const mongoose = require("mongoose");

const DRY_RUN =
  process.env.DRY_RUN === "1" ||
  process.env.DRY_RUN === "true" ||
  process.argv.includes("--dry-run");

const LIKE_CONTENT_TYPES = [
  "media",
  "artist",
  "merch",
  "ebook",
  "podcast",
  "devotional",
  "prayer",
  "forum_post",
  "forum_comment",
  "copyright_free_song",
];

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB (dryRun=${DRY_RUN})\n`);

  const Interaction = mongoose.connection.collection("interactions");
  const Like = mongoose.connection.collection("likes");
  const ForumPost = mongoose.connection.collection("forumposts");
  const PrayerPost = mongoose.connection.collection("prayerposts");
  const Media = mongoose.connection.collection("media");

  const forumPostIds = new Set(
    (await ForumPost.find({}, { projection: { _id: 1 } }).toArray()).map(d =>
      d._id.toString()
    )
  );
  const prayerPostIds = new Set(
    (await PrayerPost.find({}, { projection: { _id: 1 } }).toArray()).map(d =>
      d._id.toString()
    )
  );
  const mediaIds = new Set(
    (await Media.find({}, { projection: { _id: 1 } }).toArray()).map(d =>
      d._id.toString()
    )
  );

  function resolveContentType(mediaId, interactionType) {
    const id = mediaId.toString();
    if (prayerPostIds.has(id)) return "prayer";
    if (forumPostIds.has(id)) return "forum_post";
    if (interactionType === "favorite") return "merch";
    if (mediaIds.has(id)) return "media";
    return "media";
  }

  const cursor = Interaction.find({
    interactionType: { $in: ["like", "favorite"] },
    isRemoved: { $ne: true },
  });

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  while (await cursor.hasNext()) {
    const row = await cursor.next();
    scanned++;

    const userId = row.user;
    const contentId = row.media;
    if (!userId || !contentId) {
      skipped++;
      continue;
    }

    const contentType = resolveContentType(contentId, row.interactionType);
    if (!LIKE_CONTENT_TYPES.includes(contentType)) {
      skipped++;
      continue;
    }

    const doc = {
      userId,
      contentId,
      contentType,
      createdAt: row.createdAt || row.lastInteraction || new Date(),
    };

    try {
      const exists = await Like.findOne({ userId, contentId });
      if (exists) {
        skipped++;
        continue;
      }

      if (!DRY_RUN) {
        await Like.insertOne(doc);
      }
      migrated++;
    } catch (err) {
      if (err.code === 11000) {
        skipped++;
      } else {
        console.error("Error:", err.message, { userId, contentId });
        errors++;
      }
    }
  }

  // Forum comment likes: interactionType like where media points to comment _id
  const commentLikes = await Interaction.find({
    interactionType: "like",
  }).toArray();

  for (const row of commentLikes) {
    const comment = await Interaction.findOne({
      _id: row.media,
      interactionType: "comment",
    });
    if (!comment) continue;

    scanned++;
    const doc = {
      userId: row.user,
      contentId: row.media,
      contentType: "forum_comment",
      createdAt: row.createdAt || new Date(),
    };

    try {
      const exists = await Like.findOne({ userId: doc.userId, contentId: doc.contentId });
      if (exists) {
        skipped++;
        continue;
      }
      if (!DRY_RUN) {
        await Like.insertOne(doc);
      }
      migrated++;
    } catch (err) {
      if (err.code === 11000) skipped++;
      else errors++;
    }
  }

  console.log("\n=== Migration Summary ===");
  console.log(`Scanned: ${scanned}`);
  console.log(`Migrated: ${migrated}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total in Like collection: ${await Like.countDocuments()}`);

  await mongoose.disconnect();
  console.log("\nDone.");
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
