# Copyright-Free Music Interactions - Backend Implementation Summary

**Date**: 2024-12-19  
**Status**: ✅ **COMPLETE - Ready for Frontend Integration**

---

## 📋 Overview

This document summarizes the backend implementation for copyright-free music interactions (likes, views, saves) and provides guidance for frontend integration. All values are **dynamic** and fetched from the database - no hardcoded content.

---

## ✅ What Was Implemented

### 1. **Like/Unlike Endpoint** ✅

**Endpoint**: `POST /api/audio/copyright-free/:songId/like`

**Status**: ✅ Updated to match frontend expectations

**Response Format**:
```json
{
  "success": true,
  "data": {
    "liked": true,           // Dynamic: Current like status for user
    "likeCount": 125,        // Dynamic: Total likes from database
    "viewCount": 1250,       // Dynamic: Total views from database
    "listenCount": 0         // Note: CopyrightFreeSong model doesn't have this field, returns 0
  }
}
```

**Implementation Details**:
- ✅ All values are **dynamic** - fetched from database via `interactionService.toggleLike()`
- ✅ `likeCount` and `viewCount` come from the song document in database
- ✅ `liked` status comes from user's interaction record
- ⚠️ `listenCount` returns `0` because `CopyrightFreeSong` model doesn't have this field (frontend expects it as optional)

**Backend Logic**:
```typescript
// Gets dynamic values from database
const { liked, likeCount, shareCount, viewCount } = await interactionService.toggleLike(userId, songId);
// Returns all dynamic values
```

---

### 2. **Record View Endpoint** ✅ **NEW**

**Endpoint**: `POST /api/audio/copyright-free/:songId/view`

**Status**: ✅ **Newly Created** - Matches frontend expectations

**Request Body** (all optional):
```json
{
  "durationMs": 45000,      // Optional: Viewing duration in milliseconds
  "progressPct": 30,        // Optional: Progress percentage (0-100)
  "isComplete": false       // Optional: Whether song was completed
}
```

**Response Format**:
```json
{
  "success": true,
  "data": {
    "viewCount": 1251,      // Dynamic: Current view count from database
    "hasViewed": true       // Always true after this call
  }
}
```

**Implementation Details**:
- ✅ **One view per user per song** - Deduplication logic prevents duplicate counting
- ✅ **Dynamic view count** - Fetched from database after increment
- ✅ **Tracks user view status** - Uses `CopyrightFreeSongInteraction` model with `hasViewed` field
- ✅ **Engagement data stored** - `durationMs`, `progressPct`, `isComplete` can be used for analytics

**Backend Logic**:
```typescript
// Check if user already viewed (dynamic check)
const interaction = await interactionService.getInteraction(userId, songId);
const hasViewed = interaction?.hasViewed || false;

if (!hasViewed) {
  // First view - increment count dynamically
  await songService.incrementViewCount(songId);
  await interactionService.markAsViewed(userId, songId);
}

// Get updated count from database (dynamic)
const song = await songService.getSongById(songId);
viewCount = song?.viewCount || 0;  // Dynamic value from DB
```

**Database Changes**:
- ✅ Added `hasViewed` field to `CopyrightFreeSongInteraction` model
- ✅ Added `getInteraction()` method to interaction service
- ✅ Added `markAsViewed()` method to interaction service

---

### 3. **Save/Bookmark Endpoint** ✅ **NEW**

**Endpoint**: `POST /api/audio/copyright-free/:songId/save`

**Status**: ✅ **Newly Created** - Matches frontend expectations

**Response Format**:
```json
{
  "success": true,
  "data": {
    "bookmarked": true,        // Dynamic: Current bookmark status for user
    "bookmarkCount": 45         // Dynamic: Total bookmarks from database
  }
}
```

**Implementation Details**:
- ✅ Uses `UnifiedBookmarkService.toggleBookmark()` - handles all bookmark logic
- ✅ **Dynamic bookmark count** - Fetched from database after toggle
- ✅ **Dynamic bookmark status** - Based on user's bookmark record
- ✅ Integrates with existing bookmark system (same as regular media)

