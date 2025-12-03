# Offline Downloads List Endpoint

**Date:** 2025-01-27  
**Status:** ✅ **EXISTS** - Endpoint available and enhanced

---

## ✅ Endpoint Available

### Get All Offline Downloads

**Endpoint:** `GET /api/media/offline-downloads`

**Authentication:** ✅ Required (Bearer token)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

---

## 📋 Response Format

```json
{
  "success": true,
  "data": {
    "downloads": [
      {
        "mediaId": {
          "_id": "507f1f77bcf86cd799439011",
          "title": "Gospel Song Title",
          "description": "Song description",
          "thumbnailUrl": "https://r2.cloudflare.com/...",
          "contentType": "music",
          "duration": 180,
          "isPublicDomain": true,
          "speaker": "Artist Name",
          "year": 2024,
          "category": "Worship",
          "tags": ["gospel", "worship"],
          "fileUrl": "https://r2.cloudflare.com/..."
        },
        "downloadDate": "2025-01-27T10:30:00.000Z",
        "fileName": "Gospel Song Title",
        "fileSize": 5242880,
        "contentType": "music",
        "downloadUrl": "https://r2.cloudflare.com/media/audio123.mp3",
        "localPath": null,
        "isDownloaded": false,
        "downloadProgress": 0,
        "downloadStatus": "pending"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

---

## ✅ Includes Copyright-Free Songs

**Yes!** The endpoint automatically includes copyright-free songs because:

1. **Copyright-free songs are stored in the Media model** with `isPublicDomain: true`
2. **Download tracking uses the same system** - when copyright-free songs are downloaded via `/api/audio/copyright-free/:songId/download`, they're added to the user's `offlineDownloads` array with the `mediaId`
3. **The endpoint populates mediaId** which returns the full media document, including copyright-free songs

### How to Identify Copyright-Free Songs

Look for `isPublicDomain: true` in the populated `mediaId` object:

```json
{
  "mediaId": {
    "_id": "...",
    "title": "Copyright-Free Song",
    "contentType": "music",
    "isPublicDomain": true,  // ← This indicates it's copyright-free
    "speaker": "Artist Name",
    "year": 2024
  }
}
```

---

## 🔄 How It Works

1. **User downloads any media** (regular media or copyright-free):
   - Regular media: `POST /api/media/:id/download`
   - Copyright-free: `POST /api/audio/copyright-free/:songId/download`

2. **Backend adds to offlineDownloads**:
   - All downloads are stored in `user.offlineDownloads[]` array
   - Each entry has a `mediaId` reference to the Media document

3. **User fetches downloads**:
   - `GET /api/media/offline-downloads` returns all downloads
   - Backend populates the `mediaId` field with full media details
   - Includes both regular media and copyright-free songs

---

## 📊 Enhanced Fields (2025-01-27)

Recently enhanced to include more fields for better identification:

**Added fields in populate:**
- `isPublicDomain` - Identifies copyright-free songs
- `speaker` - Artist/speaker name (for copyright-free songs)
- `year` - Release year
- `category` - Content category
- `tags` - Content tags
- `fileUrl` - Direct file URL

**Existing fields:**
- `title` - Media title
- `description` - Media description
- `thumbnailUrl` - Thumbnail image
- `contentType` - Media type (music, audio, videos, etc.)
- `duration` - Duration in seconds

---

## 🎯 Usage Example

### Frontend Implementation

```typescript
// Fetch all offline downloads (includes copyright-free songs)
const getOfflineDownloads = async (page = 1, limit = 20) => {
  const response = await fetch(
    `${API_URL}/api/media/offline-downloads?page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();
  
  if (data.success) {
    // Separate copyright-free songs from regular media
    const copyrightFree = data.data.downloads.filter(
      (download: any) => download.mediaId?.isPublicDomain === true
    );
    
    const regularMedia = data.data.downloads.filter(
      (download: any) => !download.mediaId?.isPublicDomain
    );
    
    return {
      all: data.data.downloads,
      copyrightFree,
      regularMedia,
      pagination: data.data.pagination,
    };
  }
};
```

---

## 🗑️ Remove Download

To remove an item from offline downloads:

**Endpoint:** `DELETE /api/media/offline-downloads/:mediaId`

**Example:**
```typescript
const removeDownload = async (mediaId: string) => {
  await fetch(`${API_URL}/api/media/offline-downloads/${mediaId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};
```

---

## ✅ Summary

- ✅ **Endpoint exists:** `GET /api/media/offline-downloads`
- ✅ **Includes copyright-free songs** automatically
- ✅ **Populates full media details** including copyright-free metadata
- ✅ **Paginated response** for efficient loading
- ✅ **Enhanced with more fields** for better identification

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27  
**Status:** ✅ Complete and Enhanced

