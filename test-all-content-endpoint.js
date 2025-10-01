const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:5000/api";
const TEST_USER_TOKEN = "your_test_user_token_here"; // Replace with actual token

const headers = {
  Authorization: `Bearer ${TEST_USER_TOKEN}`,
  "Content-Type": "application/json",
};

async function testAllContentEndpoint() {
  console.log("🧪 Testing All Content Endpoint...\n");

  try {
    // Test 1: Get all content (should return content from ALL users)
    console.log("📋 Test 1: Get all content from all users");
    const allContentResponse = await axios.get(
      `${BASE_URL}/media/all-content`,
      {
        headers,
      }
    );

    console.log("✅ All content response:", {
      success: allContentResponse.data.success,
      total: allContentResponse.data.total,
      mediaCount: allContentResponse.data.media?.length || 0,
    });

    if (
      allContentResponse.data.media &&
      allContentResponse.data.media.length > 0
    ) {
      console.log("📊 Sample media items:");
      allContentResponse.data.media.slice(0, 3).forEach((item, index) => {
        console.log(
          `  ${index + 1}. ${item.title} (by: ${item.authorInfo?.fullName || "Unknown"})`
        );
      });

      // Check if content is from different users
      const uniqueAuthors = new Set(
        allContentResponse.data.media.map(
          item => item.authorInfo?._id || "unknown"
        )
      );
      console.log(`📊 Unique authors: ${uniqueAuthors.size}`);

      if (uniqueAuthors.size > 1) {
        console.log("✅ SUCCESS: Content from multiple users found!");
      } else {
        console.log("❌ ISSUE: Only content from one user found!");
      }
    }
    console.log("");

    // Test 2: Get general media with pagination
    console.log("📋 Test 2: Get general media with pagination");
    const generalMediaResponse = await axios.get(
      `${BASE_URL}/media?page=1&limit=10`,
      { headers }
    );

    console.log("✅ General media response:", {
      success: generalMediaResponse.data.success,
      mediaCount: generalMediaResponse.data.media?.length || 0,
      pagination: generalMediaResponse.data.pagination,
    });

    if (
      generalMediaResponse.data.media &&
      generalMediaResponse.data.media.length > 0
    ) {
      console.log("📊 Sample media items:");
      generalMediaResponse.data.media.slice(0, 3).forEach((item, index) => {
        console.log(
          `  ${index + 1}. ${item.title} (by: ${item.uploadedBy?.firstName || "Unknown"} ${item.uploadedBy?.lastName || ""})`
        );
      });

      // Check if content is from different users
      const uniqueUploaders = new Set(
        generalMediaResponse.data.media.map(
          item => item.uploadedBy?._id || "unknown"
        )
      );
      console.log(`📊 Unique uploaders: ${uniqueUploaders.size}`);

      if (uniqueUploaders.size > 1) {
        console.log("✅ SUCCESS: Content from multiple users found!");
      } else {
        console.log("❌ ISSUE: Only content from one user found!");
      }
    }
    console.log("");

    // Test 3: Compare both endpoints
    console.log("📋 Test 3: Compare endpoints");
    const allContentCount = allContentResponse.data.total || 0;
    const generalMediaCount = generalMediaResponse.data.pagination?.total || 0;

    console.log(`📊 All Content endpoint: ${allContentCount} items`);
    console.log(`📊 General Media endpoint: ${generalMediaCount} items`);

    if (allContentCount > 0 && generalMediaCount > 0) {
      console.log("✅ Both endpoints returning content");
    } else {
      console.log("❌ One or both endpoints not returning content");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Test without authentication (should fail)
async function testWithoutAuth() {
  console.log("\n🔒 Testing without authentication...\n");

  try {
    const response = await axios.get(`${BASE_URL}/media/all-content`);
    console.log("❌ This should not succeed:", response.data);
  } catch (error) {
    console.log(
      "✅ Correctly rejected unauthenticated request:",
      error.response?.data || error.message
    );
  }
}

// Run tests
async function runTests() {
  console.log("🚀 Starting All Content Endpoint Tests\n");
  console.log("⚠️  Make sure to:");
  console.log("   1. Replace TEST_USER_TOKEN with actual user token");
  console.log("   2. Server is running on localhost:5000");
  console.log("   3. There is content from multiple users in the database\n");

  await testAllContentEndpoint();
  await testWithoutAuth();
}

runTests();

















