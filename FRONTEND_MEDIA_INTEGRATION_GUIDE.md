# Frontend Media Integration Guide

## 🎯 **Overview**

This guide provides everything the frontend developer needs to integrate with the Jevah media system, including fetching content, implementing social features, and creating a social media-style interface like the one shown in the reference image.

## 📡 **Core Media Endpoints**

### **1. Fetch ALL Media Content**

**Endpoint:** `GET /api/media/public/all-content`

**Use Case:** Main feed, "All" tab, discover page

```javascript
const fetchAllMedia = async () => {
  try {
    const response = await fetch(
      "https://jevahapp-backend.onrender.com/api/media/public/all-content"
    );
    const data = await response.json();

    if (data.success) {
      return data.media; // Array of all media items
    }
  } catch (error) {
    console.error("Failed to fetch all media:", error);
  }
};
```

### **2. Fetch Media by Category**

**Endpoint:** `GET /api/media/public?category={category}`

**Use Case:** Category-specific feeds (Worship, Inspiration, Youth, etc.)

```javascript
const fetchMediaByCategory = async category => {
  try {
    const params = new URLSearchParams({ category });
    const response = await fetch(
      `https://jevahapp-backend.onrender.com/api/media/public?${params}`
    );
    const data = await response.json();

    if (data.success) {
      return data.media;
    }
  } catch (error) {
    console.error("Failed to fetch media by category:", error);
  }
};

// Examples
const worshipContent = await fetchMediaByCategory("worship");
const inspirationContent = await fetchMediaByCategory("inspiration");
const youthContent = await fetchMediaByCategory("youth");
```

### **3. Authenticated User Content (With Social Features)**

**Endpoint:** `GET /api/media/all-content`

**Use Case:** When user is logged in, includes personal interactions

```javascript
const fetchAuthenticatedMedia = async token => {
  try {
    const response = await fetch(
      "https://jevahapp-backend.onrender.com/api/media/all-content",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    const data = await response.json();

    if (data.success) {
      return data.media; // Includes user's likes, saves, etc.
    }
  } catch (error) {
    console.error("Failed to fetch authenticated media:", error);
  }
};
```

## 🎨 **Media Item Structure**

Each media item follows this structure:

```javascript
{
  "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
  "title": "2 Hours time with God with Dunsin Oyekan & Pastor Godman Akinlabi",
  "description": "Live worship service with powerful gospel music",
  "contentType": "live", // "videos" | "music" | "books" | "live" | "podcast" | "devotional"
  "category": "worship", // "worship" | "inspiration" | "youth" | "teachings"
  "fileUrl": "https://example.com/video.mp4",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "topics": ["gospel", "worship", "live"],
  "uploadedBy": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
    "firstName": "Minister Pius",
    "lastName": "Tagbas",
    "avatar": "https://example.com/avatar.jpg",
    "isVerified": true // For blue checkmark
  },
  "viewCount": 550,
  "likeCount": 600,
  "commentCount": 45,
  "shareCount": 900,
  "saveCount": 480,
  "duration": 7200, // in seconds
  "isLive": true, // For live indicator
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",

  // User-specific data (when authenticated)
  "userHasLiked": false,
  "userHasSaved": false,
  "userHasShared": false
}
```

## ❤️ **Social Features Implementation**

### **1. Like/Unlike Media**

**Endpoint:** `POST /api/media/{mediaId}/like`

```javascript
const toggleLike = async (mediaId, token) => {
  try {
    const response = await fetch(
      `https://jevahapp-backend.onrender.com/api/media/${mediaId}/like`,
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
      // Update local state
      return data.liked; // true if liked, false if unliked
    }
  } catch (error) {
    console.error("Failed to toggle like:", error);
  }
};

