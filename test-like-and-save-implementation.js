/**
 * Comprehensive Test Suite for Like and Save to Library Implementation
 *
 * This test suite verifies the complete like and save functionality including:
 * - Backend API endpoints
 * - Real-time Socket.IO updates
 * - Database operations
 * - Error handling
 * - State management
 */

const axios = require("axios");
const io = require("socket.io-client");

// Configuration
const API_BASE_URL = "https://jevahapp-backend.onrender.com";
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || "your-test-token-here";
const TEST_MEDIA_ID = process.env.TEST_MEDIA_ID || "64f1a2b3c4d5e6f7g8h9i0j1";
const TEST_CONTENT_TYPE = "media";

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
};

// Utility functions
function logTest(testName, status, details = "") {
  const emoji = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  console.log(
    `${emoji} ${testName}: ${status}${details ? ` - ${details}` : ""}`
  );

  if (status === "PASS") {
    testResults.passed++;
  } else {
    testResults.failed++;
    testResults.errors.push({ test: testName, details });
  }
}

function logSection(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 ${title}`);
  console.log(`${"=".repeat(60)}`);
}

// Test 1: Backend API Endpoints
async function testBackendEndpoints() {
  logSection("Testing Backend API Endpoints");

  const headers = {
    Authorization: `Bearer ${TEST_USER_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    // Test 1.1: Toggle Like Endpoint
    console.log("\n📡 Testing Like Toggle Endpoint...");
    try {
      const likeResponse = await axios.post(
        `${API_BASE_URL}/api/content/${TEST_CONTENT_TYPE}/${TEST_MEDIA_ID}/like`,
        {},
        { headers }
      );

      if (likeResponse.status === 200 && likeResponse.data.success) {
        logTest(
          "Like Toggle API",
          "PASS",
          `Response: ${JSON.stringify(likeResponse.data.data)}`
        );
      } else {
        logTest(
          "Like Toggle API",
          "FAIL",
          `Unexpected response: ${JSON.stringify(likeResponse.data)}`
        );
      }
    } catch (error) {
      logTest(
        "Like Toggle API",
        "FAIL",
        `Error: ${error.response?.data?.message || error.message}`
      );
    }

    // Test 1.2: Toggle Bookmark Endpoint
    console.log("\n📡 Testing Bookmark Toggle Endpoint...");
    try {
      const bookmarkResponse = await axios.post(
        `${API_BASE_URL}/api/bookmark/${TEST_MEDIA_ID}/toggle`,
        {},
        { headers }
      );

      if (bookmarkResponse.status === 200 && bookmarkResponse.data.success) {
        logTest(
          "Bookmark Toggle API",
          "PASS",
          `Response: ${JSON.stringify(bookmarkResponse.data.data)}`
        );
      } else {
        logTest(
          "Bookmark Toggle API",
          "FAIL",
          `Unexpected response: ${JSON.stringify(bookmarkResponse.data)}`
        );
      }
    } catch (error) {
      logTest(
        "Bookmark Toggle API",
        "FAIL",
        `Error: ${error.response?.data?.message || error.message}`
      );
    }

    // Test 1.3: Get Bookmark Status
    console.log("\n📡 Testing Bookmark Status Endpoint...");
    try {
      const statusResponse = await axios.get(
        `${API_BASE_URL}/api/bookmark/${TEST_MEDIA_ID}/status`,
        { headers }
      );

      if (statusResponse.status === 200 && statusResponse.data.success) {
        logTest(
          "Bookmark Status API",
          "PASS",
          `Response: ${JSON.stringify(statusResponse.data.data)}`
        );
      } else {
        logTest(
          "Bookmark Status API",
          "FAIL",
          `Unexpected response: ${JSON.stringify(statusResponse.data)}`
        );
      }
    } catch (error) {
      logTest(
        "Bookmark Status API",
        "FAIL",
        `Error: ${error.response?.data?.message || error.message}`
      );
    }

    // Test 1.4: Get User Bookmarks
    console.log("\n📡 Testing User Bookmarks Endpoint...");
    try {
      const bookmarksResponse = await axios.get(
        `${API_BASE_URL}/api/bookmark/user?page=1&limit=10`,
        { headers }
      );

      if (bookmarksResponse.status === 200 && bookmarksResponse.data.success) {
        logTest(
          "User Bookmarks API",
          "PASS",
          `Found ${bookmarksResponse.data.data.bookmarks.length} bookmarks`
        );
      } else {
        logTest(
          "User Bookmarks API",
          "FAIL",
          `Unexpected response: ${JSON.stringify(bookmarksResponse.data)}`
        );
      }
    } catch (error) {
      logTest(
        "User Bookmarks API",
        "FAIL",
        `Error: ${error.response?.data?.message || error.message}`
      );
    }
  } catch (error) {
    logTest("Backend API Tests", "FAIL", `Setup error: ${error.message}`);
  }
}

