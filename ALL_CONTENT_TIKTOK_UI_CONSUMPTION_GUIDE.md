# ALL Content TikTok-Style UI Consumption Guide

## 🎯 Overview

This guide explains how to consume the ALL content endpoints with the TikTok-style UI interface. The UI displays all media content (videos, music, sermons, ebooks) in a scrollable feed with Instagram/TikTok-style interactions.

## 📡 Available Endpoints

### 1. **Public All Content (No Authentication Required)**

```
GET /api/media/public/all-content
```

- **Purpose**: Returns ALL media content without pagination
- **Access**: Public (no authentication required)
- **Use Case**: Perfect for the "All" tab when users are not logged in

### 2. **Authenticated All Content (With User Features)**

```
GET /api/media/all-content
```

- **Purpose**: Returns ALL media content with additional user-specific data
- **Access**: Protected (authentication required)
- **Use Case**: For logged-in users who want personalized features

### 3. **Default Content (Onboarding Content)**

```
GET /api/media/default
```

- **Purpose**: Returns default/onboarding content specifically marked as default content
- **Access**: Public (no authentication required)
- **Use Case**: For new users and onboarding experience

## 🔧 Frontend Implementation

### **API Service Setup**

```typescript
// utils/allMediaAPI.ts
import { EXPO_PUBLIC_API_URL } from "@env";

const API_BASE_URL =
  EXPO_PUBLIC_API_URL || "https://jevahapp-backend.onrender.com";

export const allMediaAPI = {
  // Test available endpoints
  testAvailableEndpoints: async () => {
    try {
      const endpoints = [
        "/api/media/public/all-content",
        "/api/media/all-content",
        "/api/media/default",
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        console.log(`✅ ${endpoint}: ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Endpoint test failed:", error);
    }
  },

  // Get all content (public)
  getAllContent: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/media/public/all-content`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to fetch all content:", error);
      throw error;
    }
  },

  // Get all content with authentication
  getAllContentWithAuth: async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/all-content`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to fetch authenticated all content:", error);
      throw error;
    }
  },

  // Get default content
  getDefaultContent: async (
    params: { contentType?: string; limit?: number; page?: number } = {}
  ) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.contentType)
        queryParams.append("contentType", params.contentType);
      if (params.limit) queryParams.append("limit", params.limit.toString());
      if (params.page) queryParams.append("page", params.page.toString());

      const response = await fetch(
        `${API_BASE_URL}/api/media/default?${queryParams}`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Failed to fetch default content:", error);
      throw error;
    }
  },

  // Toggle like
  toggleLike: async (contentType: string, contentId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/content/${contentType}/${contentId}/like`,
        {
          method: "POST",
          headers: {
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
};
```

### **Store Implementation**

```typescript
// store/useUploadStore.ts (or useMediaStore.ts)
import { create } from "zustand";
import { allMediaAPI } from "../utils/allMediaAPI";

interface MediaStore {
  defaultContent: any[];
  defaultContentLoading: boolean;
  defaultContentError: string | null;
  defaultContentPagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  fetchDefaultContent: (params: {
    page?: number;
    limit?: number;
  }) => Promise<void>;
  loadMoreDefaultContent: () => Promise<void>;
  refreshDefaultContent: () => Promise<void>;
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  defaultContent: [],
  defaultContentLoading: false,
  defaultContentError: null,
  defaultContentPagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },

  fetchDefaultContent: async (params = {}) => {
    set({ defaultContentLoading: true, defaultContentError: null });

    try {
      const { page = 1, limit = 10 } = params;
      const response = await allMediaAPI.getDefaultContent({ page, limit });

      if (response.success) {
        set({
          defaultContent: response.data.content || response.data.all || [],
          defaultContentPagination: response.data.pagination || {
            page,
            limit,
            total: response.data.total || 0,
            pages: Math.ceil((response.data.total || 0) / limit),
          },
          defaultContentLoading: false,
        });
      } else {
        set({
          defaultContentError: response.message || "Failed to fetch content",
          defaultContentLoading: false,
        });
      }
    } catch (error) {
      set({
        defaultContentError:
          error instanceof Error ? error.message : "Unknown error",
        defaultContentLoading: false,
      });
    }
  },

  loadMoreDefaultContent: async () => {
    const { defaultContentPagination, defaultContentLoading } = get();

    if (
      defaultContentLoading ||
      defaultContentPagination.page >= defaultContentPagination.pages
    ) {
      return;
    }

    const nextPage = defaultContentPagination.page + 1;
    await get().fetchDefaultContent({ page: nextPage });
  },

  refreshDefaultContent: async () => {
    await get().fetchDefaultContent({ page: 1 });
  },
}));
```

## 📋 Expected JSON Response Format

### **All Content Endpoint Response**

```json
{
  "success": true,
  "media": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "title": "Sunday Service",
      "description": "Live worship service from our main sanctuary",
      "contentType": "videos",
      "category": "worship",
      "fileUrl": "https://example.com/video.mp4",
      "thumbnailUrl": "https://example.com/thumbnail.jpg",
      "topics": ["gospel", "worship", "live"],
      "authorInfo": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "totalLikes": 25,
      "totalShares": 8,
      "totalViews": 150,
      "likeCount": 25,
      "shareCount": 8,
      "viewCount": 150,
      "commentCount": 12,
      "duration": 3600,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "formattedCreatedAt": "2 days ago"
    },
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
      "title": "Amazing Grace",
      "description": "Classic hymn performed by our choir",
      "contentType": "audio",
      "category": "music",
      "fileUrl": "https://example.com/audio.mp3",
      "thumbnailUrl": "https://example.com/music-thumb.jpg",
      "topics": ["hymn", "choir", "classic"],
      "authorInfo": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d3",
        "firstName": "Sarah",
        "lastName": "Johnson",
        "avatar": "https://example.com/sarah-avatar.jpg"
      },
      "totalLikes": 45,
      "totalShares": 15,
      "totalViews": 200,
      "likeCount": 45,
      "shareCount": 15,
      "viewCount": 200,
      "commentCount": 8,
      "duration": 240,
      "createdAt": "2024-01-14T15:30:00.000Z",
      "updatedAt": "2024-01-14T15:30:00.000Z",
      "formattedCreatedAt": "3 days ago"
    },
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d4",
      "title": "The Power of Prayer",
      "description": "Weekly sermon on the importance of prayer",
      "contentType": "sermon",
      "category": "teaching",
      "fileUrl": "https://example.com/sermon.mp4",
      "thumbnailUrl": "https://example.com/sermon-thumb.jpg",
      "topics": ["prayer", "faith", "teaching"],
      "authorInfo": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d5",
        "firstName": "Pastor",
        "lastName": "Williams",
        "avatar": "https://example.com/pastor-avatar.jpg"
      },
      "totalLikes": 67,
      "totalShares": 23,
      "totalViews": 300,
      "likeCount": 67,
      "shareCount": 23,
      "viewCount": 300,
      "commentCount": 18,
      "duration": 1800,
      "createdAt": "2024-01-13T09:00:00.000Z",
      "updatedAt": "2024-01-13T09:00:00.000Z",
      "formattedCreatedAt": "4 days ago"
    },
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d6",
      "title": "Daily Devotional Guide",
      "description": "A comprehensive guide for daily spiritual practice",
      "contentType": "ebook",
      "category": "devotional",
      "fileUrl": "https://example.com/devotional.pdf",
      "thumbnailUrl": "https://example.com/ebook-thumb.jpg",
      "topics": ["devotional", "spiritual", "guide"],
      "authorInfo": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d7",
        "firstName": "Dr.",
        "lastName": "Smith",
        "avatar": "https://example.com/dr-smith-avatar.jpg"
      },
      "totalLikes": 89,
      "totalShares": 34,
      "totalViews": 450,
      "likeCount": 89,
      "shareCount": 34,
      "viewCount": 450,
      "commentCount": 25,
      "duration": null,
      "createdAt": "2024-01-12T14:20:00.000Z",
      "updatedAt": "2024-01-12T14:20:00.000Z",
      "formattedCreatedAt": "5 days ago"
    }
  ],
  "total": 4
}
```

### **Default Content Endpoint Response**

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d8",
        "title": "Welcome to Jevah",
        "description": "Introduction to our gospel media platform",
        "mediaUrl": "https://example.com/welcome-video.mp4",
        "thumbnailUrl": "https://example.com/welcome-thumb.jpg",
        "contentType": "video",
        "duration": 120,
        "author": {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d9",
          "firstName": "Admin",
          "lastName": "User",
          "avatar": "https://example.com/admin-avatar.jpg"
        },
        "likeCount": 0,
        "commentCount": 0,
        "shareCount": 0,
        "viewCount": 0,
        "createdAt": "2024-01-10T12:00:00.000Z",
        "updatedAt": "2024-01-10T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

## 🎨 UI Component Usage

### **Main Component Implementation**

```typescript
// components/AllContentTikTok.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { useMediaStore } from '../store/useUploadStore';
import { allMediaAPI } from '../utils/allMediaAPI';

const AllContentTikTok = () => {
  const {
    defaultContent,
    defaultContentLoading,
    defaultContentError,
    fetchDefaultContent,
    loadMoreDefaultContent,
    refreshDefaultContent,
  } = useMediaStore();

  // Transform API response to match UI interface
  const mediaList = useMemo(() => {
    if (!defaultContent || !Array.isArray(defaultContent)) return [];

    return defaultContent.map((item: any) => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      contentType: item.contentType,
      fileUrl: item.mediaUrl || item.fileUrl,
      thumbnailUrl: item.thumbnailUrl,
      speaker: item.author?.firstName
        ? `${item.author.firstName} ${item.author.lastName}`
        : "Unknown",
      uploadedBy: item.author?._id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      views: item.viewCount || 0,
      sheared: item.shareCount || 0,
      saved: 0,
      comment: item.commentCount || 0,
      favorite: item.likeCount || 0,
      imageUrl: item.thumbnailUrl,
      speakerAvatar: item.author?.avatar,
    }));
  }, [defaultContent]);

  // Filter content by type
  const allVideos = useMemo(
    () => mediaList.filter((item) => item.contentType === "video"),
    [mediaList]
  );

  const allMusic = useMemo(
    () => mediaList.filter((item) => item.contentType === "audio"),
    [mediaList]
  );

  const allEbooks = useMemo(
    () => mediaList.filter((item) =>
      item.contentType === "ebook" ||
      item.contentType === "books" ||
      item.contentType === "image"
    ),
    [mediaList]
  );

  // Load content on mount
  useEffect(() => {
    console.log("🚀 Loading default content from backend...");
    fetchDefaultContent({ page: 1, limit: 10 });
  }, [fetchDefaultContent]);

  // Handle refresh
  const handleRefresh = () => {
    refreshDefaultContent();
  };

  // Handle load more
  const handleLoadMore = () => {
    loadMoreDefaultContent();
  };

  return (
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl
          refreshing={defaultContentLoading && mediaList.length > 0}
          onRefresh={handleRefresh}
          colors={["#666"]}
          tintColor="#666"
        />
      }
      onMomentumScrollEnd={handleLoadMore}
    >
      {/* Most Recent Section */}
      {allVideos.length > 0 && (
        <View>
          <Text className="text-[16px] font-rubik-semibold px-4 mt-5 mb-3">
            Most Recent
          </Text>
          {/* Render most recent video */}
        </View>
      )}

      {/* Videos Section */}
      {allVideos.length > 0 && (
        <View className="mt-5">
          <Text className="text-[16px] font-rubik-semibold px-4 mb-3">
            Videos
          </Text>
          {allVideos.map((video, index) => (
            // Render video card
            <VideoCard key={video._id || index} video={video} index={index} />
          ))}
        </View>
      )}

      {/* Music Section */}
      {allMusic.length > 0 && (
        <View className="mt-5">
          <Text className="text-[16px] font-rubik-semibold px-4 mb-3">
            Music
          </Text>
          {allMusic.map((audio, index) => (
            // Render music card
            <MusicCard key={audio._id || index} audio={audio} index={index} />
          ))}
        </View>
      )}

      {/* Ebooks Section */}
      {allEbooks.length > 0 && (
        <View className="mt-5">
          <Text className="text-[16px] font-rubik-semibold px-4 mb-3">
            E-Books
          </Text>
          {allEbooks.map((ebook, index) => (
            // Render ebook card
            <EbookCard key={ebook._id || index} ebook={ebook} index={index} />
          ))}
        </View>
      )}

      {/* Loading indicator */}
      {defaultContentLoading && (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#256E63" />
          <Text style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
            Loading content...
          </Text>
        </View>
      )}

      {/* Error state */}
      {defaultContentError && (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ color: "#FF6B6B", fontSize: 14, textAlign: "center" }}>
            {defaultContentError}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default AllContentTikTok;
```

## 🔄 Data Flow

### **1. Initial Load**

```typescript
// Component mounts
useEffect(() => {
  fetchDefaultContent({ page: 1, limit: 10 });
}, []);

// Store calls API
const response = await allMediaAPI.getDefaultContent({ page: 1, limit: 10 });

// Store updates state
set({
  defaultContent: response.data.content,
  defaultContentPagination: response.data.pagination,
  defaultContentLoading: false,
});
```

### **2. Refresh**

```typescript
// User pulls to refresh
const handleRefresh = () => {
  refreshDefaultContent(); // Calls fetchDefaultContent({ page: 1 })
};
```

### **3. Load More**

```typescript
// User scrolls to bottom
const handleLoadMore = () => {
  loadMoreDefaultContent(); // Calls fetchDefaultContent({ page: nextPage })
};
```

### **4. Interactions**

```typescript
// Like action
const handleLike = async (contentId: string, liked: boolean) => {
  const response = await allMediaAPI.toggleLike("media", contentId);
  // Update UI based on response
};
```

## 🎯 Key Features

### **Content Types Supported**

- **Videos**: `contentType: "videos"` - Full-screen video playback
- **Music**: `contentType: "audio"` - Audio playback with progress bar
- **Sermons**: `contentType: "sermon"` - Can be video or audio
- **Ebooks**: `contentType: "ebook"` or `"books"` - PDF/EPUB files

### **Interactive Elements**

- **Play/Pause**: Video and audio controls
- **Progress Bar**: Shows playback progress
- **Volume Control**: Mute/unmute functionality
- **Like/Unlike**: Heart icon with count
- **Comment**: Comment icon with count
- **Save/Bookmark**: Save to library
- **Share**: Share content
- **Download**: Download for offline use

### **UI Sections**

- **Most Recent**: Latest content across all types
- **Videos**: All video content
- **Music**: All audio content
- **Sermons**: All sermon content
- **E-Books**: All ebook content

## 🚀 Getting Started

1. **Set up API service** with the provided `allMediaAPI` utility
2. **Create store** using Zustand with the provided store implementation
3. **Implement component** using the provided component structure
4. **Test endpoints** using the `testAvailableEndpoints()` function
5. **Handle responses** according to the JSON format specifications

## 🔧 Environment Variables

```env
EXPO_PUBLIC_API_URL=https://jevahapp-backend.onrender.com
```

## 📱 UI Requirements

- **React Native** with Expo
- **Expo AV** for video/audio playback
- **Zustand** for state management
- **React Native Vector Icons** for icons
- **React Native Share** for sharing functionality

This implementation provides a complete TikTok-style interface for consuming all media content from your backend API.

