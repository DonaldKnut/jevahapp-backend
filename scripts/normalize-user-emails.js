#!/usr/bin/env node
/**
 * One-time migration: lowercase + trim all stored user emails.
 *
 * Required after the User schema gained `lowercase: true, trim: true` on email
 * and auth lookups started normalizing input — mixed-case emails stored before
 * that change would otherwise never match at login / password reset.
 *
 * If two accounts collapse to the same lowercased email (e.g. Foo@x.com and
 * foo@x.com), the duplicates are reported and skipped — resolve those manually.
 *
 * Usage: node scripts/normalize-user-emails.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function normalizeUserEmails() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB\n");

  const users = mongoose.connection.collection("users");

  const cursor = users.find(
    { email: { $type: "string" } },
    { projection: { email: 1 } }
  );

  let updated = 0;
  let skippedDuplicates = 0;

  for await (const user of cursor) {
    const normalized = user.email.trim().toLowerCase();
    if (normalized === user.email) continue;

    const conflict = await users.findOne({
      _id: { $ne: user._id },
      email: normalized,
    });
    if (conflict) {
      skippedDuplicates++;
      console.warn(
        `SKIPPED duplicate: ${user._id} ("${user.email}") collides with ${conflict._id} ("${conflict.email}") — resolve manually`
      );
      continue;
    }

    await users.updateOne({ _id: user._id }, { $set: { email: normalized } });
    updated++;
  }

  console.log(`\nDone. Normalized: ${updated}, skipped duplicates: ${skippedDuplicates}`);

  await mongoose.disconnect();
}

normalizeUserEmails().catch(err => {
  console.error(err);
  process.exit(1);
});
