// Quick test to see if server can start
// Run: node test-server-start.js

console.log("Testing server startup...");

try {
  console.log("1. Loading dotenv...");
  require("dotenv").config();
  console.log("✅ dotenv loaded");

  console.log("2. Loading app...");
  const { app, server } = require("./dist/app");
  console.log("✅ app loaded");

  console.log("3. Starting server...");
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server started on port ${PORT}`);
    console.log("✅ SUCCESS - Server is working!");
    process.exit(0);
  });

  server.on("error", (err) => {
    console.error("❌ Server error:", err);
    process.exit(1);
  });

  setTimeout(() => {
    console.log("❌ Server didn't start in 5 seconds");
    process.exit(1);
  }, 5000);

} catch (error) {
  console.error("❌ ERROR:", error.message);
  console.error(error.stack);
  process.exit(1);
}

