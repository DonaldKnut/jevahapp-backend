#!/usr/bin/env node

/**
 * Comprehensive test script for all interaction systems
 * Tests likes, shares, comments, and reactions across all content types
 */

const axios = require("axios");

const BASE_URL = process.env.API_URL || "http://localhost:3000/api";
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || "your-test-token-here";

// Test data
const testMediaId = "507f1f77bcf86cd799439011"; // Replace with actual media ID
const testDevotionalId = "507f1f77bcf86cd799439012"; // Replace with actual devotional ID

const headers = {
  Authorization: `Bearer ${TEST_USER_TOKEN}`,
  "Content-Type": "application/json",
};

async function testAllInteractions() {
  console.log("🧪 Testing All Interaction Systems\n");

  try {
    // =============================================================================
    // TEST 1: LIKE SYSTEM
    // =============================================================================
    console.log("1. Testing Like System");
    console.log("   a. New unified like system...");

    // Test new unified like system
    const likeResponse = await axios.post(
      `${BASE_URL}/content/media/${testMediaId}/like`,
      {},
      { headers }
    );
    console.log("   ✅ New like system works:", likeResponse.data.message);

    // Test legacy media like (should redirect)
    console.log("   b. Legacy media like (should redirect)...");
    const legacyLikeResponse = await axios.post(
      `${BASE_URL}/media/${testMediaId}/favorite`,
      { actionType: "favorite" },
      { headers }
    );
    console.log(
      "   ✅ Legacy like redirects:",
      legacyLikeResponse.data.message
    );

    // =============================================================================
    // TEST 2: SHARE SYSTEM
    // =============================================================================
    console.log("\n2. Testing Share System");
    console.log("   a. New unified share system...");

    // Test new unified share system
    const shareResponse = await axios.post(
      `${BASE_URL}/content/media/${testMediaId}/share`,
      { platform: "twitter", message: "Check this out!" },
      { headers }
    );
    console.log("   ✅ New share system works:", shareResponse.data.message);

    // Test legacy media share (should redirect)
    console.log("   b. Legacy media share (should redirect)...");
    const legacyShareResponse = await axios.post(
      `${BASE_URL}/media/${testMediaId}/share`,
      { platform: "facebook" },
      { headers }
    );
    console.log(
      "   ✅ Legacy share redirects:",
      legacyShareResponse.data.message
    );

    // =============================================================================
    // TEST 3: COMMENT SYSTEM
    // =============================================================================
    console.log("\n3. Testing Comment System");
    console.log("   a. Add comment to media...");

    const mediaCommentResponse = await axios.post(
      `${BASE_URL}/content/media/${testMediaId}/comment`,
      { content: "This is a test comment for media" },
      { headers }
    );
    console.log(
      "   ✅ Media comment added:",
      mediaCommentResponse.data.message
    );
    const mediaCommentId = mediaCommentResponse.data.data._id;

    console.log("   b. Add comment to devotional...");
    const devotionalCommentResponse = await axios.post(
      `${BASE_URL}/content/devotional/${testDevotionalId}/comment`,
      { content: "This is a test comment for devotional" },
      { headers }
    );
    console.log(
      "   ✅ Devotional comment added:",
      devotionalCommentResponse.data.message
    );
    const devotionalCommentId = devotionalCommentResponse.data.data._id;

    console.log("   c. Get comments for media...");
    const getMediaCommentsResponse = await axios.get(
      `${BASE_URL}/content/media/${testMediaId}/comments?page=1&limit=10`
    );
    console.log(
      "   ✅ Media comments retrieved:",
      getMediaCommentsResponse.data.data.comments.length,
      "comments"
    );

    console.log("   d. Get comments for devotional...");
    const getDevotionalCommentsResponse = await axios.get(
      `${BASE_URL}/content/devotional/${testDevotionalId}/comments?page=1&limit=10`
    );
    console.log(
      "   ✅ Devotional comments retrieved:",
      getDevotionalCommentsResponse.data.data.comments.length,
      "comments"
    );

    // =============================================================================
    // TEST 4: COMMENT REACTIONS
    // =============================================================================
    console.log("\n4. Testing Comment Reactions");
    console.log("   a. Add reaction to comment...");

    const reactionResponse = await axios.post(
      `${BASE_URL}/interactions/comments/${mediaCommentId}/reaction`,
      { reactionType: "heart" },
      { headers }
    );
    console.log("   ✅ Comment reaction added:", reactionResponse.data.message);

    // =============================================================================
    // TEST 5: COMMENT REMOVAL
    // =============================================================================
    console.log("\n5. Testing Comment Removal");
    console.log("   a. Remove comment via new system...");

    const removeCommentResponse = await axios.delete(
      `${BASE_URL}/content/comments/${mediaCommentId}`,
      { headers }
    );
    console.log(
      "   ✅ Comment removed via new system:",
      removeCommentResponse.data.message
    );

    console.log("   b. Remove comment via legacy system...");
    const legacyRemoveResponse = await axios.delete(
      `${BASE_URL}/interactions/comments/${devotionalCommentId}`,
      { headers }
    );
    console.log(
      "   ✅ Comment removed via legacy system:",
      legacyRemoveResponse.data.message
    );

    // =============================================================================
    // TEST 6: CONTENT METADATA
    // =============================================================================
    console.log("\n6. Testing Content Metadata");
    console.log("   a. Get media metadata...");

    const mediaMetadataResponse = await axios.get(
      `${BASE_URL}/content/media/${testMediaId}/metadata`
    );
    console.log(
      "   ✅ Media metadata retrieved:",
      mediaMetadataResponse.data.success
    );

    console.log("   b. Get devotional metadata...");
    const devotionalMetadataResponse = await axios.get(
      `${BASE_URL}/content/devotional/${testDevotionalId}/metadata`
    );
    console.log(
      "   ✅ Devotional metadata retrieved:",
      devotionalMetadataResponse.data.success
    );

    // =============================================================================
    // TEST 7: SHARE URLS AND STATS
    // =============================================================================
    console.log("\n7. Testing Share URLs and Stats");
    console.log("   a. Get share URLs...");

    const shareUrlsResponse = await axios.get(
      `${BASE_URL}/interactions/media/${testMediaId}/share-urls`
    );
    console.log("   ✅ Share URLs retrieved:", shareUrlsResponse.data.success);

    console.log("   b. Get share stats...");
    const shareStatsResponse = await axios.get(
      `${BASE_URL}/interactions/media/${testMediaId}/share-stats`
    );
    console.log(
      "   ✅ Share stats retrieved:",
      shareStatsResponse.data.success
    );

    // =============================================================================
    // SUMMARY
    // =============================================================================
    console.log("\n🎉 All interaction system tests passed!");
    console.log("\n📋 Summary:");
    console.log("   ✅ Unified like system working");
    console.log("   ✅ Legacy like redirects working");
    console.log("   ✅ Unified share system working");
    console.log("   ✅ Legacy share redirects working");
    console.log("   ✅ Comment system working (media & devotional)");
    console.log("   ✅ Comment reactions working");
    console.log("   ✅ Comment removal working (both systems)");
    console.log("   ✅ Content metadata working");
    console.log("   ✅ Share URLs and stats working");
    console.log("\n🚀 All interaction systems are clean and unified!");
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testAllInteractions();
}

module.exports = { testAllInteractions };
