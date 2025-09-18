const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:3000"; // Change to your server URL
const TEST_USER_ID = "your-test-user-id"; // Replace with actual user ID

async function testAIReEngagementSystem() {
  console.log("🤖 Testing AI Re-Engagement System...\n");

  try {
    // Test 1: Get re-engagement analytics
    console.log("1️⃣ Testing re-engagement analytics...");
    try {
      const analyticsResponse = await axios.get(
        `${BASE_URL}/api/ai-reengagement/analytics`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
          },
        }
      );

      if (analyticsResponse.data.success) {
        console.log("✅ Analytics retrieved successfully:");
        console.log(
          "   📊 Re-engagement statistics:",
          analyticsResponse.data.data
        );
      } else {
        console.log("❌ Failed to get analytics (may require admin role)");
      }
    } catch (error) {
      console.log(
        "❌ Analytics endpoint error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 2: Get user re-engagement status
    console.log("\n2️⃣ Testing user re-engagement status...");
    try {
      const statusResponse = await axios.get(
        `${BASE_URL}/api/ai-reengagement/status`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
          },
        }
      );

      if (statusResponse.data.success) {
        console.log("✅ User status retrieved successfully:");
        console.log("   👤 Re-engagement status:", statusResponse.data.data);
      } else {
        console.log("❌ Failed to get user status");
      }
    } catch (error) {
      console.log(
        "❌ Status endpoint error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 3: Trigger re-engagement manually
    console.log("\n3️⃣ Testing manual re-engagement trigger...");
    try {
      const triggerResponse = await axios.post(
        `${BASE_URL}/api/ai-reengagement/trigger/${TEST_USER_ID}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (triggerResponse.data.success) {
        console.log("✅ Re-engagement triggered successfully");
        console.log("   🎯 Campaign started for user:", TEST_USER_ID);
      } else {
        console.log("❌ Failed to trigger re-engagement");
      }
    } catch (error) {
      console.log(
        "❌ Trigger endpoint error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 4: Track user return
    console.log("\n4️⃣ Testing user return tracking...");
    try {
      const returnResponse = await axios.post(
        `${BASE_URL}/api/ai-reengagement/track-return`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (returnResponse.data.success) {
        console.log("✅ User return tracked successfully");
        console.log("   🏠 User marked as returned");
      } else {
        console.log("❌ Failed to track user return");
      }
    } catch (error) {
      console.log(
        "❌ Return tracking error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 5: Simulate user signout (logout)
    console.log("\n5️⃣ Testing user signout simulation...");
    try {
      const logoutResponse = await axios.post(
        `${BASE_URL}/api/auth/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (logoutResponse.data.message === "User logged out successfully") {
        console.log("✅ User signout simulated successfully");
        console.log("   🚪 Re-engagement campaign should be initiated");
      } else {
        console.log("❌ Failed to simulate signout");
      }
    } catch (error) {
      console.log(
        "❌ Signout simulation error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 6: Simulate user login (return)
    console.log("\n6️⃣ Testing user login simulation...");
    try {
      const loginResponse = await axios.post(
        `${BASE_URL}/api/auth/login`,
        {
          email: "test@example.com", // Replace with test user email
          password: "testpassword", // Replace with test user password
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (loginResponse.data.token) {
        console.log("✅ User login simulated successfully");
        console.log("   🔄 User return should be tracked");
        console.log(
          "   🎫 New token:",
          loginResponse.data.token.substring(0, 20) + "..."
        );
      } else {
        console.log("❌ Failed to simulate login");
      }
    } catch (error) {
      console.log(
        "❌ Login simulation error:",
        error.response?.data?.message || error.message
      );
    }

    console.log("\n🎉 AI Re-Engagement System testing completed!");
    console.log("\n📱 How the AI Re-Engagement System Works:");
    console.log("   1. 🚪 User signs out → System tracks signout");
    console.log("   2. 🤖 AI analyzes user behavior and preferences");
    console.log("   3. 📝 AI generates personalized re-engagement messages");
    console.log("   4. ⏰ Messages are scheduled at optimal times:");
    console.log("      • 24 hours: New content from favorite artists");
    console.log("      • 3 days: Live stream notifications");
    console.log("      • 1 week: Community engagement messages");
    console.log("      • 2 weeks: Personalized spiritual content");
    console.log("      • 1 month: Final re-engagement message");
    console.log("   5. 📱 Push notifications are sent automatically");
    console.log("   6. 🏠 When user returns → Campaign is cancelled");

    console.log("\n🎯 Message Types Generated:");
    console.log("   • 🎵 New music from favorite artists");
    console.log("   • 📺 Live worship sessions");
    console.log("   • 👥 Community engagement");
    console.log("   • 🙏 Personalized spiritual content");
    console.log("   • 💝 Final re-engagement messages");

    console.log("\n📊 Analytics Available:");
    console.log("   • Total users with re-engagement campaigns");
    console.log("   • Users who returned after re-engagement");
    console.log("   • Re-engagement success rates");
    console.log("   • Message effectiveness metrics");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("   1. Make sure your server is running");
    console.log("   2. Check your authentication token");
    console.log("   3. Verify the user ID exists");
    console.log("   4. Ensure push notifications are configured");
    console.log(
      "   5. Check that AI re-engagement service is properly imported"
    );
  }
}

// Run the test
if (require.main === module) {
  testAIReEngagementSystem();
}

module.exports = { testAIReEngagementSystem };




