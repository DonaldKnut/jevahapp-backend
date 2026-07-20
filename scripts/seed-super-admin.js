/**
 * Seed / upsert the master admin account (support@jevahapp.com by default).
 *
 * Usage:
 *   SUPER_ADMIN_PASSWORD='your-strong-password' npm run seed:super-admin
 *
 * Optional env:
 *   SUPER_ADMIN_EMAIL=support@jevahapp.com
 *   SUPER_ADMIN_FIRST_NAME=Jevah
 *   SUPER_ADMIN_LAST_NAME=Support
 *   MONGODB_URI=...
 *
 * Flags:
 *   --keep-password   If user already exists, do not rotate password
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const MASTER_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ||
  process.env.MASTER_ADMIN_EMAIL ||
  "support@jevahapp.com"
)
  .trim()
  .toLowerCase();

async function main() {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const keepPassword = process.argv.includes("--keep-password");

  if (!password || String(password).length < 10) {
    console.error(
      "❌ Set SUPER_ADMIN_PASSWORD to a strong password (min 10 chars).\n" +
        "   Example: SUPER_ADMIN_PASSWORD='…' npm run seed:super-admin"
    );
    process.exit(1);
  }

  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app";
  await mongoose.connect(uri);
  console.log("✅ Connected to MongoDB");

  // Prefer compiled model if present; fall back to collection upsert.
  let User;
  try {
    ({ User } = require("../dist/models/user.model"));
  } catch {
    User = null;
  }

  const hashed = await bcrypt.hash(String(password), 10);
  const firstName = process.env.SUPER_ADMIN_FIRST_NAME || "Jevah";
  const lastName = process.env.SUPER_ADMIN_LAST_NAME || "Support";

  if (User) {
    const existing = await User.findOne({ email: MASTER_EMAIL });
    if (existing) {
      const updates = {
        role: "admin",
        isEmailVerified: true,
        isBanned: false,
        banReason: undefined,
        banUntil: undefined,
        provider: existing.provider || "email",
        firstName: existing.firstName || firstName,
        lastName: existing.lastName || lastName,
        isProfileComplete: true,
      };
      if (!keepPassword) {
        updates.password = hashed;
      }
      Object.assign(existing, updates);
      await existing.save();
      console.log(
        `✅ Updated master admin ${MASTER_EMAIL}` +
          (keepPassword ? " (password kept)" : " (password rotated)")
      );
    } else {
      await User.create({
        email: MASTER_EMAIL,
        password: hashed,
        provider: "email",
        role: "admin",
        firstName,
        lastName,
        isEmailVerified: true,
        isBanned: false,
        isProfileComplete: true,
        section: "adults",
      });
      console.log(`✅ Created master admin ${MASTER_EMAIL}`);
    }
  } else {
    const col = mongoose.connection.collection("users");
    const existing = await col.findOne({ email: MASTER_EMAIL });
    const doc = {
      email: MASTER_EMAIL,
      role: "admin",
      provider: "email",
      isEmailVerified: true,
      isBanned: false,
      isProfileComplete: true,
      firstName: existing?.firstName || firstName,
      lastName: existing?.lastName || lastName,
      section: "adults",
      updatedAt: new Date(),
    };
    if (!existing || !keepPassword) {
      doc.password = hashed;
    }
    if (!existing) {
      doc.createdAt = new Date();
      await col.insertOne(doc);
      console.log(`✅ Created master admin ${MASTER_EMAIL} (raw collection)`);
    } else {
      await col.updateOne({ email: MASTER_EMAIL }, { $set: doc });
      console.log(
        `✅ Updated master admin ${MASTER_EMAIL} (raw collection)` +
          (keepPassword ? " (password kept)" : " (password rotated)")
      );
    }
  }

  console.log("\nNext:");
  console.log(`  1. Log in at /login as ${MASTER_EMAIL}`);
  console.log("  2. Promote other users to role=admin from Users");
  console.log("  3. Frontend allowlist should include only master by default\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message || err);
  process.exit(1);
});
