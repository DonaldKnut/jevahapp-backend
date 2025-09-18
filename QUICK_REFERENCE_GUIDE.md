# 🚀 Quick Reference Guide - Clean URLs

## 📋 **TL;DR**

- **Before**: URLs had AWS signature parameters (`?X-Amz-Algorithm=...`)
- **After**: Clean URLs without any query parameters
- **Action**: Use URLs directly from API responses - no conversion needed!

## 🎯 **Common Use Cases**

### **1. Fetch Default Content**

```javascript
const response = await fetch("/api/media/default?page=1&limit=10");
const data = await response.json();
const mediaItems = data.data.content;

// Use URLs directly
mediaItems.forEach(item => {
  console.log("Media URL:", item.mediaUrl); // Clean URL
  console.log("Thumbnail URL:", item.thumbnailUrl); // Clean URL
});
```

### **2. Play Audio/Video**

```javascript
// React Native with Expo AV
import { Video, Audio } from 'expo-av';

// Video
<Video
  source={{ uri: mediaItem.mediaUrl }} // Direct usage
  style={{ width: 300, height: 200 }}
/>

// Audio
<Audio.Sound
  source={{ uri: mediaItem.mediaUrl }} // Direct usage
/>
```

### **3. Display Images**

```javascript
// React Native Image
<Image
  source={{ uri: mediaItem.thumbnailUrl }} // Direct usage
  style={{ width: 100, height: 100 }}
/>
```

### **4. Download Files**

```javascript
// Get download URL
const response = await fetch(`/api/media/${mediaId}/download`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ fileSize: 5242880 }),
});
const data = await response.json();
const downloadUrl = data.downloadUrl; // Clean URL

// Download file
const result = await FileSystem.downloadAsync(
  downloadUrl, // Direct usage
  FileSystem.documentDirectory + "file.mp3"
);
```

## 🔧 **Code Changes Needed**

### **Remove This (Old Code):**

```javascript
// ❌ REMOVE THIS
function convertToPublicUrl(signedUrl) {
  const url = new URL(signedUrl);
  return `${url.protocol}//${url.host}${url.pathname}`;
}

const cleanUrl = convertToPublicUrl(response.data.mediaUrl);
```

### **Use This (New Code):**

```javascript
// ✅ USE THIS
const mediaUrl = response.data.mediaUrl; // Already clean!
```

## 📡 **Endpoint Examples**

### **Default Content**

```bash
GET /api/media/default?page=1&limit=10
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "mediaUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/song.mp3",
        "thumbnailUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/thumb.webp"
      }
    ]
  }
}
```

### **All Content**

```bash
GET /api/media/all-content
```

**Response:**

```json
{
  "success": true,
  "media": [
    {
      "fileUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-videos/video.mp4",
      "thumbnailUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/thumb.webp"
    }
  ]
}
```

### **Download**

```bash
POST /api/media/123/download
```

**Response:**

```json
{
  "success": true,
  "downloadUrl": "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/song.mp3"
}
```

## 🎯 **Content Types**

- `videos` → `video` (for Video component)
- `music` → `audio` (for Audio component)
- `books` → `image` (for Image component)

## 🚨 **Error Handling**

```javascript
// Simple error handling
try {
  const response = await fetch("/api/media/default");
  const data = await response.json();

  if (data.success) {
    // Use data.data.content directly
    const mediaItems = data.data.content;
  } else {
    throw new Error(data.message);
  }
} catch (error) {
  console.error("API Error:", error);
  // Handle error
}
```

## ✅ **Testing Checklist**

- [ ] Audio files play correctly
- [ ] Video files play correctly
- [ ] Images load correctly
- [ ] Downloads work correctly
- [ ] No URL conversion errors
- [ ] Performance is improved

## 🎉 **That's It!**

The URLs are now clean and ready to use directly. No more complex conversion logic needed! 🚀
