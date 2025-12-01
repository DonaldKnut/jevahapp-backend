# Audio Library System - Complete Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** ✅ Ready for Implementation

---

## 🎯 Overview

This guide provides everything the frontend needs to integrate with the Audio Library System (YouTube Audio Library Style). The system includes copyright-free songs management, playlists, playback tracking, and real-time interactions.

---

## 📡 Base URL

```
Production: https://your-api-domain.com
Development: http://localhost:4000
```

All endpoints are prefixed with `/api/audio`

---

## 🔐 Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

---

## 📋 Table of Contents

1. [Copyright-Free Songs](#copyright-free-songs)
2. [Likes & Real-Time Updates](#likes--real-time-updates)
3. [Playlists](#playlists)
4. [Playback Tracking](#playback-tracking)
5. [User Library](#user-library)
6. [Socket.IO Integration](#socketio-integration)
7. [Error Handling](#error-handling)
8. [Complete Example](#complete-example)

---

## 1. Copyright-Free Songs

### Get All Songs (Public)

**Endpoint:** `GET /api/audio/copyright-free`

**Authentication:** ❌ Not required (Public)

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page
- `search` (string, optional) - Search term
- `category` (string, optional) - Filter by category
- `artist` (string, optional) - Filter by artist/speaker
- `year` (number, optional) - Filter by year
- `minDuration` (number, optional) - Minimum duration in seconds
- `maxDuration` (number, optional) - Maximum duration in seconds
- `tags` (array, optional) - Filter by tags
- `sortBy` (string, optional) - Sort option: `"newest" | "oldest" | "popular" | "duration" | "title"`

**Example Request:**
```javascript
const response = await fetch(
  '/api/audio/copyright-free?page=1&limit=20&sortBy=popular',
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  }
);

const result = await response.json();
```

**Response:**
```json
{
  "success": true,
  "message": "Copyright-free songs retrieved successfully",
  "data": {
    "songs": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Amazing Grace",
        "description": "Beautiful worship song",
        "contentType": "music",
        "category": "worship",
        "fileUrl": "https://...",
        "thumbnailUrl": "https://...",
        "speaker": "John Doe",
        "year": 2024,
        "duration": 180,
        "likeCount": 42,
        "viewCount": 1250,
        "listenCount": 890,
        "commentCount": 15,
        "shareCount": 8,
        "isPublicDomain": true,
        "tags": ["worship", "praise"],
        "uploadedBy": {
          "_id": "...",
          "firstName": "Admin",
          "lastName": "User",
          "avatar": "https://..."
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "totalPages": 5,
      "limit": 20
    }
  }
}
```

---

### Get Single Song (Public)

**Endpoint:** `GET /api/audio/copyright-free/:songId`

**Authentication:** ❌ Not required (Public)

**Example Request:**
```javascript
const response = await fetch(`/api/audio/copyright-free/${songId}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
```

**Response:**
```json
{
  "success": true,
  "message": "Song retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Amazing Grace",
    "description": "Beautiful worship song",
    "fileUrl": "https://...",
    "thumbnailUrl": "https://...",
    "likeCount": 42,
    "viewCount": 1250,
    "listenCount": 890,
    "commentCount": 15,
    "shareCount": 8,
    ...
  }
}
```

---

### Search Songs (Public)

**Endpoint:** `GET /api/audio/copyright-free/search`

**Authentication:** ❌ Not required (Public)

**Query Parameters:**
- `q` (string, **required**) - Search query
- `category` (string, optional)
- `artist` (string, optional)
- `sortBy` (string, optional)
- `page` (number, optional)
- `limit` (number, optional)

**Example Request:**
```javascript
const response = await fetch(
  `/api/audio/copyright-free/search?q=worship&category=inspiration`,
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  }
);
```

---

### Get Categories (Public)

**Endpoint:** `GET /api/audio/copyright-free/categories`

**Authentication:** ❌ Not required (Public)

**Response:**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": ["worship", "inspiration", "youth", "teachings"]
}
```

---

### Get Artists (Public)

**Endpoint:** `GET /api/audio/copyright-free/artists`

**Authentication:** ❌ Not required (Public)

**Response:**
```json
{
  "success": true,
  "message": "Artists retrieved successfully",
  "data": ["John Doe", "Jane Smith", "Choir"]
}
```

---

## 2. Likes & Real-Time Updates

### Like/Unlike Song

**Endpoint:** `POST /api/audio/copyright-free/:songId/like`

**Authentication:** ✅ Required

**Method:** Toggle (same endpoint for like and unlike)

**Example Request:**
```javascript
async function toggleLike(songId, token) {
  const response = await fetch(
    `/api/audio/copyright-free/${songId}/like`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const result = await response.json();
  
  if (result.success) {
    // Update UI immediately
    console.log('Liked:', result.data.liked);
    console.log('Like Count:', result.data.likeCount);
    console.log('View Count:', result.data.viewCount);
    console.log('Listen Count:', result.data.listenCount);
  }
  
  return result;
}
```

**Response:**
```json
{
  "success": true,
  "message": "Song liked successfully" | "Song unliked",
  "data": {
    "liked": true,
    "likeCount": 42,
    "viewCount": 1250,
    "listenCount": 890
  }
}
```

---

### Real-Time Like Updates

When a user likes/unlikes a song, Socket.IO events are emitted automatically. See [Socket.IO Integration](#socketio-integration) section below.

---

## 3. Playlists

### Create Playlist

**Endpoint:** `POST /api/audio/playlists`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "name": "My Worship Playlist",
  "description": "Favorite worship songs",
  "isPublic": false,
  "coverImageUrl": "https://...",
  "tags": ["worship", "favorites"]
}
```

**Example:**
```javascript
const response = await fetch('/api/audio/playlists', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Worship Playlist',
    description: 'Favorite worship songs',
    isPublic: false
  })
});
```

---

### Get User Playlists

**Endpoint:** `GET /api/audio/playlists`

**Authentication:** ✅ Required

**Query Parameters:**
- `page` (number, optional)
- `limit` (number, optional)

---

### Get Single Playlist

**Endpoint:** `GET /api/audio/playlists/:playlistId`

**Authentication:** ✅ Required (own playlists or public playlists)

---

### Add Song to Playlist

**Endpoint:** `POST /api/audio/playlists/:playlistId/songs`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "mediaId": "507f1f77bcf86cd799439011",
  "notes": "Favorite track",
  "position": 0
}
```

---

### Remove Song from Playlist

**Endpoint:** `DELETE /api/audio/playlists/:playlistId/songs/:songId`

**Authentication:** ✅ Required

---

### Reorder Songs in Playlist

**Endpoint:** `PUT /api/audio/playlists/:playlistId/songs/reorder`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "tracks": [
    { "mediaId": "507f1f77bcf86cd799439011", "order": 0 },
    { "mediaId": "507f1f77bcf86cd799439012", "order": 1 }
  ]
}
```

---

## 4. Playback Tracking

### Start Playback

**Endpoint:** `POST /api/audio/playback/start`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "trackId": "507f1f77bcf86cd799439011",
  "duration": 180,
  "position": 0,
  "deviceInfo": "iPhone 13"
}
```

**Example:**
```javascript
const response = await fetch('/api/audio/playback/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    trackId: songId,
    duration: songDuration,
    position: 0
  })
});
```

---

### Update Playback Progress

**Endpoint:** `POST /api/audio/playback/progress`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "sessionId": "507f1f77bcf86cd799439011",
  "position": 45,
  "duration": 180,
  "progressPercentage": 25
}
```

**Call every 5-10 seconds during playback:**
```javascript
setInterval(async () => {
  if (isPlaying) {
    await fetch('/api/audio/playback/progress', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: currentSessionId,
        position: currentPosition,
        duration: totalDuration,
        progressPercentage: (currentPosition / totalDuration) * 100
      })
    });
  }
}, 5000); // Every 5 seconds
```

---

### Pause Playback

**Endpoint:** `POST /api/audio/playback/pause`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "sessionId": "507f1f77bcf86cd799439011"
}
```

