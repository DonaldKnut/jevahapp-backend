#!/usr/bin/env node
/**
 * Reconcile Media.likeCount with Like rows (contentType=media).
 * Media-driven: repairs stale positive counts when zero likes exist.
 *
 * Usage:
 *   node scripts/reconcile-like-counts.js
 *   node scripts/reconcile-like-counts.js --dry-run
 *   node scripts/reconcile-like-counts.js --limit=500
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { reconcileLikeCounts } = require("./lib/reconcileLikeCounts");

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.find(a => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;

async function refreshRedisCounters(contentId, actual) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;
  try {
    const Redis = require("ioredis");
    const r = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await r.connect().catch(() => {});
    const id = String(contentId);
    await r.set(`content:media:${id}:likeCount`, String(actual), "EX", 86400);
    await r.set(`post:${id}:likes`, String(actual), "EX", 86400);
    await r.quit().catch(() => {});
  } catch {
    // non-fatal
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI (or MONGO_URI) is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const media = mongoose.connection.collection("media");
  const likes = mongoose.connection.collection("likes");

  console.log(`Connected. dryRun=${DRY_RUN} limit=${LIMIT || "none"}\n`);

  const result = await reconcileLikeCounts(media, likes, {
    dryRun: DRY_RUN,
    limit: LIMIT,
    onRepair: async ({ contentId, actual }) => {
      await refreshRedisCounters(contentId, actual);
    },
  });

  for (const o of result.orphans) {
    console.warn(`  orphan likes contentId=${o.contentId} count=${o.actual}`);
  }
  for (const r of result.repairs) {
    console.log(
      `  drift id=${r.contentId} title="${r.title}" stored=${r.stored} actual=${r.actual}`
    );
  }

  console.log(
    `\nChecked=${result.checked} drifted=${result.drifted} ` +
      `${DRY_RUN ? "wouldRepair" : "repaired"}=${DRY_RUN ? result.wouldRepair : result.repaired} ` +
      `orphans=${result.orphans.length}`
  );
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
