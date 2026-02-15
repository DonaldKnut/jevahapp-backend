const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:4000";
const TEST_TOKEN = process.env.TEST_TOKEN || "your-test-token-here";

// Test data
const testCases = [
  {
    name: "Valid media like",
    contentType: "media",
    contentId: "507f1f77bcf86cd799439011", // Valid ObjectId format
    expectedStatus: 200,
  },
  {
    name: "Valid devotional like",
    contentType: "devotional",
    contentId: "507f1f77bcf86cd799439012",
    expectedStatus: 200,
  },
  {
    name: "Invalid content ID format",
    contentType: "media",
    contentId: "invalid-id",
    expectedStatus: 400,
  },
  {
    name: "Invalid content type",
    contentType: "invalid-type",
    contentId: "507f1f77bcf86cd799439011",
    expectedStatus: 400,
  },
  {
    name: "Missing content ID",
    contentType: "media",
    contentId: "",
    expectedStatus: 400,
  },
  {
    name: "Missing content type",
    contentType: "",
    contentId: "507f1f77bcf86cd799439011",
    expectedStatus: 400,
  },
  {
    name: "Non-existent content",
    contentType: "media",
    contentId: "507f1f77bcf86cd799439999", // Non-existent ID
    expectedStatus: 404,
  },
];

async function testLikeEndpoint() {
  console.log("🧪 Testing Like Endpoint Fixes...\n");

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    console.log(`   Content Type: ${testCase.contentType}`);
    console.log(`   Content ID: ${testCase.contentId}`);
    console.log(`   Expected Status: ${testCase.expectedStatus}`);

    try {
      const response = await axios.post(
        `${BASE_URL}/api/content/${testCase.contentType}/${testCase.contentId}/like`,
        {},
        {
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
            "Content-Type": "application/json",
          },
          validateStatus: () => true, // Don't throw on any status code
        }
      );

      console.log(`   Actual Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));

      if (response.status === testCase.expectedStatus) {
        console.log(`   ✅ PASSED\n`);
        passedTests++;
      } else {
        console.log(
          `   ❌ FAILED - Expected ${testCase.expectedStatus}, got ${response.status}\n`
        );
        failedTests++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
      failedTests++;
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("📊 Test Results:");
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(
    `   📈 Success Rate: ${Math.round((passedTests / (passedTests + failedTests)) * 100)}%`
  );

  if (failedTests === 0) {
    console.log(
      "\n🎉 All tests passed! The like endpoint is working correctly."
    );
  } else {
    console.log("\n⚠️  Some tests failed. Check the logs above for details.");
  }
}

// Test authentication
async function testAuthentication() {
  console.log("🔐 Testing Authentication...\n");

  try {
    // Test without token
    console.log("Testing without authentication token...");
    const noAuthResponse = await axios.post(
      `${BASE_URL}/api/content/media/507f1f77bcf86cd799439011/like`,
      {},
      {
        validateStatus: () => true,
      }
    );

    console.log(`Status: ${noAuthResponse.status}`);
    console.log(`Response:`, JSON.stringify(noAuthResponse.data, null, 2));

    if (noAuthResponse.status === 401) {
      console.log("✅ Authentication properly required\n");
    } else {
      console.log("❌ Authentication not properly enforced\n");
    }
  } catch (error) {
    console.log(`❌ Authentication test error: ${error.message}\n`);
  }
}

// Test rate limiting
async function testRateLimiting() {
  console.log("⏱️  Testing Rate Limiting...\n");

  try {
    const requests = [];
    const requestCount = 15; // More than the 10 requests per minute limit

    console.log(`Sending ${requestCount} rapid requests...`);

    for (let i = 0; i < requestCount; i++) {
      requests.push(
        axios.post(
          `${BASE_URL}/api/content/media/507f1f77bcf86cd799439011/like`,
          {},
          {
            headers: {
              Authorization: `Bearer ${TEST_TOKEN}`,
              "Content-Type": "application/json",
            },
            validateStatus: () => true,
          }
        )
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status === 429);

    console.log(`Total requests: ${requestCount}`);
    console.log(`Rate limited responses: ${rateLimitedResponses.length}`);

    if (rateLimitedResponses.length > 0) {
      console.log("✅ Rate limiting is working\n");
    } else {
      console.log("⚠️  Rate limiting may not be working\n");
    }
  } catch (error) {
    console.log(`❌ Rate limiting test error: ${error.message}\n`);
  }
}

// Main test function
async function runAllTests() {
  console.log("🚀 Starting Like Endpoint Tests\n");
  console.log(`Server: ${BASE_URL}`);
  console.log(`Token: ${TEST_TOKEN ? "Provided" : "Missing"}\n`);

  // Check if server is running
  try {
    const healthCheck = await axios.get(`${BASE_URL}/`);
    console.log("✅ Server is running\n");
  } catch (error) {
    console.log("❌ Server is not running or not accessible");
    console.log("Please start the server with: npm run dev\n");
    return;
  }

  await testAuthentication();
  await testLikeEndpoint();
  await testRateLimiting();

  console.log("🏁 All tests completed!");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testLikeEndpoint, testAuthentication, testRateLimiting };
