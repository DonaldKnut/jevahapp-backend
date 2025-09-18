# 🔄 Frontend Migration Guide - URL Simplification

## 📋 **Migration Overview**

This guide helps you migrate your existing frontend code from signed URLs to clean URLs. The migration is straightforward and will improve performance and reliability.

## 🎯 **Step-by-Step Migration**

### **Step 1: Remove URL Conversion Functions**

**Find and remove these functions:**

```javascript
// ❌ REMOVE THESE FUNCTIONS
function convertToPublicUrl(signedUrl) {
  if (!signedUrl) return null;
  try {
    const url = new URL(signedUrl);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch (error) {
    console.error("Error converting URL:", error);
    return signedUrl;
  }
}

function cleanSignedUrl(url) {
  // Remove query parameters
  return url.split("?")[0];
}

function extractPublicUrl(signedUrl) {
  // Extract clean URL from signed URL
  const url = new URL(signedUrl);
  return url.origin + url.pathname;
}
```

### **Step 2: Update API Service Functions**

**Before (Old Code):**

```javascript
// ❌ OLD CODE
export const mediaAPI = {
  getDefaultContent: async () => {
    const response = await fetch("/api/media/default");
    const data = await response.json();

    // Convert URLs
    const content = data.data.content.map(item => ({
      ...item,
      mediaUrl: convertToPublicUrl(item.mediaUrl),
      thumbnailUrl: convertToPublicUrl(item.thumbnailUrl),
    }));

    return content;
  },
};
```

**After (New Code):**

```javascript
// ✅ NEW CODE
export const mediaAPI = {
  getDefaultContent: async () => {
    const response = await fetch("/api/media/default");
    const data = await response.json();

    // Use URLs directly - no conversion needed!
    return data.data.content;
  },
};
```

### **Step 3: Update Media Player Components**

**Before (Old Code):**

```javascript
// ❌ OLD CODE
const MediaPlayer = ({ mediaItem }) => {
  const [mediaUrl, setMediaUrl] = useState(null);

  useEffect(() => {
    // Convert URL before using
    const cleanUrl = convertToPublicUrl(mediaItem.mediaUrl);
    setMediaUrl(cleanUrl);
  }, [mediaItem.mediaUrl]);

  return <Video source={{ uri: mediaUrl }} style={styles.video} />;
};
```

**After (New Code):**

```javascript
// ✅ NEW CODE
const MediaPlayer = ({ mediaItem }) => {
  // Use URL directly - no conversion needed!
  const mediaUrl = mediaItem.mediaUrl;

  return <Video source={{ uri: mediaUrl }} style={styles.video} />;
};
```

### **Step 4: Update Image Components**

**Before (Old Code):**

```javascript
// ❌ OLD CODE
const MediaThumbnail = ({ mediaItem }) => {
  const thumbnailUrl = convertToPublicUrl(mediaItem.thumbnailUrl);

  return <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />;
};
```

**After (New Code):**

```javascript
// ✅ NEW CODE
const MediaThumbnail = ({ mediaItem }) => {
  // Use URL directly - no conversion needed!
  const thumbnailUrl = mediaItem.thumbnailUrl;

  return <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />;
};
```

### **Step 5: Update Download Handlers**

**Before (Old Code):**

```javascript
// ❌ OLD CODE
const downloadMedia = async (mediaId, token) => {
  const response = await fetch(`/api/media/${mediaId}/download`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileSize: 5242880 }),
  });
  const data = await response.json();

  // Convert download URL
  const downloadUrl = convertToPublicUrl(data.downloadUrl);

  // Download file
  const result = await FileSystem.downloadAsync(
    downloadUrl,
    FileSystem.documentDirectory + "file.mp3"
  );
};
```

**After (New Code):**

```javascript
// ✅ NEW CODE
const downloadMedia = async (mediaId, token) => {
  const response = await fetch(`/api/media/${mediaId}/download`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileSize: 5242880 }),
  });
  const data = await response.json();

  // Use download URL directly - no conversion needed!
  const downloadUrl = data.downloadUrl;

  // Download file
  const result = await FileSystem.downloadAsync(
    downloadUrl,
    FileSystem.documentDirectory + "file.mp3"
  );
};
```

### **Step 6: Update URL Validation**

**Before (Old Code):**

```javascript
// ❌ OLD CODE
const isValidSignedUrl = url => {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    // Check for AWS signature parameters
    return urlObj.searchParams.has("X-Amz-Algorithm");
  } catch (error) {
    return false;
  }
};
```

**After (New Code):**