---

### Resume Playback

**Endpoint:** `POST /api/audio/playback/resume`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "sessionId": "507f1f77bcf86cd799439011"
}
```

---

### Complete Playback

**Endpoint:** `POST /api/audio/playback/complete` or `POST /api/audio/playback/end`

**Authentication:** ✅ Required

**Request Body:**
```json
{
  "sessionId": "507f1f77bcf86cd799439011",
  "reason": "completed",
  "finalPosition": 180
}
```

---

### Get Playback History

**Endpoint:** `GET /api/audio/playback/history`

**Authentication:** ✅ Required

**Query Parameters:**
- `page` (number, optional)
- `limit` (number, optional)
- `includeInactive` (boolean, optional)

---

### Get Last Playback Position

**Endpoint:** `GET /api/audio/playback/last-position/:trackId`

**Authentication:** ✅ Required

**Response:**
```json
{
  "success": true,
  "data": {
    "position": 45,
    "progressPercentage": 25
  }
}
```

---

## 5. User Library

### Get User's Saved Songs

**Endpoint:** `GET /api/audio/library`

**Authentication:** ✅ Required

**Response:**
```json
{
  "success": true,
  "message": "Audio library retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Amazing Grace",
      "savedAt": "2024-01-15T10:30:00.000Z",
      ...
    }
  ]
}
```

---

### Save Song to Library

**Endpoint:** `POST /api/audio/copyright-free/:songId/save`

**Authentication:** ✅ Required

**Method:** Toggle (same endpoint for save/unsave)

---

## 6. Socket.IO Integration

### Setup Socket.IO Connection

```javascript
import io from 'socket.io-client';

