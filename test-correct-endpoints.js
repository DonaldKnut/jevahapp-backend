// Test script to verify correct endpoints work
const API_BASE_URL = "http://localhost:4000";

async function testCorrectEndpoints() {
  console.log("🧪 Testing Correct Endpoints...\n");

  // Test 1: Bookmark toggle (the correct endpoint)
  console.log("1️⃣ Testing Bookmark Toggle:");
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/bookmark/68cb2e00573976c282832555/toggle`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer YOUR_TOKEN_HERE", // Replace with actual token
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Bookmark toggle works:", data);
    } else {
      console.log(
        "❌ Bookmark toggle failed:",
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.log("❌ Bookmark toggle error:", error.message);
  }

  // Test 2: Content like (the correct endpoint)
  console.log("\n2️⃣ Testing Content Like:");
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/content/media/68cb2e00573976c282832555/like`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer YOUR_TOKEN_HERE", // Replace with actual token
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Content like works:", data);
    } else {
      console.log(
        "❌ Content like failed:",
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.log("❌ Content like error:", error.message);
  }

  // Test 3: Wrong endpoint (should fail)
  console.log("\n3️⃣ Testing Wrong Endpoint (should fail):");
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/interactions/media/68cb2e00573976c282832555/save`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer YOUR_TOKEN_HERE", // Replace with actual token
        },
      }
    );

    console.log(
      "❌ Wrong endpoint response:",
      response.status,
      await response.text()
    );
  } catch (error) {
    console.log("❌ Wrong endpoint error:", error.message);
  }

  console.log("\n🎯 Summary:");
  console.log("✅ Use: /api/bookmark/:mediaId/toggle for save/unsave");
  console.log("✅ Use: /api/content/:contentType/:contentId/like for likes");
  console.log("❌ Don't use: /api/interactions/media/:id/save (doesn't exist)");
}

// Run the test
testCorrectEndpoints().catch(console.error);