// Test 2: Real-time Socket.IO Updates
async function testSocketIOUpdates() {
  logSection("Testing Real-time Socket.IO Updates");

  return new Promise(resolve => {
    const socket = io(API_BASE_URL, {
      auth: {
        token: TEST_USER_TOKEN,
      },
      transports: ["websocket", "polling"],
    });

    let likeUpdateReceived = false;
    let bookmarkUpdateReceived = false;
    let connectionEstablished = false;

    // Connection timeout
    const connectionTimeout = setTimeout(() => {
      if (!connectionEstablished) {
        logTest("Socket.IO Connection", "FAIL", "Connection timeout");
        socket.disconnect();
        resolve();
      }
    }, 10000);

    // Test 2.1: Socket Connection
    socket.on("connect", () => {
      clearTimeout(connectionTimeout);
      connectionEstablished = true;
      logTest("Socket.IO Connection", "PASS", "Connected successfully");

      // Test real-time events
      testRealTimeEvents(socket);
    });

    socket.on("connect_error", error => {
      clearTimeout(connectionTimeout);
      logTest(
        "Socket.IO Connection",
        "FAIL",
        `Connection error: ${error.message}`
      );
      resolve();
    });

    // Test 2.2: Like Update Events
    socket.on("content-like-update", data => {
      console.log("📡 Received like update:", data);
      likeUpdateReceived = true;
      logTest(
        "Like Update Event",
        "PASS",
        `Received update for ${data.contentId}`
      );
    });

    // Test 2.3: Bookmark Update Events
    socket.on("content-bookmark-update", data => {
      console.log("📡 Received bookmark update:", data);
      bookmarkUpdateReceived = true;
      logTest(
        "Bookmark Update Event",
        "PASS",
        `Received update for ${data.mediaId}`
      );
    });

    // Test completion timeout
    setTimeout(() => {
      if (!likeUpdateReceived) {
        logTest(
          "Like Update Event",
          "FAIL",
          "No like update received within timeout"
        );
      }
      if (!bookmarkUpdateReceived) {
        logTest(
          "Bookmark Update Event",
          "FAIL",
          "No bookmark update received within timeout"
        );
      }

      socket.disconnect();
      resolve();
    }, 15000);
  });
}