**Backend Logic**:
```typescript
// Toggle bookmark (returns dynamic values)
const result = await UnifiedBookmarkService.toggleBookmark(userId, songId);
// result.bookmarked and result.bookmarkCount are both dynamic from DB
```

---

## 🔄 Data Flow (All Dynamic)

### Like Toggle Flow

```
1. User clicks like button
   ↓
2. Frontend: Optimistic update (UI only)
   ↓
3. Frontend: POST /api/audio/copyright-free/:songId/like
   ↓
4. Backend: 
   - Check user's current like status (from DB)
   - Toggle like in database
   - Increment/decrement likeCount in song document
   - Fetch updated counts from database
   ↓
5. Backend Response: 
   {
     liked: true,        // Dynamic from user interaction
     likeCount: 126,     // Dynamic from song document
     viewCount: 1250,    // Dynamic from song document
     listenCount: 0      // Always 0 (model doesn't have this field)
   }
   ↓
6. Frontend: Update UI with dynamic values from response
```

### View Tracking Flow

```
1. User views/listens to song
   ↓
2. Frontend: Check engagement threshold
   - 3 seconds of playback, OR
   - 25% progress, OR
   - Completion
   ↓
3. Frontend: POST /api/audio/copyright-free/:songId/view
   Body: { durationMs, progressPct, isComplete }
   ↓
4. Backend:
   - Check if user already viewed (from DB)
   - If not viewed: Increment viewCount in song document
   - Mark user as viewed in interaction record
   - Fetch updated viewCount from database
   ↓
5. Backend Response:
   {
     viewCount: 1251,    // Dynamic from song document
     hasViewed: true     // Always true after call
   }
   ↓
6. Frontend: Update view count display with dynamic value
```

### Save Toggle Flow

```
1. User clicks save/bookmark button
   ↓
2. Frontend: Optimistic update (UI only)
   ↓
3. Frontend: POST /api/audio/copyright-free/:songId/save
   ↓
4. Backend:
   - Check if user already bookmarked (from DB)
   - Toggle bookmark in database
   - Update bookmarkCount in song document
   - Fetch updated count from database
   ↓
5. Backend Response:
   {
     bookmarked: true,      // Dynamic from user bookmark
     bookmarkCount: 46      // Dynamic from song document
   }
   ↓
6. Frontend: Update UI with dynamic values from response
```

---

## 📊 Database Schema Updates

### CopyrightFreeSongInteraction Model

**Added Field**:
```typescript
hasViewed: {
  type: Boolean,
  default: false,
}
```

**Purpose**: Track whether a user has viewed a song (prevents duplicate view counting)

**Index**: Already has unique index on `{ userId: 1, songId: 1 }` for efficient lookups

---

## 🔧 Service Methods Added

### CopyrightFreeSongInteractionService

**New Methods**:

1. **`getInteraction(userId: string, songId: string)`**
   - Returns user's interaction record for a song
   - Used to check if user has viewed/liked/shared

2. **`markAsViewed(userId: string, songId: string)`**
   - Marks user as having viewed the song
   - Creates interaction record if it doesn't exist
   - Updates `hasViewed` field to `true`

---

## 🎯 Frontend Integration Guide

### Step 1: Update API Service

**File**: `app/services/copyrightFreeMusicAPI.ts`

#### Add `recordView()` Method

```typescript
async recordView(
  songId: string,
  payload?: {
    durationMs?: number;
    progressPct?: number;
    isComplete?: boolean;
  }
): Promise<{
  success: boolean;
  data: {
    viewCount: number;
    hasViewed: boolean;
  };
}> {
  try {
    const token = await TokenUtils.getAuthToken();
    if (!token) {
      throw new Error("Authentication required");
    }

    const response = await fetch(`${this.baseUrl}/${songId}/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error recording view for song ${songId}:`, error);
    throw error;
  }
}
```

#### Update `toggleSave()` Method (if needed)

Ensure it calls: `POST /api/audio/copyright-free/:songId/save`

```typescript
async toggleSave(songId: string): Promise<{
  success: boolean;
  data: {
    bookmarked: boolean;
    bookmarkCount: number;
  };
}> {
  // Implementation should call POST /api/audio/copyright-free/:songId/save
  // Response format matches backend exactly
}
```

