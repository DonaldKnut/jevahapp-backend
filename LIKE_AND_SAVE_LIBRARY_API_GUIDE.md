# Like/Unlike & Save to Library API Documentation

## 🎯 **Overview**

This comprehensive guide covers all endpoints for liking/unliking content and saving/removing content from your personal library (bookmarks). The system supports both media content and other content types with unified endpoints.

## 📡 **API Endpoints**

### **1. Like/Unlike Content**

#### **Universal Like Toggle (Recommended)**

```http
POST /api/content/{contentType}/{contentId}/like
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Parameters:**

- `contentType`: `"media"` | `"devotional"` | `"artist"` | `"merch"` | `"ebook"` | `"podcast"`
- `contentId`: MongoDB ObjectId of the content

**Response:**

```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "liked": true,
    "likeCount": 42,
    "userLiked": true
  }
}
```

#### **Media-Specific Like/Unlike**

```http
POST /api/media/{mediaId}/action
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "actionType": "favorite"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Added favorite to media 507f1f77bcf86cd799439011",
  "action": {
    "_id": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439010",
    "media": "507f1f77bcf86cd799439011",
    "actionType": "favorite",
    "createdAt": "2025-01-24T10:30:00.000Z",
    "isRemoved": false
  }
}
```

### **2. Save to Library (Bookmark)**

#### **Universal Bookmark Toggle (Recommended)**

```http
POST /api/bookmark/{mediaId}/toggle
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response:**

```json
{
  "success": true,
  "message": "Bookmark toggled successfully",
  "data": {
    "bookmarked": true,
    "bookmarkCount": 15,
    "userBookmarked": true
  }
}
```

#### **Media-Specific Bookmark**

```http
POST /api/media/{mediaId}/bookmark
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response:**

```json
{
  "success": true,
  "message": "Saved media 507f1f77bcf86cd799439011",
  "bookmark": {
    "_id": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439010",
    "media": "507f1f77bcf86cd799439011",
    "createdAt": "2025-01-24T10:30:00.000Z"
  }
}
```

### **3. Check Status Endpoints**

#### **Get Like Status**

```http
GET /api/media/{mediaId}/action-status
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "success": true,
  "message": "User action status retrieved successfully",
  "status": {
    "isFavorited": true,
    "isShared": false
  }
}
```

#### **Get Bookmark Status**

```http
GET /api/bookmark/{mediaId}/status
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "isBookmarked": true,
    "bookmarkCount": 15
  }
}
```

### **4. Get User's Saved Content**

#### **Get User's Bookmarks**

```http
GET /api/bookmark/user
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "bookmarks": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "media": {
          "_id": "507f1f77bcf86cd799439011",
          "title": "Amazing Gospel Song",
          "contentType": "music",
          "category": "worship",
          "thumbnailUrl": "https://example.com/thumb.jpg",
          "fileUrl": "https://example.com/song.mp3",
          "topics": ["worship", "praise"],
          "authorInfo": {
            "_id": "507f1f77bcf86cd799439013",
            "firstName": "John",
            "lastName": "Doe",
            "fullName": "John Doe",
            "avatar": "https://example.com/avatar.jpg"
          },
          "viewCount": 150,
          "likeCount": 25,
          "shareCount": 8,
          "commentCount": 12,
          "createdAt": "2025-01-20T10:30:00.000Z"
        },
        "createdAt": "2025-01-24T10:30:00.000Z"
      }
    ],
    "total": 1,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### **Get Bookmarked Media (Alternative)**

```http
GET /api/bookmarks/get-bookmarked-media
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "bookmarkedMedia": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Amazing Gospel Song",
        "contentType": "music",
        "category": "worship",
        "thumbnailUrl": "https://example.com/thumb.jpg",
        "fileUrl": "https://example.com/song.mp3",
        "topics": ["worship", "praise"],
        "authorInfo": {
          "_id": "507f1f77bcf86cd799439013",
          "firstName": "John",
          "lastName": "Doe",
          "fullName": "John Doe",
          "avatar": "https://example.com/avatar.jpg"
        },
        "viewCount": 150,
        "likeCount": 25,
        "shareCount": 8,
        "commentCount": 12,
        "createdAt": "2025-01-20T10:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

## 🔧 **Frontend Implementation**

### **React/React Native Components**

#### **Like Button Component**

```tsx
import React, { useState, useEffect } from "react";
import { TouchableOpacity, Text } from "react-native";

interface LikeButtonProps {
  contentType: string;
  contentId: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
  onLikeChange?: (liked: boolean, count: number) => void;
}

