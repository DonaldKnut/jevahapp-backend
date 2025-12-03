# Offline Downloads - How It Works

## Current Backend Implementation

### ✅ What the Backend Does

1. **Tracks Download Metadata**
   - When a user taps "Download", the backend:
     - Records the download interaction
     - Adds metadata to the user's `offlineDownloads` array
     - Returns a `downloadUrl` (Cloudflare R2 URL)

2. **Stores Download Information**
   - Each download entry includes:
     - `mediaId` - Reference to the media
     - `downloadUrl` - URL to download the file from
     - `fileName`, `fileSize`, `contentType`
     - `localPath` - **Optional, managed by frontend**
     - `isDownloaded` - **Boolean, default `false`** (frontend updates this)
     - `downloadStatus` - `"pending" | "downloading" | "completed" | "failed"`
     - `downloadProgress` - Percentage (0-100)

3. **Provides Endpoints**
   - `POST /api/media/:id/download` - Initiate download (records metadata, returns URL)
   - `GET /api/media/offline-downloads` - Get user's downloaded items
   - `DELETE /api/media/offline-downloads/:mediaId` - Remove from downloads

### ⚠️ What the Backend Does NOT Do

- **Does NOT download the actual file** - Backend only provides the URL
- **Does NOT store files on the server** - Files stay in Cloudflare R2
- **Does NOT manage local file storage** - That's the frontend's responsibility

---

## How It Should Work (Frontend Implementation)

### Step 1: User Taps "Download"

```typescript
// Frontend calls backend
POST /api/media/:id/download
Body: { fileSize: 12345678 }

// Backend responds
{
  success: true,
  downloadUrl: "https://r2.cloudflare.com/media/video123.mp4",
  fileName: "Gospel Video",
  fileSize: 12345678
}
```

### Step 2: Frontend Downloads File to App Storage

```typescript
// Frontend uses Expo FileSystem or React Native FS
import * as FileSystem from 'expo-file-system';

// Download to app-specific directory (NOT device's public storage)
const localPath = FileSystem.documentDirectory + `downloads/${mediaId}.mp4`;

// Download the file
await FileSystem.downloadAsync(downloadUrl, localPath);

// Update backend with local path and status
PATCH /api/media/offline-downloads/:mediaId
Body: {
  localPath: localPath,
  isDownloaded: true,
  downloadStatus: "completed",
  downloadProgress: 100
}
```

### Step 3: Play from Local Storage

```typescript
// When user wants to watch offline
const download = await getOfflineDownload(mediaId);

if (download.isDownloaded && download.localPath) {
  // Play from local file
  playVideo(download.localPath); // Uses local URI, not network
} else {
  // Fallback to streaming
  playVideo(download.downloadUrl);
}
```

---

## Important: App-Only Storage (Not in Device Files/Gallery)

### ✅ Correct Implementation (App-Only)

**Use app-specific directories:**
- **iOS**: `NSDocumentDirectory` or `NSCachesDirectory` (not accessible via Files app)
- **Android**: App's private storage (not in Downloads/Gallery)
- **Expo**: `FileSystem.documentDirectory` or `FileSystem.cacheDirectory`

**Example:**
```typescript
// ✅ CORRECT - App-only storage
const localPath = FileSystem.documentDirectory + `downloads/${mediaId}.mp4`;
// Path: file:///var/mobile/Containers/Data/Application/.../downloads/video123.mp4
// NOT accessible via Files app or Gallery
```

### ❌ Wrong Implementation (Public Storage)

**Don't use:**
- Device's Downloads folder
- Gallery/Photos app
- Public file system locations

**Example:**
```typescript
// ❌ WRONG - Public storage
const localPath = '/storage/emulated/0/Download/video123.mp4';
// This would be visible in device's Files app
```

---

## Backend Support for Frontend Updates

### Current Status

The backend has fields ready for frontend to update:
- `localPath` - Where frontend stores the file
- `isDownloaded` - Whether file is actually downloaded
- `downloadStatus` - Current download state
- `downloadProgress` - Download progress percentage

### ⚠️ Missing Endpoint

**The backend currently doesn't have an endpoint to update these fields!**

You'll need to add:

```typescript
// Suggested endpoint
PATCH /api/media/offline-downloads/:mediaId
Body: {
  localPath?: string,
  isDownloaded?: boolean,
  downloadStatus?: "pending" | "downloading" | "completed" | "failed",
  downloadProgress?: number
}
```

Or update the existing download entry when frontend completes the download.

---

## Summary

### ✅ Backend Ready For:
- Tracking download metadata
- Providing download URLs
- Listing user's downloads
- Removing downloads

### ⚠️ Frontend Needs To:
1. **Download actual files** from `downloadUrl` to app-specific storage
2. **Update backend** with `localPath`, `isDownloaded`, `downloadStatus`
3. **Play from local files** when offline
4. **Use app-only storage** (not device's public storage)

### 🎯 Answer to Your Question

**Yes, users can download media for offline viewing within the app!**

- ✅ Backend tracks downloads and provides URLs
- ✅ Frontend downloads files to app-only storage (not visible in device Files/Gallery)
- ✅ Files are stored in app's private directory
- ✅ Users can watch offline from local storage

**The backend is ready. The frontend just needs to implement the actual file download and storage using app-specific directories.**

---

## Recommended Frontend Implementation

1. **Use Expo FileSystem** (if using Expo):
   ```typescript
   import * as FileSystem from 'expo-file-system';
   const downloadDir = FileSystem.documentDirectory + 'downloads/';
   ```

2. **Or React Native FS** (if not using Expo):
   ```typescript
   import RNFS from 'react-native-fs';
   const downloadDir = RNFS.DocumentDirectoryPath + '/downloads/';
   ```

3. **Download with progress tracking**:
   ```typescript
   const downloadResumable = FileSystem.createDownloadResumable(
     downloadUrl,
     localPath,
     {},
     (downloadProgress) => {
       const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
       // Update backend with progress
     }
   );
   await downloadResumable.downloadAsync();
   ```

4. **Update backend when complete**:
   ```typescript
   await updateOfflineDownload(mediaId, {
     localPath,
     isDownloaded: true,
     downloadStatus: 'completed',
     downloadProgress: 100
   });
   ```

