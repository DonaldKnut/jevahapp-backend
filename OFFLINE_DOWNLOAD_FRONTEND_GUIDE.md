# 📱 **Offline Download Frontend Implementation Guide**

## 🎯 **Overview**

This guide provides complete implementation for offline download functionality in your React Native app. Users can download media content for offline viewing/listening.

---

## 🚀 **Backend Endpoints Available**

### **1. Initiate Download**

```http
POST /api/media/:id/download
Authorization: Bearer <user_token>
Content-Type: application/json

Body:
{
  "fileSize": 1024000
}
```

**Response:**

```json
{
  "success": true,
  "downloadUrl": "https://signed-url-from-cloudflare-r2.com/file.mp4",
  "fileName": "In His Face - Bob Sorge",
  "fileSize": 1024000,
  "contentType": "video/mp4",
  "message": "Download initiated successfully"
}
```

### **2. Get User's Offline Downloads**

```http
GET /api/media/offline-downloads?page=1&limit=20
Authorization: Bearer <user_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "mediaId": "68b6c565a65fe359311eaf79",
        "downloadDate": "2025-01-XX...",
        "fileName": "In His Face - Bob Sorge",
        "fileSize": 1024000,
        "contentType": "video/mp4",
        "downloadUrl": "https://signed-url-from-cloudflare-r2.com/file.mp4",
        "localPath": "/storage/downloads/file.mp4",
        "isDownloaded": true,
        "downloadProgress": 100,
        "downloadStatus": "completed",
        "mediaId": {
          "_id": "68b6c565a65fe359311eaf79",
          "title": "In His Face - Bob Sorge",
          "description": "Powerful worship song",
          "thumbnailUrl": "https://...",
          "contentType": "video/mp4",
          "duration": 240
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

### **3. Remove from Offline Downloads**

```http
DELETE /api/media/offline-downloads/:mediaId
Authorization: Bearer <user_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Media removed from offline downloads"
}
```

---

## 📦 **Required Dependencies**

Add these to your `package.json`:

```json
{
  "dependencies": {
    "react-native-fs": "^2.20.0",
    "react-native-permissions": "^3.10.1",
    "react-native-document-picker": "^9.1.1"
  }
}
```

**Install:**

```bash
npm install react-native-fs react-native-permissions react-native-document-picker
cd ios && pod install # For iOS
```

---

## 🔧 **API Service Implementation**

### **Update `allMediaAPI.ts`**

```typescript
// Add to your existing allMediaAPI.ts

class AllMediaAPI {
  // ... existing methods ...

