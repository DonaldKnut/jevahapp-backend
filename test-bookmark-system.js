const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:5000/api";
const TEST_USER_TOKEN = "your_test_user_token_here"; // Replace with actual token

// Test data
const TEST_MEDIA_ID = "68b6c565a65fe359311eaf79"; // Replace with actual media ID

const headers = {
  Authorization: `Bearer ${TEST_USER_TOKEN}`,
  "Content-Type": "application/json",
};

async function testBookmarkSystem() {
  console.log("🧪 Testing Bookmark System...\n");

  try {
    // Test 1: Get initial bookmarks (should be empty for new user)
    console.log("📋 Test 1: Get initial bookmarks");
    const initialBookmarks = await axios.get(
      `${BASE_URL}/bookmarks/get-bookmarked-media`,
      { headers }
    );
    console.log("✅ Initial bookmarks:", initialBookmarks.data);
    console.log("📊 Count:", initialBookmarks.data.data?.media?.length || 0);
    console.log("");

    // Test 2: Add bookmark
    console.log("📋 Test 2: Add bookmark");
    const addBookmark = await axios.post(
      `${BASE_URL}/bookmarks/${TEST_MEDIA_ID}`,
      {},
      { headers }
    );
    console.log("✅ Add bookmark response:", addBookmark.data);
    console.log("");

    // Test 3: Try to add same bookmark again (should fail)
    console.log("📋 Test 3: Try to add same bookmark again");
    try {
      const duplicateBookmark = await axios.post(
        `${BASE_URL}/bookmarks/${TEST_MEDIA_ID}`,
        {},
        { headers }
      );
      console.log("❌ This should not succeed:", duplicateBookmark.data);
    } catch (error) {
      console.log(
        "✅ Correctly rejected duplicate:",
        error.response?.data || error.message
      );
    }
    console.log("");

    // Test 4: Get bookmarks after adding (should show the bookmarked item)
    console.log("📋 Test 4: Get bookmarks after adding");
    const afterBookmarks = await axios.get(
      `${BASE_URL}/bookmarks/get-bookmarked-media`,
      { headers }
    );
    console.log("✅ Bookmarks after adding:", afterBookmarks.data);
    console.log("📊 Count:", afterBookmarks.data.data?.media?.length || 0);

    // Verify the bookmarked item has correct properties
    if (afterBookmarks.data.data?.media?.length > 0) {
      const bookmarkedItem = afterBookmarks.data.data.media[0];
      console.log("🔍 Bookmarked item properties:");
      console.log("  - isInLibrary:", bookmarkedItem.isInLibrary);
      console.log("  - isDefaultContent:", bookmarkedItem.isDefaultContent);
      console.log(
        "  - isOnboardingContent:",
        bookmarkedItem.isOnboardingContent
      );
      console.log("  - bookmarkedBy:", bookmarkedItem.bookmarkedBy);
      console.log("  - bookmarkedAt:", bookmarkedItem.bookmarkedAt);
    }
    console.log("");

    // Test 5: Remove bookmark
    console.log("📋 Test 5: Remove bookmark");
    const removeBookmark = await axios.delete(
      `${BASE_URL}/bookmarks/${TEST_MEDIA_ID}`,
      { headers }
    );
    console.log("✅ Remove bookmark response:", removeBookmark.data);
    console.log("");

    // Test 6: Get bookmarks after removing (should be empty again)
    console.log("📋 Test 6: Get bookmarks after removing");
    const finalBookmarks = await axios.get(
      `${BASE_URL}/bookmarks/get-bookmarked-media`,
      { headers }
    );
    console.log("✅ Final bookmarks:", finalBookmarks.data);
    console.log("📊 Count:", finalBookmarks.data.data?.media?.length || 0);
    console.log("");

    // Test 7: Try to remove non-existent bookmark (should fail)
    console.log("📋 Test 7: Try to remove non-existent bookmark");
    try {
      const removeNonExistent = await axios.delete(
        `${BASE_URL}/bookmarks/${TEST_MEDIA_ID}`,
        { headers }
      );
      console.log("❌ This should not succeed:", removeNonExistent.data);
    } catch (error) {
      console.log(
        "✅ Correctly rejected non-existent bookmark:",
        error.response?.data || error.message
      );
    }
    console.log("");

    console.log("🎉 All bookmark tests completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Test without authentication (should fail)
async function testWithoutAuth() {
  console.log("\n🔒 Testing without authentication...\n");

  try {
    const response = await axios.get(
      `${BASE_URL}/bookmarks/get-bookmarked-media`
    );
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
  console.log("🚀 Starting Bookmark System Tests\n");
  console.log("⚠️  Make sure to:");
  console.log("   1. Replace TEST_USER_TOKEN with actual user token");
  console.log("   2. Replace TEST_MEDIA_ID with actual media ID");
  console.log("   3. Server is running on localhost:5000");
  console.log("   4. User is authenticated\n");

  await testBookmarkSystem();
  await testWithoutAuth();
}

runTests();