const LikeButton: React.FC<LikeButtonProps> = ({
  contentType,
  contentId,
  initialLiked = false,
  initialLikeCount = 0,
  onLikeChange,
}) => {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);

  const toggleLike = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/content/${contentType}/${contentId}/like`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setLiked(data.data.liked);
        setLikeCount(data.data.likeCount);
        onLikeChange?.(data.data.liked, data.data.likeCount);
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={toggleLike}
      disabled={loading}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 8,
        backgroundColor: liked ? "#ff6b6b" : "#f0f0f0",
        borderRadius: 20,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <Text style={{ marginRight: 4, fontSize: 16 }}>
        {liked ? "❤️" : "🤍"}
      </Text>
      <Text
        style={{
          color: liked ? "white" : "#333",
          fontWeight: "bold",
        }}
      >
        {likeCount}
      </Text>
    </TouchableOpacity>
  );
};

export default LikeButton;
```

#### **Save to Library Button Component**

```tsx
import React, { useState, useEffect } from "react";
import { TouchableOpacity, Text } from "react-native";

interface SaveButtonProps {
  mediaId: string;
  initialSaved?: boolean;
  onSaveChange?: (saved: boolean) => void;
}

const SaveButton: React.FC<SaveButtonProps> = ({
  mediaId,
  initialSaved = false,
  onSaveChange,
}) => {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  const toggleSave = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/bookmark/${mediaId}/toggle`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setSaved(data.data.bookmarked);
        onSaveChange?.(data.data.bookmarked);
      }
    } catch (error) {
      console.error("Failed to toggle save:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={toggleSave}
      disabled={loading}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 8,
        backgroundColor: saved ? "#4CAF50" : "#f0f0f0",
        borderRadius: 20,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <Text style={{ marginRight: 4, fontSize: 16 }}>
        {saved ? "📚" : "📖"}
      </Text>
      <Text
        style={{
          color: saved ? "white" : "#333",
          fontWeight: "bold",
        }}
      >
        {saved ? "Saved" : "Save"}
      </Text>
    </TouchableOpacity>
  );
};

export default SaveButton;
```

#### **Media Item with Interactions**

```tsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import LikeButton from "./LikeButton";
import SaveButton from "./SaveButton";

interface MediaItemProps {
  media: {
    _id: string;
    title: string;
    contentType: string;
    thumbnailUrl: string;
    authorInfo: {
      fullName: string;
      avatar: string;
    };
    viewCount: number;
    likeCount: number;
    shareCount: number;
    commentCount: number;
    topics: string[];
  };
  isLiked?: boolean;
  isSaved?: boolean;
  onLikeChange?: (liked: boolean, count: number) => void;
  onSaveChange?: (saved: boolean) => void;
}

