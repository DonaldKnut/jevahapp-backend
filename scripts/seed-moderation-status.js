/**
 * One-time seed: set moderationStatus "approved" on already-playable Media
 * that are missing / null / empty status. Never touches rejected / under_review / pending.
 *
 * Also marks those rows live for PUBLIC_MEDIA_FILTER (isHidden=false, publicationState=live).
 *
 * Usage:
 *   npm run seed:moderation-status:dry
 *   npm run seed:moderation-status
 *   node scripts/seed-moderation-status.js --dry-run
 *   node scripts/seed-moderation-status.js --apply
 */
require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");

const DRY =
  process.argv.includes("--dry-run") || !process.argv.includes("--apply");
const SEED_REASON = "backfill_missing_status_2026_09";

function ensureMongoDnsServers(mongoUri) {
  if (!String(mongoUri || "").startsWith("mongodb+srv://")) return;
  const current = dns.getServers();
  const onlyLoopback =
    current.length > 0 &&
    current.every((s) => s === "127.0.0.1" || s === "::1");
  const fromEnv = (process.env.DNS_SERVERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const servers =
    fromEnv.length > 0
      ? fromEnv
      : onlyLoopback
        ? ["8.8.8.8", "1.1.1.1"]
        : null;
  if (!servers) return;
  dns.setServers(servers);
  console.log("DNS servers set for mongodb+srv:", servers.join(", "));
}

function missingFilter() {
  return {
    $and: [
      {
        $or: [
          { moderationStatus: { $exists: false } },
          { moderationStatus: null },
          { moderationStatus: "" },
        ],
      },
      {
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
      },
      {
        $or: [
          { fileUrl: /^https?:\/\//i },
          { playbackUrl: /^https?:\/\//i },
          { hlsUrl: /^https?:\/\//i },
        ],
      },
      { isHidden: { $ne: true } },
    ],
  };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI (or MONGO_URI) is required");
    process.exit(1);
  }

  ensureMongoDnsServers(uri);
  await mongoose.connect(uri);
  const media = mongoose.connection.collection("media");
  console.log(`Connected. dryRun=${DRY} (pass --apply to write)\n`);

  const match = missingFilter();

  const [
    missing,
    approved,
    pending,
    underReview,
    rejected,
    total,
  ] = await Promise.all([
    media.countDocuments(match),
    media.countDocuments({ moderationStatus: "approved" }),
    media.countDocuments({ moderationStatus: "pending" }),
    media.countDocuments({ moderationStatus: "under_review" }),
    media.countDocuments({ moderationStatus: "rejected" }),
    media.countDocuments({}),
  ]);

  console.log("Counts before:");
  console.log(`  total media:              ${total}`);
  console.log(`  missing/empty (playable): ${missing}`);
  console.log(`  approved:                 ${approved}`);
  console.log(`  pending:                  ${pending}`);
  console.log(`  under_review:             ${underReview}`);
  console.log(`  rejected:                 ${rejected}`);

  const samples = await media
    .find(match, { projection: { _id: 1, title: 1, contentType: 1 } })
    .limit(15)
    .toArray();
  if (samples.length) {
    console.log("\nSample matches:");
    for (const s of samples) {
      console.log(`  ${s._id}  ${s.contentType || "?"}  ${s.title || ""}`);
    }
  }

  if (DRY) {
    console.log(
      `\nDry-run only. Would set ${missing} docs → moderationStatus=approved (+ live).`
    );
    console.log("Re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  if (missing === 0) {
    console.log("\nNothing to update.");
    await mongoose.disconnect();
    return;
  }

  const now = new Date();
  const result = await media.updateMany(match, {
    $set: {
      moderationStatus: "approved",
      isHidden: false,
      publicationState: "live",
      publishedAt: now,
      "moderationResult.isApproved": true,
      "moderationResult.reason": SEED_REASON,
    },
  });

  const afterMissing = await media.countDocuments(match);
  const afterApproved = await media.countDocuments({
    moderationStatus: "approved",
  });

  console.log("\nWrite result:");
  console.log(`  matched:  ${result.matchedCount}`);
  console.log(`  modified: ${result.modifiedCount}`);
  console.log(`  missing after:  ${afterMissing}`);
  console.log(`  approved after: ${afterApproved}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
