# Video Playback System - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Production Ready

---

## 📋 Overview

This guide explains how to implement TikTok-like single video playback with proper progress tracking. The backend provides playback session management to help the frontend maintain only one video playing at a time.

---

## 🔍 The Problem

**Current Issues:**
1. ❌ Multiple videos playing simultaneously
2. ❌ Progress tracking not working
3. ❌ No seamless playback experience

---

## 💡 Solution: Backend + Frontend Collaboration

### Backend Responsibilities ✅

- **Track Active Playback Session** - Know which video should be playing
- **Automatic Session Management** - Pause previous session when new starts
- **Progress Storage** - Store playback position for resume
- **View Tracking** - Record views when threshold met

### Frontend Responsibilities ✅

- **Single Video Player** - Global video player store
- **Stop Previous Video** - Pause/stop before starting new
- **Progress Updates** - Send position every 5-10 seconds
- **Sync with Backend** - Check active session on app start

---

## 📡 API Endpoints

### 1. Start Playback Session

Start playing a video. Automatically pauses any existing active session.

```
POST /api/media/:id/playback/start
```

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "duration": 180, // Total video duration in seconds
  "position": 45,  // Optional: Resume from position (seconds)
  "deviceInfo": "iPhone 13" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playback started successfully",
  "data": {
    "session": {
      "_id": "session123",
      "userId": "user123",
      "mediaId": "media123",
      "currentPosition": 45, // Resume position if available
      "duration": 180,
      "progressPercentage": 25,
      "isActive": true,
      "isPaused": false,
      "startedAt": "2024-01-15T10:30:00.000Z"
    },
    "previousSessionPaused": {
      "sessionId": "previousSession123",
      "mediaId": "previousMedia123",
      "position": 120
    },
    "resumeFrom": 45 // Position to resume from (if > 0)
  }
}
```

**Key Feature:** Backend automatically pauses previous active session!

---

### 2. Update Playback Progress

Send progress updates every 5-10 seconds during playback.

```
POST /api/media/playback/progress
```

**Request Body:**
```json
{
  "sessionId": "session123",
  "position": 60, // Current position in seconds
  "duration": 180, // Total duration
  "progressPercentage": 33.33 // 0-100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Progress updated successfully",
  "data": {
    "session": { /* updated session */ },
    "position": 60,
    "progressPercentage": 33.33
  }
}
```

---

### 3. Pause Playback

Pause the current playback session.

```
POST /api/media/playback/pause
```

**Request Body:**
```json
{
  "sessionId": "session123"
}
```

---

### 4. Resume Playback

Resume a paused playback session.

```
POST /api/media/playback/resume
```

**Request Body:**
```json
{
  "sessionId": "session123"
}
```

---

### 5. End Playback Session

End playback when video finishes or user stops.

```
POST /api/media/playback/end
```

**Request Body:**
```json
{
  "sessionId": "session123",
  "reason": "completed", // "completed" | "stopped" | "error"
  "finalPosition": 180 // Optional: Final position
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playback ended successfully",
  "data": {
    "session": { /* ended session */ },
    "viewRecorded": true // Whether view was recorded (30+ seconds watched)
  }
}
```

---

### 6. Get Active Playback Session

Get the currently active playback session (what video should be playing).

```
GET /api/media/playback/active
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "sessionId": "session123",
      "mediaId": "media123",
      "media": {
        "_id": "media123",
        "title": "Video Title",
        "thumbnailUrl": "https://...",
        "duration": 180
      },
      "position": 60,
      "duration": 180,
      "progressPercentage": 33.33,
      "isPaused": false,
      "startedAt": "2024-01-15T10:30:00.000Z",
      "totalWatchTime": 60
    }
  }
}
```

**Use Case:** Check on app start/resume to know which video should be playing

---

## 🎨 Frontend Implementation

### Global Video Player Store (React/React Native)

```typescript
// stores/videoPlayerStore.ts
import { create } from 'zustand';
import apiClient from '../apiClient';

interface VideoPlayerState {
  currentSessionId: string | null;
  currentVideoId: string | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isLoading: boolean;

  // Play video (automatically stops previous)
  playVideo: (videoId: string, duration: number) => Promise<void>;
  
  // Pause video
  pauseVideo: () => Promise<void>;
  
  // Resume video
  resumeVideo: () => Promise<void>;
  
  // Stop video
  stopVideo: () => Promise<void>;
  
  // Update position (called by video player)
  updatePosition: (position: number) => void;
  
  // Check active session on app start
  checkActiveSession: () => Promise<void>;
}

