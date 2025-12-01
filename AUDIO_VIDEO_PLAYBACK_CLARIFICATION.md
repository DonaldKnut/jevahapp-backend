# Audio & Video Playback System - Universal Support

**Date:** 2024  
**Status:** ✅ Works for Both Video AND Audio/Music

---

## ✅ YES - It Works for Both!

The playback session system we built works for **ALL media types**, including:

- ✅ **Videos** (`contentType: "videos"`)
- ✅ **Music** (`contentType: "music"`)
- ✅ **Audio** (`contentType: "audio"`)
- ✅ **Podcasts** (`contentType: "podcast"`)
- ✅ **Sermons** (`contentType: "sermon"`)
- ✅ **Any other media type**

---

## 🎯 How It Works

### Generic Media Playback

The `PlaybackSession` model uses `mediaId` which references the `Media` model. Since the `Media` model supports all content types, the playback session system works universally:

```typescript
// PlaybackSession Model
{
  userId: ObjectId,
  mediaId: ObjectId,  // ← References Media (any type)
  currentPosition: number,  // Works for both video & audio
  duration: number,  // Works for both
  progressPercentage: number,  // Works for both
  totalWatchTime: number,  // Actually means "playback time" (works for both)
}
```

### Media Model Content Types

```typescript
export type MediaContentType =
  | "music"      // ✅ Audio/Music
  | "videos"     // ✅ Video
  | "audio"      // ✅ Audio files
  | "podcast"    // ✅ Podcasts
  | "sermon"     // ✅ Sermons
  | "devotional" // ✅ Devotionals
  | "ebook"      // ✅ E-books
  | "live"       // ✅ Live streams
  | "recording"  // ✅ Recordings
  | "merch";     // ❌ Not applicable
```

---

## 🎵 Audio/Music Specific Features

### 1. Single Audio Playback

Just like videos, only ONE audio/music should play at a time:

```
User plays Song A
  ↓
User plays Song B
  ↓
Song A automatically stops (backend pauses session)
  ↓
Song B starts playing
```

### 2. Progress Tracking for Audio

The same progress tracking works:

```typescript
// Audio playback progress
POST /api/media/:id/playback/start
{
  "duration": 240,  // 4 minutes song
  "position": 60    // Resume from 1 minute
}

POST /api/media/playback/progress
{
  "sessionId": "...",
  "position": 120,  // 2 minutes into song
  "duration": 240,
  "progressPercentage": 50
}
```

### 3. Resume Audio Playback

Users can resume from where they left off:

```typescript
// User plays song, listens for 2 minutes, closes app
// Later, user opens app and plays same song
POST /api/media/:songId/playback/start

// Response includes resume position
{
  "resumeFrom": 120,  // Resume from 2 minutes (where they left off)
  "session": { ... }
}
```

---

## 📡 API Endpoints (Same for Video & Audio)

All endpoints work for **both video and audio**:

```
POST /api/media/:id/playback/start      # Start video OR audio
POST /api/media/playback/progress       # Update progress (video OR audio)
POST /api/media/playback/pause          # Pause (video OR audio)
POST /api/media/playback/resume         # Resume (video OR audio)
POST /api/media/playback/end            # End (video OR audio)
GET  /api/media/playback/active         # Get active (video OR audio)
GET  /api/media/playback/history        # Get history (video OR audio)
```

**No difference in API usage!** The backend automatically handles the media type.

---

## 🎬 Frontend Implementation

### For Video Player

```typescript
// Video player
const playVideo = async (videoId: string) => {
  await api.post(`/api/media/${videoId}/playback/start`, {
    duration: videoDuration,
  });
  // Start video playback
};
```

### For Audio/Music Player

```typescript
// Audio/Music player (SAME API!)
const playAudio = async (audioId: string) => {
  await api.post(`/api/media/${audioId}/playback/start`, {
    duration: audioDuration,
  });
  // Start audio playback
};
```

**It's the same API!** The backend doesn't care if it's video or audio.

---

## 🔄 Universal Playback Flow

### Scenario: User Plays Video Then Audio

1. **User plays Video A**
   ```
   POST /api/media/videoA/playback/start
   → Backend creates session for videoA
   → Video A starts playing
   ```

2. **User plays Song B** (while video is playing)
   ```
   POST /api/media/songB/playback/start
   → Backend automatically pauses videoA session ✅
   → Backend creates session for songB
   → Video A stops (frontend stops it)
   → Song B starts playing
   ```

3. **User plays Song C** (while song B is playing)
   ```
   POST /api/media/songC/playback/start
   → Backend automatically pauses songB session ✅
   → Backend creates session for songC
   → Song B stops (frontend stops it)
   → Song C starts playing
   ```

**The backend automatically pauses ANY previous media (video or audio) when new media starts!**

---

## 📊 View/Listen Count Tracking

The backend tracks appropriately:

### For Videos
- Uses `viewCount` in Media model
- Records as "view" interaction

### For Audio/Music
- Uses `listenCount` in Media model
- Records as "listen" interaction

The playback session system automatically determines which to use based on `media.contentType`:

```typescript
// In playbackSession.service.ts (when ending session)
if (media.contentType === "videos") {
  // Record as view
  updateField.viewCount = 1;
} else if (["music", "audio", "podcast"].includes(media.contentType)) {
  // Record as listen
  updateField.listenCount = 1;
}
```

---

## ✅ Summary

| Feature | Video | Audio/Music | Status |
|---------|-------|-------------|--------|
| Single playback | ✅ | ✅ | Works for both |
| Progress tracking | ✅ | ✅ | Works for both |
| Resume support | ✅ | ✅ | Works for both |
| Auto-pause previous | ✅ | ✅ | Works for both |
| Active session tracking | ✅ | ✅ | Works for both |
| Cross-media pause | ✅ | ✅ | Video pauses audio, audio pauses video |

---

## 🎯 Key Points

1. **Same API** - No separate endpoints for audio vs video
2. **Universal System** - One playback session system for all media
3. **Auto-Pause** - Any media type pauses any other media type
4. **Progress Tracking** - Works the same for both
5. **Resume Support** - Works for both video and audio

---

## 📝 Frontend Implementation Note

**Frontend must implement:**

1. **Universal Player Store** - Handle both video and audio
2. **Single Playback** - Only one media (video OR audio) plays at a time
3. **Stop Previous** - Stop previous media (any type) before starting new
4. **Same API Calls** - Use same endpoints for both

```typescript
// Universal player store (works for video AND audio)
const mediaPlayerStore = {
  currentMediaId: null,  // Can be video OR audio
  currentMediaType: null, // "video" | "audio"
  
  playMedia(mediaId: string, type: "video" | "audio") {
    // Stop previous (video or audio)
    if (this.currentMediaId) {
      this.stopMedia(this.currentMediaId);
    }
    
    // Start new (video or audio)
    api.post(`/api/media/${mediaId}/playback/start`);
    this.currentMediaId = mediaId;
    this.currentMediaType = type;
  }
}
```

---

**Conclusion:** ✅ The playback session system works for **both video AND audio/music** out of the box! No separate implementation needed.


