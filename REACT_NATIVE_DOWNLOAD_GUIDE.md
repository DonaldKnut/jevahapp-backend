# 📱 React Native Download & Offline Media Guide

## 🎯 **Overview**

This guide provides complete implementation for downloading media content for offline use in your React Native app. Users can download music, videos, and ebooks to enjoy without internet connection.

---

## 📡 **Download API Endpoints**

### **1. Initiate Download**

**Endpoint:** `POST /api/media/:id/download`

**Purpose:** Start downloading media for offline use

**Headers Required:**

```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Request Body:**

```json
{
  "fileSize": 15728640 // File size in bytes (optional)
}
```

**Response:**

```json
{
  "success": true,
  "message": "Download initiated successfully",
  "data": {
    "downloadUrl": "https://jevahapp-backend.onrender.com/api/media/download-file/abc123",
    "fileName": "Great_Are_You_Lord_Sinach.mp3",
    "fileSize": 15728640,
    "contentType": "audio/mpeg",
    "mediaId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "title": "Great Are You Lord - Sinach",
    "thumbnailUrl": "https://example.com/thumbnail.jpg"
  }
}
```

### **2. Get Offline Downloads**

**Endpoint:** `GET /api/media/offline-downloads`

**Purpose:** Retrieve user's downloaded media

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "mediaId": "64f8a1b2c3d4e5f6a7b8c9d0",
        "title": "Great Are You Lord - Sinach",
        "contentType": "music",
        "fileSize": 15728640,
        "fileName": "Great_Are_You_Lord_Sinach.mp3",
        "thumbnailUrl": "https://example.com/thumbnail.jpg",
        "downloadDate": "2024-01-15T10:00:00Z",
        "localPath": "/storage/downloads/Great_Are_You_Lord_Sinach.mp3",
        "isDownloaded": true,
        "downloadProgress": 100
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

### **3. Remove Download**

**Endpoint:** `DELETE /api/media/offline-downloads/:mediaId`

**Purpose:** Remove media from offline downloads

**Response:**

```json
{
  "success": true,
  "message": "Media removed from offline downloads"
}
```

---

## 🛠️ **React Native Implementation**

### **1. Download Service**

```typescript
// services/downloadService.ts
import RNFS from "react-native-fs";
import { PermissionsAndroid, Platform } from "react-native";

const BASE_URL = "https://jevahapp-backend.onrender.com";

export interface DownloadResponse {
  success: boolean;
  message: string;
  data: {
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    mediaId: string;
    title: string;
    thumbnailUrl: string;
  };
}

export interface OfflineDownload {
  mediaId: string;
  title: string;
  contentType: string;
  fileSize: number;
  fileName: string;
  thumbnailUrl: string;
  downloadDate: string;
  localPath: string;
  isDownloaded: boolean;
  downloadProgress: number;
}