// Usage in React Native
const handleLike = async () => {
  const isLiked = await toggleLike(mediaItem._id, userToken);
  // Update UI state
  setMediaItem(prev => ({
    ...prev,
    userHasLiked: isLiked,
    likeCount: isLiked ? prev.likeCount + 1 : prev.likeCount - 1,
  }));
};
```

### **2. Save/Unsave to Library**

**Endpoint:** `POST /api/media/{mediaId}/save`

```javascript
const toggleSave = async (mediaId, token) => {
  try {
    const response = await fetch(
      `https://jevahapp-backend.onrender.com/api/media/${mediaId}/save`,
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
      return data.saved; // true if saved, false if unsaved
    }
  } catch (error) {
    console.error("Failed to toggle save:", error);
  }
};

// Usage
const handleSave = async () => {
  const isSaved = await toggleSave(mediaItem._id, userToken);
  setMediaItem(prev => ({
    ...prev,
    userHasSaved: isSaved,
    saveCount: isSaved ? prev.saveCount + 1 : prev.saveCount - 1,
  }));
};
```

### **3. Share Media**

**Endpoint:** `POST /api/media/{mediaId}/share`

```javascript
const shareMedia = async (mediaId, token) => {
  try {
    const response = await fetch(
      `https://jevahapp-backend.onrender.com/api/media/${mediaId}/share`,
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
      // Update share count
      setMediaItem(prev => ({
        ...prev,
        shareCount: prev.shareCount + 1,
      }));

      // Use React Native Share API
      Share.share({
        message: `Check out this amazing content: ${mediaItem.title}`,
        url: mediaItem.fileUrl,
      });
    }
  } catch (error) {
    console.error("Failed to share media:", error);
  }
};
```

### **4. Add Comment**

**Endpoint:** `POST /api/media/{mediaId}/comments`

```javascript
const addComment = async (mediaId, commentText, token) => {
  try {
    const response = await fetch(
      `https://jevahapp-backend.onrender.com/api/media/${mediaId}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: commentText,
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      // Add comment to local state
      setComments(prev => [data.comment, ...prev]);
      setMediaItem(prev => ({
        ...prev,
        commentCount: prev.commentCount + 1,
      }));
    }
  } catch (error) {
    console.error("Failed to add comment:", error);
  }
};
```

### **5. Fetch Comments**

**Endpoint:** `GET /api/media/{mediaId}/comments`

```javascript
const fetchComments = async (mediaId, token) => {
  try {
    const response = await fetch(
      `https://jevahapp-backend.onrender.com/api/media/${mediaId}/comments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      return data.comments;
    }
  } catch (error) {
    console.error("Failed to fetch comments:", error);
  }
};
```

## 🎬 **React Native Implementation Example**

```javascript
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const MediaCard = ({ media, token, onLike, onSave, onShare, onComment }) => {
  const [isLiked, setIsLiked] = useState(media.userHasLiked || false);
  const [isSaved, setIsSaved] = useState(media.userHasSaved || false);
  const [likeCount, setLikeCount] = useState(media.likeCount);
  const [saveCount, setSaveCount] = useState(media.saveCount);
  const [shareCount, setShareCount] = useState(media.shareCount);

  const handleLike = async () => {
    const newLikeState = await onLike(media._id, token);
    setIsLiked(newLikeState);
    setLikeCount(prev => (newLikeState ? prev + 1 : prev - 1));
  };

  const handleSave = async () => {
    const newSaveState = await onSave(media._id, token);
    setIsSaved(newSaveState);
    setSaveCount(prev => (newSaveState ? prev + 1 : prev - 1));
  };

  const handleShare = async () => {
    await onShare(media._id, token);
    setShareCount(prev => prev + 1);
  };

  return (
    <View style={styles.mediaCard}>
      {/* Live Indicator */}
      {media.isLive && (
        <View style={styles.liveIndicator}>
          <Text style={styles.liveText}>LIVE</Text>
          <Ionicons name="radio" size={12} color="white" />
        </View>
      )}

      {/* Media Content */}
      <Image source={{ uri: media.thumbnailUrl }} style={styles.thumbnail} />

      {/* Title Overlay */}
      <View style={styles.titleOverlay}>
        <Text style={styles.title}>{media.title}</Text>
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <Image
          source={{ uri: media.uploadedBy.avatar }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.userName}>
            {media.uploadedBy.firstName} {media.uploadedBy.lastName}
          </Text>
          {media.uploadedBy.isVerified && (
            <Ionicons name="checkmark-circle" size={16} color="#007AFF" />
          )}
        </View>
        <Text style={styles.timestamp}>3HRS AGO</Text>
      </View>

      {/* Engagement Metrics */}
      <View style={styles.engagement}>
        <View style={styles.metric}>
          <Ionicons name="eye" size={16} color="#666" />
          <Text style={styles.metricText}>{media.viewCount}</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="share" size={16} color="#666" />
          <Text style={styles.metricText}>{shareCount}</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="bookmark" size={16} color="#666" />
          <Text style={styles.metricText}>{saveCount}</Text>
        </View>
        <View style={styles.metric}>
          <Ionicons name="heart" size={16} color="#666" />
          <Text style={styles.metricText}>{likeCount}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={24}
            color={isLiked ? "#FF3B30" : "#666"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onComment(media._id)}
          style={styles.actionButton}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
          <Ionicons name="share-outline" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSave} style={styles.actionButton}>
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={24}
            color={isSaved ? "#007AFF" : "#666"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mediaCard: {
    backgroundColor: "white",
    borderRadius: 12,
    margin: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  liveIndicator: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#FF3B30",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  liveText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 4,
  },
  thumbnail: {
    width: "100%",
    height: 200,
    borderRadius: 8,
  },
  titleOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
  },
  title: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    fontStyle: "italic",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userDetails: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  timestamp: {
    fontSize: 12,
    color: "#666",
  },
  engagement: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  actionButton: {
    padding: 8,
  },
});

