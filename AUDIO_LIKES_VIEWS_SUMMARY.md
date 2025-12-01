# Audio Library - Likes & View Counts Summary

**Date:** 2024  
**Status:** ✅ **COMPLETE**

---

## ✅ What's Implemented

### 1. Like/Unlike Endpoint ✅

**Endpoint:** `POST /api/audio/copyright-free/:songId/like`

- ✅ **Toggle behavior** - Same endpoint for like and unlike
- ✅ **Returns counts** - likeCount, viewCount, listenCount in response
- ✅ **Real-time updates** - Automatically emits Socket.IO events
- ✅ **Authentication required**

**Usage:**
```javascript
// First call = Like
POST /api/audio/copyright-free/507f1f77bcf86cd799439011/like
Response: { liked: true, likeCount: 42, viewCount: 1250, listenCount: 890 }

// Second call = Unlike
POST /api/audio/copyright-free/507f1f77bcf86cd799439011/like
Response: { liked: false, likeCount: 41, viewCount: 1250, listenCount: 890 }
```

---

### 2. Real-Time Updates ✅

**Socket.IO Events Emitted:**

1. **`content-like-update`** - Global event
2. **`like-updated`** - Room-scoped (content:{songId})
3. **`audio-like-updated`** - Audio-specific (content:media:{songId})
4. **`like-updated`** - Copyright-free specific (audio:copyright-free:{songId})

**Payload includes:**
- `songId` / `contentId`
- `liked` / `userLiked` (boolean)
- `likeCount` (number)
- `viewCount` (number)
- `listenCount` (number)
- `userId` (who performed action)
- `timestamp` (ISO string)

---

### 3. Count Fields in All Responses ✅

All song endpoints now return:

- ✅ **`likeCount`** - Total number of likes
- ✅ **`viewCount`** - Total number of views
- ✅ **`listenCount`** - Total number of listens
- ✅ **`commentCount`** - Total number of comments
- ✅ **`shareCount`** - Total number of shares

**Included in:**
- `GET /api/audio/copyright-free` (list)
- `GET /api/audio/copyright-free/:songId` (single)
- `GET /api/audio/copyright-free/search` (search)
- `POST /api/audio/copyright-free/:songId/like` (like response)

---

## 📡 Frontend Integration Guide

### 1. Like/Unlike Icon Click

```javascript
// When user clicks like icon
async function handleLikeClick(songId) {
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
    setLikeCount(result.data.likeCount);
    setViewCount(result.data.viewCount);
    setListenCount(result.data.listenCount);
    setLiked(result.data.liked);
    
    // Update like icon state
    setLikeIconFilled(result.data.liked);
  }
}
```

### 2. Real-Time Updates Setup

```javascript
// When song page loads
useEffect(() => {
  // Join Socket.IO rooms
  socket.emit('join-content', {
    contentId: songId,
    contentType: 'media'
  });
  
  socket.join(`audio:copyright-free:${songId}`);
  socket.join(`content:media:${songId}`);

  // Listen for real-time updates
  socket.on('audio-like-updated', (data) => {
    if (data.songId === songId) {
      // Update counts in real-time
      setLikeCount(data.likeCount);
      setViewCount(data.viewCount);
      setListenCount(data.listenCount);
      setLiked(data.liked);
      
      // Update icon state
      setLikeIconFilled(data.liked);
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
  };
}, [songId]);
```

### 3. Display Counts

```javascript
// In your component
<div className="song-stats">
  <span>
    <HeartIcon filled={liked} />
    {likeCount} likes
  </span>
  <span>
    <EyeIcon />
    {viewCount} views
  </span>
  <span>
    <PlayIcon />
    {listenCount} listens
  </span>
</div>

<button onClick={() => handleLikeClick(songId)}>
  {liked ? <HeartFilledIcon /> : <HeartEmptyIcon />}
</button>
```

---

## 🎯 Features

✅ **Toggle Like/Unlike** - Single endpoint handles both  
✅ **Real-Time Updates** - Instant updates via Socket.IO  
✅ **Count Tracking** - Like, view, and listen counts  
✅ **Multiple Events** - Different Socket.IO events for flexibility  
✅ **Room-Based** - Specific rooms for audio content  
✅ **Immediate Response** - Counts in API response  
✅ **Real-Time Sync** - Other users see updates instantly  

---

## 📋 Endpoints Summary

### Like/Unlike
- `POST /api/audio/copyright-free/:songId/like`
  - Auth: ✅ Required
  - Returns: `{ liked, likeCount, viewCount, listenCount }`
  - Real-time: ✅ Yes

### Get Song (with counts)
- `GET /api/audio/copyright-free/:songId`
  - Auth: ❌ Public
  - Returns: Song with all counts

### List Songs (with counts)
- `GET /api/audio/copyright-free`
  - Auth: ❌ Public
  - Returns: Songs array with all counts

### Search Songs (with counts)
- `GET /api/audio/copyright-free/search?q=...`
  - Auth: ❌ Public
  - Returns: Songs array with all counts

---

## ✅ Status

**Implementation:** ✅ **COMPLETE**  
**Real-Time Updates:** ✅ **WORKING**  
**Count Tracking:** ✅ **WORKING**  
**Frontend Ready:** ✅ **YES**  

---

**All backend logic for likes, views, and real-time updates is implemented and ready for frontend integration!** 🚀

