# Audio Library System - Complete Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** ✅ Production Ready

---

## 🎯 Overview

This guide provides everything your frontend needs to integrate with the Audio Library System without breaking your UI. Follow these patterns to ensure smooth integration.

---

## 📡 Base Configuration

### API Base URL
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-domain.com';
// or for React Native/Expo
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-api-domain.com';
```

### Socket.IO Configuration
```javascript
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || API_BASE_URL;
```

---

## 🔐 Authentication Setup

### Get Access Token
```javascript
// Get token from your auth system (localStorage, AsyncStorage, etc.)
const getAccessToken = () => {
  // Example: from localStorage
  return localStorage.getItem('accessToken');
  
  // Or from AsyncStorage (React Native)
  // return await AsyncStorage.getItem('accessToken');
};
```

### API Request Helper
```javascript
async function apiRequest(endpoint, options = {}) {
  const token = getAccessToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}
```

---

## 📋 1. Fetch Copyright-Free Songs

### Get All Songs (Public - No Auth Required)

```javascript
async function getCopyrightFreeSongs(filters = {}) {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    artist,
    year,
    minDuration,
    maxDuration,
    tags,
    sortBy = 'newest',
  } = filters;

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
  });

  if (search) params.append('search', search);
  if (category) params.append('category', category);
  if (artist) params.append('artist', artist);
  if (year) params.append('year', year.toString());
  if (minDuration) params.append('minDuration', minDuration.toString());
  if (maxDuration) params.append('maxDuration', maxDuration.toString());
  if (tags && Array.isArray(tags)) {
    tags.forEach(tag => params.append('tags', tag));
  }

  const response = await fetch(
    `${API_BASE_URL}/api/audio/copyright-free?${params.toString()}`
  );
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || 'Failed to fetch songs');
  }

  return result.data; // { songs: [...], pagination: {...} }
}
```

### React Hook Example

```javascript
import { useState, useEffect } from 'react';

function useCopyrightFreeSongs(filters = {}) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    async function fetchSongs() {
      try {
        setLoading(true);
        setError(null);
        
        const data = await getCopyrightFreeSongs(filters);
        
        setSongs(data.songs || []);
        setPagination(data.pagination);
      } catch (err) {
        setError(err.message);
        setSongs([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSongs();
  }, [JSON.stringify(filters)]); // Re-fetch when filters change

  return { songs, loading, error, pagination };
}

// Usage in component
function SongsList() {
  const [filters, setFilters] = useState({ page: 1, limit: 20 });
  const { songs, loading, error, pagination } = useCopyrightFreeSongs(filters);

  if (loading) return <div>Loading songs...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {songs.map(song => (
        <SongCard key={song._id} song={song} />
      ))}
      {/* Pagination controls */}
    </div>
  );
}
```

---

## 🎵 2. Get Single Song

```javascript
async function getCopyrightFreeSong(songId) {
  const response = await fetch(
    `${API_BASE_URL}/api/audio/copyright-free/${songId}`
  );
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || 'Song not found');
  }

  return result.data; // Song object with all fields
}

