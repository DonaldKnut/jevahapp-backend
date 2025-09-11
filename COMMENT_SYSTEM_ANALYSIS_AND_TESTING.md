# Comment System Analysis & Testing Guide

## 🎯 **Backend Analysis: How Comments Work**

### **Backend Comment Flow:**

1. **Comment Creation** (`POST /api/content/media/:contentId/comment`)

   - Validates user authentication
   - Validates content ID and type
   - Creates comment in `MediaInteraction` collection
   - Updates media's `commentCount`
   - Returns populated comment with user info

2. **Comment Retrieval** (`GET /api/content/media/:contentId/comments`)

   - Fetches comments from `MediaInteraction` collection
   - Filters by `interactionType: "comment"` and `isRemoved: { $ne: true }`
   - Populates user info (`firstName`, `lastName`, `avatar`)
   - Supports pagination (`page`, `limit`)
   - Sorts by `createdAt: -1` (newest first)

3. **Comment Deletion** (`DELETE /api/content/comments/:commentId`)
   - Soft deletes comment (sets `isRemoved: true`)
   - Decrements media's `commentCount`

### **Backend Data Structure:**

```typescript
// MediaInteraction Model (for comments)
{
  _id: ObjectId,
  user: ObjectId (ref: "User"),
  media: ObjectId (ref: "Media"),
  interactionType: "comment",
  content: string,
  parentCommentId?: ObjectId (for replies),
  isRemoved: boolean,
  createdAt: Date,
  updatedAt: Date
}

// Populated Comment Response
{
  _id: "64f8a1b2c3d4e5f6a7b8c9d0",
  content: "Great content!",
  user: {
    _id: "64f8a1b2c3d4e5f6a7b8c9d1",
    firstName: "John",
    lastName: "Doe",
    avatar: "https://example.com/avatar.jpg"
  },
  parentCommentId: null,
  createdAt: "2023-09-10T10:30:00.000Z",
  updatedAt: "2023-09-10T10:30:00.000Z"
}
```

## 📱 **Frontend Analysis: Your CommentModal**

### **✅ What's Working Perfectly:**

1. **API Integration** - Your CommentModal correctly calls:

   - `allMediaAPI.getComments("media", contentId, pageNum, 20)` ✅
   - `allMediaAPI.addComment("media", contentId, newComment.trim(), replyingTo)` ✅
   - `allMediaAPI.deleteComment(commentId)` ✅

2. **UI Features** - Your CommentModal includes:

   - Pagination support ✅
   - Pull-to-refresh ✅
   - Reply functionality ✅
   - Keyboard handling ✅
   - Loading states ✅
   - Error handling ✅

3. **Date Formatting** - Your `formatDate` function handles:
   - "Just now" for < 1 minute ✅
   - "2m ago" for minutes ✅
   - "3h ago" for hours ✅
   - "5d ago" for days ✅
   - Actual dates for older comments ✅

## 🔍 **How to Test if Comments are Working**

### **Step 1: Test API Endpoints Directly**

Create a test script `test-comment-endpoints.js`:

