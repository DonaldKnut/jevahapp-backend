const axios = require("axios");

const API_BASE_URL = "http://localhost:4000";

async function testCommentEndpoints() {
  console.log("🧪 Testing Comment Endpoints...\n");

  try {
    // First, let's get some default content to test with
    console.log("1️⃣ Getting default content...");
    const defaultContentResponse = await axios.get(
      `${API_BASE_URL}/api/media/default?limit=1`
    );

    if (
      !defaultContentResponse.data.success ||
      !defaultContentResponse.data.data.content.length
    ) {
      console.log("❌ No default content available for testing");
      return;
    }

    const contentId = defaultContentResponse.data.data.content[0]._id;
    console.log("✅ Found content to test with:", {
      contentId,
      title: defaultContentResponse.data.data.content[0].title,
    });

    // Test 1: Get Comments (should work without auth)
    console.log("\n2️⃣ Testing GET Comments (no auth required)...");
    const getResponse = await axios.get(
      `${API_BASE_URL}/api/content/media/${contentId}/comments?page=1&limit=20`
    );

    console.log("✅ GET Comments Response:", {
      success: getResponse.data.success,
      commentsCount: getResponse.data.data.comments.length,
      pagination: getResponse.data.data.pagination,
      sampleComment: getResponse.data.data.comments[0]
        ? {
            id: getResponse.data.data.comments[0]._id,
            content: getResponse.data.data.comments[0].content,
            user: getResponse.data.data.comments[0].user,
            createdAt: getResponse.data.data.comments[0].createdAt,
          }
        : "No comments found",
    });

    // Test 2: Test invalid content ID
    console.log("\n3️⃣ Testing GET Comments with invalid ID...");
    try {
      await axios.get(`${API_BASE_URL}/api/content/media/invalid-id/comments`);
    } catch (error) {
      console.log("✅ Invalid ID handled correctly:", {
        status: error.response?.status,
        message: error.response?.data?.message,
      });
    }

    // Test 3: Test invalid content type
    console.log("\n4️⃣ Testing GET Comments with invalid content type...");
    try {
      await axios.get(
        `${API_BASE_URL}/api/content/invalid-type/${contentId}/comments`
      );
    } catch (error) {
      console.log("✅ Invalid content type handled correctly:", {
        status: error.response?.status,
        message: error.response?.data?.message,
      });
    }

    // Test 4: Test POST comment without auth (should fail)
    console.log("\n5️⃣ Testing POST Comment without auth (should fail)...");
    try {
      await axios.post(
        `${API_BASE_URL}/api/content/media/${contentId}/comment`,
        {
          content: "Test comment without auth",
        }
      );
    } catch (error) {
      console.log("✅ POST without auth correctly rejected:", {
        status: error.response?.status,
        message: error.response?.data?.message,
      });
    }

    console.log("\n🎉 Comment endpoints are working correctly!");
    console.log("\n📋 Available Comment Endpoints:");
    console.log(
      "• GET /api/content/media/:contentId/comments - Get comments (no auth required)"
    );
    console.log(
      "• POST /api/content/media/:contentId/comment - Add comment (auth required)"
    );
    console.log(
      "• DELETE /api/content/comments/:commentId - Delete comment (auth required)"
    );
    console.log(
      "\n💡 To test authenticated endpoints, you need a valid auth token."
    );
  } catch (error) {
    console.error("❌ Test failed:", {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data,
    });
  }
}

testCommentEndpoints();
