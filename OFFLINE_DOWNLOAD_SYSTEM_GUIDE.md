# Offline Download System API Guide

## 🎯 Overview

The Offline Download System allows users to download media content (videos, audio, ebooks) for offline consumption. This feature is essential for users with limited internet connectivity or those who want to access content without using mobile data.

## 📡 Available Offline Download Endpoints

### **1. Initiate Download**

#### **Start Download Process**

```
POST /api/media/:id/download
```

- **Purpose**: Initiate download for offline use
- **Access**: Protected (Authentication required)
- **Content Types**: `videos`, `audio`, `sermon`, `ebook`, `books`

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
  "message": "Download recorded successfully",
  "data": {
    "downloadUrl": "https://example.com/signed-download-url",
    "fileName": "Sunday Service.mp4",
    "fileSize": 1024000,
    "contentType": "video/mp4"
  }
}
```

### **2. Get User's Offline Downloads**

#### **Retrieve Downloaded Content**

```
GET /api/media/offline-downloads
```

- **Purpose**: Get user's downloaded content list
- **Access**: Protected (Authentication required)
- **Pagination**: Supported with `page` and `limit` parameters

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
        "mediaId": "media_id",
        "downloadDate": "2024-01-15T10:00:00.000Z",
        "fileName": "Sunday Service.mp4",
        "fileSize": 1024000,
        "contentType": "video/mp4",
        "downloadUrl": "https://example.com/download-url",
        "isDownloaded": true,
        "downloadProgress": 100,
        "downloadStatus": "completed",
        "media": {
          "_id": "media_id",
          "title": "Sunday Service",
          "description": "Live worship service",
          "contentType": "videos",
          "fileUrl": "original_file_url",
          "thumbnailUrl": "thumbnail_url",
          "duration": 3600,
          "uploadedBy": {
            "_id": "user_id",
            "firstName": "Pastor",
            "lastName": "Williams",
            "avatar": "avatar_url"
          }
        }
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

### **3. Remove from Downloads**

#### **Delete Downloaded Content**

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

**Response:**

```json
{
  "success": true,
  "message": "Media removed from offline downloads successfully"
}
```

## 🔧 Frontend Implementation

### **API Service Setup**

```typescript
// utils/offlineDownloadAPI.ts
import { EXPO_PUBLIC_API_URL } from "@env";

const API_BASE_URL =
  EXPO_PUBLIC_API_URL || "https://jevahapp-backend.onrender.com";

export const offlineDownloadAPI = {
  // Initiate download
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

  // Get offline downloads
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

  // Remove from downloads
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
};
```

### **Download Store Implementation**

```typescript
// store/useDownloadStore.ts
import { create } from "zustand";
import { offlineDownloadAPI } from "../utils/offlineDownloadAPI";
import * as FileSystem from "expo-file-system";

interface DownloadItem {
  _id: string;
  mediaId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadUrl: string;
  localPath?: string;
  isDownloaded: boolean;
  downloadProgress: number;
  downloadStatus: "pending" | "downloading" | "completed" | "failed";
  media: {
    _id: string;
    title: string;
    description: string;
    contentType: string;
    thumbnailUrl: string;
    duration: number;
  };
}

interface DownloadStore {
  downloads: DownloadItem[];
  downloadingItems: Set<string>;
  downloadProgress: Record<string, number>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadDownloadedItems: () => Promise<void>;
  downloadMedia: (
    mediaId: string,
    downloadUrl: string,
    fileName: string
  ) => Promise<void>;
  removeDownload: (mediaId: string) => Promise<void>;
  checkIfDownloaded: (mediaId: string) => boolean;
  getDownloadedItem: (mediaId: string) => DownloadItem | undefined;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloads: [],
  downloadingItems: new Set(),
  downloadProgress: {},
  isLoading: false,
  error: null,

