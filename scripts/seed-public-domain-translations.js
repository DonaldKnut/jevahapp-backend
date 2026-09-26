/**
 * Seed KJV + BSB from official public-domain files.
 *
 * Does not touch WEB. Does not seed NIV/ESV/NLT or scrape Bible Gateway.
 *
 * Usage:
 *   npm run bible:seed-pd
 *   npm run bible:seed-kjv
 *   npm run bible:seed-bsb
 *   npm run bible:seed-asv
 *   npm run bible:seed-drb
 *   node scripts/seed-public-domain-translations.js --dry-run
 *   node scripts/seed-public-domain-translations.js --translation=asv,drb
 *   node scripts/seed-public-domain-translations.js --translation=kjv --replace
 *
 * After a successful seed on Contabo:
 *   BIBLE_PACK_TRANSLATION=kjv npm run bible:pack
 *   BIBLE_PACK_TRANSLATION=bsb npm run bible:pack
 */
const path = require("path");
const dns = require("dns");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

/**
 * Windows DNS stub often refuses mongodb+srv SRV lookups
 * (`querySrv ECONNREFUSED`). Same idea as src/config/mongoDns.ts,
 * but this seed always uses public resolvers unless DNS_SERVERS is set.
 */
function ensureMongoDnsServers(mongoUri) {
  if (!String(mongoUri || "").startsWith("mongodb+srv://")) return;
  const fromEnv = (process.env.DNS_SERVERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const servers = fromEnv.length > 0 ? fromEnv : ["8.8.8.8", "1.1.1.1"];
  dns.setServers(servers);
  console.log("DNS servers set for mongodb+srv:", servers.join(", "));
}

const {
  SOURCES,
  parseVersePerLineText,
  assertProtestantCanon,
} = require("./lib/publicDomainBible");

const ALLOWED = new Set(["KJV", "BSB", "ASV", "DRB"]);
const BATCH = 500;

function parseArgs(argv) {
  const args = { translation: "all", dryRun: false, replace: false };
  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw === "--replace") args.replace = true;
    else if (raw.startsWith("--translation=")) {
      args.translation = String(raw.split("=")[1] || "all")
        .trim()
        .toLowerCase();
    }
  }
  return args;
}

function codesFromArg(translation) {
  if (!translation || translation === "all") return ["KJV", "BSB"];
  const codes = String(translation)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  for (const code of codes) {
    if (!ALLOWED.has(code)) {
      throw new Error(
        `Refusing "${code}". This script only seeds public-domain KJV, BSB, ASV, and DRB.`
      );
    }
  }
  return codes;
}

function loadModule(distPath, srcPath) {
  try {
    return require(distPath);
  } catch {
    try {
      require("ts-node/register/transpile-only");
      return require(srcPath);
    } catch (err) {
      console.error(
        "Could not load",
        distPath,
        "— run npm run build first.",
        err.message
      );
      process.exit(1);
    }
  }
}

async function downloadText(url) {
  const res = await axios.get(url, {
    timeout: 120000,
    responseType: "text",
    maxContentLength: 20 * 1024 * 1024,
    maxRedirects: 5,
    headers: {
      "User-Agent": "JevahBibleSeed/1.0 (public-domain KJV/BSB import)",
      Accept: "text/plain, text/*, */*",
    },
    validateStatus: (s) => s >= 200 && s < 300,
  });
  return String(res.data || "");
}

async function loadCorpus(code) {
  const sources = SOURCES[code] || [];
  const errors = [];
  for (const source of sources) {
    try {
      console.log(`  Downloading ${source.name}…`);
      const text = await downloadText(source.url);
      const { verses, omitted, skipped } = parseVersePerLineText(text);
      const summary = assertProtestantCanon(verses, `${code} (${source.name})`);
      if (omitted.length) {
        console.log(
          `  ${omitted.length} empty verse slot(s) (critical-text omissions, e.g. ${omitted[0]})`
        );
      }
      if (skipped.length) {
        console.warn(
          `  Skipped ${skipped.length} unmatched numbered line(s). First: ${skipped[0]}`
        );
      }
      console.log(
        `  ${source.name}: ${summary.verseCount} verses, ${summary.bookCount} books`
      );
      return { verses, source };
    } catch (err) {
      errors.push(`${source.name}: ${err.message}`);
      console.warn(`  Failed ${source.name}: ${err.message}`);
    }
  }
  throw new Error(
    `Could not load a complete ${code} file.\n${errors.join("\n")}`
  );
}

async function ensureBooks(BibleBook, BIBLE_BOOKS) {
  const existing = await BibleBook.find({ isActive: true })
    .select("name _id")
    .lean();
  const byName = new Map(existing.map((b) => [b.name, b]));
  for (const book of BIBLE_BOOKS) {
    if (byName.has(book.name)) continue;
    const created = await BibleBook.create({ ...book, isActive: true });
    byName.set(book.name, created);
    console.log(`  Created missing book row: ${book.name}`);
  }
  return byName;
}

