/**
 * Backfill Media.duration (seconds) for ready videos missing duration.
 * Uses ffprobe against fileUrl / playbackUrl (progressive MP4 preferred).
 *
 * Usage:
 *   npm run heal:media-duration
 *   npm run heal:media-duration:dry
 *   node scripts/heal-media-duration.js --limit=50
 */
require("dotenv").config();
const dns = require("dns");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const mongoose = require("mongoose");

const execFileAsync = promisify(execFile);
const DRY = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10) || 100) : 100;

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

function parseDurationSeconds(raw) {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

async function probeUrl(url) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "heal-duration-"));
  const localPath = path.join(workDir, "media.bin");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(localPath, buf);
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        localPath,
      ],
      { timeout: 60_000 }
    );
    return parseDurationSeconds(String(stdout).trim());
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  ensureMongoDnsServers(mongoUri);

  try {
    await execFileAsync("ffprobe", ["-version"], { timeout: 5000 });
  } catch {
    console.error("ffprobe not found on PATH");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const Media = mongoose.connection.collection("media");

  const cursor = Media.find({
    contentType: { $in: ["videos", "video", "sermon", "sermons", "live", "recording"] },
    $or: [
      { duration: { $exists: false } },
      { duration: null },
      { duration: 0 },
      { duration: { $lte: 0 } },
    ],
    $and: [
      {
        $or: [
          { fileUrl: { $exists: true, $ne: null } },
          { playbackUrl: { $exists: true, $ne: null } },
        ],
      },
    ],
  })
    .project({
      _id: 1,
      fileUrl: 1,
      playbackUrl: 1,
      duration: 1,
      contentType: 1,
    })
    .limit(LIMIT);

  let scanned = 0;
  let updated = 0;
  let failed = 0;

  for await (const doc of cursor) {
    scanned++;
    const url = doc.playbackUrl || doc.fileUrl;
    if (!url || typeof url !== "string") {
      failed++;
      continue;
    }
    try {
      const duration = await probeUrl(url);
      if (duration == null) {
        console.warn("No duration", String(doc._id), url);
        failed++;
        continue;
      }
      console.log(
        DRY ? "[dry]" : "[set]",
        String(doc._id),
        "duration=",
        duration
      );
      if (!DRY) {
        await Media.updateOne(
          { _id: doc._id },
          {
            $set: {
              duration,
              "processingMetadata.durationSeconds": duration,
            },
          }
        );
      }
      updated++;
    } catch (err) {
      failed++;
      console.warn("Failed", String(doc._id), err?.message || err);
    }
  }

  console.log({ dry: DRY, scanned, updated, failed, limit: LIMIT });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