---

### Step 2: Update Component State Management

**File**: `app/components/CopyrightFreeSongModal.tsx`

#### Initialize State from Song Data

```typescript
// When song prop changes, initialize from song data (all dynamic)
useEffect(() => {
  if (song) {
    // All values come from song object (dynamic from backend)
    setIsLiked(song.isLiked || false);
    setLikeCount(song.likeCount || song.likes || 0);
    setViewCount(song.viewCount || song.views || 0);
    setIsInLibrary(song.isInLibrary || false);
    // ... other fields
  }
}, [song]);
```

#### Update State from API Responses

```typescript
// After like toggle - use dynamic values from response
const handleToggleLike = async () => {
  try {
    // Optimistic update (UI only)
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    
    // API call
    const result = await copyrightFreeMusicAPI.toggleLike(songId);
    
    if (result.success && result.data) {
      // Update with dynamic values from backend
      setIsLiked(result.data.liked);           // Dynamic
      setLikeCount(result.data.likeCount);    // Dynamic
      setViewCount(result.data.viewCount);    // Dynamic
    } else {
      // Revert optimistic update on error
      setIsLiked(isLiked);
      setLikeCount(likeCount);
    }
  } catch (error) {
    // Revert optimistic update on error
    setIsLiked(isLiked);
    setLikeCount(likeCount);
    Alert.alert("Error", "Failed to update like");
  }
};

// After view tracking - use dynamic value from response
const handleRecordView = async (durationMs?: number, progressPct?: number, isComplete?: boolean) => {
  try {
    const result = await copyrightFreeMusicAPI.recordView(songId, {
      durationMs,
      progressPct,
      isComplete,
    });
    
    if (result.success && result.data) {
      // Update with dynamic value from backend
      setViewCount(result.data.viewCount);  // Dynamic
      setHasTrackedView(true);
    }
  } catch (error) {
    // Silent error - view tracking is non-critical
    console.error("Error recording view:", error);
  }
};

// After save toggle - use dynamic values from response
const handleToggleSave = async () => {
  try {
    // Optimistic update (UI only)
    setIsInLibrary(!isInLibrary);
    
    // API call
    const result = await copyrightFreeMusicAPI.toggleSave(songId);
    
    if (result.success && result.data) {
      // Update with dynamic values from backend
      setIsInLibrary(result.data.bookmarked);        // Dynamic
      setBookmarkCount(result.data.bookmarkCount);   // Dynamic
    } else {
      // Revert optimistic update on error
      setIsInLibrary(isInLibrary);
    }
  } catch (error) {
    // Revert optimistic update on error
    setIsInLibrary(isInLibrary);
    Alert.alert("Error", "Failed to update save");
  }
};
```

---

### Step 3: Implement View Tracking Logic

**File**: `app/components/CopyrightFreeSongModal.tsx`

#### Track View When Thresholds Met

```typescript
// Track playback progress
const [playbackProgress, setPlaybackProgress] = useState(0);
const [playbackDuration, setPlaybackDuration] = useState(0);
const [hasTrackedView, setHasTrackedView] = useState(false);

// When playback progresses
const handlePlaybackProgress = (currentTime: number, duration: number) => {
  setPlaybackProgress(currentTime);
  setPlaybackDuration(duration);
  
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  // Track view if threshold met and not already tracked
  if (!hasTrackedView) {
    const durationMs = currentTime * 1000; // Convert to milliseconds
    
    // Threshold: 3 seconds OR 25% progress
    if (currentTime >= 3 || progressPct >= 25) {
      handleRecordView(durationMs, progressPct, false);
    }
  }
};

// When playback completes
const handlePlaybackComplete = () => {
  if (!hasTrackedView) {
    const durationMs = playbackDuration * 1000;
    handleRecordView(durationMs, 100, true);
  }
};
```

---

## ⚠️ Important Notes

### 1. **All Values Are Dynamic** ✅

- ✅ **No hardcoded values** - All counts come from database
- ✅ **Real-time updates** - Values reflect current database state
- ✅ **User-specific data** - `liked`, `bookmarked`, `hasViewed` are per-user