export default MediaCard;
```

## 🔄 **State Management with Zustand**

```javascript
import { create } from "zustand";

const useMediaStore = create((set, get) => ({
  media: [],
  loading: false,
  error: null,
  selectedCategory: "all",

  // Actions
  setMedia: media => set({ media }),
  setLoading: loading => set({ loading }),
  setError: error => set({ error }),
  setCategory: category => set({ selectedCategory: category }),

  // Async actions
  fetchAllMedia: async () => {
    const { setLoading, setError, setMedia } = get();

    try {
      setLoading(true);
      const response = await fetch("/api/media/public/all-content");
      const data = await response.json();

      if (data.success) {
        setMedia(data.media);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError("Failed to fetch media");
    } finally {
      setLoading(false);
    }
  },

  fetchByCategory: async category => {
    const { setLoading, setError, setMedia } = get();

    try {
      setLoading(true);
      const params = new URLSearchParams({ category });
      const response = await fetch(`/api/media/public?${params}`);
      const data = await response.json();

      if (data.success) {
        setMedia(data.media);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError("Failed to fetch media by category");
    } finally {
      setLoading(false);
    }
  },

  toggleLike: async (mediaId, token) => {
    const { media, setMedia } = get();

    try {
      const response = await fetch(`/api/media/${mediaId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setMedia(
          media.map(item =>
            item._id === mediaId
              ? {
                  ...item,
                  userHasLiked: data.liked,
                  likeCount: data.liked
                    ? item.likeCount + 1
                    : item.likeCount - 1,
                }
              : item
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  },
}));

export default useMediaStore;
```

## 🎯 **Key Implementation Notes**

1. **Real-time Updates**: Consider using WebSockets for live engagement updates
2. **Optimistic Updates**: Update UI immediately, then sync with server
3. **Error Handling**: Always handle network errors gracefully
4. **Loading States**: Show loading indicators during API calls
5. **Caching**: Cache media data to reduce API calls
6. **Pagination**: Implement infinite scroll for large media lists
7. **Offline Support**: Cache data for offline viewing

This implementation will give you a social media-style interface similar to the reference image, with all the engagement features working seamlessly!