```javascript
// ✅ NEW CODE
const isValidMediaUrl = url => {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    // Check for clean R2 URL
    return (
      urlObj.protocol === "https:" &&
      urlObj.hostname.includes("r2.cloudflarestorage.com") &&
      !urlObj.search
    ); // No query parameters
  } catch (error) {
    return false;
  }
};
```

### **Step 7: Update Error Handling**

**Before (Old Code):**

```javascript
// ❌ OLD CODE
const handleMediaError = (error, mediaItem) => {
  console.error("Media loading error:", error);

  // Try to convert URL as fallback
  const fallbackUrl = convertToPublicUrl(mediaItem.mediaUrl);
  if (fallbackUrl !== mediaItem.mediaUrl) {
    // Retry with converted URL
    setMediaUrl(fallbackUrl);
  }
};
```

**After (New Code):**

```javascript
// ✅ NEW CODE
const handleMediaError = (error, mediaItem) => {
  console.error("Media loading error:", error);
  console.error("Failed URL:", mediaItem.mediaUrl);

  // Show user-friendly error
  Alert.alert(
    "Media Error",
    "Failed to load media. Please check your internet connection.",
    [{ text: "OK" }]
  );
};
```

## 🔍 **Search and Replace Patterns**

Use these patterns to find and update your code:

### **Find These Patterns:**

```javascript
// Search for these patterns in your codebase
convertToPublicUrl(
cleanSignedUrl(
extractPublicUrl(
convertToPublicUrl(
```

### **Replace With:**

```javascript
// Replace with direct usage
// Remove the function call entirely
```

## 📱 **Component-Specific Updates**

### **Video Component**

```javascript
// Before
<Video source={{ uri: convertToPublicUrl(mediaItem.mediaUrl) }} />

// After
<Video source={{ uri: mediaItem.mediaUrl }} />
```

### **Audio Component**

```javascript
// Before
<Audio.Sound source={{ uri: convertToPublicUrl(mediaItem.mediaUrl) }} />

// After
<Audio.Sound source={{ uri: mediaItem.mediaUrl }} />
```

### **Image Component**

```javascript
// Before
<Image source={{ uri: convertToPublicUrl(mediaItem.thumbnailUrl) }} />

// After
<Image source={{ uri: mediaItem.thumbnailUrl }} />
```

## 🧪 **Testing After Migration**

### **Test Checklist:**

- [ ] **Audio Playback**: Test audio files play correctly
- [ ] **Video Playback**: Test video files play correctly
- [ ] **Image Display**: Test thumbnails load correctly
- [ ] **Download Function**: Test file downloads work
- [ ] **Error Handling**: Test invalid URLs are handled gracefully
- [ ] **Performance**: Test loading times are improved
- [ ] **Memory Usage**: Test no memory leaks

### **Test URLs:**

```javascript
// Test these URL formats
const testUrls = [
  "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/song.mp3",
  "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-videos/video.mp4",
  "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-thumbnails/thumb.webp",
];

// These should all work directly without conversion
testUrls.forEach(url => {
  console.log("Testing URL:", url);
  // Test with your media components
});
```

## 🚨 **Common Issues and Solutions**

### **Issue 1: URLs Still Have Query Parameters**

**Solution:** Check if you're using cached API responses. Clear cache and refresh.

### **Issue 2: Media Not Loading**

**Solution:** Verify the URL format and check network connectivity.

### **Issue 3: Performance Issues**

**Solution:** Remove any remaining URL conversion logic that might be running.

### **Issue 4: Error Handling**

**Solution:** Update error messages to reflect the new URL system.

## 📊 **Performance Improvements**

After migration, you should see:

- **Faster API responses** (smaller payloads)
- **Reduced CPU usage** (no URL conversion)
- **Better memory efficiency** (no temporary URL objects)
- **Improved reliability** (no expiration issues)

## 🎉 **Migration Complete!**

Once you've completed all steps:

1. **Remove all URL conversion functions**
2. **Update all media components**
3. **Test all functionality**
4. **Deploy to production**

The new system is more reliable, performant, and easier to maintain! 🚀

## 📞 **Support**

If you encounter issues during migration:

1. **Check URL Format**: Ensure URLs are clean (no query parameters)
2. **Verify Endpoints**: Make sure you're using the correct API endpoints
3. **Test Network**: Ensure device has internet connectivity
4. **Review Logs**: Check console logs for specific error messages
5. **Clear Cache**: Clear any cached API responses

The migration should be straightforward, and the new system will provide better performance and reliability! 🎯