const socket = io('https://your-api-domain.com', {
  auth: {
    token: accessToken // JWT access token
  },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to real-time server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from real-time server');
});
```

---

### Join Content Rooms

When user views a song, join relevant rooms:

```javascript
function joinSongRooms(songId) {
  // Join content room for general updates
  socket.emit('join-content', {
    contentId: songId,
    contentType: 'media'
  });
  
  // Join audio-specific rooms
  socket.join(`audio:copyright-free:${songId}`);
  socket.join(`content:media:${songId}`);
}
```

---

### Listen for Real-Time Like Updates

```javascript
useEffect(() => {
  if (!songId || !socket) return;

  // Join rooms
  joinSongRooms(songId);

  // Listen for audio-specific like updates
  socket.on('audio-like-updated', (data) => {
    if (data.songId === songId) {
      // Update UI in real-time
      setLikeCount(data.likeCount);
      setViewCount(data.viewCount);
      setListenCount(data.listenCount);
      setLiked(data.liked);
      setLikeIconFilled(data.liked);
    }
  });

  // Alternative: Listen to content-specific event
  socket.on('like-updated', (data) => {
    if (data.contentId === songId) {
      setLikeCount(data.likeCount);
      setLiked(data.userLiked);
    }
  });

  // Global content like update
  socket.on('content-like-update', (data) => {
    if (data.contentId === songId && data.contentType === 'media') {
      setLikeCount(data.likeCount);
    }
  });

  // Cleanup on unmount
  return () => {
    socket.emit('leave-content', {
      contentId: songId,
      contentType: 'media'
    });
    socket.leave(`audio:copyright-free:${songId}`);
    socket.leave(`content:media:${songId}`);
    socket.off('audio-like-updated');
    socket.off('like-updated');
    socket.off('content-like-update');
  };
}, [songId, socket]);
```

---

### Socket.IO Events

#### `audio-like-updated`
**Room:** `content:media:{songId}` or `audio:copyright-free:{songId}`

**Payload:**
```json
{
  "songId": "507f1f77bcf86cd799439011",
  "liked": true,
  "likeCount": 42,
  "viewCount": 1250,
  "listenCount": 890,
  "userId": "user123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `like-updated`
**Room:** `content:{songId}` or `audio:copyright-free:{songId}`

#### `content-like-update`
**Global event** (no room required)

---

## 7. Error Handling

### Standard Error Response

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error information"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### Example Error Handling

```javascript
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, options);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Request failed');
    }

    return result;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

---

## 8. Complete Example

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

function AudioPlayer({ songId, token }) {
  const [song, setSong] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [listenCount, setListenCount] = useState(0);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.IO
  useEffect(() => {
    const newSocket = io('https://your-api-domain.com', {
      auth: { token }
    });
    setSocket(newSocket);

    return () => newSocket.close();
  }, [token]);

  // Fetch song data
  useEffect(() => {
    async function fetchSong() {
      const response = await fetch(`/api/audio/copyright-free/${songId}`);
      const result = await response.json();
      
      if (result.success) {
        setSong(result.data);
        setLikeCount(result.data.likeCount);
        setViewCount(result.data.viewCount);
        setListenCount(result.data.listenCount);
      }
    }
    
    fetchSong();
  }, [songId]);

  // Join Socket.IO rooms and listen for updates
  useEffect(() => {
    if (!songId || !socket) return;

    // Join rooms
    socket.emit('join-content', {
      contentId: songId,
      contentType: 'media'
    });
    socket.join(`audio:copyright-free:${songId}`);

    // Listen for real-time updates
    socket.on('audio-like-updated', (data) => {
      if (data.songId === songId) {
        setLikeCount(data.likeCount);
        setViewCount(data.viewCount);
        setListenCount(data.listenCount);
        setLiked(data.liked);
      }
    });

    return () => {
      socket.emit('leave-content', {
        contentId: songId,
        contentType: 'media'
      });
      socket.leave(`audio:copyright-free:${songId}`);
      socket.off('audio-like-updated');
    };
  }, [songId, socket]);

  // Handle like/unlike
  async function handleLike() {
    const response = await fetch(`/api/audio/copyright-free/${songId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      // Update UI immediately
      setLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
      setViewCount(result.data.viewCount);
      setListenCount(result.data.listenCount);
      
      // Real-time updates will also come via Socket.IO
    }
  }

  if (!song) return <div>Loading...</div>;

  return (
    <div className="audio-player">
      <img src={song.thumbnailUrl} alt={song.title} />
      <h2>{song.title}</h2>
      <p>{song.description}</p>
      
      <div className="stats">
        <button onClick={handleLike}>
          {liked ? '❤️' : '🤍'} {likeCount}
        </button>
        <span>👁️ {viewCount}</span>
        <span>🎵 {listenCount}</span>
      </div>
      
      <audio src={song.fileUrl} controls />
    </div>
  );
}

