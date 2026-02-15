const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:4000"; // Change to your server URL
const TEST_USER_ID = "your-test-user-id"; // Replace with actual user ID
const TEST_DEVICE_TOKEN = "ExponentPushToken[your-test-token]"; // Replace with actual Expo token

// Test data
const testNotifications = [
  {
    title: "Welcome to Jevah! 🎉",
    body: "Thank you for joining our gospel community",
    data: { type: "welcome", userId: TEST_USER_ID },
    type: "system",
  },
  {
    title: "New Follower",
    body: "John Doe started following you",
    data: { type: "follow", followerId: "follower123" },
    type: "newFollowers",
  },
  {
    title: "Content Liked",
    body: "Sarah liked your latest song",
    data: { type: "like", contentId: "content123", contentType: "media" },
    type: "mediaLikes",
  },
  {
    title: "New Comment",
    body: "Mike commented on your devotional",
    data: {
      type: "comment",
      contentId: "content456",
      contentType: "devotional",
    },
    type: "mediaComments",
  },
  {
    title: "Merch Purchase",
    body: "Someone purchased your merchandise",
    data: { type: "merch_purchase", merchId: "merch123" },
    type: "merchPurchases",
  },
];

async function testPushNotificationAPI() {
  console.log("🧪 Testing Push Notification API...\n");

  try {
    // Test 1: Register device token
    console.log("1️⃣ Testing device token registration...");
    const registerResponse = await axios.post(
      `${BASE_URL}/api/push-notifications/register`,
      {
        deviceToken: TEST_DEVICE_TOKEN,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (registerResponse.data.success) {
      console.log("✅ Device token registered successfully");
    } else {
      console.log("❌ Failed to register device token");
    }

    // Test 2: Update preferences
    console.log("\n2️⃣ Testing preference updates...");
    const preferencesResponse = await axios.put(
      `${BASE_URL}/api/push-notifications/preferences`,
      {
        newFollowers: true,
        mediaLikes: true,
        mediaComments: false,
        merchPurchases: true,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (preferencesResponse.data.success) {
      console.log("✅ Preferences updated successfully");
    } else {
      console.log("❌ Failed to update preferences");
    }

    // Test 3: Send test notification
    console.log("\n3️⃣ Testing test notification...");
    const testResponse = await axios.post(
      `${BASE_URL}/api/push-notifications/test`,
      {
        title: "Test Notification",
        body: "This is a test push notification from Jevah App",
        data: { test: true, timestamp: new Date().toISOString() },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (testResponse.data.success) {
      console.log("✅ Test notification sent successfully");
    } else {
      console.log("❌ Failed to send test notification");
    }

    // Test 4: Send multiple notifications
    console.log("\n4️⃣ Testing multiple notifications...");
    for (let i = 0; i < testNotifications.length; i++) {
      const notification = testNotifications[i];
      console.log(`   Sending notification ${i + 1}: ${notification.title}`);

      try {
        const response = await axios.post(
          `${BASE_URL}/api/push-notifications/test`,
          notification,
          {
            headers: {
              Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.success) {
          console.log(`   ✅ Notification ${i + 1} sent successfully`);
        } else {
          console.log(`   ❌ Notification ${i + 1} failed`);
        }
      } catch (error) {
        console.log(`   ❌ Notification ${i + 1} error:`, error.message);
      }

      // Wait 2 seconds between notifications
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Test 5: Get stats (if admin)
    console.log("\n5️⃣ Testing stats endpoint...");
    try {
      const statsResponse = await axios.get(
        `${BASE_URL}/api/push-notifications/stats`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
          },
        }
      );

      if (statsResponse.data.success) {
        console.log("✅ Stats retrieved successfully:");
        console.log(
          "   📊 Push notification statistics:",
          statsResponse.data.data
        );
      } else {
        console.log("❌ Failed to get stats (may require admin role)");
      }
    } catch (error) {
      console.log(
        "❌ Stats endpoint error:",
        error.response?.data?.message || error.message
      );
    }

    console.log("\n🎉 Push notification testing completed!");
    console.log("\n📱 Next steps:");
    console.log("   1. Install the frontend dependencies");
    console.log(
      "   2. Implement the PushNotificationService in your React Native app"
    );
    console.log("   3. Test on a physical device (not simulator)");
    console.log("   4. Check your device for push notifications");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("   1. Make sure your server is running");
    console.log("   2. Check your authentication token");
    console.log("   3. Verify the user ID exists");
    console.log("   4. Ensure Expo access token is configured");
  }
}

// Run the test
if (require.main === module) {
  testPushNotificationAPI();
}

module.exports = { testPushNotificationAPI };
