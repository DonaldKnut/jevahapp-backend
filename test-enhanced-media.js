const axios = require("axios");

const BASE_URL = "http://localhost:4000";

const testServerConnectivity = async () => {
  console.log("🌐 Testing server connectivity...");

  try {
    // Test basic server response
    const response = await axios.get(`${BASE_URL}/`, { timeout: 10000 });
    console.log("✅ Server is accessible");
    console.log(`   Status: ${response.status}`);
    return true;
  } catch (error) {
    console.log("❌ Server connectivity failed:", error.message);
    return false;
  }
};

const testExistingEndpoints = async () => {
  console.log("\n🔍 Testing existing endpoints...");

  const endpoints = [
    "/api/health",
    "/api/media",
    "/api/media/public",
    "/api/auth/login",
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔗 Testing ${endpoint}...`);
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        timeout: 5000,
      });
      console.log(`   ✅ ${endpoint} - Status: ${response.status}`);
    } catch (error) {
      console.log(
        `   ❌ ${endpoint} - ${error.response?.status || error.message}`
      );
    }
  }
};

const testEnhancedEndpoints = async () => {
  console.log("\n🚀 Testing enhanced endpoints...");

  const enhancedEndpoints = [
    "/api/media/all-content",
    "/api/media/public/all-content",
  ];

  for (const endpoint of enhancedEndpoints) {
    try {
      console.log(`🔗 Testing ${endpoint}...`);
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        timeout: 5000,
      });
      console.log(`   ✅ ${endpoint} - Status: ${response.status}`);

      if (response.data && response.data.success) {
        console.log(
          `   📊 Data: ${JSON.stringify(response.data).substring(0, 200)}...`
        );
      }
    } catch (error) {
      console.log(
        `   ❌ ${endpoint} - ${error.response?.status || error.message}`
      );
      if (error.response?.data) {
        console.log(
          `   📝 Error details: ${JSON.stringify(error.response.data).substring(0, 200)}...`
        );
      }
    }
  }
};

const testViewTrackingEndpoint = async () => {
  console.log("\n👁️  Testing view tracking endpoint...");

  try {
    // Test with a dummy media ID
    const response = await axios.post(
      `${BASE_URL}/api/media/track-view`,
      {
        mediaId: "507f1f77bcf86cd799439011",
        duration: 45,
        isComplete: false,
      },
      { timeout: 5000 }
    );

    console.log(`   ✅ View tracking - Status: ${response.status}`);
  } catch (error) {
    console.log(
      `   ❌ View tracking - ${error.response?.status || error.message}`
    );
    if (error.response?.data) {
      console.log(
        `   📝 Error details: ${JSON.stringify(error.response.data).substring(0, 200)}...`
      );
    }
  }
};

const runTests = async () => {
  console.log("🚀 Testing Enhanced Media API...\n");

  // Test basic connectivity
  const serverAccessible = await testServerConnectivity();

  if (serverAccessible) {
    // Test existing endpoints
    await testExistingEndpoints();

    // Test enhanced endpoints
    await testEnhancedEndpoints();

    // Test view tracking
    await testViewTrackingEndpoint();
  }

  console.log("\n✅ All tests completed!");
};

runTests().catch(error => {
  console.error("💥 Test error:", error.message);
});


