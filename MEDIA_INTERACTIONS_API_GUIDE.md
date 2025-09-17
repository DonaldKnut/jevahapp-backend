# Media Interactions API Guide

## 🎯 Overview

This guide covers all media interaction endpoints that power the TikTok-style UI interactions: **Like/Unlike**, **Comment**, **Save/Bookmark**, and **Offline Download**. These are the core engagement features visible in the UI.

## 📡 Available Interaction Endpoints

### **1. Like/Unlike System**

#### **Universal Like Toggle**

```
POST /api/content/:contentType/:contentId/like
```

- **Purpose**: Toggle like status on any content type
- **Access**: Protected (Authentication required)
- **Content Types**: `media`, `devotional`, `artist`, `merch`, `ebook`, `podcast`

**Request:**

```typescript
// No body required - just toggle
const response = await fetch(
  `${API_BASE_URL}/api/content/media/${mediaId}/like`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
  }
);
```

**Response:**

```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "liked": true,
    "likeCount": 25
  }
}
```

### **2. Comment System**

#### **Add Comment**

```
POST /api/content/:contentType/:contentId/comment
```

- **Purpose**: Add a comment to content
- **Access**: Protected (Authentication required)
- **Content Types**: `media`, `devotional`

**Request:**

```typescript
const response = await fetch(
  `${API_BASE_URL}/api/content/media/${mediaId}/comment`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: "Great video! Very inspiring.",
      parentCommentId: "optional_parent_comment_id", // For replies
    }),
  }
);
```

**Response:**

```json
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "id": "comment_id",
    "content": "Great video! Very inspiring.",
    "user": {
      "_id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "avatar_url"
    },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "likes": 0,
    "replies": []
  }
}
```

#### **Get Comments**

```
GET /api/content/:contentType/:contentId/comments
```

- **Purpose**: Retrieve all comments for content
- **Access**: Public (No authentication required)

**Request:**

```typescript
const response = await fetch(
  `${API_BASE_URL}/api/content/media/${mediaId}/comments`
);
```

**Response:**

```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "comment_id",
        "content": "Great video!",
        "user": {
          "_id": "user_id",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "avatar_url"
        },
        "createdAt": "2024-01-15T10:00:00.000Z",
        "likes": 5,
        "replies": [
          {
            "id": "reply_id",
            "content": "I agree!",
            "user": {
              "_id": "user_id_2",
              "firstName": "Jane",
              "lastName": "Smith",
              "avatar": "avatar_url_2"
            },
            "createdAt": "2024-01-15T11:00:00.000Z",
            "likes": 2
          }
        ]
      }
    ],
    "total": 1
  }
}
```

#### **Remove Comment**

```
DELETE /api/interactions/comments/:commentId
```

- **Purpose**: Delete a comment (owner only)
- **Access**: Protected (Authentication required)

**Request:**

```typescript
const response = await fetch(
  `${API_BASE_URL}/api/interactions/comments/${commentId}`,
  {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  }
);
```

### **3. Save/Bookmark System**

#### **Toggle Bookmark**

```
POST /api/bookmark/:mediaId/toggle
```

- **Purpose**: Save/unsave media to user's library
- **Access**: Protected (Authentication required)

**Request:**

```typescript
const response = await fetch(`${API_BASE_URL}/api/bookmark/${mediaId}/toggle`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${userToken}`,
    "Content-Type": "application/json",
  },
});
```

**Response:**

```json
{
  "success": true,
  "message": "Bookmark toggled successfully",
  "data": {
    "bookmarked": true,
    "bookmarkCount": 15
  }
}
```

#### **Check Bookmark Status**

```
GET /api/bookmark/:mediaId/status
```

- **Purpose**: Check if user has bookmarked specific media
- **Access**: Protected (Authentication required)

**Request:**

```typescript
const response = await fetch(`${API_BASE_URL}/api/bookmark/${mediaId}/status`, {
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
});
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

#### **Get User's Bookmarks**

```
GET /api/bookmark/user
```

- **Purpose**: Retrieve user's saved/bookmarked content
- **Access**: Protected (Authentication required)