export interface OfflineDownloadsResponse {
  success: boolean;
  data: {
    downloads: OfflineDownload[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

class DownloadService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async initiateDownload(
    mediaId: string,
    fileSize?: number
  ): Promise<DownloadResponse> {
    try {
      const response = await fetch(
        `${BASE_URL}/api/media/${mediaId}/download`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileSize }),
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error("Failed to initiate download");
    }
  }

  async downloadFile(downloadUrl: string, fileName: string): Promise<string> {
    try {
      // Request storage permission on Android
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: "Storage Permission",
            message: "App needs access to storage to download files",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error("Storage permission denied");
        }
      }

      const downloadDest = `${RNFS.DownloadDirectoryPath}/${fileName}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: downloadDest,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        progress: res => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          // Emit progress event
          this.emitProgress(mediaId, progress);
        },
      }).promise;

      return downloadDest;
    } catch (error) {
      throw new Error("Download failed");
    }
  }

  async getOfflineDownloads(
    page: number = 1,
    limit: number = 20
  ): Promise<OfflineDownloadsResponse> {
    try {
      const response = await fetch(
        `${BASE_URL}/api/media/offline-downloads?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error("Failed to get offline downloads");
    }
  }

  async removeDownload(mediaId: string): Promise<void> {
    try {
      const response = await fetch(
        `${BASE_URL}/api/media/offline-downloads/${mediaId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
    } catch (error) {
      throw new Error("Failed to remove download");
    }
  }

  private emitProgress(mediaId: string, progress: number) {
    // Emit progress event for UI updates
    // Implementation depends on your state management solution
  }
}

export default DownloadService;
```

### **2. Download Hook**

```typescript
// hooks/useDownload.ts
import { useState, useEffect, useCallback } from "react";
import DownloadService from "../services/downloadService";
import { OfflineDownload } from "../services/downloadService";

interface DownloadState {
  isDownloading: boolean;
  progress: number;
  error: string | null;
}

export const useDownload = (token: string) => {
  const [downloadStates, setDownloadStates] = useState<
    Record<string, DownloadState>
  >({});
  const [offlineDownloads, setOfflineDownloads] = useState<OfflineDownload[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  const downloadService = new DownloadService(token);

  const downloadMedia = useCallback(
    async (mediaId: string, fileName: string) => {
      try {
        setDownloadStates(prev => ({
          ...prev,
          [mediaId]: { isDownloading: true, progress: 0, error: null },
        }));

        // Initiate download
        const downloadResponse =
          await downloadService.initiateDownload(mediaId);

        if (!downloadResponse.success) {
          throw new Error(downloadResponse.message);
        }

        // Download file
        const localPath = await downloadService.downloadFile(
          downloadResponse.data.downloadUrl,
          downloadResponse.data.fileName
        );

        setDownloadStates(prev => ({
          ...prev,
          [mediaId]: { isDownloading: false, progress: 100, error: null },
        }));

        // Refresh offline downloads
        await loadOfflineDownloads();

        return localPath;
      } catch (error) {
        setDownloadStates(prev => ({
          ...prev,
          [mediaId]: {
            isDownloading: false,
            progress: 0,
            error: error instanceof Error ? error.message : "Download failed",
          },
        }));
        throw error;
      }
    },
    [downloadService]
  );

  const removeDownload = useCallback(
    async (mediaId: string) => {
      try {
        await downloadService.removeDownload(mediaId);
        await loadOfflineDownloads();
      } catch (error) {
        throw error;
      }
    },
    [downloadService]
  );

  const loadOfflineDownloads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await downloadService.getOfflineDownloads();
      setOfflineDownloads(response.data.downloads);
    } catch (error) {
      console.error("Failed to load offline downloads:", error);
    } finally {
      setLoading(false);
    }
  }, [downloadService]);

  useEffect(() => {
    if (token) {
      loadOfflineDownloads();
    }
  }, [token, loadOfflineDownloads]);

  return {
    downloadMedia,
    removeDownload,
    loadOfflineDownloads,
    downloadStates,
    offlineDownloads,
    loading,
  };
};
```

### **3. Download Button Component**

```typescript
// components/DownloadButton.tsx
import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface DownloadButtonProps {
  mediaId: string;
  fileName: string;
  isDownloaded: boolean;
  isDownloading: boolean;
  progress: number;
  onDownload: (mediaId: string, fileName: string) => Promise<void>;
  onRemove: (mediaId: string) => Promise<void>;
  size?: 'small' | 'medium' | 'large';
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  mediaId,
  fileName,
  isDownloaded,
  isDownloading,
  progress,
  onDownload,
  onRemove,
  size = 'medium',
}) => {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePress = async () => {
    // Animate button press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      if (isDownloaded) {
        Alert.alert(
          'Remove Download',
          'Are you sure you want to remove this download?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => onRemove(mediaId)
            },
          ]
        );
      } else {
        await onDownload(mediaId, fileName);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to download media');
    }
  };

  const getIconName = () => {
    if (isDownloading) return 'cloud-download';
    if (isDownloaded) return 'cloud-done';
    return 'cloud-download';
  };

  const getButtonText = () => {
    if (isDownloading) return `${Math.round(progress)}%`;
    if (isDownloaded) return 'Downloaded';
    return 'Download';
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.button];

    if (size === 'small') baseStyle.push(styles.buttonSmall);
    if (size === 'large') baseStyle.push(styles.buttonLarge);

    if (isDownloaded) baseStyle.push(styles.buttonDownloaded);
    if (isDownloading) baseStyle.push(styles.buttonDownloading);

    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText];

    if (size === 'small') baseStyle.push(styles.buttonTextSmall);
    if (size === 'large') baseStyle.push(styles.buttonTextLarge);

    if (isDownloaded) baseStyle.push(styles.buttonTextDownloaded);

    return baseStyle;
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        disabled={isDownloading}
        activeOpacity={0.8}
      >
        {isDownloading ? (
          <ActivityIndicator
            size="small"
            color={isDownloaded ? '#fff' : '#007AFF'}
          />
        ) : (
          <Icon
            name={getIconName()}
            size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
            color={isDownloaded ? '#fff' : '#007AFF'}
            style={styles.icon}
          />
        )}
        <Text style={getTextStyle()}>{getButtonText()}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#007AFF',
    minWidth: 100,
  },
  buttonSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 80,
  },
  buttonLarge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 120,
  },
  buttonDownloaded: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  buttonDownloading: {
    backgroundColor: '#f0f8ff',
    borderColor: '#007AFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  buttonTextSmall: {
    fontSize: 12,
  },
  buttonTextLarge: {
    fontSize: 16,
  },
  buttonTextDownloaded: {
    color: '#fff',
  },
  icon: {
    marginRight: 4,
  },
});
```

### **4. Download Progress Component**

```typescript
// components/DownloadProgress.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

interface DownloadProgressProps {
  progress: number;
  fileName: string;
  fileSize: number;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  progress,
  fileName,
  fileSize,
}) => {
  const [animatedProgress] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedProgress]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.fileName} numberOfLines={1}>
          {fileName}
        </Text>
        <Text style={styles.fileSize}>
          {formatFileSize(fileSize)}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: animatedProgress.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(progress)}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  fileSize: {
    fontSize: 14,
    color: '#666',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    minWidth: 40,
    textAlign: 'right',
  },
});
```

### **5. Offline Downloads Screen**

```typescript
// screens/OfflineDownloadsScreen.tsx
import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useDownload } from '../hooks/useDownload';
import { OfflineDownload } from '../services/downloadService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface OfflineDownloadsScreenProps {
  userToken: string;
  onMediaPress: (media: OfflineDownload) => void;
}

export const OfflineDownloadsScreen: React.FC<OfflineDownloadsScreenProps> = ({
  userToken,
  onMediaPress,
}) => {
  const {
    offlineDownloads,
    loading,
    removeDownload,
    loadOfflineDownloads,
  } = useDownload(userToken);

  const handleRemoveDownload = async (mediaId: string, title: string) => {
    Alert.alert(
      'Remove Download',
      `Are you sure you want to remove "${title}" from your downloads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeDownload(mediaId);
            } catch (error) {
              Alert.alert('Error', 'Failed to remove download');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderDownloadItem = ({ item }: { item: OfflineDownload }) => (
    <TouchableOpacity
      style={styles.downloadItem}
      onPress={() => onMediaPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.itemContent}>
        <View style={styles.mediaInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.fileInfo}>
            {formatFileSize(item.fileSize)} • Downloaded {formatDate(item.downloadDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveDownload(item.mediaId, item.title)}
        >
          <Icon name="delete" size={20} color="#ff3b30" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="cloud-download" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Downloads Yet</Text>
      <Text style={styles.emptySubtitle}>
        Download your favorite content to enjoy offline
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Offline Downloads</Text>
        <Text style={styles.headerSubtitle}>
          {offlineDownloads.length} item{offlineDownloads.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={offlineDownloads}
        renderItem={renderDownloadItem}
        keyExtractor={(item) => item.mediaId}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadOfflineDownloads}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  downloadItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  mediaInfo: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  fileInfo: {
    fontSize: 14,
    color: '#666',
  },
  removeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff5f5',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
```

### **6. Media Card with Download**

```typescript
// components/MediaCardWithDownload.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { DownloadButton } from './DownloadButton';
import { useDownload } from '../hooks/useDownload';

interface MediaCardWithDownloadProps {
  media: {
    _id: string;
    title: string;
    thumbnailUrl: string;
    contentType: string;
    uploadedBy: {
      firstName: string;
      lastName: string;
      avatar: string;
    };
    viewCount: number;
    likeCount: number;
  };
  userToken: string;
  onPress: (media: any) => void;
}

export const MediaCardWithDownload: React.FC<MediaCardWithDownloadProps> = ({
  media,
  userToken,
  onPress,
}) => {
  const { downloadMedia, removeDownload, downloadStates, offlineDownloads } = useDownload(userToken);

  const isDownloaded = offlineDownloads.some(download => download.mediaId === media._id);
  const downloadState = downloadStates[media._id] || { isDownloading: false, progress: 0, error: null };

  const handleDownload = async (mediaId: string, fileName: string) => {
    try {
      await downloadMedia(mediaId, fileName);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleRemove = async (mediaId: string) => {
    try {
      await removeDownload(mediaId);
    } catch (error) {
      console.error('Remove failed:', error);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(media)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: media.thumbnailUrl }} style={styles.thumbnail} />

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {media.title}
        </Text>

        <View style={styles.creatorInfo}>
          <Image source={{ uri: media.uploadedBy.avatar }} style={styles.avatar} />
          <Text style={styles.creatorName}>
            {media.uploadedBy.firstName} {media.uploadedBy.lastName}
          </Text>
        </View>

        <View style={styles.stats}>
          <Text style={styles.stat}>👁️ {media.viewCount}</Text>
          <Text style={styles.stat}>❤️ {media.likeCount}</Text>
        </View>
      </View>

      <View style={styles.downloadContainer}>
        <DownloadButton
          mediaId={media._id}
          fileName={`${media.title.replace(/[^a-zA-Z0-9]/g, '_')}.${media.contentType === 'music' ? 'mp3' : 'mp4'}`}
          isDownloaded={isDownloaded}
          isDownloading={downloadState.isDownloading}
          progress={downloadState.progress}
          onDownload={handleDownload}
          onRemove={handleRemove}
          size="small"
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  creatorName: {
    fontSize: 14,
    color: '#666',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontSize: 14,
    color: '#666',
  },
  downloadContainer: {
    padding: 16,
    paddingTop: 0,
    alignItems: 'flex-end',
  },
});
```

---

## 🎨 **UI Flow & User Experience**

### **1. Download Flow**

1. **User taps download icon** → Button shows loading state
2. **Download initiates** → Progress bar appears with percentage
3. **Download completes** → Button changes to "Downloaded" with checkmark
4. **User can access offline** → Content available in offline downloads screen

### **2. Visual States**

- **Default**: Blue download icon with "Download" text
- **Downloading**: Spinner with progress percentage
- **Downloaded**: Green checkmark with "Downloaded" text
- **Error**: Red exclamation with error message

### **3. Offline Downloads Screen**

- **Header**: Shows total number of downloads
- **List**: Each item shows title, file size, download date
- **Actions**: Tap to play, swipe to remove
- **Empty State**: Helpful message with download icon

---

## 📱 **Installation Requirements**

```bash
# Required packages
npm install react-native-fs
npm install react-native-vector-icons
npm install @react-native-async-storage/async-storage

# iOS setup
cd ios && pod install

# Android permissions (add to android/app/src/main/AndroidManifest.xml)
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

---

## 🚀 **Usage Example**

```typescript
// In your main app component
import { MediaCardWithDownload } from './components/MediaCardWithDownload';
import { OfflineDownloadsScreen } from './screens/OfflineDownloadsScreen';

const App = () => {
  const [userToken, setUserToken] = useState<string | null>(null);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MediaFeed">
          {(props) => (
            <MediaFeedScreen
              {...props}
              userToken={userToken}
              renderMediaCard={(media) => (
                <MediaCardWithDownload
                  media={media}
                  userToken={userToken}
                  onPress={handleMediaPress}
                />
              )}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="OfflineDownloads">
          {(props) => (
            <OfflineDownloadsScreen
              {...props}
              userToken={userToken}
              onMediaPress={handleMediaPress}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

This implementation provides a complete, beautiful, and user-friendly download system with offline capabilities for your React Native app! 🎉