export const useVideoPlayerStore = create<VideoPlayerState>((set, get) => ({
  currentSessionId: null,
  currentVideoId: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  isLoading: false,

  playVideo: async (videoId: string, duration: number) => {
    try {
      set({ isLoading: true });

      // 1. Pause current video (frontend side)
      const { currentSessionId, isPlaying } = get();
      if (currentSessionId && isPlaying) {
        await get().pauseVideo();
      }

      // 2. Notify backend - start new session (automatically pauses previous)
      const response = await apiClient.post(`/api/media/${videoId}/playback/start`, {
        duration,
        position: 0, // Or get from saved progress
      });

      const { session, previousSessionPaused, resumeFrom } = response.data.data;

      // 3. Log if previous session was paused
      if (previousSessionPaused) {
        console.log('Backend paused previous session:', previousSessionPaused);
      }

      // 4. Update state
      set({
        currentSessionId: session._id,
        currentVideoId: videoId,
        isPlaying: true,
        position: resumeFrom || 0,
        duration: session.duration,
        isLoading: false,
      });

      // 5. Start progress tracking
      get().startProgressTracking(session._id);
    } catch (error) {
      console.error('Error starting playback:', error);
      set({ isLoading: false });
    }
  },

  pauseVideo: async () => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    try {
      await apiClient.post('/api/media/playback/pause', {
        sessionId: currentSessionId,
      });

      set({ isPlaying: false });
    } catch (error) {
      console.error('Error pausing playback:', error);
    }
  },

  resumeVideo: async () => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    try {
      await apiClient.post('/api/media/playback/resume', {
        sessionId: currentSessionId,
      });

      set({ isPlaying: true });
    } catch (error) {
      console.error('Error resuming playback:', error);
    }
  },

  stopVideo: async () => {
    const { currentSessionId, currentVideoId } = get();
    if (!currentSessionId) return;

    try {
      await apiClient.post('/api/media/playback/end', {
        sessionId: currentSessionId,
        reason: 'stopped',
      });

      set({
        currentSessionId: null,
        currentVideoId: null,
        isPlaying: false,
        position: 0,
        duration: 0,
      });
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  },

  updatePosition: (position: number) => {
    set({ position });
  },

  checkActiveSession: async () => {
    try {
      const response = await apiClient.get('/api/media/playback/active');
      const session = response.data.data.session;

      if (session) {
        // Resume active session
        set({
          currentSessionId: session.sessionId,
          currentVideoId: session.mediaId._id || session.mediaId,
          isPlaying: !session.isPaused,
          position: session.position,
          duration: session.duration,
        });

        // If not paused, start progress tracking
        if (!session.isPaused) {
          get().startProgressTracking(session.sessionId);
        }
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  },

  // Internal: Start progress tracking interval
  startProgressTracking: (sessionId: string) => {
    const interval = setInterval(async () => {
      const { currentSessionId, position, duration, isPlaying } = get();

      // Only update if this is still the active session and playing
      if (currentSessionId !== sessionId || !isPlaying) {
        clearInterval(interval);
        return;
      }

      try {
        const progressPercentage = duration > 0 
          ? (position / duration) * 100 
          : 0;

        await apiClient.post('/api/media/playback/progress', {
          sessionId,
          position,
          duration,
          progressPercentage,
        });
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    }, 10000); // Every 10 seconds

    // Store interval ID for cleanup
    set({ progressTrackingInterval: interval });
  },
}));
```

### Video Player Component Example

```tsx
// components/VideoPlayer.tsx
import React, { useEffect, useRef } from 'react';
import { Video } from 'expo-av';
import { useVideoPlayerStore } from '../stores/videoPlayerStore';

interface VideoPlayerProps {
  videoId: string;
  videoUrl: string;
  duration: number;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, videoUrl, duration }) => {
  const videoRef = useRef<Video>(null);
  const {
    currentVideoId,
    isPlaying,
    position,
    playVideo,
    pauseVideo,
    stopVideo,
    updatePosition,
  } = useVideoPlayerStore();

  // Check if this is the currently playing video
  const isCurrentVideo = currentVideoId === videoId;

  // Handle play button press
  const handlePlay = async () => {
    await playVideo(videoId, duration);
    
    // Start playing video
    if (videoRef.current) {
      if (position > 0) {
        await videoRef.current.setPositionAsync(position * 1000); // Convert to ms
      }
      await videoRef.current.playAsync();
    }
  };

  // Handle pause
  const handlePause = async () => {
    await pauseVideo();
    if (videoRef.current) {
      await videoRef.current.pauseAsync();
    }
  };

  // Listen for position updates
  useEffect(() => {
    if (!isCurrentVideo || !isPlaying) return;

    const interval = setInterval(async () => {
      if (videoRef.current) {
        const status = await videoRef.current.getStatusAsync();
        if (status.isLoaded) {
          const currentPosition = status.positionMillis / 1000; // Convert to seconds
          updatePosition(currentPosition);

          // Check if video ended
          if (status.didJustFinish) {
            await stopVideo();
          }
        }
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isCurrentVideo, isPlaying]);

  // Auto-pause if another video starts playing
  useEffect(() => {
    if (isCurrentVideo && !isPlaying && videoRef.current) {
      videoRef.current.pauseAsync();
    } else if (isCurrentVideo && isPlaying && videoRef.current) {
      videoRef.current.playAsync();
    } else if (!isCurrentVideo && videoRef.current) {
      // Another video is playing, pause this one
      videoRef.current.pauseAsync();
    }
  }, [isCurrentVideo, isPlaying]);

  return (
    <Video
      ref={videoRef}
      source={{ uri: videoUrl }}
      shouldPlay={isCurrentVideo && isPlaying}
      isLooping={false}
      onPlaybackStatusUpdate={(status) => {
        if (status.isLoaded) {
          const currentPosition = status.positionMillis / 1000;
          updatePosition(currentPosition);
        }
      }}
    />
  );
};
```

### App Initialization

```tsx
// App.tsx
import { useEffect } from 'react';
import { useVideoPlayerStore } from './stores/videoPlayerStore';

const App = () => {
  const { checkActiveSession } = useVideoPlayerStore();

  useEffect(() => {
    // Check for active session on app start
    checkActiveSession();
  }, []);

  // ... rest of app
};
```

---

## 🔄 Complete Playback Flow

### Scenario: User Opens App

1. **App Starts**
   - Frontend calls `GET /api/media/playback/active`
   - If active session exists, resume from that position
   - Video player resumes at stored position

### Scenario: User Starts New Video

1. **User Taps Video**
   - Frontend calls `POST /api/media/:id/playback/start`
   - **Backend automatically pauses previous session** ✅
   - Frontend receives `previousSessionPaused` info
   - Frontend stops previous video player
   - Frontend starts new video player

2. **During Playback**
   - Frontend sends progress every 10 seconds
   - Backend updates session and Library progress
   - Frontend tracks position locally for UI

3. **User Swipes to Next Video**
   - Frontend calls `POST /api/media/:newId/playback/start`
   - Backend pauses current session automatically
   - Frontend stops current video
   - Frontend starts new video

4. **Video Ends**
   - Frontend calls `POST /api/media/playback/end`
   - Backend records view if 30+ seconds watched
   - Backend stores final progress
   - Session marked as inactive

---

## 🎯 Key Implementation Points

### 1. Single Video Player (Frontend Must Do)

```typescript
// ✅ CORRECT: Global store ensures only one video plays
const videoPlayerStore = {
  currentVideoId: null, // Only one at a time
  
  playVideo(id) {
    // Always stop previous first
    if (this.currentVideoId) {
      this.stopVideo(this.currentVideoId);
    }
    // Then start new
    this.currentVideoId = id;
  }
}
```

### 2. Backend Session Tracking (Backend Does This)

When frontend calls `POST /api/media/:id/playback/start`:
- Backend automatically pauses any existing active session
- Creates new active session
- Returns info about what was paused

### 3. Progress Updates (Frontend Must Send)

```typescript
// Send every 5-10 seconds during playback
setInterval(() => {
  api.post('/api/media/playback/progress', {
    sessionId,
    position: video.currentTime,
    duration: video.duration,
    progressPercentage: (video.currentTime / video.duration) * 100,
  });
}, 10000);
```

### 4. Resume Support (Backend Provides)

Backend stores progress in Library model. When user starts video:
- Backend checks Library for last position
- Returns `resumeFrom` position in response
- Frontend seeks to that position

---

## ✅ Checklist for Frontend

- [ ] Implement global video player store (only one video at a time)
- [ ] Stop previous video before starting new one
- [ ] Call `POST /api/media/:id/playback/start` when video starts
- [ ] Send progress updates every 5-10 seconds
- [ ] Call pause/resume/end endpoints appropriately
- [ ] Check active session on app start/resume
- [ ] Resume from position if `resumeFrom` provided
- [ ] Handle `previousSessionPaused` response to stop old video

---

## 🎬 TikTok-Like Experience

With this implementation:

1. ✅ **Single Video Playback** - Only one video plays at a time
2. ✅ **Automatic Pause** - Previous video stops when new starts
3. ✅ **Progress Tracking** - Real-time position tracking
4. ✅ **Resume Support** - Resume from last position
5. ✅ **Smooth Transitions** - Backend manages sessions seamlessly

---

**Questions?** Contact the backend team or refer to the API documentation.