async function ensureChapters(BibleChapter, book, chapterNumbers) {
  const existing = await BibleChapter.find({
    bookId: book._id,
    chapterNumber: { $in: chapterNumbers },
  })
    .select("chapterNumber")
    .lean();
  const have = new Set(existing.map((c) => c.chapterNumber));
  const missing = chapterNumbers.filter((n) => !have.has(n));
  if (!missing.length) return 0;
  await BibleChapter.insertMany(
    missing.map((chapterNumber) => ({
      bookId: book._id,
      bookName: book.name,
      chapterNumber,
      verses: 1,
      isActive: true,
    })),
    { ordered: false }
  );
  return missing.length;
}

async function seedTranslation({
  code,
  verses,
  replace,
  BibleBook,
  BibleChapter,
  BibleVerse,
  BIBLE_BOOKS,
}) {
  const booksByName = await ensureBooks(BibleBook, BIBLE_BOOKS);
  if (replace) {
    const deleted = await BibleVerse.deleteMany({ translation: code });
    console.log(`  Removed ${deleted.deletedCount || 0} existing ${code} verses`);
  }

  const chaptersByBook = new Map();
  for (const v of verses) {
    if (!chaptersByBook.has(v.bookName)) chaptersByBook.set(v.bookName, new Set());
    chaptersByBook.get(v.bookName).add(v.chapterNumber);
  }
  let chaptersCreated = 0;
  for (const [bookName, nums] of chaptersByBook.entries()) {
    const book = booksByName.get(bookName);
    if (!book) continue;
    chaptersCreated += await ensureChapters(
      BibleChapter,
      book,
      [...nums].sort((a, b) => a - b)
    );
  }
  if (chaptersCreated) {
    console.log(`  Created ${chaptersCreated} missing chapter row(s)`);
  }

  let upserted = 0;
  for (let i = 0; i < verses.length; i += BATCH) {
    const slice = verses.slice(i, i + BATCH);
    const ops = [];
    for (const v of slice) {
      const book = booksByName.get(v.bookName);
      if (!book) continue;
      ops.push({
        updateOne: {
          filter: {
            bookName: v.bookName,
            chapterNumber: v.chapterNumber,
            verseNumber: v.verseNumber,
            translation: code,
          },
          update: {
            $set: {
              bookId: book._id,
              bookName: v.bookName,
              chapterNumber: v.chapterNumber,
              verseNumber: v.verseNumber,
              text: v.text,
              translation: code,
              isActive: true,
            },
          },
          upsert: true,
        },
      });
    }
    if (!ops.length) continue;
    const result = await BibleVerse.bulkWrite(ops, { ordered: false });
    upserted +=
      (result.upsertedCount || 0) +
      (result.modifiedCount || 0) +
      (result.matchedCount || 0);
    process.stdout.write(
      `\r  Writing ${code}: ${Math.min(i + BATCH, verses.length)}/${verses.length}`
    );
  }
  process.stdout.write("\n");
  const count = await BibleVerse.countDocuments({
    translation: code,
    isActive: true,
  });
  console.log(`  ${code} now has ${count} active verses (batch ops ≈ ${upserted})`);
  return count;
}

async function main() {
  const args = parseArgs(process.argv);
  const codes = codesFromArg(args.translation);
  console.log(
    `Public-domain Bible seed: ${codes.join(" + ")}${
      args.dryRun ? " (dry-run)" : ""
    }`
  );

  const loaded = [];
  for (const code of codes) {
    console.log(`\n${code}`);
    const corpus = await loadCorpus(code);
    loaded.push({ code, ...corpus });
  }

  if (args.dryRun) {
    console.log("\nDry-run complete. No Mongo writes.");
    return;
  }

  const mongoose = require("mongoose");
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app";
  ensureMongoDnsServers(uri);
  await mongoose.connect(uri);
  console.log("\nConnected to MongoDB");

  const { BibleBook, BibleChapter, BibleVerse, BIBLE_BOOKS } = loadModule(
    path.join(__dirname, "../dist/models/bible.model.js"),
    path.join(__dirname, "../src/models/bible.model")
  );

  for (const item of loaded) {
    console.log(`\nSeeding ${item.code} from ${item.source.name}`);
    await seedTranslation({
      code: item.code,
      verses: item.verses,
      replace: args.replace,
      BibleBook,
      BibleChapter,
      BibleVerse,
      BIBLE_BOOKS,
    });
  }

  await mongoose.disconnect();
  console.log(
    "\nDone. Catalog lists KJV/BSB within ~5 minutes (or restart the API)."
  );
  console.log("Default translation stays WEB. Offline packs: npm run bible:pack");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
