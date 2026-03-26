require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;
  const col = mongoose.connection.db.collection("interactions");

  const indexes = await col.indexes();
  const old = indexes.find(
    (i) => i.name === "user_1_media_1_interactionType_1" && i.unique
  );

  if (old) {
    await col.dropIndex("user_1_media_1_interactionType_1");
    console.log("Dropped old unique index");
  } else {
    console.log("Old unique index not found");
  }

  await col.createIndex(
    { user: 1, media: 1, interactionType: 1 },
    {
      unique: true,
      partialFilterExpression: { interactionType: { $ne: "comment" } },
    }
  );
  console.log("Created partial unique index");

  const after = await col.indexes();
  console.log(
    "Database:",
    dbName,
    "| Indexes:",
    after.map((i) => ({
      name: i.name,
      unique: !!i.unique,
      partialFilterExpression: i.partialFilterExpression || null,
    }))
  );
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Index migration failed:", err.message || err);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });
