# 🚀 Frontend URL Simplification Guide

## 📋 **Overview**

The backend has been updated to return **clean, direct public URLs** instead of signed URLs with AWS signature parameters. This eliminates the need for URL conversion logic in the frontend and provides better performance and reliability.

## 🎯 **What Changed**

### **Before (Signed URLs):**

```javascript
// Old response with signed URLs
{
  "mediaUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/kefee_thank-you-my-god.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=92dafeb76f86a6bb3e5dbcc37f4c1a1c%2F20250918%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250918T030724Z&X-Amz-Expires=3600&X-Amz-Signature=4e10192f590450735a81bece35bd5ff27324ed5b56f9bde8d746136e478167c7&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
}
```

### **After (Clean URLs):**

```javascript
// New response with clean URLs
{
  "mediaUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/kefee_thank-you-my-god.mp3"
}
```

## 📡 **Updated Endpoints**

### **1. Default Content Endpoint**

```http
GET /api/media/default
```

**Query Parameters:**

- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)
- `contentType` (optional) - Filter by content type (default: all)

**Example Request:**

```javascript
const response = await fetch(
  "/api/media/default?page=1&limit=10&contentType=all"
);
const data = await response.json();
```

**Response Format:**

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "title": "Thank You My God - Kefee",
        "description": "Gospel music by Kefee",
        "mediaUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/kefee_thank-you-my-god.mp3",
        "thumbnailUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/Kefee-2.webp",
        "contentType": "audio",
        "duration": 180,
        "author": {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
          "firstName": "Kefee",
          "lastName": "Branama",
          "avatar": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/Kefee-2.webp"
        },
        "likeCount": 42,
        "commentCount": 8,
        "shareCount": 12,
        "viewCount": 1250,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    }
  }
}
```

### **2. All Content Endpoint (Authenticated)**

```http
GET /api/media/all-content
```

**Headers Required:**

```javascript
{
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

**Response Format:**

```json
{
  "success": true,
  "media": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "title": "2 Hours time with God with Dunsin Oyekan",
      "contentType": "live",
      "category": "worship",
      "fileUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-videos/dunsin_2hours.mp4",
      "thumbnailUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/dunsin_thumb.webp",
      "uploadedBy": {
        "firstName": "Minister Pius",
        "lastName": "Tagbas",
        "avatar": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/pius_avatar.webp",
        "isVerified": true
      },
      "viewCount": 550,
      "likeCount": 600,
      "commentCount": 45,
      "shareCount": 900,
      "duration": 7200,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 150
}
```

### **3. Public All Content Endpoint (No Auth)**

```http
GET /api/media/public/all-content
```

**No authentication required**

**Response Format:**

```json
{
  "success": true,
  "media": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "title": "Worship Session - Hillsong",
      "contentType": "music",
      "category": "worship",
      "fileUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/hillsong_worship.mp3",
      "thumbnailUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/hillsong_thumb.webp",
      "uploadedBy": {
        "firstName": "Hillsong",
        "lastName": "Worship",
        "avatar": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/hillsong_avatar.webp"
      },
      "viewCount": 1250,
      "likeCount": 890,
      "commentCount": 67,
      "shareCount": 234,
      "duration": 240,
      "createdAt": "2024-01-15T08:00:00Z"
    }
  ],
  "total": 150
}
```

### **4. Download Endpoint**

```http
POST /api/media/:id/download
```

**Headers Required:**

```javascript
{
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

**Request Body:**

```json
{
  "fileSize": 5242880
}
```

**Response Format:**

```json
{
  "success": true,
  "message": "Download recorded successfully",
  "downloadUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/kefee_thank-you-my-god.mp3"
}
```

## 🔧 **Frontend Implementation**

### **1. Remove Old URL Conversion Logic**

**Before (Remove this):**

```javascript
// OLD CODE - REMOVE THIS
function convertToPublicUrl(signedUrl) {
  if (!signedUrl) return null;

  try {
    const url = new URL(signedUrl);
    // Remove query parameters
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch (error) {
    console.error("Error converting URL:", error);
    return signedUrl;
  }
}

// OLD USAGE - REMOVE THIS
const cleanUrl = convertToPublicUrl(response.data.mediaUrl);
```

**After (Use directly):**

```javascript
// NEW CODE - USE DIRECTLY
const mediaUrl = response.data.mediaUrl; // Already clean!
```

### **2. Updated API Service**

```javascript
// utils/mediaAPI.js
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://jevahapp-backend.onrender.com";

export const mediaAPI = {
  // Get default content
  getDefaultContent: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append("page", params.page);
      if (params.limit) queryParams.append("limit", params.limit);
      if (params.contentType)
        queryParams.append("contentType", params.contentType);

      const response = await fetch(
        `${API_BASE_URL}/api/media/default?${queryParams}`
      );
      const data = await response.json();

      if (data.success) {
        return data.data.content; // Array of media items
      }
      throw new Error(data.message || "Failed to fetch default content");
    } catch (error) {
      console.error("Error fetching default content:", error);
      throw error;
    }
  },

  // Get all content (authenticated)
  getAllContent: async token => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/media/all-content`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      if (data.success) {
        return data.media; // Array of media items
      }
      throw new Error(data.message || "Failed to fetch all content");
    } catch (error) {
      console.error("Error fetching all content:", error);
      throw error;
    }
  },

  // Get public all content (no auth)
  getPublicAllContent: async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/media/public/all-content`
      );
      const data = await response.json();

      if (data.success) {
        return data.media; // Array of media items
      }
      throw new Error(data.message || "Failed to fetch public content");
    } catch (error) {
      console.error("Error fetching public content:", error);
      throw error;
    }
  },

  // Download media
  downloadMedia: async (mediaId, fileSize, token) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/media/${mediaId}/download`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileSize }),
        }
      );
      const data = await response.json();

      if (data.success) {
        return data.downloadUrl; // Clean download URL
      }
      throw new Error(data.message || "Failed to initiate download");
    } catch (error) {
      console.error("Error downloading media:", error);
      throw error;
    }
  },
};
```

### **3. Media Player Implementation**

```javascript
// components/MediaPlayer.js
import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Video, Audio } from "expo-av";

const MediaPlayer = ({ mediaItem }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Use media URL directly - no conversion needed!
  const mediaUrl = mediaItem.mediaUrl;
  const thumbnailUrl = mediaItem.thumbnailUrl;

  const handlePlay = async () => {
    try {
      if (mediaItem.contentType === "video") {
        if (videoRef.current) {
          await videoRef.current.playAsync();
        }
      } else if (mediaItem.contentType === "audio") {
        if (audioRef.current) {
          await audioRef.current.playAsync();
        }
      }
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing media:", error);
      Alert.alert("Error", "Failed to play media");
    }
  };

  const handlePause = async () => {
    try {
      if (mediaItem.contentType === "video") {
        if (videoRef.current) {
          await videoRef.current.pauseAsync();
        }
      } else if (mediaItem.contentType === "audio") {
        if (audioRef.current) {
          await audioRef.current.pauseAsync();
        }
      }
      setIsPlaying(false);
    } catch (error) {
      console.error("Error pausing media:", error);
    }
  };

  return (
    <View style={styles.container}>
      {mediaItem.contentType === "video" ? (
        <Video
          ref={videoRef}
          source={{ uri: mediaUrl }} // Direct URL usage
          style={styles.video}
          resizeMode="contain"
          onPlaybackStatusUpdate={status => {
            setPosition(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
            setIsPlaying(status.isPlaying || false);
          }}
        />
      ) : (
        <View style={styles.audioContainer}>
          <Text style={styles.title}>{mediaItem.title}</Text>
          <Text style={styles.author}>
            {mediaItem.author?.firstName} {mediaItem.author?.lastName}
          </Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity onPress={isPlaying ? handlePause : handlePlay}>
          <Text style={styles.playButton}>{isPlaying ? "Pause" : "Play"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: 200,
  },
  audioContainer: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  author: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 5,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 20,
  },
  playButton: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
};

export default MediaPlayer;
```

### **4. Image Display Component**

```javascript
// components/MediaThumbnail.js
import React from "react";
import { Image, View, Text } from "react-native";

const MediaThumbnail = ({ mediaItem, style }) => {
  // Use thumbnail URL directly - no conversion needed!
  const thumbnailUrl = mediaItem.thumbnailUrl || mediaItem.mediaUrl;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: thumbnailUrl }} // Direct URL usage
        style={styles.thumbnail}
        resizeMode="cover"
        onError={error => {
          console.log("Thumbnail load error:", error);
          // Handle error if needed
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.title}>{mediaItem.title}</Text>
        <Text style={styles.author}>
          {mediaItem.author?.firstName} {mediaItem.author?.lastName}
        </Text>
      </View>
    </View>
  );
};

const styles = {
  container: {
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: 200,
    borderRadius: 8,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  author: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 2,
  },
};

export default MediaThumbnail;
```

