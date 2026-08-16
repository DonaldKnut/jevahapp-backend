/**
 * Build a gzip JSON Bible pack from Mongo and upload it to R2.
 *
 * Public-domain only. Does not stream the pack through the API process.
 * Run on Contabo against prod Mongo after `npm run build`.
 *
 * Usage:
 *   npm run bible:pack
 *   BIBLE_PACK_TRANSLATION=web BIBLE_PACK_VERSION=1 npm run bible:pack
 *
 * Optional:
 *   BIBLE_PACK_DRY=1   — build + hash, skip R2 upload
 */
require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");

const TARGET_GZIP_BYTES = 8 * 1024 * 1024;

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

function loadModule(distPath, srcPath) {
  try {
    return require(distPath);
  } catch {
    try {
      require("ts-node/register/transpile-only");
      return require(srcPath);
    } catch (err) {
      console.error("Could not load", distPath, "— run npm run build first.", err.message);
      process.exit(1);
    }
  }
}

async function main() {
  const translationId = String(
    process.env.BIBLE_PACK_TRANSLATION || "web"
  )
    .trim()
    .toLowerCase();
  const packVersion = Math.max(
    1,
    parseInt(process.env.BIBLE_PACK_VERSION || "1", 10) || 1
  );
  const dry = String(process.env.BIBLE_PACK_DRY || "") === "1";

  const translations = loadModule(
    "../dist/modules/bible/bibleTranslations.js",
    "../src/modules/bible/bibleTranslations"
  );
  const pack = loadModule(
    "../dist/modules/bible/biblePack.js",
    "../src/modules/bible/biblePack"
  );
  const meta = translations.getTranslationMeta(translationId);
  if (meta.license === "licensed") {
    console.error(
      `Refusing to pack licensed translation "${translationId}" (${meta.name}).`
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app";
  ensureMongoDnsServers(uri);
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const { BibleBook, BibleVerse, BIBLE_BOOKS } = loadModule(
    "../dist/models/bible.model.js",
    "../src/models/bible.model"
  );

  let books = await BibleBook.find({ isActive: true })
    .sort({ order: 1 })
    .select("name abbreviation testament chapters")
    .lean();
  if (!books || books.length === 0) {
    books = BIBLE_BOOKS;
    console.warn("No BibleBook rows; using BIBLE_BOOKS constant for metadata.");
  }

  const stored = translations.toStorageTranslationCode(translationId);
  const verses = [];
  const cursor = BibleVerse.find({
    translation: stored,
    isActive: true,
  })
    .select("bookName chapterNumber verseNumber text")
    .lean()
    .cursor();

  for await (const row of cursor) {
    verses.push({
      bookName: row.bookName,
      chapterNumber: row.chapterNumber,
      verseNumber: row.verseNumber,
      text: row.text,
    });
  }

  if (verses.length === 0) {
    console.error(`No verses for translation ${stored}.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Building ${translationId} pack from ${verses.length} verses…`);
  const json = pack.buildBiblePackJson({
    translationId,
    packVersion,
    books,
    verses,
  });
  const { gzip, contentHash, uncompressed } = pack.gzipPack(json);
  console.log(
    `uncompressed=${uncompressed.length} gzip=${gzip.length} hash=${contentHash}`
  );
  if (gzip.length > TARGET_GZIP_BYTES) {
    console.warn(
      `Gzip is ${(gzip.length / (1024 * 1024)).toFixed(2)}MB (target <8MB). Lite still accepts up to 12MB.`
    );
  }

  if (dry) {
    console.log("BIBLE_PACK_DRY=1 — skipped R2 upload.");
    await mongoose.disconnect();
    return;
  }

  const manifest = await pack.publishPackToR2({
    translationId,
    packVersion,
    gzip,
    contentHash,
    license: meta.license,
  });
  console.log("Uploaded", manifest);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
