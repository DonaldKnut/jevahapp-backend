# Copyright-Free Songs Model Clarification

**Date:** 2025-01-27  
**Status:** 🔍 **CLARIFICATION NEEDED**

---

## ✅ Current Reality

### Copyright-Free Songs Have Their Own Model

**Model:** `CopyrightFreeSong` (separate collection)  
**File:** `src/models/copyrightFreeSong.model.ts`  
**Service:** `src/service/copyrightFreeSong.service.ts`  
**Controller:** `src/controllers/copyrightFreeSong.controller.ts`

**Fields:**
- `title` - Song title
- `singer` - Artist/author name
- `fileUrl` - Audio file URL
- `thumbnailUrl` - Optional thumbnail
- `likeCount`, `shareCount`, `viewCount` - Engagement metrics
- `duration` - Duration in seconds
- `uploadedBy` - Admin who uploaded

**Routes:** `/api/audio/copyright-free` uses the `CopyrightFreeSong` model

---

## ⚠️ Current Issue: Download Implementation

### Problem

The download endpoint I created (`downloadCopyrightFreeSong`) incorrectly uses the `Media` model instead of the `CopyrightFreeSong` model.

**Current (Wrong) Implementation:**
```typescript
// Uses Media model
const { Media } = await import("../models/media.model");
const song = await Media.findById(songId).select("...");
```

**Should Be:**
```typescript
// Use CopyrightFreeSong model
const { CopyrightFreeSong } = await import("../models/copyrightFreeSong.model");
const song = await CopyrightFreeSong.findById(songId);
```

---

## 🔄 Additional Issue: Offline Downloads Tracking

### Current Structure

The `offlineDownloads` array in the User model only supports `Media`:

```typescript
offlineDownloads: [{
  mediaId: ObjectId,  // Only references Media collection
  downloadDate: Date,
  fileName: string,
  fileSize: number,
  contentType: string,
  downloadUrl: string,
  // ...
}]
```

### Problem

- Copyright-free songs are in `CopyrightFreeSong` collection
- Offline downloads only reference `Media` collection
- Cannot track copyright-free song downloads properly

### Solution Needed

Update `offlineDownloads` to support both models (similar to playlists):

```typescript
offlineDownloads: [{
  // Content reference - one required
  mediaId?: ObjectId,                    // For regular Media
  copyrightFreeSongId?: ObjectId,        // For copyright-free songs
  downloadType: "media" | "copyrightFree", // Type discriminator
  
  downloadDate: Date,
  fileName: string,
  fileSize: number,
  contentType: string,
  downloadUrl: string,
  // ...
}]
```

---

## 📊 Comparison: Playlists vs Offline Downloads

### Playlists (Already Support Both)
```typescript
tracks: [{
  mediaId?: ObjectId,
  copyrightFreeSongId?: ObjectId,
  trackType: "media" | "copyrightFree",
  // ...
}]
```

### Offline Downloads (Currently Only Media)
```typescript
offlineDownloads: [{
  mediaId: ObjectId,  // Only Media
  // ...
}]
```

---

## 🎯 Required Changes

### 1. Fix Download Endpoint
- Use `CopyrightFreeSong` model instead of `Media` model
- Query the correct collection

### 2. Update Offline Downloads Schema
- Add `copyrightFreeSongId` field (optional)
- Add `downloadType` discriminator
- Make `mediaId` optional
- Update validation logic

### 3. Update Download Service
- Support adding both Media and CopyrightFreeSong downloads
- Handle both types when fetching downloads
- Populate correct model based on `downloadType`

### 4. Update Get Downloads Endpoint
- Populate both `mediaId` and `copyrightFreeSongId` based on type
- Return unified format

---

## 🔍 Codebase Confusion

There appears to be some confusion in the codebase:

1. **Routes use CopyrightFreeSong model** ✅
   - `/api/audio/copyright-free` → `copyrightFreeSong.controller.ts` → `CopyrightFreeSong` model

2. **Audio service queries Media model** ⚠️
   - `audio.service.ts` queries Media with `isPublicDomain: true`
   - But routes don't use audio.service for fetching songs

3. **Download endpoint uses Media model** ❌
   - Should use `CopyrightFreeSong` model

**Recommendation:** Clarify which system is active and update all code to use the correct model.

---

**Next Steps:**
1. Fix download endpoint to use `CopyrightFreeSong` model
2. Update offline downloads schema to support both models
3. Update download service to handle both types
4. Test end-to-end download flow