// Test 3: Real-time Event Triggers
async function testRealTimeEvents(socket) {
  logSection("Testing Real-time Event Triggers");

  const headers = {
    Authorization: `Bearer ${TEST_USER_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    // Trigger like event
    console.log("\n🔄 Triggering like event...");
    await axios.post(
      `${API_BASE_URL}/api/content/${TEST_CONTENT_TYPE}/${TEST_MEDIA_ID}/like`,
      {},
      { headers }
    );
    logTest("Like Event Trigger", "PASS", "Like event triggered successfully");

    // Wait a bit for real-time update
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Trigger bookmark event
    console.log("\n🔄 Triggering bookmark event...");
    await axios.post(
      `${API_BASE_URL}/api/bookmark/${TEST_MEDIA_ID}/toggle`,
      {},
      { headers }
    );
    logTest(
      "Bookmark Event Trigger",
      "PASS",
      "Bookmark event triggered successfully"
    );
  } catch (error) {
    logTest(
      "Real-time Event Triggers",
      "FAIL",
      `Error: ${error.response?.data?.message || error.message}`
    );
  }
}

// Test 4: Error Handling
async function testErrorHandling() {
  logSection("Testing Error Handling");

  const headers = {
    Authorization: `Bearer ${TEST_USER_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    // Test 4.1: Invalid Content ID
    console.log("\n🚫 Testing invalid content ID...");
    try {
      await axios.post(
        `${API_BASE_URL}/api/content/${TEST_CONTENT_TYPE}/invalid-id/like`,
        {},
        { headers }
      );
      logTest("Invalid Content ID", "FAIL", "Should have returned error");
    } catch (error) {
      if (error.response?.status === 400) {
        logTest("Invalid Content ID", "PASS", "Correctly returned 400 error");
      } else {
        logTest(
          "Invalid Content ID",
          "FAIL",
          `Unexpected error: ${error.response?.status}`
        );
      }
    }

    // Test 4.2: Invalid Content Type
    console.log("\n🚫 Testing invalid content type...");
    try {
      await axios.post(
        `${API_BASE_URL}/api/content/invalid-type/${TEST_MEDIA_ID}/like`,
        {},
        { headers }
      );
      logTest("Invalid Content Type", "FAIL", "Should have returned error");
    } catch (error) {
      if (error.response?.status === 400) {
        logTest("Invalid Content Type", "PASS", "Correctly returned 400 error");
      } else {
        logTest(
          "Invalid Content Type",
          "FAIL",
          `Unexpected error: ${error.response?.status}`
        );
      }
    }

    // Test 4.3: Unauthorized Request
    console.log("\n🚫 Testing unauthorized request...");
    try {
      await axios.post(
        `${API_BASE_URL}/api/content/${TEST_CONTENT_TYPE}/${TEST_MEDIA_ID}/like`,
        {},
        { headers: { "Content-Type": "application/json" } } // No auth token
      );
      logTest("Unauthorized Request", "FAIL", "Should have returned 401 error");
    } catch (error) {
      if (error.response?.status === 401) {
        logTest("Unauthorized Request", "PASS", "Correctly returned 401 error");
      } else {
        logTest(
          "Unauthorized Request",
          "FAIL",
          `Unexpected error: ${error.response?.status}`
        );
      }
    }
  } catch (error) {
    logTest("Error Handling Tests", "FAIL", `Setup error: ${error.message}`);
  }
}

// Test 5: Performance Testing
async function testPerformance() {
  logSection("Testing Performance");

  const headers = {
    Authorization: `Bearer ${TEST_USER_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    // Test 5.1: Multiple Like Requests
    console.log("\n⚡ Testing multiple like requests...");
    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(
        axios.post(
          `${API_BASE_URL}/api/content/${TEST_CONTENT_TYPE}/${TEST_MEDIA_ID}/like`,
          {},
          { headers }
        )
      );
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    if (duration < 5000) {
      logTest("Multiple Like Requests", "PASS", `Completed in ${duration}ms`);
    } else {
      logTest("Multiple Like Requests", "FAIL", `Too slow: ${duration}ms`);
    }

    // Test 5.2: Multiple Bookmark Requests
    console.log("\n⚡ Testing multiple bookmark requests...");
    const bookmarkStartTime = Date.now();
    const bookmarkPromises = [];

    for (let i = 0; i < 3; i++) {
      bookmarkPromises.push(
        axios.post(
          `${API_BASE_URL}/api/bookmark/${TEST_MEDIA_ID}/toggle`,
          {},
          { headers }
        )
      );
    }

    await Promise.all(bookmarkPromises);
    const bookmarkEndTime = Date.now();
    const bookmarkDuration = bookmarkEndTime - bookmarkStartTime;

    if (bookmarkDuration < 3000) {
      logTest(
        "Multiple Bookmark Requests",
        "PASS",
        `Completed in ${bookmarkDuration}ms`
      );
    } else {
      logTest(
        "Multiple Bookmark Requests",
        "FAIL",
        `Too slow: ${bookmarkDuration}ms`
      );
    }
  } catch (error) {
    logTest(
      "Performance Tests",
      "FAIL",
      `Error: ${error.response?.data?.message || error.message}`
    );
  }
}

// Test 6: Database Consistency
async function testDatabaseConsistency() {
  logSection("Testing Database Consistency");

  const headers = {
    Authorization: `Bearer ${TEST_USER_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    // Test 6.1: Like Count Consistency
    console.log("\n🗄️ Testing like count consistency...");

    // Get initial like count
    const initialLikeResponse = await axios.post(
      `${API_BASE_URL}/api/content/${TEST_CONTENT_TYPE}/${TEST_MEDIA_ID}/like`,
      {},
      { headers }
    );
    const initialLikeCount = initialLikeResponse.data.data.likeCount;

    // Toggle like
    const toggleLikeResponse = await axios.post(
      `${API_BASE_URL}/api/content/${TEST_CONTENT_TYPE}/${TEST_MEDIA_ID}/like`,
      {},
      { headers }
    );
    const newLikeCount = toggleLikeResponse.data.data.likeCount;

    // Verify count changed correctly
    const expectedCount = initialLikeResponse.data.data.liked
      ? initialLikeCount - 1
      : initialLikeCount + 1;

    if (newLikeCount === expectedCount) {
      logTest(
        "Like Count Consistency",
        "PASS",
        `Count changed from ${initialLikeCount} to ${newLikeCount}`
      );
    } else {
      logTest(
        "Like Count Consistency",
        "FAIL",
        `Expected ${expectedCount}, got ${newLikeCount}`
      );
    }

    // Test 6.2: Bookmark Count Consistency
    console.log("\n🗄️ Testing bookmark count consistency...");

    // Get initial bookmark count
    const initialBookmarkResponse = await axios.post(
      `${API_BASE_URL}/api/bookmark/${TEST_MEDIA_ID}/toggle`,
      {},
      { headers }
    );
    const initialBookmarkCount =
      initialBookmarkResponse.data.data.bookmarkCount;

    // Toggle bookmark
    const toggleBookmarkResponse = await axios.post(
      `${API_BASE_URL}/api/bookmark/${TEST_MEDIA_ID}/toggle`,
      {},
      { headers }
    );
    const newBookmarkCount = toggleBookmarkResponse.data.data.bookmarkCount;

    // Verify count changed correctly
    const expectedBookmarkCount = initialBookmarkResponse.data.data.bookmarked
      ? initialBookmarkCount - 1
      : initialBookmarkCount + 1;

    if (newBookmarkCount === expectedBookmarkCount) {
      logTest(
        "Bookmark Count Consistency",
        "PASS",
        `Count changed from ${initialBookmarkCount} to ${newBookmarkCount}`
      );
    } else {
      logTest(
        "Bookmark Count Consistency",
        "FAIL",
        `Expected ${expectedBookmarkCount}, got ${newBookmarkCount}`
      );
    }
  } catch (error) {
    logTest(
      "Database Consistency Tests",
      "FAIL",
      `Error: ${error.response?.data?.message || error.message}`
    );
  }
}

// Main test runner
async function runAllTests() {
  console.log("🚀 Starting Comprehensive Like and Save Implementation Tests");
  console.log(`📡 API Base URL: ${API_BASE_URL}`);
  console.log(`🔑 Using test token: ${TEST_USER_TOKEN.substring(0, 20)}...`);
  console.log(`📱 Testing with media ID: ${TEST_MEDIA_ID}`);

  const startTime = Date.now();

  try {
    // Run all test suites
    await testBackendEndpoints();
    await testSocketIOUpdates();
    await testErrorHandling();
    await testPerformance();
    await testDatabaseConsistency();
  } catch (error) {
    console.error("❌ Test suite error:", error);
  }

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  // Print final results
  logSection("Test Results Summary");
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏱️ Total Duration: ${totalDuration}ms`);
  console.log(
    `📊 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`
  );

  if (testResults.errors.length > 0) {
    console.log("\n🚨 Failed Tests:");
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.details}`);
    });
  }

  console.log("\n🎯 Test Suite Complete!");

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error("❌ Fatal test error:", error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testBackendEndpoints,
  testSocketIOUpdates,
  testErrorHandling,
  testPerformance,
  testDatabaseConsistency,
};

