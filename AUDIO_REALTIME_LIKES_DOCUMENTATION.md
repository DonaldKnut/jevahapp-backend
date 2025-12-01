# Audio Library - Real-Time Likes & View Counts

**Date:** 2024  
**Status:** ✅ Implementation Complete

---

## ✅ Implementation Summary

### Like/Unlike Endpoint

**Endpoint:** `POST /api/audio/copyright-free/:songId/like`

**Method:** Toggle (same endpoint for like and unlike)

**Authentication:** Required

**Request:**
```http
POST /api/audio/copyright-free/507f1f77bcf86cd799439011/like
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Song liked successfully" | "Song unliked",
  "data": {
    "liked": true,           // Current like status
    "likeCount": 42,         // Total likes
    "viewCount": 1250,       // Total views
    "listenCount": 890       // Total listens
  }
}
```

---

## 🔄 Real-Time Updates

### Socket.IO Events

When a user likes/unlikes a song, real-time events are emitted automatically:

#### 1. **Global Content Like Update**
**Event:** `content-like-update`

**Payload:**
```json
{
  "contentId": "507f1f77bcf86cd799439011",
  "contentType": "media",
  "likeCount": 42,
  "userLiked": true,
  "userId": "user123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 2. **Content-Specific Room Event**
**Event:** `like-updated`  
**Room:** `content:{songId}`

**Payload:**
```json
{
  "contentId": "507f1f77bcf86cd799439011",
  "contentType": "media",
  "likeCount": 42,
  "userLiked": true,
  "userId": "user123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 3. **Audio-Specific Events**

**Event 1:** `audio-like-updated`  
**Room:** `content:media:{songId}`

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

**Event 2:** `like-updated`  
**Room:** `audio:copyright-free:{songId}`

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

---

## 📡 Frontend Integration

### 1. Join Socket Rooms

When a user views a copyright-free song, join the relevant rooms:

```javascript
// Join content room for general updates
socket.emit('join-content', {
  contentId: songId,
  contentType: 'media'
});

// Join audio-specific room
socket.join(`audio:copyright-free:${songId}`);
socket.join(`content:media:${songId}`);
```

### 2. Listen for Real-Time Updates

```javascript
// Listen for like updates
socket.on('audio-like-updated', (data) => {
  console.log('Like updated:', data);
  // Update UI in real-time
  updateLikeCount(data.likeCount);
  updateViewCount(data.viewCount);
  updateListenCount(data.listenCount);
  updateLikeButton(data.liked);
});

// Alternative: Listen to content-specific event
socket.on('like-updated', (data) => {
  if (data.contentId === currentSongId) {
    updateLikeCount(data.likeCount);
    updateLikeButton(data.userLiked);
  }
});

// Global content like update
socket.on('content-like-update', (data) => {
  if (data.contentId === currentSongId && data.contentType === 'media') {
    updateLikeCount(data.likeCount);
  }
});
```

### 3. Handle Like/Unlike Action

```javascript
async function toggleLike(songId) {
  try {
    const response = await fetch(`/api/audio/copyright-free/${songId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      // Update UI immediately from response
      updateLikeCount(result.data.likeCount);
      updateViewCount(result.data.viewCount);
      updateListenCount(result.data.listenCount);
      updateLikeButton(result.data.liked);
      
      // Real-time updates will also come via Socket.IO
      // so other users will see the update in real-time
    }
  } catch (error) {
    console.error('Error toggling like:', error);
  }
}
```

### 4. Leave Rooms When Done

```javascript
// When user navigates away from song
socket.emit('leave-content', {
  contentId: songId,
  contentType: 'media'
});
socket.leave(`audio:copyright-free:${songId}`);
socket.leave(`content:media:${songId}`);
```

---

## 📊 Count Fields

All song responses include the following counts:

### Like Count
- **Field:** `likeCount`
- **Type:** `number`
- **Updates:** Real-time via Socket.IO
- **Increments:** When user likes
- **Decrements:** When user unlikes

### View Count
- **Field:** `viewCount`
- **Type:** `number`
- **Updates:** Real-time via Socket.IO when playback starts
- **Increments:** When user starts playback

### Listen Count
- **Field:** `listenCount`
- **Type:** `number`
- **Updates:** Real-time via Socket.IO when playback completes
- **Increments:** When user completes listening (or significant progress)

### Other Counts
- `commentCount` - Number of comments
- `shareCount` - Number of shares
- `downloadCount` - Number of downloads (if enabled)

---

## 🎯 Response Format

All song endpoints return counts:

### Get Single Song
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Song Title",
    "likeCount": 42,
    "viewCount": 1250,
    "listenCount": 890,
    "commentCount": 15,
    "shareCount": 8,
    ...
  }
}
```

### Get All Songs
```json
{
  "success": true,
  "data": {
    "songs": [
      {
        "_id": "...",
        "title": "Song Title",
        "likeCount": 42,
        "viewCount": 1250,
        "listenCount": 890,
        ...
      }
    ],
    "pagination": {...}
  }
}
```

---

## 🔒 Socket.IO Room Strategy

### Room Types

1. **Content Rooms** (`content:{songId}`)
   - General content updates
   - Used by all content types

2. **Media Rooms** (`content:media:{songId}`)
   - Media-specific updates
   - More specific than content rooms

3. **Audio Rooms** (`audio:copyright-free:{songId}`)
   - Audio library specific
   - Most specific for copyright-free songs

### Frontend Should:

1. **Join all relevant rooms** when viewing a song
2. **Listen to multiple events** for redundancy
3. **Update UI immediately** from API response
4. **Update UI again** when Socket.IO events arrive (for real-time sync)
5. **Leave rooms** when navigating away

---

## ✅ Features

### Real-Time Updates ✅
- ✅ Like/unlike updates broadcast instantly
- ✅ All users viewing the same song see updates
- ✅ Counts update in real-time
- ✅ No page refresh needed

### Toggle Behavior ✅
- ✅ Single endpoint for like/unlike
- ✅ First call = like, second call = unlike
- ✅ Idempotent operation
- ✅ Returns current state

### Count Tracking ✅
- ✅ Like count tracked
- ✅ View count tracked
- ✅ Listen count tracked
- ✅ All counts included in responses
- ✅ All counts update in real-time

---

## 🚀 Testing

### Test Like/Unlike

```bash
# Like a song
curl -X POST http://localhost:4000/api/audio/copyright-free/507f1f77bcf86cd799439011/like \
  -H "Authorization: Bearer <token>"

# Response shows liked: true, likeCount increased

# Unlike the same song (call same endpoint again)
curl -X POST http://localhost:4000/api/audio/copyright-free/507f1f77bcf86cd799439011/like \
  -H "Authorization: Bearer <token>"

# Response shows liked: false, likeCount decreased
```

### Test Real-Time Updates

1. Open song in two browser windows
2. Like from one window
3. Second window should see count update instantly (via Socket.IO)

---

## 📝 Summary

✅ **Like/Unlike Endpoint:** `POST /api/audio/copyright-free/:songId/like`  
✅ **Real-Time Updates:** Automatic via Socket.IO  
✅ **Counts Included:** likeCount, viewCount, listenCount  
✅ **Toggle Behavior:** Single endpoint handles both like and unlike  
✅ **Multi-Event Support:** Multiple Socket.IO events for flexibility  
✅ **Room-Based:** Specific rooms for audio/copyright-free content  

**Status:** ✅ **Ready for Frontend Integration**

