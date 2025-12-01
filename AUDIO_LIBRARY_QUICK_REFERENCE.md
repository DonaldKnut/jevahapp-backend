# Audio Library - Quick Reference Card

**For Frontend Developers**

---

## 🚀 Quick Start

### Base URL
```
/api/audio
```

### Authentication Header
```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`
}
```

---

## 📋 Most Common Endpoints

### 1. Get All Songs (Public)
```javascript
GET /api/audio/copyright-free?page=1&limit=20&sortBy=popular
```

### 2. Get Single Song (Public)
```javascript
GET /api/audio/copyright-free/:songId
```

### 3. Like/Unlike Song
```javascript
POST /api/audio/copyright-free/:songId/like
// Returns: { liked: true/false, likeCount: 42, viewCount: 1250, listenCount: 890 }
```

### 4. Save to Library
```javascript
POST /api/audio/copyright-free/:songId/save
```

### 5. Start Playback
```javascript
POST /api/audio/playback/start
Body: { trackId: "...", duration: 180, position: 0 }
```

---

## 🔄 Real-Time Updates

### Setup Socket.IO
```javascript
const socket = io('API_URL', {
  auth: { token: accessToken }
});
```

### Join Rooms When Viewing Song
```javascript
socket.emit('join-content', {
  contentId: songId,
  contentType: 'media'
});
socket.join(`audio:copyright-free:${songId}`);
```

### Listen for Like Updates
```javascript
socket.on('audio-like-updated', (data) => {
  // Update UI: data.likeCount, data.viewCount, data.listenCount, data.liked
});
```

---

## 📊 Response Fields

All songs include:
- `likeCount` - Number of likes
- `viewCount` - Number of views
- `listenCount` - Number of listens
- `commentCount` - Number of comments
- `shareCount` - Number of shares

---

## 🎯 Like Button Implementation

```javascript
async function handleLike(songId) {
  const res = await fetch(`/api/audio/copyright-free/${songId}/like`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const result = await res.json();
  
  // Update UI immediately
  setLiked(result.data.liked);
  setLikeCount(result.data.likeCount);
  
  // Real-time updates will come via Socket.IO
}
```

---

## 📝 Full Documentation

- **Complete Guide:** `AUDIO_LIBRARY_FRONTEND_GUIDE.md`
- **Real-Time Updates:** `AUDIO_REALTIME_LIKES_DOCUMENTATION.md`
- **Implementation Status:** `AUDIO_LIBRARY_IMPLEMENTATION_COMPLETE.md`

---

**Build Status:** ✅ **SUCCESS**

