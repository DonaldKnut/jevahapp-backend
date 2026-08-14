/**
 * Seed / upsert a demo Creator Studio account (role=artist + active Artist).
 *
 * support@jevahapp.com is the master admin — do not convert it to artist.
 * Default studio login: creator@jevahapp.com
 *
 * Usage:
 *   CREATOR_SEED_PASSWORD='your-strong-password' npm run seed:demo-creator
 *
 * Optional:
 *   CREATOR_SEED_EMAIL=creator@jevahapp.com
 *   CREATOR_SEED_DISPLAY_NAME=Jevah Demo Artist
 *   MONGODB_URI=...
 */
require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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

const MASTER_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ||
  process.env.MASTER_ADMIN_EMAIL ||
  "support@jevahapp.com"
)
  .trim()
  .toLowerCase();

const DEFAULT_CREATOR_EMAIL = "creator@jevahapp.com";

function slugify(name) {
  return (
    String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || `artist-${Date.now()}`
  );
}

async function main() {
  const password = process.env.CREATOR_SEED_PASSWORD;
  if (!password || String(password).length < 10) {
    console.error(
      "Set CREATOR_SEED_PASSWORD (min 10 chars).\n" +
        "  PowerShell:\n" +
        "  $env:CREATOR_SEED_PASSWORD='your-strong-password'\n" +
        "  npm run seed:demo-creator"
    );
    process.exit(1);
  }

  let email = (
    process.env.CREATOR_SEED_EMAIL || DEFAULT_CREATOR_EMAIL
  )
    .trim()
    .toLowerCase();

  if (email === MASTER_EMAIL) {
    console.warn(
      `Refusing to demote master admin ${MASTER_EMAIL} to artist.\n` +
        `Seeding ${DEFAULT_CREATOR_EMAIL} instead so Creator Studio login works.\n` +
        `Admin dashboard: ${MASTER_EMAIL}\n` +
        `Creator Studio:   ${DEFAULT_CREATOR_EMAIL}`
    );
    email = DEFAULT_CREATOR_EMAIL;
  }

  const displayName =
    process.env.CREATOR_SEED_DISPLAY_NAME || "Jevah Demo Artist";
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app";
  ensureMongoDnsServers(uri);
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  let User;
  let Artist;
  let CopyrightFreeSong;
  try {
    ({ User } = require("../dist/models/user.model"));
    ({ Artist } = require("../dist/models/artist.model"));
    ({ CopyrightFreeSong } = require("../dist/models/copyrightFreeSong.model"));
  } catch {
    try {
      require("ts-node/register/transpile-only");
      ({ User } = require("../src/models/user.model"));
      ({ Artist } = require("../src/models/artist.model"));
      ({ CopyrightFreeSong } = require("../src/models/copyrightFreeSong.model"));
    } catch (err) {
      console.error("Could not load models. Run npm run build first.", err.message);
      process.exit(1);
    }
  }

  const hashed = await bcrypt.hash(String(password), 10);

  let user = await User.findOne({ email });
  if (user) {
    user.password = hashed;
    user.role = "artist";
    user.provider = user.provider || "email";
    user.isEmailVerified = true;
    user.isBanned = false;
    user.banReason = undefined;
    user.banUntil = undefined;
    user.isProfileComplete = true;
    user.isVerifiedArtist = true;
    user.isVerifiedCreator = true;
    user.firstName = user.firstName || "Jevah";
    user.lastName = user.lastName || "Artist";
    user.artistProfile = {
      ...(user.artistProfile && user.artistProfile.toObject
        ? user.artistProfile.toObject()
        : user.artistProfile || {}),
      artistName: displayName,
      genre: ["gospel", "afro_gospel"],
      bio: "Demo gospel catalog artist for Creator Studio.",
      isVerifiedArtist: true,
    };
    await user.save();
    console.log(`Updated creator user ${email}`);
  } else {
    user = await User.create({
      email,
      password: hashed,
      provider: "email",
      role: "artist",
      firstName: "Jevah",
      lastName: "Artist",
      isEmailVerified: true,
      isBanned: false,
      isProfileComplete: true,
      isVerifiedArtist: true,
      isVerifiedCreator: true,
      section: "adults",
      artistProfile: {
        artistName: displayName,
        genre: ["gospel", "afro_gospel"],
        bio: "Demo gospel catalog artist for Creator Studio.",
        isVerifiedArtist: true,
      },
    });
    console.log(`Created creator user ${email}`);
  }

  let artist = await Artist.findOne({ userId: user._id });
  const slugBase = slugify(displayName);
  let slug = slugBase;
  if (!artist) {
    let n = 0;
    while (await Artist.exists({ slug })) {
      n += 1;
      slug = `${slugBase}-${n}`;
    }
    artist = await Artist.create({
      userId: user._id,
      displayName,
      slug,
      bio: "Demo gospel catalog artist for Creator Studio.",
      genres: ["gospel", "afro_gospel"],
      creatorTypes: ["artist"],
      isVerified: true,
      status: "active",
      applicationNote: "Seeded demo creator for Studio dashboard.",
      reviewedAt: new Date(),
    });
    console.log(`Created Artist ${slug} (active, verified)`);
  } else {
    artist.displayName = displayName;
    artist.status = "active";
    artist.isVerified = true;
    artist.genres = artist.genres?.length
      ? artist.genres
      : ["gospel", "afro_gospel"];
    artist.creatorTypes = artist.creatorTypes?.length
      ? artist.creatorTypes
      : ["artist"];
    artist.bio =
      artist.bio || "Demo gospel catalog artist for Creator Studio.";
    await artist.save();
    console.log(`Updated Artist ${artist.slug} (active, verified)`);
  }

  const existingTrack = await CopyrightFreeSong.findOne({
    artistId: artist._id,
    lane: "artist",
    title: "Demo Praise — Studio Seed",
  });
  if (!existingTrack) {
    const placeholder =
      "https://cdn.jevahapp.com/demo/studio-seed-placeholder.mp3";
    await CopyrightFreeSong.create({
      title: "Demo Praise — Studio Seed",
      singer: displayName,
      artistName: displayName,
      artistId: artist._id,
      artistSlug: artist.slug,
      genre: "gospel",
      category: "worship",
      language: "english",
      lane: "artist",
      visibility: "published",
      copyrightStatus: "original",
      uploadedBy: user._id,
      fileUrl: placeholder,
      audio: { playbackUrl: placeholder, format: "mp3" },
      duration: 180,
      durationSec: 180,
      likeCount: 12,
      saveCount: 4,
      viewCount: 86,
      playCount: 140,
      moderationStatus: "approved",
      processing: { status: "ready" },
      publishedAt: new Date(),
    });
    console.log("Seeded one published demo track for Studio analytics");
  } else {
    console.log("Demo track already present");
  }

  console.log("\nCreator Studio login");
  console.log(`  Email:    ${email}`);
  console.log("  Password: (the CREATOR_SEED_PASSWORD you passed)");
  console.log("  Then open /creators or /creators/studio — not /admin\n");
  console.log(`Admin dashboard remains ${MASTER_EMAIL} (role=admin).\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