// React Hook
function useSong(songId) {
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!songId) return;

    async function fetchSong() {
      try {
        setLoading(true);
        const data = await getCopyrightFreeSong(songId);
        setSong(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setSong(null);
      } finally {
        setLoading(false);
      }
    }

    fetchSong();
  }, [songId]);

  return { song, loading, error };
}
```

---

## ❤️ 3. Like/Unlike Song (With Real-Time Updates)

### API Call

```javascript
async function toggleLike(songId) {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/audio/copyright-free/${songId}/like`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to toggle like');
  }

  return result.data; // { liked: true/false, likeCount: number, viewCount: number, listenCount: number }
}
```

### Complete Like Button Component (With Real-Time Updates)

```javascript
import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

function LikeButton({ songId, initialLiked = false, initialLikeCount = 0 }) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected');
      
      // Join content room for real-time updates
      newSocket.emit('join-content', {
        contentId: songId,
        contentType: 'media',
      });
      
      // Join audio-specific rooms
      newSocket.join(`audio:copyright-free:${songId}`);
      newSocket.join(`content:media:${songId}`);
    });

    // Listen for real-time like updates
    newSocket.on('audio-like-updated', (data) => {
      if (data.songId === songId) {
        console.log('📡 Real-time like update:', data);
        // Update state from real-time event (from other users)
        setLikeCount(data.likeCount);
        setLiked(data.liked);
      }
    });

    // Alternative event listener (backup)
    newSocket.on('like-updated', (data) => {
      if (data.contentId === songId || data.songId === songId) {
        setLikeCount(data.likeCount || data.likeCount);
        setLiked(data.liked !== undefined ? data.liked : data.userLiked);
      }
    });

    setSocket(newSocket);

    return () => {
      // Cleanup on unmount
      newSocket.emit('leave-content', {
        contentId: songId,
        contentType: 'media',
      });
      newSocket.leave(`audio:copyright-free:${songId}`);
      newSocket.leave(`content:media:${songId}`);
      newSocket.off('audio-like-updated');
      newSocket.off('like-updated');
      newSocket.close();
    };
  }, [songId]);

  // Handle like button click
  const handleLikeClick = useCallback(async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      
      // Optimistic update (update UI immediately)
      const newLiked = !liked;
      const newCount = newLiked ? likeCount + 1 : likeCount - 1;
      
      setLiked(newLiked);
      setLikeCount(newCount);

      // Call API
      const result = await toggleLike(songId);

      // Update with actual response (in case of errors or race conditions)
      setLiked(result.liked);
      setLikeCount(result.likeCount);
      
      // Real-time updates will also come via Socket.IO
      // So other users will see the update instantly
    } catch (error) {
      console.error('Error toggling like:', error);
      
      // Revert optimistic update on error
      setLiked(!liked);
      setLikeCount(liked ? likeCount - 1 : likeCount + 1);
      
      // Show error message to user
      alert(error.message || 'Failed to toggle like');
    } finally {
      setIsLoading(false);
    }
  }, [songId, liked, likeCount, isLoading]);

  return (
    <button
      onClick={handleLikeClick}
      disabled={isLoading}
      className={`like-button ${liked ? 'liked' : ''}`}
    >
      {liked ? '❤️' : '🤍'} {likeCount}
    </button>
  );
}
```

### Important Notes for Like Button

1. **Optimistic Updates**: Update UI immediately, then sync with server
2. **Error Handling**: Revert optimistic update if API call fails
3. **Real-Time Sync**: Socket.IO will update counts from other users
4. **Prevent Double-Clicks**: Use `isLoading` state to prevent rapid clicks

---

## 👁️ 4. Display View & Listen Counts

### Song Stats Component

```javascript
function SongStats({ song }) {
  const [viewCount, setViewCount] = useState(song.viewCount || 0);
  const [listenCount, setListenCount] = useState(song.listenCount || 0);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.IO for real-time count updates
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
    });

    newSocket.emit('join-content', {
      contentId: song._id,
      contentType: 'media',
    });
    newSocket.join(`audio:copyright-free:${song._id}`);

    // Listen for real-time count updates
    newSocket.on('audio-like-updated', (data) => {
      if (data.songId === song._id) {
        if (data.viewCount !== undefined) setViewCount(data.viewCount);
        if (data.listenCount !== undefined) setListenCount(data.listenCount);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [song._id]);

  return (
    <div className="song-stats">
      <span>👁️ {viewCount} views</span>
      <span>🎵 {listenCount} listens</span>
    </div>
  );
}
```

---

## 🎧 5. Audio Playback Integration

### Start Playback

```javascript
async function startPlayback(trackId, duration, position = 0) {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/audio/playback/start`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trackId,
        duration,
        position,
        deviceInfo: navigator.userAgent || 'Unknown',
      }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to start playback');
  }

  return result.data; // { session: {...}, previousSessionPaused: {...}, resumeFrom: number }
}
```

### Update Playback Progress

```javascript
// Call this every 5-10 seconds during playback
async function updatePlaybackProgress(sessionId, position, duration, progressPercentage) {
  const token = getAccessToken();
  
  if (!token) return;

  try {
    await fetch(`${API_BASE_URL}/api/audio/playback/progress`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        position,
        duration,
        progressPercentage,
      }),
    });
  } catch (error) {
    console.error('Failed to update playback progress:', error);
    // Don't throw - this is not critical
  }
}
```

### Complete Audio Player Component

```javascript
import { useState, useEffect, useRef } from 'react';

