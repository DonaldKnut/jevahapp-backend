# Video Playback Issues Analysis & Solution

**Date:** 2024  
**Status:** Analysis & Proposed Solution

---

## 🔍 Current Situation

**Frontend Issues:**
1. ❌ Multiple videos playing at once (should stop previous when new starts)
2. ❌ Progress tracking not working properly
3. ❌ No TikTok-like seamless playback experience

---

## 📊 What Backend Currently Has

### ✅ Existing Backend Features

1. **Progress Tracking Endpoint**
   - `PUT /api/media/progress` - Updates watch progress
   - Stores: `watchProgress` (seconds), `completionPercentage` (0-100)
   - Stores in Library model

2. **View Tracking Endpoint**
   - `POST /api/media/:id/track-view` - Tracks view with duration
   - Records: duration, isComplete flag
   - Has view threshold (30 seconds default)

3. **Currently Watching Endpoint**
   - `GET /api/media/currently-watching` - Gets in-progress media
   - Returns media user hasn't finished watching

### ❌ What Backend is Missing

1. **Active Playback Session Management**
   - No way to track "which video is currently playing right now"
   - No way to pause/stop previous video when new one starts
   - No real-time playback state tracking

2. **Progress Updates Endpoint**
   - Current endpoint is manual (PUT), not automatic
   - No periodic progress update endpoint
   - No heartbeat/keepalive for active playback

3. **Playback State Endpoint**
   - Can't query "what video is user watching right now"
   - Can't get playback position in real-time
   - No playback session ID

---

## 🎯 Solution: Backend + Frontend Collaboration

### Frontend Responsibilities (What Frontend Must Do)

1. **Single Video Playback Control**
   - ✅ **Frontend must manage**: Only one video plays at a time
   - ✅ **Frontend must**: Pause/stop previous video before starting new one
   - ✅ **Frontend must**: Use a global video player state/store

2. **Periodic Progress Updates**
   - ✅ **Frontend must**: Send progress updates every 5-10 seconds
   - ✅ **Frontend must**: Track playback position in real-time
   - ✅ **Frontend must**: Call backend when video starts/pauses/ends

### Backend Enhancements (What Backend Should Add)

1. **Active Playback Session Tracking**
   - Track which video user is currently watching
   - Automatically pause previous session when new one starts
   - Real-time playback state

2. **Playback Lifecycle Endpoints**
   - `POST /api/media/:id/playback/start` - Video started playing
   - `POST /api/media/:id/playback/progress` - Periodic progress updates
   - `POST /api/media/:id/playback/pause` - Video paused
   - `POST /api/media/:id/playback/end` - Video ended/stopped
   - `GET /api/media/playback/active` - Get currently active playback

3. **Automatic Session Management**
   - When user starts new video, automatically pause previous
   - Track active playback session per user
   - Store last playback position

---

## 💡 Proposed Backend Solution

### 1. Create Playback Session Model

Track active playback sessions:

```typescript
interface PlaybackSession {
  userId: ObjectId;
  mediaId: ObjectId;
  startedAt: Date;
  lastProgressAt: Date;
  currentPosition: number; // seconds
  duration: number; // total seconds
  isActive: boolean;
  isPaused: boolean;
  progressPercentage: number; // 0-100
}
```

### 2. New Playback Endpoints

```
POST /api/media/:id/playback/start
  - Start playback session
  - Automatically pause any existing session
  
POST /api/media/:id/playback/progress
  - Update playback position (every 5-10 seconds)
  - Keep session alive
  
POST /api/media/:id/playback/pause
  - Pause playback
  
POST /api/media/:id/playback/resume
  - Resume playback
  
POST /api/media/:id/playback/end
  - End playback (video finished or user stopped)
  
GET /api/media/playback/active
  - Get currently active playback session
  - Returns: mediaId, position, duration, etc.
```

### 3. Backend Behavior

**When User Starts New Video:**
1. Backend receives `POST /api/media/:id/playback/start`
2. Backend automatically:
   - Pauses any existing active playback session
   - Creates new active session for new video
   - Returns active session info

**During Playback:**
1. Frontend sends progress every 5-10 seconds
2. Backend updates position in active session
3. Backend stores progress in Library for resume

**When Video Ends:**
1. Frontend sends `POST /api/media/:id/playback/end`
2. Backend:
   - Marks session as inactive
   - Updates final progress in Library
   - Records view if threshold met

---

## 🎬 TikTok-Like Flow

### How TikTok/Instagram Does It:

1. **Single Video Player** - Only one video plays globally
2. **Automatic Pause** - Starting new video stops previous
3. **Smooth Transitions** - Preload next video
4. **Resume Support** - Resume from last position
5. **Progress Tracking** - Real-time position tracking

### Our Implementation:

**Frontend:**
```typescript
// Global video player store
const videoPlayerStore = {
  currentVideo: null,
  isPlaying: false,
  position: 0,
  
  async playVideo(videoId) {
    // 1. Pause current video (if any)
    if (this.currentVideo) {
      await pauseCurrentVideo();
    }
    
    // 2. Notify backend - start new session
    await api.post(`/api/media/${videoId}/playback/start`);
    
    // 3. Start playing new video
    this.currentVideo = videoId;
    this.isPlaying = true;
    
    // 4. Start progress tracking
    this.startProgressTracking(videoId);
  },
  
  startProgressTracking(videoId) {
    setInterval(async () => {
      const position = getVideoCurrentTime();
      await api.post(`/api/media/${videoId}/playback/progress`, {
        position,
        duration: getVideoDuration(),
        progressPercentage: (position / getVideoDuration()) * 100,
      });
    }, 10000); // Every 10 seconds
  }
}
```

**Backend:**
```typescript
// Automatically handles pause of previous session
POST /api/media/:id/playback/start
  → Pauses any existing active session
  → Creates new active session
  → Returns session info
```

---

## 📝 Implementation Plan

### Phase 1: Backend Enhancements ✅ (We'll create)

1. ✅ Create PlaybackSession model
2. ✅ Create playback service
3. ✅ Create playback endpoints
4. ✅ Automatic session management
5. ✅ Progress tracking improvements

### Phase 2: Frontend Integration (Frontend team)

1. Implement global video player store
2. Call backend endpoints on playback events
3. Send periodic progress updates
4. Handle playback state from backend

---

## ⚠️ Current Limitations

### What Backend CANNOT Do:

- ❌ Cannot force frontend to pause videos (frontend must do this)
- ❌ Cannot control video player directly
- ❌ Cannot prevent multiple videos from playing (frontend must prevent)

### What Backend CAN Do:

- ✅ Track which video SHOULD be playing
- ✅ Provide session state to frontend
- ✅ Store progress and position
- ✅ Automatically pause previous sessions (tracking-wise)
- ✅ Provide resume functionality

---

## 🎯 Conclusion

**The Issue is BOTH Frontend AND Backend:**

1. **Frontend MUST:** Implement single video player control
2. **Backend SHOULD:** Provide active session tracking to help frontend
3. **Together:** Create TikTok-like seamless experience

**Recommendation:**
- Backend should create playback session management system
- Frontend should use it to maintain single video playback
- Backend can help by tracking "active session" so frontend knows what should be playing

---

**Ready to implement backend enhancements?** We can create the playback session system to support the frontend in implementing proper video playback control.


