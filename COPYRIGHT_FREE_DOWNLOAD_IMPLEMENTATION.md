# Copyright-Free Songs Download - Implementation Guide

**Date:** 2025-01-27  
**Status:** ✅ **IMPLEMENTED** - Download endpoint added

---

## ✅ Implementation Complete

### What Was Added

**Copyright-free songs CAN NOW be downloaded for offline listening!**

**New Endpoint:**
- `POST /api/audio/copyright-free/:songId/download` - Download a copyright-free song for offline listening

**Implementation Details:**

1. ✅ **Controller Function** - Added `downloadCopyrightFreeSong()` in `src/controllers/audio.controller.ts`
2. ✅ **Route** - Added download route in `src/routes/audio.route.ts`
3. ✅ **Uses Existing Service** - Leverages `MediaService.downloadMedia()` since copyright-free songs are stored in the Media model
4. ✅ **Validation** - Verifies song exists, is copyright-free (`isPublicDomain: true`), and is an audio file
5. ✅ **Same Download Flow** - Uses the same offline download tracking as regular media

---

## 📋 API Usage

### Endpoint

```
POST /api/audio/copyright-free/:songId/download
```

### Authentication

✅ **Required** - User must be authenticated

### Request Body (Optional)

```json
{
  "fileSize": 1024000  // Optional: File size in bytes
}
```

### Response

```json
{
  "success": true,
  "message": "Download recorded successfully",
  "downloadUrl": "https://r2.cloudflare.com/media/audio123.mp3",
  "fileName": "Gospel Song",
  "fileSize": 1024000,
  "contentType": "music"
}
```

### Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Song not found"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "This song is not available for download as a copyright-free song"
}
```
OR
```json
{
  "success": false,
  "message": "Song file not available for download"
}
```

---

## 🎯 How It Works

1. **User requests download** via `POST /api/audio/copyright-free/:songId/download`
2. **Backend validates:**
   - User is authenticated
   - Song exists
   - Song is copyright-free (`isPublicDomain: true`)
   - Song is an audio/music file
   - File URL is available
3. **Backend uses existing MediaService** to:
   - Record download interaction
   - Add to user's `offlineDownloads` array
   - Return download URL and metadata
4. **Frontend downloads** the file from the `downloadUrl` to app storage
5. **Frontend updates** the download status in `offlineDownloads` (when implemented)

---

## 🔗 Integration with Existing System

### Uses Existing Media Download Service

Since copyright-free songs are stored in the `Media` model with `isPublicDomain: true`, the download endpoint:

- ✅ Uses `MediaService.downloadMedia()` (same as regular media)
- ✅ Adds to user's `offlineDownloads` array (same structure)
- ✅ Records download interaction
- ✅ Returns download URL for frontend to fetch

### Offline Downloads Structure

The download is added to the user's `offlineDownloads` array with:

```typescript
{
  mediaId: ObjectId,        // The song's Media ID
  downloadDate: Date,
  fileName: string,
  fileSize: number,
  contentType: string,      // "music" or "audio"
  downloadUrl: string,      // Cloudflare R2 URL
  localPath?: string,       // Frontend manages this
  isDownloaded: boolean,    // Frontend updates this
  downloadProgress?: number,
  downloadStatus?: "pending" | "downloading" | "completed" | "failed"
}
```

---

## 📱 Frontend Implementation

### Example Request

```typescript
// Download a copyright-free song
const downloadSong = async (songId: string) => {
  try {
    const response = await fetch(
      `${API_URL}/api/audio/copyright-free/${songId}/download`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileSize: audioFileSize, // Optional
        }),
      }
    );

    const data = await response.json();
    
    if (data.success) {
      // Download the file from downloadUrl
      await downloadFileToLocalStorage(data.downloadUrl, songId);
      
      // Update backend with local path (when endpoint is ready)
      // PATCH /api/media/offline-downloads/:mediaId
    }
  } catch (error) {
    console.error('Download failed:', error);
  }
};
```

### Get User's Downloaded Songs

Users can get their downloaded copyright-free songs via the existing endpoint:

```
GET /api/media/offline-downloads
```

This will return all downloads including copyright-free songs (since they're stored in the Media model).

---

## ✅ Testing

### Test Case 1: Download with fileSize
```bash
POST /api/audio/copyright-free/:songId/download
Body: { "fileSize": 1024000 }
```
**Expected:** Uses provided fileSize ✅

### Test Case 2: Download without fileSize
```bash
POST /api/audio/copyright-free/:songId/download
Body: {}
```
**Expected:** Fetches fileSize from media document ✅

### Test Case 3: Download non-copyright-free song
```bash
POST /api/audio/copyright-free/:regularMediaId/download
```
**Expected:** Returns 403 error (not a copyright-free song) ✅

### Test Case 4: Download without authentication
```bash
POST /api/audio/copyright-free/:songId/download
```
**Expected:** Returns 401 error ✅

---

## 🎯 Summary

**Current Status:** ✅ **YES** - Users can now download copyright-free songs for offline listening

**What Works:**
- ✅ Download endpoint: `POST /api/audio/copyright-free/:songId/download`
- ✅ Authentication required
- ✅ Validates copyright-free status
- ✅ Returns download URL
- ✅ Tracks downloads in user's offlineDownloads
- ✅ Uses existing Media download infrastructure

**Frontend Needs To:**
1. Call the download endpoint
2. Download the file from `downloadUrl` to app storage
3. Update backend with `localPath` and `isDownloaded` status (when endpoint is ready)

---

**Document Version:** 2.0  
**Last Updated:** 2025-01-27  
**Status:** ✅ Complete - Ready for use