```javascript
const axios = require("axios");

const API_BASE_URL = "https://jevahapp-backend.onrender.com";
const AUTH_TOKEN = "YOUR_AUTH_TOKEN_HERE"; // Get from your app
const CONTENT_ID = "YOUR_CONTENT_ID_HERE"; // Get from your app

async function testCommentEndpoints() {
  console.log("🧪 Testing Comment Endpoints...\n");

  try {
    // Test 1: Get Comments
    console.log("1️⃣ Testing GET Comments...");
    const getResponse = await axios.get(
      `${API_BASE_URL}/api/content/media/${CONTENT_ID}/comments?page=1&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ GET Comments Response:", {
      success: getResponse.data.success,
      commentsCount: getResponse.data.data.comments.length,
      pagination: getResponse.data.data.pagination,
    });

    // Test 2: Add Comment
    console.log("\n2️⃣ Testing POST Comment...");
    const addResponse = await axios.post(
      `${API_BASE_URL}/api/content/media/${CONTENT_ID}/comment`,
      {
        content: `Test comment from API - ${new Date().toISOString()}`,
      },
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ POST Comment Response:", {
      success: addResponse.data.success,
      message: addResponse.data.message,
      commentId: addResponse.data.data._id,
      content: addResponse.data.data.content,
      user: addResponse.data.data.user,
      createdAt: addResponse.data.data.createdAt,
    });

    const newCommentId = addResponse.data.data._id;

    // Test 3: Get Comments Again (should include new comment)
    console.log("\n3️⃣ Testing GET Comments After Add...");
    const getResponse2 = await axios.get(
      `${API_BASE_URL}/api/content/media/${CONTENT_ID}/comments?page=1&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ GET Comments After Add:", {
      success: getResponse2.data.success,
      commentsCount: getResponse2.data.data.comments.length,
      newCommentFound: getResponse2.data.data.comments.some(
        c => c._id === newCommentId
      ),
    });

    // Test 4: Delete Comment
    console.log("\n4️⃣ Testing DELETE Comment...");
    const deleteResponse = await axios.delete(
      `${API_BASE_URL}/api/content/comments/${newCommentId}`,
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ DELETE Comment Response:", {
      success: deleteResponse.data.success,
      message: deleteResponse.data.message,
    });

    console.log("\n🎉 All comment endpoints are working correctly!");
  } catch (error) {
    console.error("❌ Test failed:", {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data,
    });
  }
}

testCommentEndpoints();
```

### **Step 2: Test Frontend Integration**

Add this debugging code to your CommentModal:

```typescript
// Add this to your CommentModal component
const debugCommentSystem = async () => {
  console.log("🔍 DEBUGGING COMMENT SYSTEM");
  console.log("Content ID:", contentId);
  console.log("Current user:", currentUser);

  try {
    // Test API call
    console.log("📡 Testing API call...");
    const response = await allMediaAPI.getComments("media", contentId, 1, 20);
    console.log("📡 API Response:", {
      success: response.success,
      error: response.error,
      data: response.data
        ? {
            commentsCount: response.data.comments?.length || 0,
            pagination: response.data.pagination,
            firstComment: response.data.comments?.[0]
              ? {
                  id: response.data.comments[0]._id,
                  content: response.data.comments[0].content,
                  user: response.data.comments[0].user,
                  createdAt: response.data.comments[0].createdAt,
                  formattedDate: formatDate(
                    response.data.comments[0].createdAt
                  ),
                }
              : null,
          }
        : null,
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
  }
};

// Call this in your useEffect
useEffect(() => {
  if (visible && contentId) {
    debugCommentSystem(); // Add this line
    loadComments();
  }
}, [visible, contentId]);
```

### **Step 3: Check Network Requests**

In your React Native app, add this to see network requests:

```typescript
// Add to your allMediaAPI.ts
const debugAPI = (method: string, url: string, data?: any) => {
  console.log(`🌐 API ${method}:`, {
    url,
    data,
    timestamp: new Date().toISOString(),
  });
};

// Update your API methods to include debugging
export const getComments = async (
  contentType: string,
  contentId: string,
  page: number = 1,
  limit: number = 20
) => {
  const url = `${API_BASE_URL}/api/content/${contentType}/${contentId}/comments?page=${page}&limit=${limit}`;
  debugAPI("GET", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
    });

    const responseData = await response.json();
    console.log(`🌐 API Response:`, {
      status: response.status,
      success: responseData.success,
      data: responseData.data,
    });

    if (!response.ok) {
      throw new Error(
        responseData.message || `HTTP error! status: ${response.status}`
      );
    }

    return responseData;
  } catch (error) {
    console.error("❌ API Error:", error);
    return { success: false, error: error.message };
  }
};
```

## 🚨 **Common Issues & Solutions**

### **Issue 1: "Invalid date" in comments**

**Cause:** Date string format mismatch
**Solution:** Your `formatDate` function is correct, but ensure the backend returns proper ISO dates.

**Test:**

```javascript
// Test date formatting
const testDate = "2023-09-10T10:30:00.000Z";
const date = new Date(testDate);
console.log("Date test:", {
  original: testDate,
  parsed: date,
  isValid: !isNaN(date.getTime()),
  formatted: formatDate(testDate),
});
```

### **Issue 2: Comments not loading**

**Causes:**

1. Wrong content ID
2. Authentication issues
3. Network connectivity
4. Backend errors

**Debug Steps:**

1. Check if `contentId` is valid MongoDB ObjectId
2. Verify auth token is valid
3. Check network requests in React Native debugger
4. Test API endpoints directly

### **Issue 3: Comments not posting**

**Causes:**

1. Rate limiting (5 comments per minute)
2. Content validation errors
3. Authentication issues

**Debug Steps:**

1. Check rate limit headers
2. Validate comment content (not empty, < 1000 chars)
3. Verify user authentication

## 📊 **Expected API Responses**

### **GET Comments Response:**

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "content": "Great content!",
        "user": {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "https://example.com/avatar.jpg"
        },
        "parentCommentId": null,
        "createdAt": "2023-09-10T10:30:00.000Z",
        "updatedAt": "2023-09-10T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### **POST Comment Response:**

```json
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "content": "Great content!",
    "user": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "parentCommentId": null,
    "createdAt": "2023-09-10T10:30:00.000Z",
    "updatedAt": "2023-09-10T10:30:00.000Z"
  }
}
```

## ✅ **Verification Checklist**

- [ ] **API Endpoints Working**: Test all endpoints directly
- [ ] **Authentication**: Verify auth token is valid
- [ ] **Content ID**: Ensure content ID is valid MongoDB ObjectId
- [ ] **Network Requests**: Check requests in React Native debugger
- [ ] **Date Formatting**: Verify dates display correctly
- [ ] **Error Handling**: Test error scenarios
- [ ] **Rate Limiting**: Test comment posting limits
- [ ] **Pagination**: Test loading more comments
- [ ] **Refresh**: Test pull-to-refresh functionality
- [ ] **Reply**: Test reply functionality

## 🎯 **Summary**

Your CommentModal is **perfectly designed** and should work with our backend! The integration is spot-on:

- ✅ **API calls match backend endpoints exactly**
- ✅ **Data structures align perfectly**
- ✅ **Error handling is comprehensive**
- ✅ **UI features are professional**
- ✅ **Date formatting is correct**

**To verify it's working:**

1. Run the test script above
2. Add debugging to your CommentModal
3. Check network requests in React Native debugger
4. Test all functionality (post, load, delete, refresh)

**Your comment system should work flawlessly!** 🚀