function AudioPlayer({ song }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Initialize playback when song loads
  useEffect(() => {
    return () => {
      // Cleanup: stop progress updates
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Start playback session
  const handlePlay = async () => {
    try {
      if (!hasStarted) {
        // Start new playback session
        const result = await startPlayback(
          song._id,
          song.duration || 0,
          currentPosition
        );
        
        setSessionId(result.session._id);
        setHasStarted(true);
        
        // Resume from last position if available
        if (result.resumeFrom && result.resumeFrom > 0) {
          setCurrentPosition(result.resumeFrom);
          if (audioRef.current) {
            audioRef.current.currentTime = result.resumeFrom;
          }
        }
      }

      // Play audio
      if (audioRef.current) {
        await audioRef.current.play();
        setIsPlaying(true);
      }

      // Start progress tracking (every 5 seconds)
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current && sessionId) {
          const currentPos = audioRef.current.currentTime;
          const totalDuration = audioRef.current.duration || song.duration || 0;
          const progressPct = totalDuration > 0 
            ? (currentPos / totalDuration) * 100 
            : 0;

          updatePlaybackProgress(
            sessionId,
            currentPos,
            totalDuration,
            progressPct
          );
        }
      }, 5000);
    } catch (error) {
      console.error('Error starting playback:', error);
      alert(error.message);
    }
  };

  // Pause playback
  const handlePause = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (sessionId) {
      try {
        await fetch(`${API_BASE_URL}/api/audio/playback/pause`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });
      } catch (error) {
        console.error('Error pausing playback:', error);
      }
    }
  };

  // Handle audio ended
  const handleEnded = async () => {
    setIsPlaying(false);
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (sessionId) {
      try {
        await fetch(`${API_BASE_URL}/api/audio/playback/complete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            reason: 'completed',
            finalPosition: currentPosition,
          }),
        });
      } catch (error) {
        console.error('Error completing playback:', error);
      }
    }
  };

  // Update current position
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentPosition(audioRef.current.currentTime);
    }
  };

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={song.fileUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      
      <button onClick={isPlaying ? handlePause : handlePlay}>
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      
      <span>{formatTime(currentPosition)} / {formatTime(song.duration || 0)}</span>
    </div>
  );
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
```

---

## 💾 6. Save to Library

```javascript
async function saveToLibrary(songId) {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/audio/copyright-free/${songId}/save`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to save song');
  }

  return result.data; // { bookmarked: true/false, bookmarkCount: number }
}

// React Component
function SaveButton({ songId, initialSaved = false }) {
  const [saved, setSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      
      // Optimistic update
      setSaved(!saved);
      
      const result = await saveToLibrary(songId);
      
      // Update with actual response
      setSaved(result.bookmarked);
    } catch (error) {
      // Revert on error
      setSaved(!saved);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleSave} disabled={isLoading}>
      {saved ? '💾 Saved' : '💾 Save'}
    </button>
  );
}
```

---

## 📚 7. Get User's Audio Library

```javascript
async function getUserAudioLibrary() {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/api/audio/library`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to fetch library');
  }

  return result.data; // Array of saved songs
}
```

---

## 📋 8. Search Songs

```javascript
async function searchSongs(query, filters = {}) {
  const params = new URLSearchParams({
    q: query,
  });

  if (filters.category) params.append('category', filters.category);
  if (filters.artist) params.append('artist', filters.artist);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await fetch(
    `${API_BASE_URL}/api/audio/copyright-free/search?${params.toString()}`
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Search failed');
  }

  return result.data; // { songs: [...], pagination: {...} }
}
```

---

## 🎯 9. Complete Song Card Component

Here's a complete, production-ready song card component:

```javascript
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

function SongCard({ song }) {
  const [liked, setLiked] = useState(false); // Get from user's liked songs list
  const [saved, setSaved] = useState(false); // Get from user's library
  const [likeCount, setLikeCount] = useState(song.likeCount || 0);
  const [viewCount, setViewCount] = useState(song.viewCount || 0);
  const [listenCount, setListenCount] = useState(song.listenCount || 0);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.IO for real-time updates
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
    });

    newSocket.on('connect', () => {
      newSocket.emit('join-content', {
        contentId: song._id,
        contentType: 'media',
      });
      newSocket.join(`audio:copyright-free:${song._id}`);
    });

    // Listen for real-time updates
    newSocket.on('audio-like-updated', (data) => {
      if (data.songId === song._id) {
        setLikeCount(data.likeCount);
        setViewCount(data.viewCount);
        setListenCount(data.listenCount);
        // Note: data.liked is for the user who clicked, not necessarily current user
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-content', {
        contentId: song._id,
        contentType: 'media',
      });
      newSocket.leave(`audio:copyright-free:${song._id}`);
      newSocket.close();
    };
  }, [song._id]);

  // Handle like
  const handleLike = async () => {
    try {
      const result = await toggleLike(song._id);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
      setViewCount(result.viewCount);
      setListenCount(result.listenCount);
    } catch (error) {
      alert(error.message);
    }
  };

  // Handle save
  const handleSave = async () => {
    try {
      const result = await saveToLibrary(song._id);
      setSaved(result.bookmarked);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="song-card">
      <img src={song.thumbnailUrl} alt={song.title} />
      <h3>{song.title}</h3>
      <p>By {song.speaker || song.uploadedBy?.firstName}</p>
      
      <div className="song-stats">
        <button onClick={handleLike}>
          {liked ? '❤️' : '🤍'} {likeCount}
        </button>
        <span>👁️ {viewCount}</span>
        <span>🎵 {listenCount}</span>
        <button onClick={handleSave}>
          {saved ? '💾' : '📥'}
        </button>
      </div>
      
      <AudioPlayer song={song} />
    </div>
  );
}
```

---

## ⚠️ 10. Critical UI Patterns (Avoid Breaking Your UI)

### ❌ DON'T Do This

```javascript
// ❌ BAD: Directly mutating state
function BadComponent() {
  const [songs, setSongs] = useState([]);
  
  const handleLike = (songId) => {
    // ❌ BAD: Directly mutating array
    songs.find(s => s._id === songId).likeCount++;
    setSongs(songs); // This won't trigger re-render!
  };
}
```

### ✅ DO This Instead

```javascript
// ✅ GOOD: Create new array/object
function GoodComponent() {
  const [songs, setSongs] = useState([]);
  
  const handleLike = async (songId) => {
    try {
      // Optimistic update with new array
      setSongs(prevSongs => 
        prevSongs.map(song => 
          song._id === songId
            ? { ...song, liked: !song.liked, likeCount: song.liked ? song.likeCount - 1 : song.likeCount + 1 }
            : song
        )
      );

      // Call API
      const result = await toggleLike(songId);

      // Update with actual response
      setSongs(prevSongs => 
        prevSongs.map(song => 
          song._id === songId
            ? { ...song, liked: result.liked, likeCount: result.likeCount }
            : song
        )
      );
    } catch (error) {
      // Revert on error
      setSongs(prevSongs => 
        prevSongs.map(song => 
          song._id === songId
            ? { ...song, liked: !song.liked, likeCount: song.liked ? song.likeCount + 1 : song.likeCount - 1 }
            : song
        )
      );
    }
  };
}
```

### ✅ Key Patterns

1. **Always Create New Objects/Arrays**
   ```javascript
   // ✅ GOOD
   setSongs([...songs, newSong]);
   setSongs(songs.map(s => s._id === id ? {...s, ...updates} : s));
   setSongs(songs.filter(s => s._id !== id));
   ```

2. **Handle Loading States**
   ```javascript
   const [loading, setLoading] = useState(false);
   
   const handleAction = async () => {
     setLoading(true);
     try {
       await apiCall();
     } finally {
       setLoading(false);
     }
   };
   ```

3. **Optimistic Updates with Error Recovery**
   ```javascript
   // Update UI immediately
   setState(newState);
   
   try {
     await apiCall();
     // Update with server response
     setState(serverState);
   } catch (error) {
     // Revert on error
     setState(oldState);
   }
   ```

4. **Prevent Double Actions**
   ```javascript
   const [isProcessing, setIsProcessing] = useState(false);
   
   const handleClick = async () => {
     if (isProcessing) return; // Prevent double-click
     setIsProcessing(true);
     try {
       await action();
     } finally {
       setIsProcessing(false);
     }
   };
   ```

---

## 🔄 11. Socket.IO Best Practices

### Single Socket Instance (Singleton Pattern)

```javascript
// socket.js - Create singleton socket instance
let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    const token = getAccessToken();
    socketInstance = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
```

### Reusable Socket Hook

```javascript
import { useEffect, useRef } from 'react';
import { getSocket } from './socket';

function useSocketRoom(roomId, eventName, callback) {
  const socketRef = useRef(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const socket = getSocket();

    if (roomId) {
      socket.emit('join-content', {
        contentId: roomId,
        contentType: 'media',
      });
      socket.join(`audio:copyright-free:${roomId}`);
    }

    const handler = (data) => {
      if (data.songId === roomId || data.contentId === roomId) {
        callbackRef.current(data);
      }
    };

    socket.on(eventName, handler);
    socketRef.current = socket;

    return () => {
      if (roomId) {
        socket.emit('leave-content', {
          contentId: roomId,
          contentType: 'media',
        });
        socket.leave(`audio:copyright-free:${roomId}`);
      }
      socket.off(eventName, handler);
    };
  }, [roomId, eventName]);
}

// Usage
function SongCard({ song }) {
  const [likeCount, setLikeCount] = useState(song.likeCount);

  // Listen for real-time updates
  useSocketRoom(song._id, 'audio-like-updated', (data) => {
    setLikeCount(data.likeCount);
  });

  return <div>Likes: {likeCount}</div>;
}
```

---

## 🛡️ 12. Error Handling Patterns

### Global Error Handler

```javascript
// api-client.js
class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.message || 'Request failed',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network errors
    if (error.message === 'Failed to fetch') {
      throw new ApiError('Network error. Please check your connection.', 0);
    }

    throw new ApiError(error.message || 'An unexpected error occurred', 0);
  }
}
```

### Error Boundary for React

```javascript
class AudioLibraryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Audio Library Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 📊 13. State Management Pattern (Redux/Zustand Example)

### Zustand Store Example

```javascript
// stores/audioStore.js
import create from 'zustand';

const useAudioStore = create((set, get) => ({
  songs: [],
  likedSongs: new Set(), // Song IDs user has liked
  savedSongs: new Set(), // Song IDs user has saved
  loading: false,
  error: null,

  // Actions
  setSongs: (songs) => set({ songs }),
  
  toggleLike: async (songId) => {
    const { likedSongs, songs } = get();
    const isLiked = likedSongs.has(songId);

    // Optimistic update
    set({
      likedSongs: new Set([...likedSongs, songId].filter(id => id !== songId || !isLiked)),
      songs: songs.map(s => 
        s._id === songId 
          ? { ...s, liked: !isLiked, likeCount: isLiked ? s.likeCount - 1 : s.likeCount + 1 }
          : s
      ),
    });

    try {
      const result = await toggleLike(songId);
      set({
        likedSongs: result.liked 
          ? new Set([...likedSongs, songId])
          : new Set([...likedSongs].filter(id => id !== songId)),
        songs: songs.map(s => 
          s._id === songId 
            ? { ...s, liked: result.liked, likeCount: result.likeCount }
            : s
        ),
      });
    } catch (error) {
      // Revert on error
      set({
        likedSongs: new Set([...likedSongs, ...(isLiked ? [songId] : [])].filter(id => id !== songId || isLiked)),
        songs: songs.map(s => 
          s._id === songId 
            ? { ...s, liked: isLiked, likeCount: isLiked ? s.likeCount + 1 : s.likeCount - 1 }
            : s
        ),
      });
      throw error;
    }
  },
}));
```

---

## 🎨 14. Complete Example: Songs List Screen

```javascript
import { useState, useEffect } from 'react';
import { useCopyrightFreeSongs } from './hooks/useCopyrightFreeSongs';
import SongCard from './components/SongCard';

function SongsListScreen() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    sortBy: 'newest',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const { songs, loading, error, pagination } = useCopyrightFreeSongs(
    searchQuery ? { ...filters, search: searchQuery } : filters
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    setFilters({ ...filters, page: 1 }); // Reset to page 1 on search
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && songs.length === 0) {
    return <div>Loading songs...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="songs-list-screen">
      {/* Search */}
      <input
        type="text"
        placeholder="Search songs..."
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {/* Songs Grid */}
      <div className="songs-grid">
        {songs.map(song => (
          <SongCard key={song._id} song={song} />
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={filters.page === 1}
            onClick={() => handlePageChange(filters.page - 1)}
          >
            Previous
          </button>
          
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          
          <button
            disabled={filters.page >= pagination.totalPages}
            onClick={() => handlePageChange(filters.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 🔍 15. Search & Filter Implementation

```javascript
function SearchFilters({ onFiltersChange }) {
  const [category, setCategory] = useState('');
  const [artist, setArtist] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [categories, setCategories] = useState([]);
  const [artists, setArtists] = useState([]);

  // Fetch categories and artists
  useEffect(() => {
    async function fetchFilters() {
      try {
        const [catsRes, artistsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/audio/copyright-free/categories`),
          fetch(`${API_BASE_URL}/api/audio/copyright-free/artists`),
        ]);

        const catsData = await catsRes.json();
        const artistsData = await artistsRes.json();

        setCategories(catsData.data || []);
        setArtists(artistsData.data || []);
      } catch (error) {
        console.error('Error fetching filters:', error);
      }
    }

    fetchFilters();
  }, []);

  // Notify parent when filters change
  useEffect(() => {
    onFiltersChange({
      category: category || undefined,
      artist: artist || undefined,
      sortBy,
    });
  }, [category, artist, sortBy, onFiltersChange]);

  return (
    <div className="search-filters">
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All Categories</option>
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <select value={artist} onChange={(e) => setArtist(e.target.value)}>
        <option value="">All Artists</option>
        {artists.map(artist => (
          <option key={artist} value={artist}>{artist}</option>
        ))}
      </select>

      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="popular">Most Popular</option>
        <option value="title">Title A-Z</option>
        <option value="duration">Duration</option>
      </select>
    </div>
  );
}
```

---

## 📱 16. React Native / Mobile Considerations

### Using Expo/React Native

```javascript
// api-client.js
import AsyncStorage from '@react-native-async-storage/async-storage';

async function getAccessToken() {
  return await AsyncStorage.getItem('accessToken');
}

// Socket.IO with React Native
import { io } from 'socket.io-client';

const socket = io(SOCKET_URL, {
  auth: async () => {
    const token = await getAccessToken();
    return { token };
  },
  transports: ['websocket'], // Prefer websocket on mobile
});
```

### Audio Player (React Native)

```javascript
import { Audio } from 'expo-av';

function AudioPlayer({ song }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: song.fileUrl },
        { shouldPlay: true }
      );

      setSound(audioSound);
      setIsPlaying(true);

      // Track playback
      await startPlayback(song._id, song.duration);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const pauseAudio = async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  };

  return (
    <View>
      <Button
        title={isPlaying ? 'Pause' : 'Play'}
        onPress={isPlaying ? pauseAudio : playAudio}
      />
    </View>
  );
}
```

---

## ⚡ 17. Performance Optimization

### 1. Pagination (Don't Load All Songs)

```javascript
// ✅ GOOD: Load 20 at a time
const [songs, setSongs] = useState([]);
const [page, setPage] = useState(1);

const loadMore = async () => {
  const data = await getCopyrightFreeSongs({ page: page + 1, limit: 20 });
  setSongs(prev => [...prev, ...data.songs]); // Append, don't replace
  setPage(prev => prev + 1);
};

// ❌ BAD: Loading all songs at once
const [allSongs, setAllSongs] = useState([]);
// This will break your UI with thousands of songs!
```

### 2. Image Optimization

```javascript
// Lazy load images
function SongThumbnail({ src, alt }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && <div className="skeleton" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{ display: loaded ? 'block' : 'none' }}
      />
    </>
  );
}
```

### 3. Debounce Search

```javascript
import { useDebouncedCallback } from 'use-debounce';

function SearchInput({ onSearch }) {
  const [query, setQuery] = useState('');
  
  const debouncedSearch = useDebouncedCallback(
    (value) => {
      onSearch(value);
    },
    300 // Wait 300ms after user stops typing
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  return <input value={query} onChange={handleChange} />;
}
```

---

## 🚨 18. Common Pitfalls & Solutions

### Pitfall 1: Not Handling Loading States

```javascript
// ❌ BAD
function Component() {
  const [songs, setSongs] = useState([]);
  
  useEffect(() => {
    getCopyrightFreeSongs().then(setSongs);
  }, []);
  
  return <div>{songs.map(...)}</div>; // Crashes if songs is undefined
}

// ✅ GOOD
function Component() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    getCopyrightFreeSongs()
      .then(data => setSongs(data.songs || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);
  
  if (loading) return <div>Loading...</div>;
  return <div>{songs.map(...)}</div>;
}
```

### Pitfall 2: Not Updating State Correctly

```javascript
// ❌ BAD: Direct mutation
const handleLike = (songId) => {
  const song = songs.find(s => s._id === songId);
  song.liked = !song.liked; // Direct mutation!
  song.likeCount += song.liked ? 1 : -1;
  setSongs(songs); // Won't trigger re-render
};

// ✅ GOOD: Create new array
const handleLike = (songId) => {
  setSongs(prevSongs =>
    prevSongs.map(song =>
      song._id === songId
        ? {
            ...song,
            liked: !song.liked,
            likeCount: song.liked ? song.likeCount - 1 : song.likeCount + 1,
          }
        : song
    )
  );
};
```

### Pitfall 3: Not Cleaning Up Socket Connections

```javascript
// ❌ BAD: Socket connections pile up
function Component({ songId }) {
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('update', handleUpdate);
    // ❌ Never disconnects!
  }, [songId]);
}