**Request:**

```typescript
const response = await fetch(
  `${API_BASE_URL}/api/bookmark/user?page=1&limit=20`,
  {
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  }
);
```

**Response:**

```json
{
  "success": true,
  "data": {
    "bookmarks": [
      {
        "_id": "bookmark_id",
        "media": {
          "_id": "media_id",
          "title": "Sunday Service",
          "contentType": "videos",
          "fileUrl": "video_url",
          "thumbnailUrl": "thumbnail_url",
          "uploadedBy": {
            "_id": "user_id",
            "firstName": "Pastor",
            "lastName": "Williams",
            "avatar": "avatar_url"
          }
        },
        "bookmarkedAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2
    }
  }
}
```

### **4. Offline Download System**

#### **Initiate Download**

```
POST /api/media/:id/download
```

- **Purpose**: Start download for offline use
- **Access**: Protected (Authentication required)

**Request:**

```typescript
const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}/download`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${userToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    fileSize: 1024000, // File size in bytes (optional)
  }),
});
```

**Response:**

```json
{
  "success": true,
  "message": "Download initiated successfully",
  "data": {
    "downloadUrl": "https://example.com/download-url",
    "fileName": "sunday-service.mp4",
    "fileSize": 1024000,
    "contentType": "video/mp4"
  }
}
```

#### **Get Offline Downloads**

```
GET /api/media/offline-downloads
```

- **Purpose**: Retrieve user's downloaded content
- **Access**: Protected (Authentication required)

**Request:**

```typescript
const response = await fetch(
  `${API_BASE_URL}/api/media/offline-downloads?page=1&limit=20`,
  {
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  }
);
```

**Response:**

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "_id": "download_id",
        "media": {
          "_id": "media_id",
          "title": "Sunday Service",
          "contentType": "videos",
          "fileUrl": "video_url",
          "thumbnailUrl": "thumbnail_url",
          "duration": 3600
        },
        "downloadedAt": "2024-01-15T10:00:00.000Z",
        "fileSize": 1024000,
        "downloadStatus": "completed"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

#### **Remove from Downloads**

```
DELETE /api/media/offline-downloads/:mediaId
```

- **Purpose**: Remove media from offline downloads
- **Access**: Protected (Authentication required)

**Request:**

```typescript
const response = await fetch(
  `${API_BASE_URL}/api/media/offline-downloads/${mediaId}`,
  {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  }
);
```

### **5. Share System**

#### **Share Content**

```
POST /api/content/:contentType/:contentId/share
```

- **Purpose**: Record share action and get share URL
- **Access**: Protected (Authentication required)

**Request:**

```typescript
const response = await fetch(
  `${API_BASE_URL}/api/content/media/${mediaId}/share`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
  }
);
```

**Response:**

```json
{
  "success": true,
  "message": "Content shared successfully",
  "data": {
    "shareUrl": "https://jevahapp.com/share/media_id",
    "shareCount": 8
  }
}
```

## 🔧 Frontend Implementation

### **API Service Setup**

```typescript
// utils/mediaInteractionsAPI.ts
import { EXPO_PUBLIC_API_URL } from "@env";

const API_BASE_URL =
  EXPO_PUBLIC_API_URL || "https://jevahapp-backend.onrender.com";