export default AudioPlayer;
```

---

## ✅ Summary

### Endpoints Overview

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/audio/copyright-free` | GET | ❌ | List all songs |
| `/api/audio/copyright-free/:songId` | GET | ❌ | Get single song |
| `/api/audio/copyright-free/search` | GET | ❌ | Search songs |
| `/api/audio/copyright-free/categories` | GET | ❌ | Get categories |
| `/api/audio/copyright-free/artists` | GET | ❌ | Get artists |
| `/api/audio/copyright-free/:songId/like` | POST | ✅ | Like/unlike song |
| `/api/audio/copyright-free/:songId/save` | POST | ✅ | Save/unsave song |
| `/api/audio/playlists` | GET/POST | ✅ | Manage playlists |
| `/api/audio/playlists/:id/songs` | POST/DELETE | ✅ | Manage playlist songs |
| `/api/audio/playback/start` | POST | ✅ | Start playback |
| `/api/audio/playback/progress` | POST | ✅ | Update progress |
| `/api/audio/playback/pause` | POST | ✅ | Pause playback |
| `/api/audio/playback/resume` | POST | ✅ | Resume playback |
| `/api/audio/playback/complete` | POST | ✅ | Complete playback |
| `/api/audio/library` | GET | ✅ | Get saved songs |

### Key Features

✅ **Public Viewing** - No auth required for browsing  
✅ **Real-Time Updates** - Socket.IO for instant updates  
✅ **Like/Unlike** - Toggle endpoint with real-time sync  
✅ **Playback Tracking** - Track listening progress  
✅ **Playlist Management** - Full CRUD operations  
✅ **Count Tracking** - Like, view, listen counts  

---

**Status:** ✅ **Ready for Frontend Implementation**

For detailed Socket.IO setup and real-time updates, refer to `AUDIO_REALTIME_LIKES_DOCUMENTATION.md`