### **5. Download Handler**

```javascript
// hooks/useDownload.js
import { useState } from "react";
import { Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import { mediaAPI } from "../utils/mediaAPI";

export const useDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const downloadMedia = async (mediaItem, token) => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      // Get clean download URL from backend
      const downloadUrl = await mediaAPI.downloadMedia(
        mediaItem._id,
        mediaItem.fileSize || 0,
        token
      );

      // Download file using clean URL
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl, // Direct URL usage
        FileSystem.documentDirectory + `${mediaItem.title}.mp3`,
        {
          onProgress: progress => {
            const progressPercent =
              (progress.totalBytesWritten /
                progress.totalBytesExpectedToWrite) *
              100;
            setDownloadProgress(progressPercent);
          },
        }
      );

      if (downloadResult.status === 200) {
        Alert.alert("Success", "File downloaded successfully");
        return downloadResult.uri;
      } else {
        throw new Error("Download failed");
      }
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Error", "Failed to download file");
      throw error;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return {
    downloadMedia,
    isDownloading,
    downloadProgress,
  };
};
```

## 🎯 **Content Type Mapping**

The backend returns content types in the following format:

```javascript
// Content type mapping
const contentTypeMap = {
  videos: "video",
  sermon: "video",
  audio: "audio",
  music: "audio",
  devotional: "audio",
  ebook: "image",
  books: "image",
};
```

## 🔍 **URL Validation**

Since URLs are now clean, you can simplify validation:

```javascript
// Simple URL validation
const isValidMediaUrl = url => {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    return (
      urlObj.protocol === "https:" &&
      urlObj.hostname.includes("r2.cloudflarestorage.com")
    );
  } catch (error) {
    return false;
  }
};

// Usage
if (isValidMediaUrl(mediaItem.mediaUrl)) {
  // Use the URL
} else {
  console.error("Invalid media URL:", mediaItem.mediaUrl);
}
```

## 🚨 **Error Handling**

```javascript
// Error handling for media loading
const handleMediaError = (error, mediaItem) => {
  console.error("Media loading error:", error);
  console.error("Media item:", mediaItem);

  // Log the URL for debugging
  console.error("Failed URL:", mediaItem.mediaUrl);

  // Show user-friendly error
  Alert.alert("Media Error", "Failed to load media. Please try again.", [
    { text: "OK" },
  ]);
};
```

## 📱 **React Native Specific Notes**

### **Expo AV Configuration**

```javascript
// app.json or expo.json
{
  "expo": {
    "plugins": [
      [
        "expo-av",
        {
          "microphonePermission": "Allow Jevah to access your microphone for recording.",
          "cameraPermission": "Allow Jevah to access your camera for video recording."
        }
      ]
    ]
  }
}
```

### **Network Security**

```javascript
// For Android, ensure network security config allows HTTPS
// android/app/src/main/res/xml/network_security_config.xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">r2.cloudflarestorage.com</domain>
    </domain-config>
</network-security-config>
```

## 🧪 **Testing Checklist**

- [ ] **Audio Playback**: Test audio files play correctly
- [ ] **Video Playback**: Test video files play correctly
- [ ] **Image Display**: Test thumbnails load correctly
- [ ] **Download Function**: Test file downloads work
- [ ] **Error Handling**: Test invalid URLs are handled gracefully
- [ ] **Network Issues**: Test offline/network error scenarios
- [ ] **Performance**: Test loading times are improved
- [ ] **Memory Usage**: Test no memory leaks with media players

## 🎉 **Benefits Summary**

1. **✅ Simplified Code**: No more URL conversion logic
2. **✅ Better Performance**: Smaller response payloads
3. **✅ Improved Reliability**: No expiration issues
4. **✅ Easier Debugging**: Clean, readable URLs
5. **✅ Direct Playback**: Media players work seamlessly
6. **✅ Reduced Complexity**: Less error-prone code

## 📞 **Support**

If you encounter any issues with the new URL system:

1. **Check URL Format**: Ensure URLs start with `https://` and contain `r2.cloudflarestorage.com`
2. **Verify Endpoints**: Make sure you're using the correct endpoint URLs
3. **Test Network**: Ensure device has internet connectivity
4. **Check Permissions**: Verify media player permissions are granted
5. **Review Logs**: Check console logs for specific error messages

The new system is designed to be more reliable and easier to work with. All URLs are now permanent and don't require any conversion or special handling! 🚀