export const mediaInteractionsAPI = {
  // Like/Unlike
  toggleLike: async (contentType: string, contentId: string, token: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/content/${contentType}/${contentId}/like`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to toggle like:", error);
      throw error;
    }
  },

  // Comments
  addComment: async (
    contentType: string,
    contentId: string,
    content: string,
    token: string,
    parentCommentId?: string
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/content/${contentType}/${contentId}/comment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
            parentCommentId,
          }),
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to add comment:", error);
      throw error;
    }
  },

  getComments: async (contentType: string, contentId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/content/${contentType}/${contentId}/comments`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to get comments:", error);
      throw error;
    }
  },

  removeComment: async (commentId: string, token: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/interactions/comments/${commentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to remove comment:", error);
      throw error;
    }
  },

  // Bookmarks/Save
  toggleBookmark: async (mediaId: string, token: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bookmark/${mediaId}/toggle`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to toggle bookmark:", error);
      throw error;
    }
  },

  getBookmarkStatus: async (mediaId: string, token: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bookmark/${mediaId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to get bookmark status:", error);
      throw error;
    }
  },

  getUserBookmarks: async (token: string, page = 1, limit = 20) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bookmark/user?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to get user bookmarks:", error);
      throw error;
    }
  },

  // Downloads
  initiateDownload: async (
    mediaId: string,
    token: string,
    fileSize?: number
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/media/${mediaId}/download`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileSize,
          }),
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to initiate download:", error);
      throw error;
    }
  },

  getOfflineDownloads: async (token: string, page = 1, limit = 20) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/media/offline-downloads?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to get offline downloads:", error);
      throw error;
    }
  },

  removeFromDownloads: async (mediaId: string, token: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/media/offline-downloads/${mediaId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to remove from downloads:", error);
      throw error;
    }
  },

  // Share
  shareContent: async (
    contentType: string,
    contentId: string,
    token: string
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/content/${contentType}/${contentId}/share`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to share content:", error);
      throw error;
    }
  },
};
```

### **UI Component Integration**

```typescript
// components/MediaInteractionButtons.tsx
import React, { useState } from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { mediaInteractionsAPI } from '../utils/mediaInteractionsAPI';
import { useAuth } from '../hooks/useAuth';

interface MediaInteractionButtonsProps {
  mediaId: string;
  contentType: string;
  initialLiked: boolean;
  initialLikeCount: number;
  initialBookmarked: boolean;
  initialBookmarkCount: number;
  initialCommentCount: number;
  onLikeChange: (liked: boolean, count: number) => void;
  onBookmarkChange: (bookmarked: boolean, count: number) => void;
  onCommentPress: () => void;
  onSharePress: () => void;
  onDownloadPress: () => void;
}

const MediaInteractionButtons: React.FC<MediaInteractionButtonsProps> = ({
  mediaId,
  contentType,
  initialLiked,
  initialLikeCount,
  initialBookmarked,
  initialBookmarkCount,
  initialCommentCount,
  onLikeChange,
  onBookmarkChange,
  onCommentPress,
  onSharePress,
  onDownloadPress,
}) => {
  const { token } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (!token || loading) return;

    setLoading(true);
    try {
      const response = await mediaInteractionsAPI.toggleLike(contentType, mediaId, token);

      if (response.success) {
        setLiked(response.data.liked);
        setLikeCount(response.data.likeCount);
        onLikeChange(response.data.liked, response.data.likeCount);
      } else {
        Alert.alert('Error', response.message || 'Failed to toggle like');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle like');
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (!token || loading) return;

    setLoading(true);
    try {
      const response = await mediaInteractionsAPI.toggleBookmark(mediaId, token);

      if (response.success) {
        setBookmarked(response.data.bookmarked);
        setBookmarkCount(response.data.bookmarkCount);
        onBookmarkChange(response.data.bookmarked, response.data.bookmarkCount);
      } else {
        Alert.alert('Error', response.message || 'Failed to toggle bookmark');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle bookmark');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!token) return;

    try {
      const response = await mediaInteractionsAPI.shareContent(contentType, mediaId, token);

      if (response.success) {
        // Use React Native Share to share the URL
        const { Share } = require('react-native');
        await Share.share({
          title: 'Check this out!',
          message: `Check this out: ${response.data.shareUrl}`,
          url: response.data.shareUrl,
        });
        onSharePress();
      } else {
        Alert.alert('Error', response.message || 'Failed to share');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const handleDownload = async () => {
    if (!token) return;

    try {
      const response = await mediaInteractionsAPI.initiateDownload(mediaId, token);

      if (response.success) {
        // Handle download logic here
        onDownloadPress();
        Alert.alert('Success', 'Download started successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to start download');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start download');
    }
  };

  return (
    <View className="flex-row items-center justify-between pl-2 pr-8">
      {/* Like Button */}
      <TouchableOpacity
        onPress={handleLike}
        className="flex-row items-center mr-6"
        disabled={loading}
      >
        <MaterialIcons
          name={liked ? "favorite" : "favorite-border"}
          size={28}
          color={liked ? "#D22A2A" : "#98A2B3"}
        />
        <Text className="text-[10px] text-gray-500 ml-1 font-rubik">
          {likeCount}
        </Text>
      </TouchableOpacity>

      {/* Comment Button */}
      <TouchableOpacity
        className="flex-row items-center mr-6"
        onPress={onCommentPress}
      >
        <Ionicons name="chatbubble-outline" size={28} color="#98A2B3" />
        <Text className="text-[10px] text-gray-500 ml-1 font-rubik">
          {initialCommentCount}
        </Text>
      </TouchableOpacity>

      {/* Bookmark Button */}
      <TouchableOpacity
        onPress={handleBookmark}
        className="flex-row items-center mr-6"
        disabled={loading}
      >
        <MaterialIcons
          name={bookmarked ? "bookmark" : "bookmark-border"}
          size={28}
          color={bookmarked ? "#FEA74E" : "#98A2B3"}
        />
        <Text className="text-[10px] text-gray-500 ml-1 font-rubik">
          {bookmarkCount}
        </Text>
      </TouchableOpacity>

      {/* Download Button */}
      <TouchableOpacity
        className="flex-row items-center"
        onPress={handleDownload}
      >
        <Ionicons name="download-outline" size={28} color="#98A2B3" />
      </TouchableOpacity>
    </View>
  );
};

export default MediaInteractionButtons;
```

## 🎯 Usage Examples

### **1. Like/Unlike Implementation**

```typescript
// In your media card component
const handleLike = async (mediaId: string) => {
  const response = await mediaInteractionsAPI.toggleLike(
    "media",
    mediaId,
    userToken
  );
  if (response.success) {
    // Update UI with new like status and count
    setLiked(response.data.liked);
    setLikeCount(response.data.likeCount);
  }
};
```

### **2. Comment System Implementation**

```typescript
// Add comment
const addComment = async (mediaId: string, commentText: string) => {
  const response = await mediaInteractionsAPI.addComment(
    "media",
    mediaId,
    commentText,
    userToken
  );
  if (response.success) {
    // Refresh comments list
    loadComments();
  }
};

// Get comments
const loadComments = async (mediaId: string) => {
  const response = await mediaInteractionsAPI.getComments("media", mediaId);
  if (response.success) {
    setComments(response.data.comments);
  }
};
```

### **3. Save/Bookmark Implementation**

```typescript
// Toggle bookmark
const handleBookmark = async (mediaId: string) => {
  const response = await mediaInteractionsAPI.toggleBookmark(
    mediaId,
    userToken
  );
  if (response.success) {
    // Update UI with new bookmark status
    setBookmarked(response.data.bookmarked);
    setBookmarkCount(response.data.bookmarkCount);
  }
};
```

### **4. Download Implementation**

```typescript
// Initiate download
const handleDownload = async (mediaId: string) => {
  const response = await mediaInteractionsAPI.initiateDownload(
    mediaId,
    userToken
  );
  if (response.success) {
    // Start actual download using the provided URL
    startFileDownload(response.data.downloadUrl, response.data.fileName);
  }
};
```

## 🔐 Authentication Requirements

**All interaction endpoints require authentication:**

- Include `Authorization: Bearer ${token}` header
- Token must be valid and not expired
- User must be logged in

## 📱 UI Integration Points

### **Visible in TikTok-Style UI:**

1. **Heart Icon** - Like/Unlike functionality
2. **Comment Icon** - Comment system
3. **Bookmark Icon** - Save to library
4. **Download Icon** - Offline download
5. **Share Icon** - Share content

### **Interaction Flow:**

1. User taps interaction button
2. API call made with authentication
3. Response updates UI state
4. Visual feedback provided to user
5. Counts and status updated in real-time

This implementation provides complete media interaction functionality for your TikTok-style UI, with proper error handling, loading states, and user feedback.
