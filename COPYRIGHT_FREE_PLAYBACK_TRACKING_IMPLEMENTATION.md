# Copyright-Free Songs Playback-Based View Tracking

**Date:** 2025-01-27  
**Status:** ✅ **IMPLEMENTED**

---

## ✅ Implementation Complete

### **What Changed**

1. ✅ **Removed immediate view count increment** from GET endpoint
2. ✅ **Added playback tracking service** method
3. ✅ **Created playback tracking endpoint** with 30-second threshold
4. ✅ **Only counts views after actual playback** (≥30 seconds)

---

## 🔄 New Flow

### **Before (Old Approach)** ❌

```
User opens song page
    ↓
GET /api/audio/copyright-free/:songId
    ↓
✅ ViewCount increments immediately (even if user never plays)
```

**Problems:**
- Counts page views, not actual plays
- Inflated view counts
- Inconsistent with regular media

### **After (New Approach)** ✅

```
User opens song page
    ↓
GET /api/audio/copyright-free/:songId
    ↓
✅ Return song data (NO view count increment)
    ↓
User presses play button
    ↓
[Frontend plays audio - tracks duration]
    ↓
User stops/completes playback
    ↓
POST /api/audio/copyright-free/:songId/playback/track
Body: { "playbackDuration": 180 }
    ↓
✅ Check: Did user listen ≥ 30 seconds?
    ↓
YES → ✅ Increment viewCount
NO  → ❌ Don't count as view
```

---

## 📋 New API Endpoint

### **Track Playback**

**Endpoint:** `POST /api/audio/copyright-free/:songId/playback/track`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "playbackDuration": 180,        // Required: Duration in seconds user listened
  "thresholdSeconds": 30          // Optional: Threshold (default: 30 seconds)
}
```

**Response:**
```json
{
  "success": true,
  "message": "View count incremented",
  "data": {
    "viewCountIncremented": true,
    "newViewCount": 1251,
    "playbackDuration": 180,
    "thresholdSeconds": 30
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "playbackDuration is required and must be a positive number"
}
```

---

## 🎯 How It Works

### **1. User Gets Song (No View Count)**

```typescript
GET /api/audio/copyright-free/:songId

Response:
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Song Title",
    "viewCount": 1250,  // ← Current count (not incremented)
    // ... other fields
  }
}
```

### **2. User Plays Song (Frontend Tracks Duration)**

Frontend plays the audio and tracks how long user listens.

### **3. User Stops/Completes Playback**

```typescript
POST /api/audio/copyright-free/:songId/playback/track
Body: {
  "playbackDuration": 180  // User listened for 3 minutes
}

// Backend checks:
// - playbackDuration (180) >= thresholdSeconds (30) → YES
// - Increments viewCount
// - Returns new count

Response:
{
  "success": true,
  "data": {
    "viewCountIncremented": true,
    "newViewCount": 1251,  // ← Incremented!
    "playbackDuration": 180,
    "thresholdSeconds": 30
  }
}
```

### **4. Short Playback (No View Count)**

```typescript
POST /api/audio/copyright-free/:songId/playback/track
Body: {
  "playbackDuration": 15  // User only listened for 15 seconds
}

// Backend checks:
// - playbackDuration (15) >= thresholdSeconds (30) → NO
// - Does NOT increment viewCount

Response:
{
  "success": true,
  "data": {
    "viewCountIncremented": false,  // ← Not counted!
    "newViewCount": 1250,  // ← Same count
    "playbackDuration": 15,
    "thresholdSeconds": 30
  }
}
```

---

## 📱 Frontend Implementation Guide

### **Step 1: Remove View Count on Page Load**

**Before (Remove):**
```typescript
// ❌ OLD - Don't do this anymore
useEffect(() => {
  fetchSong(songId); // This used to increment viewCount
}, [songId]);
```

**After:**
```typescript
// ✅ NEW - Just fetch, no automatic increment
useEffect(() => {
  fetchSong(songId); // No view count increment
}, [songId]);
```

### **Step 2: Track Playback Duration**

```typescript
// Track when user starts playing
const [playbackStartTime, setPlaybackStartTime] = useState<number | null>(null);
const [totalPlaybackDuration, setTotalPlaybackDuration] = useState<number>(0);

