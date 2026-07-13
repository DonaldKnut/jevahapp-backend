require("dotenv").config();
const mongoose = require("mongoose");

const srv = process.env.MONGODB_URI;
if (!srv) {
  console.error("MONGODB_URI missing");
  process.exit(1);
}

const hosts = [
  "ac-vfegjnl-shard-00-00.cerc7kk.mongodb.net:27017",
  "ac-vfegjnl-shard-00-01.cerc7kk.mongodb.net:27017",
  "ac-vfegjnl-shard-00-02.cerc7kk.mongodb.net:27017",
].join(",");

const standard = srv.replace(
  "mongodb+srv://",
  "mongodb://"
).replace(
  /@tevahdb\.cerc7kk\.mongodb\.net/,
  `@${hosts}`
) + (srv.includes("?") ? "" : "?ssl=true&authSource=admin&retryWrites=true&w=majority");

async function tryConnect(label, uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log(`OK: ${label}`);
    await mongoose.disconnect();
    return true;
  } catch (e) {
    console.error(`FAIL: ${label} —`, e.message);
    return false;
  }
}

(async () => {
  const srvOk = await tryConnect("mongodb+srv", srv);
  if (!srvOk) {
    await tryConnect("standard (non-SRV)", standard);
  }
})();