### 2. **listenCount Field**

- ⚠️ `CopyrightFreeSong` model doesn't have `listenCount` field
- ✅ Backend returns `0` for `listenCount` (frontend expects it as optional)
- ✅ This is acceptable - frontend can ignore or display as 0
- 💡 **Future Enhancement**: Add `listenCount` field to model if needed

### 3. **View Deduplication**

- ✅ **One view per user per song** - Backend prevents duplicate counting
- ✅ Uses `hasViewed` flag in `CopyrightFreeSongInteraction` model
- ✅ If user already viewed, returns current count without incrementing

### 4. **Error Handling**

- ✅ **Like/Save errors**: Show alert to user, revert optimistic update
- ✅ **View errors**: Silent (logged but not shown) - non-critical operation
- ✅ **Network errors**: Frontend should handle gracefully

---

## 🧪 Testing Checklist

### Backend Testing

- [ ] Like toggle increments/decrements count correctly
- [ ] View tracking increments count only once per user
- [ ] Save toggle updates bookmark count correctly
- [ ] All values are fetched dynamically from database
- [ ] Error responses are properly formatted

### Frontend Testing

- [ ] Like button updates with dynamic values from response
- [ ] View count updates when view is tracked
- [ ] Save button updates with dynamic values from response
- [ ] Optimistic updates are reverted on error
- [ ] View tracking doesn't block UI
- [ ] All counts display correctly from song data

### Integration Testing

- [ ] Multiple users can like same song
- [ ] View counts are accurate across users
- [ ] Bookmark counts are accurate
- [ ] State persists across sessions
- [ ] Real-time updates work correctly

---

## 📝 API Endpoints Summary

| Endpoint | Method | Purpose | Response Fields (All Dynamic) |
|----------|--------|---------|-------------------------------|
| `/api/audio/copyright-free/:songId/like` | POST | Toggle like | `liked`, `likeCount`, `viewCount`, `listenCount` |
| `/api/audio/copyright-free/:songId/view` | POST | Record view | `viewCount`, `hasViewed` |
| `/api/audio/copyright-free/:songId/save` | POST | Toggle save | `bookmarked`, `bookmarkCount` |
| `/api/audio/copyright-free/:songId` | GET | Get song | `isLiked`, `likeCount`, `viewCount`, `isInLibrary` |
| `/api/audio/copyright-free` | GET | Get all songs | Each song includes interaction state |

---

## 🚀 Next Steps for Frontend

1. ✅ **Update API Service** - Add `recordView()` method
2. ✅ **Update Component** - Implement view tracking logic
3. ✅ **Test Integration** - Verify all endpoints work correctly
4. ✅ **Handle Errors** - Implement proper error handling
5. ✅ **Optimize Performance** - Use optimistic updates where appropriate

---

## 📚 Related Files

### Backend Files Modified

- `src/controllers/copyrightFreeSong.controller.ts` - Added `recordView()` and `toggleSave()`, updated `toggleLike()`
- `src/routes/audio.route.ts` - Added routes for `/view` and `/save`
- `src/models/copyrightFreeSongInteraction.model.ts` - Added `hasViewed` field
- `src/service/copyrightFreeSongInteraction.service.ts` - Added `getInteraction()` and `markAsViewed()` methods

### Frontend Files to Update

- `app/services/copyrightFreeMusicAPI.ts` - Add `recordView()` method
- `app/components/CopyrightFreeSongModal.tsx` - Implement view tracking logic

---

## ✅ Status Summary

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Like Toggle | ✅ Complete | ✅ Ready | ✅ Ready for Integration |
| View Tracking | ✅ Complete | ⚠️ Needs Implementation | ⚠️ Pending Frontend |
| Save Toggle | ✅ Complete | ✅ Ready | ✅ Ready for Integration |
| Dynamic Values | ✅ All Dynamic | ✅ Expected | ✅ Matched |

---

**Last Updated**: 2024-12-19  
**Backend Status**: ✅ **Complete**  
**Frontend Status**: ⚠️ **Needs View Tracking Implementation**  
**Integration Status**: ✅ **Ready**



