# 📚 API Documentation - Clean URLs System

## 📋 **Overview**

This documentation covers all media-related API endpoints that now return clean, direct public URLs instead of signed URLs with AWS signature parameters.

## 🎯 **Base URL**

```
Production: https://jevahapp-backend.onrender.com
Development: http://localhost:3000
```

## 📡 **Media Endpoints**

### **1. Default Content Endpoint**

**Endpoint:** `GET /api/media/default`

**Description:** Retrieve default/onboarding content for new users

**Authentication:** Not required (Public)

**Query Parameters:**

- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)
- `contentType` (optional) - Filter by content type (default: all)

**Example Request:**

```bash
GET /api/media/default?page=1&limit=10&contentType=all
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

**Endpoint:** `GET /api/media/all-content`

**Description:** Retrieve all media content for authenticated users

**Authentication:** Required (Bearer Token)

**Headers:**

```javascript
{
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

**Example Request:**

```bash
GET /api/media/all-content
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

### **3. Public All Content Endpoint**

**Endpoint:** `GET /api/media/public/all-content`

**Description:** Retrieve all media content without authentication

**Authentication:** Not required (Public)

**Example Request:**

```bash
GET /api/media/public/all-content
```

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

### **4. Public Media Endpoint**

**Endpoint:** `GET /api/media/public`

**Description:** Retrieve media items with optional filters (no authentication required)

**Authentication:** Not required (Public)

**Query Parameters:**

- `search` (optional) - Search by title, description
- `contentType` (optional) - Filter by content type
- `category` (optional) - Filter by category
- `topics` (optional) - Comma-separated topics
- `sort` (optional) - Sort order (newest, oldest, popular)
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 50)
- `creator` (optional) - Filter by creator ID
- `duration` (optional) - Filter by duration (short, medium, long)
- `startDate` (optional) - ISO date string
- `endDate` (optional) - ISO date string

**Example Request:**

```bash
GET /api/media/public?contentType=videos&category=worship&page=1&limit=20
```

**Response Format:**

```json
{
  "success": true,
  "media": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "title": "Worship Video",
      "contentType": "videos",
      "category": "worship",
      "fileUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-videos/worship_video.mp4",
      "thumbnailUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/worship_thumb.webp",
      "uploadedBy": {
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/john_avatar.webp"
      },
      "viewCount": 500,
      "likeCount": 100,
      "commentCount": 25,
      "shareCount": 50,
      "duration": 300,
      "createdAt": "2024-01-15T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### **5. Download Media Endpoint**

**Endpoint:** `POST /api/media/:id/download`

**Description:** Initiate download for a media item

**Authentication:** Required (Bearer Token)

**Headers:**

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

**Example Request:**

```bash
POST /api/media/64f8a1b2c3d4e5f6a7b8c9d0/download
```

**Response Format:**

```json
{
  "success": true,
  "message": "Download recorded successfully",
  "downloadUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/kefee_thank-you-my-god.mp3"
}
```

### **6. Upload Media Endpoint**

**Endpoint:** `POST /api/media/upload`

**Description:** Upload a new media item with thumbnail

**Authentication:** Required (Bearer Token)

**Headers:**

```javascript
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

**Request Body (Multipart Form Data):**

- `title` (string) - Media title
- `description` (string, optional) - Media description
- `contentType` (string) - Content type (music, videos, books, live)
- `category` (string, optional) - Media category
- `topics` (string, optional) - Comma-separated topics
- `duration` (number, optional) - Duration in seconds
- `file` (File) - Media file
- `thumbnail` (File, optional) - Thumbnail image

**Example Request:**

```bash
POST /api/media/upload
Content-Type: multipart/form-data

title: "My Song"
description: "A beautiful song"
contentType: "music"
category: "worship"
file: [audio file]
thumbnail: [image file]
```

**Response Format:**

```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "media": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "title": "My Song",
    "description": "A beautiful song",
    "contentType": "music",
    "category": "worship",
    "fileUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/my_song.mp3",
    "thumbnailUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/my_song_thumb.webp",
    "uploadedBy": "64f8a1b2c3d4e5f6a7b8c9d1",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🎯 **Content Type Mapping**

The backend returns content types in the following format:

| Backend Type | Frontend Type | Description      |
| ------------ | ------------- | ---------------- |
| `videos`     | `video`       | Video content    |
| `sermon`     | `video`       | Sermon videos    |
| `audio`      | `audio`       | Audio content    |
| `music`      | `audio`       | Music content    |
| `devotional` | `audio`       | Devotional audio |
| `ebook`      | `image`       | E-book content   |
| `books`      | `image`       | Book content     |

## 🔍 **URL Format**

All media URLs follow this format:

```
https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-[type]/[filename]
```

**Examples:**

- Audio: `https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/song.mp3`
- Video: `https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-videos/video.mp4`
- Thumbnail: `https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/thumb.webp`

## 🚨 **Error Responses**

### **400 Bad Request**

```json
{
  "success": false,
  "message": "Invalid request parameters"
}
```

### **401 Unauthorized**

```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

### **404 Not Found**

```json
{
  "success": false,
  "message": "Media not found"
}
```

### **500 Internal Server Error**

```json
{
  "success": false,
  "message": "Failed to retrieve media"
}
```

## 🧪 **Testing Examples**

### **JavaScript/React Native**

```javascript
// Fetch default content
const fetchDefaultContent = async () => {
  try {
    const response = await fetch("/api/media/default?page=1&limit=10");
    const data = await response.json();

    if (data.success) {
      const mediaItems = data.data.content;
      mediaItems.forEach(item => {
        console.log("Media URL:", item.mediaUrl);
        console.log("Thumbnail URL:", item.thumbnailUrl);
      });
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

// Download media
const downloadMedia = async (mediaId, token) => {
  try {
    const response = await fetch(`/api/media/${mediaId}/download`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileSize: 5242880 }),
    });
    const data = await response.json();

    if (data.success) {
      const downloadUrl = data.downloadUrl;
      // Use downloadUrl directly for file download
    }
  } catch (error) {
    console.error("Error:", error);
  }
};
```

### **cURL Examples**

```bash
# Get default content
curl -X GET "https://jevahapp-backend.onrender.com/api/media/default?page=1&limit=10"

# Get all content (authenticated)
curl -X GET "https://jevahapp-backend.onrender.com/api/media/all-content" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Download media
curl -X POST "https://jevahapp-backend.onrender.com/api/media/64f8a1b2c3d4e5f6a7b8c9d0/download" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileSize": 5242880}'
```

## 📱 **Frontend Integration**

### **React Native with Expo AV**

```javascript
import { Video, Audio } from 'expo-av';

// Video component
<Video
  source={{ uri: mediaItem.mediaUrl }}
  style={{ width: 300, height: 200 }}
  resizeMode="contain"
/>

// Audio component
<Audio.Sound
  source={{ uri: mediaItem.mediaUrl }}
/>
```

### **React Native Image**

```javascript
import { Image } from "react-native";

<Image
  source={{ uri: mediaItem.thumbnailUrl }}
  style={{ width: 100, height: 100 }}
  resizeMode="cover"
/>;
```

## 🎉 **Benefits**

1. **✅ Clean URLs**: No AWS signature parameters
2. **✅ Better Performance**: Smaller response payloads
3. **✅ Improved Reliability**: No expiration issues
4. **✅ Easier Debugging**: Readable URLs
5. **✅ Direct Usage**: No URL conversion needed
6. **✅ Reduced Complexity**: Simpler frontend code

## 📞 **Support**

For API support or questions:

- Check URL format and endpoint URLs
- Verify authentication tokens
- Test network connectivity
- Review error messages in console logs

The new clean URL system provides better performance and reliability for your media applications! 🚀
