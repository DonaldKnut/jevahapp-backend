/**
 * Heal comment imageUrl values missing the public CDN prefix (e.g. `jevah/`).
 *
 * Bad:  https://pub-….r2.dev/comments/x.jpg
 * Good: https://pub-….r2.dev/jevah/comments/x.jpg  (when R2_PUBLIC_KEY_PREFIX=jevah)
 *
 * Prefix rules match fileUpload.service:
 * - Explicit R2_PUBLIC_KEY_PREFIX= (empty) → no rewrite
 * - Explicit R2_PUBLIC_KEY_PREFIX=jevah → rewrite
 * - Unset + R2_CUSTOM_DOMAIN → no prefix (prod custom domains usually bucket root)
 * - Unset + r2.dev → jevah
 *
 * Usage:
 *   npm run heal:comment-images
 *   npm run heal:comment-images:dry
 */
require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry-run");

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

function getR2PublicKeyPrefix() {
  if (process.env.R2_PUBLIC_KEY_PREFIX !== undefined) {
    return String(process.env.R2_PUBLIC_KEY_PREFIX).replace(/^\/+|\/+$/g, "");
  }
  if (process.env.R2_CUSTOM_DOMAIN) return "";
  return "jevah";
}

function ensurePublicR2Url(url) {
  if (!url || typeof url !== "string") return url;
  try {
    const u = new URL(url);
    const prefix = getR2PublicKeyPrefix();
    if (!prefix) return url;
    if (u.pathname === `/${prefix}` || u.pathname.startsWith(`/${prefix}/`)) {
      return url;
    }
    if (!u.hostname.toLowerCase().endsWith(".r2.dev") && !process.env.R2_CUSTOM_DOMAIN) {
      // still heal known r2.dev; custom domain without prefix is no-op above
    }
    const knownCustom = (process.env.R2_CUSTOM_DOMAIN || "")
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .toLowerCase();
    const isR2 = u.hostname.toLowerCase().endsWith(".r2.dev");
    const isCustom = knownCustom && u.hostname.toLowerCase() === knownCustom;
    if (!isR2 && !isCustom) return url;

    const path = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    u.pathname = `/${prefix}${path}`;
    return u.toString();
  } catch {
    return url;
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI required");
    process.exit(1);
  }

  ensureMongoDnsServers(uri);
  await mongoose.connect(uri);
  const col = mongoose.connection.collection("interactions");

  const prefix = getR2PublicKeyPrefix();
  if (!prefix) {
    console.log(
      "R2_PUBLIC_KEY_PREFIX is empty (or unset with R2_CUSTOM_DOMAIN) — nothing to heal"
    );
    await mongoose.disconnect();
    return;
  }

  const filter = {
    interactionType: "comment",
    imageUrl: { $type: "string", $ne: "" },
  };

  const docs = await col.find(filter).project({ _id: 1, imageUrl: 1 }).toArray();
  let updated = 0;
  for (const doc of docs) {
    const next = ensurePublicR2Url(doc.imageUrl);
    if (next === doc.imageUrl) continue;
    console.log(`${doc._id}: ${doc.imageUrl} → ${next}`);
    if (!DRY) {
      await col.updateOne({ _id: doc._id }, { $set: { imageUrl: next } });
    }
    updated += 1;
  }

  console.log(DRY ? `Dry-run: would update ${updated}` : `Updated ${updated}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