  /**
   * Initiate download for offline use
   */
  async downloadMedia(mediaId: string, fileSize: number = 0) {
    try {
      const response = await fetch(
        `${this.baseURL}/media/${mediaId}/download`,
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

      if (!response.ok) {
        throw new Error(data.message || "Download failed");
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Download media error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user's offline downloads
   */
  async getOfflineDownloads(page: number = 1, limit: number = 20) {
    try {
      const response = await fetch(
        `${this.baseURL}/media/offline-downloads?page=${page}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to get offline downloads");
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error("Get offline downloads error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Remove media from offline downloads
   */
  async removeFromOfflineDownloads(mediaId: string) {
    try {
      const response = await fetch(
        `${this.baseURL}/media/offline-downloads/${mediaId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to remove from offline downloads"
        );
      }

      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error("Remove from offline downloads error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new AllMediaAPI();
```

---

## 📱 **Download Service Implementation**

### **Create `DownloadService.ts`**

```typescript
import RNFS from "react-native-fs";
import { PermissionsAndroid, Platform } from "react-native";

interface DownloadProgress {
  mediaId: string;
  progress: number;
  status: "pending" | "downloading" | "completed" | "failed";
  localPath?: string;
}

class DownloadService {
  private downloads: Map<string, DownloadProgress> = new Map();
  private listeners: ((downloads: DownloadProgress[]) => void)[] = [];

  /**
   * Request storage permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
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
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS permissions handled by Info.plist
  }

  /**
   * Download media file
   */
  async downloadMedia(
    mediaId: string,
    downloadUrl: string,
    fileName: string,
    contentType: string
  ): Promise<boolean> {
    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error("Storage permission denied");
      }

      // Create downloads directory
      const downloadsDir = `${RNFS.DocumentDirectoryPath}/downloads`;
      await RNFS.mkdir(downloadsDir);

      // Generate local file path
      const fileExtension = this.getFileExtension(contentType);
      const localPath = `${downloadsDir}/${mediaId}${fileExtension}`;

      // Initialize download progress
      this.updateDownloadProgress(mediaId, {
        mediaId,
        progress: 0,
        status: "downloading",
        localPath,
      });

      // Start download
      const downloadResult = await RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: localPath,
        progress: res => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          this.updateDownloadProgress(mediaId, {
            mediaId,
            progress: Math.round(progress),
            status: "downloading",
            localPath,
          });
        },
      }).promise;

      if (downloadResult.statusCode === 200) {
        this.updateDownloadProgress(mediaId, {
          mediaId,
          progress: 100,
          status: "completed",
          localPath,
        });
        return true;
      } else {
        throw new Error(
          `Download failed with status: ${downloadResult.statusCode}`
        );
      }
    } catch (error) {
      console.error("Download error:", error);
      this.updateDownloadProgress(mediaId, {
        mediaId,
        progress: 0,
        status: "failed",
      });
      return false;
    }
  }

  /**
   * Get file extension from content type
   */
  private getFileExtension(contentType: string): string {
    const extensions: { [key: string]: string } = {
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/ogg": ".ogg",
      "audio/mpeg": ".mp3",
      "audio/mp3": ".mp3",
      "audio/wav": ".wav",
      "audio/ogg": ".ogg",
      "audio/aac": ".aac",
      "audio/flac": ".flac",
      "application/pdf": ".pdf",
      "application/epub+zip": ".epub",
    };
    return extensions[contentType] || ".bin";
  }

  /**
   * Update download progress
   */
  private updateDownloadProgress(mediaId: string, progress: DownloadProgress) {
    this.downloads.set(mediaId, progress);
    this.notifyListeners();
  }

  /**
   * Get download progress for a media item
   */
  getDownloadProgress(mediaId: string): DownloadProgress | undefined {
    return this.downloads.get(mediaId);
  }

  /**
   * Get all download progress
   */
  getAllDownloadProgress(): DownloadProgress[] {
    return Array.from(this.downloads.values());
  }

  /**
   * Check if file exists locally
   */
  async isFileDownloaded(localPath: string): Promise<boolean> {
    try {
      return await RNFS.exists(localPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete downloaded file
   */
  async deleteDownloadedFile(localPath: string): Promise<boolean> {
    try {
      if (await RNFS.exists(localPath)) {
        await RNFS.unlink(localPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Delete file error:", error);
      return false;
    }
  }

  /**
   * Get local file URI for playback
   */
  getLocalFileUri(localPath: string): string {
    return `file://${localPath}`;
  }

  /**
   * Add progress listener
   */
  addProgressListener(listener: (downloads: DownloadProgress[]) => void) {
    this.listeners.push(listener);
  }

  /**
   * Remove progress listener
   */
  removeProgressListener(listener: (downloads: DownloadProgress[]) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    this.listeners.forEach(listener => {
      listener(this.getAllDownloadProgress());
    });
  }
}

export default new DownloadService();
```

---

## 🎨 **UI Components**

### **1. Download Button Component**

```typescript
// components/DownloadButton.tsx
import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import allMediaAPI from '../utils/allMediaAPI';
import DownloadService from '../services/DownloadService';

interface DownloadButtonProps {
  mediaId: string;
  fileName: string;
  contentType: string;
  fileSize?: number;
  onDownloadComplete?: (success: boolean) => void;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  mediaId,
  fileName,
  contentType,
  fileSize = 0,
  onDownloadComplete,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);

  useEffect(() => {
    // Check if already downloaded
    checkDownloadStatus();

    // Listen for download progress
    const progressListener = (downloads: any[]) => {
      const download = downloads.find(d => d.mediaId === mediaId);
      if (download) {
        setDownloadProgress(download.progress);
        setIsDownloading(download.status === 'downloading');
        setIsDownloaded(download.status === 'completed');
      }
    };

    DownloadService.addProgressListener(progressListener);
    return () => DownloadService.removeProgressListener(progressListener);
  }, [mediaId]);

  const checkDownloadStatus = async () => {
    const progress = DownloadService.getDownloadProgress(mediaId);
    if (progress) {
      setDownloadProgress(progress.progress);
      setIsDownloading(progress.status === 'downloading');
      setIsDownloaded(progress.status === 'completed');
    }
  };

  const handleDownload = async () => {
    if (isDownloaded) {
      Alert.alert(
        'Already Downloaded',
        'This content is already available offline.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      // Initiate download with backend
      const response = await allMediaAPI.downloadMedia(mediaId, fileSize);

      if (!response.success) {
        throw new Error(response.error);
      }

      const { downloadUrl } = response.data;

      // Start actual file download
      const success = await DownloadService.downloadMedia(
        mediaId,
        downloadUrl,
        fileName,
        contentType
      );

      if (success) {
        Alert.alert('Success', 'Content downloaded successfully!');
        onDownloadComplete?.(true);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download content');
      onDownloadComplete?.(false);
    } finally {
      setIsDownloading(false);
    }
  };

  const getButtonText = () => {
    if (isDownloaded) return 'Downloaded';
    if (isDownloading) return `${downloadProgress}%`;
    return 'Download';
  };

  const getButtonIcon = () => {
    if (isDownloaded) return 'check-circle';
    if (isDownloading) return 'downloading';
    return 'download';
  };

  return (
    <TouchableOpacity
      style={[
        styles.downloadButton,
        isDownloaded && styles.downloadedButton,
        isDownloading && styles.downloadingButton,
      ]}
      onPress={handleDownload}
      disabled={isDownloading}
    >
      <View style={styles.buttonContent}>
        {isDownloading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name={getButtonIcon()} size={20} color="#fff" />
        )}
        <Text style={styles.buttonText}>{getButtonText()}</Text>
      </View>

      {isDownloading && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${downloadProgress}%` }
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = {
  downloadButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  downloadedButton: {
    backgroundColor: '#34C759',
  },
  downloadingButton: {
    backgroundColor: '#FF9500',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
};

export default DownloadButton;
```

### **2. Offline Downloads Screen**

```typescript
// screens/OfflineDownloadsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import allMediaAPI from '../utils/allMediaAPI';
import DownloadService from '../services/DownloadService';

interface OfflineDownload {
  mediaId: string;
  downloadDate: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadUrl: string;
  localPath?: string;
  isDownloaded: boolean;
  downloadProgress: number;
  downloadStatus: string;
  mediaId: {
    _id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    contentType: string;
    duration: number;
  };
}

const OfflineDownloadsScreen: React.FC = () => {
  const [downloads, setDownloads] = useState<OfflineDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadDownloads = useCallback(async (pageNum: number = 1, refresh: boolean = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await allMediaAPI.getOfflineDownloads(pageNum, 20);

      if (response.success) {
        const newDownloads = response.data.downloads || [];

        if (pageNum === 1) {
          setDownloads(newDownloads);
        } else {
          setDownloads(prev => [...prev, ...newDownloads]);
        }

        setHasMore(newDownloads.length === 20);
        setPage(pageNum);
      } else {
        Alert.alert('Error', response.error || 'Failed to load downloads');
      }
    } catch (error) {
      console.error('Load downloads error:', error);
      Alert.alert('Error', 'Failed to load downloads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  const handleRefresh = useCallback(() => {
    loadDownloads(1, true);
  }, [loadDownloads]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadDownloads(page + 1);
    }
  }, [loading, hasMore, page, loadDownloads]);

  const handleRemoveDownload = async (mediaId: string) => {
    Alert.alert(
      'Remove Download',
      'Are you sure you want to remove this download?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await allMediaAPI.removeFromOfflineDownloads(mediaId);

              if (response.success) {
                setDownloads(prev => prev.filter(d => d.mediaId !== mediaId));
                Alert.alert('Success', 'Download removed successfully');
              } else {
                Alert.alert('Error', response.error || 'Failed to remove download');
              }
            } catch (error) {
              console.error('Remove download error:', error);
              Alert.alert('Error', 'Failed to remove download');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderDownloadItem = ({ item }: { item: OfflineDownload }) => (
    <View style={styles.downloadItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.fileName}
        </Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveDownload(item.mediaId)}
        >
          <Icon name="delete" size={20} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      <View style={styles.itemDetails}>
        <Text style={styles.itemSize}>
          {formatFileSize(item.fileSize)}
        </Text>
        <Text style={styles.itemDate}>
          Downloaded {formatDate(item.downloadDate)}
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[
          styles.statusBadge,
          item.isDownloaded ? styles.completedBadge : styles.pendingBadge
        ]}>
          <Text style={styles.statusText}>
            {item.isDownloaded ? 'Available Offline' : 'Pending'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="download" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Downloads Yet</Text>
      <Text style={styles.emptySubtitle}>
        Download content to watch or listen offline
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#666" />
      </View>
    );
  };

  if (loading && downloads.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#666" />
        <Text style={styles.loadingText}>Loading downloads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={downloads}
        renderItem={renderDownloadItem}
        keyExtractor={(item) => item.mediaId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#666']}
            tintColor="#666"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  downloadItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  removeButton: {
    padding: 4,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemSize: {
    fontSize: 14,
    color: '#666',
  },
  itemDate: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadge: {
    backgroundColor: '#d4edda',
  },
  pendingBadge: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#155724',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
};

export default OfflineDownloadsScreen;
```

---

## 🔄 **Integration with Existing Components**

### **Update ContentCard Component**

```typescript
// Add to your existing ContentCard component
import DownloadButton from './DownloadButton';

const ContentCard: React.FC<ContentCardProps> = ({ content, onDownload }) => {
  // ... existing code ...

  return (
    <View style={styles.container}>
      {/* ... existing content ... */}

      {/* Add download button */}
      <View style={styles.actionButtons}>
        {/* ... existing buttons ... */}

        <DownloadButton
          mediaId={content._id}
          fileName={content.title}
          contentType={content.contentType}
          fileSize={content.fileSize}
          onDownloadComplete={(success) => {
            if (success) {
              onDownload?.(content._id);
            }
          }}
        />
      </View>
    </View>
  );
};
```

---

## 📱 **Usage Examples**

### **1. Basic Download**

```typescript
import DownloadService from "../services/DownloadService";

// Download a media file
const downloadMedia = async (mediaId: string) => {
  const response = await allMediaAPI.downloadMedia(mediaId, 0);

  if (response.success) {
    const { downloadUrl, fileName, contentType } = response.data;

    const success = await DownloadService.downloadMedia(
      mediaId,
      downloadUrl,
      fileName,
      contentType
    );

    if (success) {
      console.log("Download completed!");
    }
  }
};
```

### **2. Check Download Status**

```typescript
// Check if media is downloaded
const isDownloaded =
  DownloadService.getDownloadProgress(mediaId)?.status === "completed";

// Get local file path for playback
const progress = DownloadService.getDownloadProgress(mediaId);
const localPath = progress?.localPath;
const localUri = localPath ? DownloadService.getLocalFileUri(localPath) : null;
```

### **3. Play Downloaded Content**

```typescript
import { Video } from 'react-native-video';

const PlayDownloadedVideo = ({ mediaId }: { mediaId: string }) => {
  const progress = DownloadService.getDownloadProgress(mediaId);
  const localUri = progress?.localPath ? DownloadService.getLocalFileUri(progress.localPath) : null;

  if (!localUri) {
    return <Text>Content not downloaded</Text>;
  }

  return (
    <Video
      source={{ uri: localUri }}
      style={{ width: '100%', height: 200 }}
      controls
      resizeMode="contain"
    />
  );
};
```

---

## 🚨 **Important Notes**

### **Permissions**

- **Android**: Add `WRITE_EXTERNAL_STORAGE` permission to `android/app/src/main/AndroidManifest.xml`
- **iOS**: Add file access permissions to `ios/YourApp/Info.plist`

### **Storage Management**

- Downloaded files are stored in the app's document directory
- Consider implementing storage cleanup for old downloads
- Monitor storage usage and provide user controls

### **Error Handling**

- Always handle network errors gracefully
- Provide retry mechanisms for failed downloads
- Show clear error messages to users

### **Performance**

- Downloads run in background
- Progress updates are throttled to avoid UI lag
- Consider implementing download queue for multiple files

---

## 🧪 **Testing**

Use the provided test script to verify backend functionality:

```bash
node test-bookmark-system.js
```

Make sure to:

1. Replace `TEST_USER_TOKEN` with actual user token
2. Replace `TEST_MEDIA_ID` with actual media ID
3. Server is running on localhost:5000

---

## 🎉 **Summary**

This implementation provides:

✅ **Complete offline download functionality**  
✅ **Progress tracking and status updates**  
✅ **User-friendly UI components**  
✅ **Proper error handling**  
✅ **Storage management**  
✅ **Integration with existing components**

The frontend is now ready to provide a seamless offline experience for your users!