// ✅ GOOD: Clean up on unmount
function Component({ songId }) {
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('update', handleUpdate);
    
    return () => {
      socket.off('update', handleUpdate);
      socket.disconnect(); // Clean up!
    };
  }, [songId]);
}
```

### Pitfall 4: Race Conditions

```javascript
// ❌ BAD: Multiple rapid clicks cause race conditions
const handleLike = async () => {
  await toggleLike(songId);
  await fetchSongs(); // Might get stale data
};

// ✅ GOOD: Use optimistic updates + single source of truth
const handleLike = async () => {
  // Optimistic update
  setLiked(!liked);
  
  try {
    const result = await toggleLike(songId);
    // Update with server response
    setLiked(result.liked);
    setLikeCount(result.likeCount);
  } catch (error) {
    // Revert on error
    setLiked(!liked);
  }
};
```

---

## ✅ 19. Checklist Before Going Live

- [ ] **Error Handling**: All API calls wrapped in try-catch
- [ ] **Loading States**: Loading indicators for async operations
- [ ] **Optimistic Updates**: UI updates immediately, syncs with server
- [ ] **Error Recovery**: Revert optimistic updates on error
- [ ] **Socket Cleanup**: All Socket.IO connections cleaned up on unmount
- [ ] **State Management**: Using immutable updates (new objects/arrays)
- [ ] **Pagination**: Not loading all songs at once
- [ ] **Image Loading**: Lazy loading or skeleton screens
- [ ] **Search Debounce**: Debounced search input
- [ ] **Double-Click Prevention**: Prevent rapid API calls
- [ ] **Authentication Checks**: Verify user is authenticated before actions
- [ ] **Network Errors**: Handle offline/network errors gracefully

---

## 📊 20. Response Format Reference

### Get Songs Response
```typescript
{
  success: true,
  message: "Copyright-free songs retrieved successfully",
  data: {
    songs: Array<{
      _id: string;
      title: string;
      description?: string;
      fileUrl: string;
      thumbnailUrl: string;
      speaker: string;
      year: number;
      duration: number;
      likeCount: number;
      viewCount: number;
      listenCount: number;
      commentCount: number;
      shareCount: number;
      category: string;
      topics: string[];
      tags: string[];
      uploadedBy: {
        _id: string;
        firstName: string;
        lastName: string;
        avatar?: string;
      };
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: {
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    };
  };
}
```

### Like Response
```typescript
{
  success: true,
  message: "Song liked successfully" | "Song unliked",
  data: {
    liked: boolean;
    likeCount: number;
    viewCount: number;
    listenCount: number;
  };
}
```

### Save Response
```typescript
{
  success: true,
  message: "Song saved to library" | "Song removed from library",
  data: {
    bookmarked: boolean;
    bookmarkCount: number;
  };
}
```

---

## 🎯 Quick Reference

### Essential Endpoints

| Action | Endpoint | Auth | Method |
|--------|----------|------|--------|
| Get all songs | `/api/audio/copyright-free` | ❌ | GET |
| Get single song | `/api/audio/copyright-free/:songId` | ❌ | GET |
| Search songs | `/api/audio/copyright-free/search?q=...` | ❌ | GET |
| Like/unlike | `/api/audio/copyright-free/:songId/like` | ✅ | POST |
| Save to library | `/api/audio/copyright-free/:songId/save` | ✅ | POST |
| Get library | `/api/audio/library` | ✅ | GET |
| Start playback | `/api/audio/playback/start` | ✅ | POST |
| Update progress | `/api/audio/playback/progress` | ✅ | POST |

### Socket.IO Events

| Event | When | Payload |
|-------|------|---------|
| `audio-like-updated` | User likes/unlikes | `{ songId, liked, likeCount, viewCount, listenCount }` |
| `like-updated` | Like update (backup) | `{ contentId, likeCount, userLiked }` |
| `content-like-update` | Global like update | `{ contentId, contentType, likeCount }` |

---

## 📝 Summary: Do's and Don'ts

### ✅ DO:
- ✅ Create new arrays/objects when updating state
- ✅ Use optimistic updates with error recovery
- ✅ Clean up Socket.IO connections
- ✅ Handle loading and error states
- ✅ Prevent double-clicks/rapid actions
- ✅ Debounce search inputs
- ✅ Use pagination
- ✅ Verify authentication before actions

### ❌ DON'T:
- ❌ Mutate state directly
- ❌ Load all songs at once
- ❌ Forget to clean up sockets
- ❌ Ignore error handling
- ❌ Allow rapid API calls (no debouncing)
- ❌ Update UI without API calls (miss real-time sync)
- ❌ Forget to handle loading states

---

## 🚀 You're Ready!

Follow this guide and your UI will:
- ✅ Update in real-time
- ✅ Handle errors gracefully
- ✅ Stay performant
- ✅ Provide great UX

**All endpoints are ready. Start integrating!** 🎉

