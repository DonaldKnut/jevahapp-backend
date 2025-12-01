# Video Playback: Backend vs Frontend Responsibilities

**Date:** 2024  
**Status:** Clear Separation of Concerns

---

## 🔍 The Core Question

**"Is video playback control backend or frontend?"**

**Answer:** It's BOTH, but with clear responsibilities:

---

## 🎯 Frontend Responsibilities (What Frontend MUST Do)

### 1. Single Video Player Control ✅ REQUIRED

**Frontend MUST:**
- ✅ Implement a **global video player store** that ensures only ONE video plays at a time
- ✅ **Stop/pause previous video** before starting a new one
- ✅ Manage video player state (playing, paused, stopped)
- ✅ Control the actual video playback (play, pause, seek, stop)

**Why Frontend?**
- Video player is a UI component - only frontend can control it
- Browser/app has direct access to video element
- Real-time playback control requires frontend

**Example:**
```typescript
// Frontend must do this:
const videoPlayer = {
  currentVideo: null,
  
  playVideo(newVideo) {
    // 1. STOP current video first
    if (this.currentVideo) {
      this.currentVideo.pause();
      this.currentVideo = null;
    }
    
    // 2. THEN start new video
    this.currentVideo = newVideo;
    this.currentVideo.play();
  }
}
```

---

## 🎯 Backend Responsibilities (What Backend DOES Provide)

### 1. Playback Session Tracking ✅ PROVIDED

**Backend CAN:**
- ✅ Track which video SHOULD be playing (active session)
- ✅ Automatically pause previous session when new one starts
- ✅ Store playback progress and position
- ✅ Provide session state to frontend

**Why Backend?**
- Persistent across app restarts
- Sync across devices (if needed)
- Analytics and tracking
- Resume functionality

### 2. Progress Storage ✅ PROVIDED

**Backend CAN:**
- ✅ Store last playback position
- ✅ Track watch time
- ✅ Record views when threshold met
- ✅ Provide resume positions

---

## 💡 How They Work Together

### The Solution: Collaboration

```
Frontend (Controls Playback)          Backend (Tracks Sessions)
     │                                       │
     │ 1. User taps video                   │
     │──────────────────────────────────────>│
     │                                       │ POST /playback/start
     │                                       │ → Pause previous session
     │                                       │ → Create new session
     │                                       │
     │<──────────────────────────────────────│
     │ Returns: { session, previousPaused } │
     │                                       │
     │ 2. Frontend stops old video          │
     │    (based on previousPaused info)    │
     │                                       │
     │ 3. Frontend starts new video         │
     │    (at resumeFrom position)          │
     │                                       │
     │ 4. Progress updates every 10s        │
     │──────────────────────────────────────>│
     │                                       │ POST /playback/progress
     │                                       │ → Update session
     │                                       │ → Store in Library
```

---

## ⚠️ What Backend CANNOT Do

### Backend Limitations:

1. ❌ **Cannot directly pause videos** - Video player is frontend
2. ❌ **Cannot control video element** - No access to DOM/native player
3. ❌ **Cannot prevent multiple videos** - Frontend must prevent this
4. ❌ **Cannot force UI changes** - Backend provides data, frontend renders

### What Backend CAN Do:

1. ✅ **Track which video SHOULD be playing** - Active session tracking
2. ✅ **Automatically pause previous session** - Session management
3. ✅ **Store progress** - Resume support
4. ✅ **Provide session state** - Frontend can sync with backend
5. ✅ **Record analytics** - Watch time, views, etc.

---

## 🎬 Real-World Example: How TikTok Does It

### TikTok's Approach:

1. **Frontend:** Global video player (only one plays)
2. **Frontend:** Swipe gesture stops current, starts next
3. **Backend:** Tracks which video is active
4. **Backend:** Stores progress for resume

### Our Implementation:

1. **Frontend:** Global video player store (your responsibility)
2. **Frontend:** Stop previous before starting new (your responsibility)
3. **Backend:** Tracks active session (we provide this) ✅
4. **Backend:** Stores progress (we provide this) ✅

---

## 📋 Frontend Checklist

### What Frontend MUST Implement:

- [ ] **Global Video Player Store**
  ```typescript
  const videoPlayer = {
    currentVideo: null,
    isPlaying: false,
    
    playVideo(id) {
      // Stop previous
      if (this.currentVideo) {
        this.stopVideo(this.currentVideo);
      }
      // Start new
      this.currentVideo = id;
    }
  }
  ```

- [ ] **Call Backend on Playback Events**
  - `POST /api/media/:id/playback/start` when video starts
  - `POST /api/media/playback/progress` every 5-10 seconds
  - `POST /api/media/playback/pause` when paused
  - `POST /api/media/playback/end` when stopped/ended

- [ ] **Stop Previous Video**
  - When starting new video, stop previous first
  - Use `previousSessionPaused` response from backend

- [ ] **Check Active Session on App Start**
  - Call `GET /api/media/playback/active`
  - Resume if active session exists

---

## 📋 Backend Provides (What We Built)

### ✅ Playback Session Management

1. **Start Playback** - `POST /api/media/:id/playback/start`
   - Automatically pauses previous session
   - Creates new active session
   - Returns resume position if available

2. **Update Progress** - `POST /api/media/playback/progress`
   - Updates session position
   - Stores in Library for resume

3. **Pause/Resume/End** - Full lifecycle management
   - Pause: `POST /api/media/playback/pause`
   - Resume: `POST /api/media/playback/resume`
   - End: `POST /api/media/playback/end`

4. **Get Active Session** - `GET /api/media/playback/active`
   - Returns currently active session
   - Frontend can sync with this

---

## 🎯 Conclusion

### The Issue Breakdown:

| Issue | Responsibility | Solution |
|-------|---------------|----------|
| Multiple videos playing | **Frontend** | Global video player store |
| Progress not tracking | **Both** | Frontend sends updates, Backend stores |
| No resume support | **Backend** | ✅ We provide this |
| No active session tracking | **Backend** | ✅ We provide this |

### What We Built (Backend):

✅ **Playback Session System**
- Tracks active playback sessions
- Automatically pauses previous when new starts
- Stores progress for resume
- Provides session state to frontend

✅ **All Required Endpoints**
- Start, progress, pause, resume, end
- Get active session
- Get playback history

### What Frontend Must Do:

✅ **Implement Single Video Player**
- Global store that ensures only one plays
- Stop previous before starting new

✅ **Integrate with Backend**
- Call endpoints on playback events
- Send progress updates regularly
- Check active session on app start

---

## 🚀 Next Steps

1. **Backend is Ready** ✅ - All endpoints created
2. **Frontend Integration** - Use the guide: `VIDEO_PLAYBACK_FRONTEND_GUIDE.md`
3. **Test Together** - Backend + Frontend working in harmony

---

**Summary:** Backend provides session tracking and progress storage. Frontend must implement single video player control. Together, they create TikTok-like seamless playback! 🎬