  loadDownloadedItems: async () => {
    set({ isLoading: true, error: null });

    try {
      // Get user token from auth store
      const { token } = useAuth.getState();
      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await offlineDownloadAPI.getOfflineDownloads(token);

      if (response.success) {
        set({
          downloads: response.data.downloads,
          isLoading: false,
        });
      } else {
        set({
          error: response.message || "Failed to load downloads",
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  downloadMedia: async (
    mediaId: string,
    downloadUrl: string,
    fileName: string
  ) => {
    const { downloadingItems, downloadProgress } = get();

    if (downloadingItems.has(mediaId)) {
      console.log("Download already in progress for:", mediaId);
      return;
    }

    set(state => ({
      downloadingItems: new Set([...state.downloadingItems, mediaId]),
      downloadProgress: { ...state.downloadProgress, [mediaId]: 0 },
    }));

    try {
      // Create downloads directory if it doesn't exist
      const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadsDir, {
          intermediates: true,
        });
      }

      // Generate unique filename
      const fileExtension = fileName.split(".").pop() || "mp4";
      const uniqueFileName = `${mediaId}_${Date.now()}.${fileExtension}`;
      const localPath = `${downloadsDir}${uniqueFileName}`;

      // Start download with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localPath,
        {},
        downloadProgress => {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          set(state => ({
            downloadProgress: {
              ...state.downloadProgress,
              [mediaId]: progress,
            },
          }));
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (result) {
        // Update download status
        set(state => ({
          downloads: state.downloads.map(item =>
            item.mediaId === mediaId
              ? {
                  ...item,
                  localPath: result.uri,
                  isDownloaded: true,
                  downloadProgress: 100,
                  downloadStatus: "completed" as const,
                }
              : item
          ),
          downloadingItems: new Set(
            [...downloadingItems].filter(id => id !== mediaId)
          ),
        }));

        console.log("✅ Download completed:", result.uri);
      }
    } catch (error) {
      console.error("❌ Download failed:", error);

      set(state => ({
        downloads: state.downloads.map(item =>
          item.mediaId === mediaId
            ? {
                ...item,
                downloadStatus: "failed" as const,
                downloadProgress: 0,
              }
            : item
        ),
        downloadingItems: new Set(
          [...downloadingItems].filter(id => id !== mediaId)
        ),
      }));
    }
  },

  removeDownload: async (mediaId: string) => {
    try {
      const { token } = useAuth.getState();
      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await offlineDownloadAPI.removeFromDownloads(
        mediaId,
        token
      );

      if (response.success) {
        // Remove from local state
        set(state => ({
          downloads: state.downloads.filter(item => item.mediaId !== mediaId),
        }));

        // Delete local file
        const downloadItem = get().downloads.find(
          item => item.mediaId === mediaId
        );
        if (downloadItem?.localPath) {
          try {
            await FileSystem.deleteAsync(downloadItem.localPath);
          } catch (fileError) {
            console.warn("Failed to delete local file:", fileError);
          }
        }
      } else {
        throw new Error(response.message || "Failed to remove download");
      }
    } catch (error) {
      console.error("❌ Failed to remove download:", error);
      throw error;
    }
  },

  checkIfDownloaded: (mediaId: string) => {
    const { downloads } = get();
    return downloads.some(
      item => item.mediaId === mediaId && item.isDownloaded
    );
  },

  getDownloadedItem: (mediaId: string) => {
    const { downloads } = get();
    return downloads.find(
      item => item.mediaId === mediaId && item.isDownloaded
    );
  },
}));
```

### **Download Handler Hook**

```typescript
// hooks/useDownloadHandler.ts
import { useState } from "react";
import { Alert } from "react-native";
import { useDownloadStore } from "../store/useDownloadStore";
import { offlineDownloadAPI } from "../utils/offlineDownloadAPI";
import { useAuth } from "./useAuth";

export const useDownloadHandler = () => {
  const { token } = useAuth();
  const { downloadMedia, checkIfDownloaded, getDownloadedItem } =
    useDownloadStore();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (mediaItem: {
    _id: string;
    title: string;
    contentType: string;
    fileSize?: number;
  }) => {
    if (!token) {
      Alert.alert(
        "Authentication Required",
        "Please log in to download content"
      );
      return;
    }

    if (checkIfDownloaded(mediaItem._id)) {
      Alert.alert("Already Downloaded", "This content is already downloaded");
      return;
    }

    setIsDownloading(true);

    try {
      // Step 1: Initiate download with backend
      const response = await offlineDownloadAPI.initiateDownload(
        mediaItem._id,
        token,
        mediaItem.fileSize
      );

      if (response.success) {
        // Step 2: Start actual file download
        await downloadMedia(
          mediaItem._id,
          response.data.downloadUrl,
          response.data.fileName
        );

        Alert.alert("Success", "Download started successfully");
      } else {
        Alert.alert("Error", response.message || "Failed to start download");
      }
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Error", "Failed to start download");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRemoveDownload = async (mediaId: string) => {
    try {
      await useDownloadStore.getState().removeDownload(mediaId);
      Alert.alert("Success", "Download removed successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to remove download");
    }
  };

  return {
    handleDownload,
    handleRemoveDownload,
    isDownloading,
    checkIfDownloaded,
    getDownloadedItem,
  };
};
```

### **UI Component Implementation**

```typescript
// components/DownloadButton.tsx
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDownloadHandler } from '../hooks/useDownloadHandler';
import { useDownloadStore } from '../store/useDownloadStore';

interface DownloadButtonProps {
  mediaId: string;
  mediaTitle: string;
  contentType: string;
  fileSize?: number;
  onDownloadComplete?: () => void;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  mediaId,
  mediaTitle,
  contentType,
  fileSize,
  onDownloadComplete,
}) => {
  const { handleDownload, isDownloading, checkIfDownloaded } = useDownloadHandler();
  const { downloadProgress, downloadingItems } = useDownloadStore();

  const isDownloaded = checkIfDownloaded(mediaId);
  const isCurrentlyDownloading = downloadingItems.has(mediaId);
  const progress = downloadProgress[mediaId] || 0;

  const handlePress = async () => {
    await handleDownload({
      _id: mediaId,
      title: mediaTitle,
      contentType,
      fileSize,
    });
    onDownloadComplete?.();
  };

  const getIconName = () => {
    if (isDownloaded) return 'checkmark-circle';
    if (isCurrentlyDownloading) return 'pause-circle';
    return 'download-outline';
  };

  const getIconColor = () => {
    if (isDownloaded) return '#256E63';
    if (isCurrentlyDownloading) return '#FEA74E';
    return '#98A2B3';
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDownloading || isCurrentlyDownloading}
      className="flex-row items-center"
    >
      {isCurrentlyDownloading ? (
        <ActivityIndicator size="small" color="#FEA74E" />
      ) : (
        <Ionicons
          name={getIconName()}
          size={28}
          color={getIconColor()}
        />
      )}

      {isCurrentlyDownloading && (
        <Text className="text-[10px] text-gray-500 ml-1 font-rubik">
          {Math.round(progress * 100)}%
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default DownloadButton;
```

### **Offline Downloads Screen**

```typescript
// screens/OfflineDownloadsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDownloadStore } from '../store/useDownloadStore';
import { useDownloadHandler } from '../hooks/useDownloadHandler';

const OfflineDownloadsScreen: React.FC = () => {
  const { downloads, isLoading, loadDownloadedItems } = useDownloadStore();
  const { handleRemoveDownload } = useDownloadHandler();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDownloadedItems();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDownloadedItems();
    setRefreshing(false);
  };

  const handleRemove = async (mediaId: string, title: string) => {
    Alert.alert(
      'Remove Download',
      `Are you sure you want to remove "${title}" from downloads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => handleRemoveDownload(mediaId),
        },
      ]
    );
  };

  const renderDownloadItem = ({ item }: { item: any }) => (
    <View className="flex-row items-center p-4 bg-white mb-2 rounded-lg shadow-sm">
      <Image
        source={{ uri: item.media.thumbnailUrl }}
        className="w-16 h-16 rounded-lg"
        resizeMode="cover"
      />

      <View className="flex-1 ml-4">
        <Text className="text-lg font-semibold text-gray-800" numberOfLines={2}>
          {item.media.title}
        </Text>
        <Text className="text-sm text-gray-500 mt-1">
          {item.contentType} • {(item.fileSize / 1024 / 1024).toFixed(1)} MB
        </Text>
        <Text className="text-xs text-gray-400 mt-1">
          Downloaded {new Date(item.downloadDate).toLocaleDateString()}
        </Text>

        {item.downloadStatus === 'completed' && (
          <View className="flex-row items-center mt-2">
            <Ionicons name="checkmark-circle" size={16} color="#256E63" />
            <Text className="text-xs text-green-600 ml-1">Ready for offline use</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={() => handleRemove(item.mediaId, item.media.title)}
        className="p-2"
      >
        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  if (isLoading && downloads.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#256E63" />
        <Text className="text-gray-500 mt-4">Loading downloads...</Text>
      </View>
    );
  }

  if (downloads.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Ionicons name="download-outline" size={64} color="#9CA3AF" />
        <Text className="text-xl font-semibold text-gray-600 mt-4">
          No Downloads Yet
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          Download content to enjoy it offline
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-800">
          Offline Downloads
        </Text>
        <Text className="text-gray-500 mt-1">
          {downloads.length} item{downloads.length !== 1 ? 's' : ''} downloaded
        </Text>
      </View>

      <FlatList
        data={downloads}
        renderItem={renderDownloadItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
};

export default OfflineDownloadsScreen;
```

## 🎯 Usage Examples

### **1. Basic Download Implementation**

```typescript
// In your media card component
const handleDownload = async (mediaItem: MediaItem) => {
  const { handleDownload } = useDownloadHandler();
  await handleDownload({
    _id: mediaItem._id,
    title: mediaItem.title,
    contentType: mediaItem.contentType,
    fileSize: mediaItem.fileSize,
  });
};
```

### **2. Check Download Status**

```typescript
// Check if content is downloaded
const { checkIfDownloaded } = useDownloadHandler();
const isDownloaded = checkIfDownloaded(mediaId);

// Get downloaded item details
const { getDownloadedItem } = useDownloadHandler();
const downloadedItem = getDownloadedItem(mediaId);
```

### **3. Offline Playback**

```typescript
// Play downloaded content
const playOfflineContent = (mediaId: string) => {
  const downloadedItem = getDownloadedItem(mediaId);
  if (downloadedItem?.localPath) {
    // Use local path for playback
    playMedia(downloadedItem.localPath);
  }
};
```

## 🔐 Authentication Requirements

**All offline download endpoints require authentication:**

- Include `Authorization: Bearer ${token}` header
- Token must be valid and not expired
- User must be logged in

## 📱 UI Integration Points

### **Visible in TikTok-Style UI:**

1. **Download Icon** - Initiate download
2. **Progress Indicator** - Show download progress
3. **Status Badge** - Downloaded/Downloading/Failed
4. **Offline Downloads Screen** - Manage downloaded content

### **Download Flow:**

1. User taps download button
2. Backend generates signed download URL
3. Frontend starts file download with progress tracking
4. File saved to device storage
5. Status updated in UI
6. Content available for offline playback

## 🚀 Key Features

### **Backend Features:**

- **Signed URLs**: Secure download links with expiration
- **Download Tracking**: Record user download history
- **File Management**: Track download status and progress
- **Storage Integration**: Cloudflare R2 integration

### **Frontend Features:**

- **Progress Tracking**: Real-time download progress
- **Offline Storage**: Local file management
- **Status Management**: Download state tracking
- **Error Handling**: Comprehensive error management
- **Storage Management**: Automatic cleanup and organization

This implementation provides a complete offline download system for your TikTok-style UI, enabling users to download and enjoy content without internet connectivity.