const MediaItem: React.FC<MediaItemProps> = ({
  media,
  isLiked = false,
  isSaved = false,
  onLikeChange,
  onSaveChange,
}) => {
  return (
    <View style={styles.container}>
      <Image source={{ uri: media.thumbnailUrl }} style={styles.thumbnail} />
      <View style={styles.content}>
        <Text style={styles.title}>{media.title}</Text>
        <Text style={styles.author}>{media.authorInfo.fullName}</Text>

        <View style={styles.stats}>
          <Text style={styles.stat}>👁 {media.viewCount}</Text>
          <Text style={styles.stat}>💬 {media.commentCount}</Text>
          <Text style={styles.stat}>📤 {media.shareCount}</Text>
        </View>

        <View style={styles.topics}>
          {media.topics.slice(0, 3).map(topic => (
            <Text key={topic} style={styles.topic}>
              #{topic}
            </Text>
          ))}
        </View>

        <View style={styles.actions}>
          <LikeButton
            contentType="media"
            contentId={media._id}
            initialLiked={isLiked}
            initialLikeCount={media.likeCount}
            onLikeChange={onLikeChange}
          />
          <SaveButton
            mediaId={media._id}
            initialSaved={isSaved}
            onSaveChange={onSaveChange}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnail: {
    width: 120,
    height: 120,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  author: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  stats: {
    flexDirection: "row",
    marginBottom: 8,
  },
  stat: {
    fontSize: 12,
    color: "#888",
    marginRight: 12,
  },
  topics: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  topic: {
    fontSize: 11,
    color: "#555",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
    marginBottom: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

export default MediaItem;
```

### **API Service Functions**

#### **Like Service**

```typescript
// services/likeService.ts
class LikeService {
  private baseURL: string;
  private token: string;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async toggleLike(contentType: string, contentId: string) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/content/${contentType}/${contentId}/like`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Like toggle failed:", error);
      throw error;
    }
  }

  async getActionStatus(mediaId: string) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/media/${mediaId}/action-status`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get action status failed:", error);
      throw error;
    }
  }
}

export default LikeService;
```

#### **Bookmark Service**

```typescript
// services/bookmarkService.ts
class BookmarkService {
  private baseURL: string;
  private token: string;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async toggleBookmark(mediaId: string) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/bookmark/${mediaId}/toggle`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Bookmark toggle failed:", error);
      throw error;
    }
  }

  async getBookmarkStatus(mediaId: string) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/bookmark/${mediaId}/status`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get bookmark status failed:", error);
      throw error;
    }
  }

  async getUserBookmarks(page: number = 1, limit: number = 20) {
    try {
      const response = await fetch(
        `${this.baseURL}/api/bookmark/user?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Get user bookmarks failed:", error);
      throw error;
    }
  }
}

export default BookmarkService;
```

### **Usage Examples**

#### **Basic Like/Unlike**

```typescript
// Toggle like for media content
const likeResult = await likeService.toggleLike(
  "media",
  "507f1f77bcf86cd799439011"
);
console.log("Liked:", likeResult.data.liked);
console.log("Total likes:", likeResult.data.likeCount);

// Toggle like for devotional content
const devotionalLike = await likeService.toggleLike(
  "devotional",
  "507f1f77bcf86cd799439012"
);
```

#### **Basic Save/Unsave**

```typescript
// Toggle bookmark
const bookmarkResult = await bookmarkService.toggleBookmark(
  "507f1f77bcf86cd799439011"
);
console.log("Bookmarked:", bookmarkResult.data.bookmarked);

// Get user's saved content
const userBookmarks = await bookmarkService.getUserBookmarks(1, 20);
console.log("Total bookmarks:", userBookmarks.data.total);
console.log("Bookmarked media:", userBookmarks.data.bookmarks);
```

#### **Check Status Before Actions**

```typescript
// Check if content is already liked
const actionStatus = await likeService.getActionStatus(
  "507f1f77bcf86cd799439011"
);
console.log("Is favorited:", actionStatus.status.isFavorited);

// Check if content is already bookmarked
const bookmarkStatus = await bookmarkService.getBookmarkStatus(
  "507f1f77bcf86cd799439011"
);
console.log("Is bookmarked:", bookmarkStatus.data.isBookmarked);
```

## 🚨 **Error Handling**

### **Common Error Responses**

#### **Unauthorized (401)**

```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

#### **Invalid Content ID (400)**

```json
{
  "success": false,
  "message": "Invalid media identifier"
}
```

#### **Content Not Found (404)**

```json
{
  "success": false,
  "message": "Media not found"
}
```

#### **Already Saved (400)**

```json
{
  "success": false,
  "message": "Media already saved"
}
```

### **Error Handling in Frontend**

```typescript
const handleLikeToggle = async () => {
  try {
    const result = await likeService.toggleLike("media", mediaId);
    // Handle success
    updateUI(result.data.liked, result.data.likeCount);
  } catch (error) {
    if (error.message.includes("401")) {
      // Redirect to login
      navigate("/login");
    } else if (error.message.includes("404")) {
      // Show content not found message
      showError("Content not found");
    } else {
      // Show generic error
      showError("Failed to update like status");
    }
  }
};
```

## 📊 **Analytics Integration**

### **Track User Interactions**

```typescript
// Track like events for analytics
const trackLikeEvent = (
  contentType: string,
  contentId: string,
  liked: boolean
) => {
  analytics.track("content_liked", {
    contentType,
    contentId,
    liked,
    timestamp: new Date().toISOString(),
  });
};

// Track bookmark events
const trackBookmarkEvent = (mediaId: string, bookmarked: boolean) => {
  analytics.track("content_bookmarked", {
    mediaId,
    bookmarked,
    timestamp: new Date().toISOString(),
  });
};
```

## 🔄 **State Management**

### **Redux/Context Integration**

```typescript
// actions/mediaActions.ts
export const toggleLike =
  (contentType: string, contentId: string) => async dispatch => {
    dispatch({ type: "TOGGLE_LIKE_START" });

    try {
      const result = await likeService.toggleLike(contentType, contentId);
      dispatch({
        type: "TOGGLE_LIKE_SUCCESS",
        payload: {
          contentType,
          contentId,
          liked: result.data.liked,
          likeCount: result.data.likeCount,
        },
      });
    } catch (error) {
      dispatch({
        type: "TOGGLE_LIKE_FAILURE",
        payload: error.message,
      });
    }
  };

export const toggleBookmark = (mediaId: string) => async dispatch => {
  dispatch({ type: "TOGGLE_BOOKMARK_START" });

  try {
    const result = await bookmarkService.toggleBookmark(mediaId);
    dispatch({
      type: "TOGGLE_BOOKMARK_SUCCESS",
      payload: {
        mediaId,
        bookmarked: result.data.bookmarked,
      },
    });
  } catch (error) {
    dispatch({
      type: "TOGGLE_BOOKMARK_FAILURE",
      payload: error.message,
    });
  }
};
```

## 🎯 **Best Practices**

1. **Always check authentication status** before making requests
2. **Handle loading states** to prevent multiple rapid clicks
3. **Cache status locally** to improve user experience
4. **Implement optimistic updates** for better perceived performance
5. **Provide clear feedback** for successful/failed operations
6. **Handle network errors gracefully** with retry mechanisms
7. **Track user interactions** for analytics and recommendations
8. **Use consistent UI patterns** across all interaction buttons

This comprehensive system provides robust like/unlike and save/unsave functionality with proper error handling, state management, and user experience considerations.