const handlePlay = () => {
  setPlaybackStartTime(Date.now());
  audioPlayer.play();
};

const handlePause = () => {
  if (playbackStartTime) {
    const duration = (Date.now() - playbackStartTime) / 1000; // seconds
    setTotalPlaybackDuration(prev => prev + duration);
    setPlaybackStartTime(null);
  }
  audioPlayer.pause();
};

const handleStop = async () => {
  let finalDuration = totalPlaybackDuration;
  
  if (playbackStartTime) {
    const duration = (Date.now() - playbackStartTime) / 1000;
    finalDuration += duration;
    setPlaybackStartTime(null);
  }
  
  // Track playback on backend
  await trackPlayback(songId, finalDuration);
  
  audioPlayer.stop();
};
```

### **Step 3: Call Tracking Endpoint**

```typescript
const trackPlayback = async (songId: string, playbackDuration: number) => {
  try {
    const response = await fetch(
      `${API_URL}/api/audio/copyright-free/${songId}/playback/track`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playbackDuration: Math.round(playbackDuration), // Round to seconds
          thresholdSeconds: 30, // Optional, defaults to 30
        }),
      }
    );

    const data = await response.json();
    
    if (data.success) {
      if (data.data.viewCountIncremented) {
        // Update local view count
        setViewCount(data.data.newViewCount);
      }
      // Even if not incremented, playback was tracked
    }
  } catch (error) {
    console.error('Failed to track playback:', error);
    // Non-critical, don't block user
  }
};
```

### **Step 4: Handle Different Scenarios**

```typescript
// Scenario 1: User completes full song
const handleSongComplete = async () => {
  const fullDuration = song.duration || totalPlaybackDuration;
  await trackPlayback(songId, fullDuration);
};

// Scenario 2: User stops early
const handleStop = async () => {
  await trackPlayback(songId, totalPlaybackDuration);
};

// Scenario 3: User switches songs (cleanup)
const handleUnmount = async () => {
  if (totalPlaybackDuration > 0) {
    await trackPlayback(songId, totalPlaybackDuration);
  }
};
```

---

## ✅ Benefits

### **1. Accurate View Counts** ✅

- Only counts actual engagement
- No accidental views
- No bot inflation

### **2. Consistent with Regular Media** ✅

- Same 30-second threshold
- Same playback-based tracking
- Same user experience

### **3. Better Analytics** ✅

- Can track average playback duration
- Can distinguish between:
  - ✅ Users who listened fully
  - ❌ Users who skipped quickly

### **4. Industry Standard** ✅

- Same approach as YouTube, Spotify, etc.
- 30-second threshold is common practice

---

## 📊 Threshold Logic

### **Default: 30 Seconds**

View count increments only if:
- `playbackDuration >= 30 seconds`

### **Customizable**

Frontend can specify different threshold:
```json
{
  "playbackDuration": 180,
  "thresholdSeconds": 60  // Custom threshold (60 seconds)
}
```

### **Why 30 Seconds?**

- ✅ Industry standard (YouTube, Spotify use similar)
- ✅ Filters out accidental plays
- ✅ Ensures genuine engagement
- ✅ Consistent with regular media

---

## 🔍 Comparison

| Aspect | Old (GET) | New (Playback) |
|--------|-----------|----------------|
| **When counted** | Page load | After playback ≥30s |
| **Accuracy** | ❌ Low | ✅ High |
| **Consistency** | ❌ Different | ✅ Same as media |
| **Analytics** | ❌ Inflated | ✅ Real engagement |

---

## 🎯 Summary

### **What's Changed**

1. ✅ **GET endpoint** - No longer increments view count
2. ✅ **New endpoint** - `POST /playback/track` for playback tracking
3. ✅ **Threshold logic** - Only counts after 30 seconds
4. ✅ **Accurate counts** - Reflects actual engagement

### **Frontend Needs To**

1. ✅ Track playback duration locally
2. ✅ Call `/playback/track` when playback ends
3. ✅ Update view count in UI based on response

### **Backend Provides**

1. ✅ Threshold validation (30 seconds default)
2. ✅ View count increment (only if threshold met)
3. ✅ Response with increment status and new count

---

**Status:** ✅ **COMPLETE** - Ready for frontend integration!

**Next Steps:** Frontend should implement playback duration tracking and call the new endpoint.

