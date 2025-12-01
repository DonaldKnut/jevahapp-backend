# Audio Library - Frontend Quick Start

**For Frontend Developers - Start Here!**

---

## 🚀 Setup (5 minutes)

### 1. Install Socket.IO Client

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

### 2. Configuration

```javascript
// config/api.js
export const API_BASE_URL = 'https://your-api-domain.com';
export const SOCKET_URL = API_BASE_URL;

export const getAccessToken = () => {
  return localStorage.getItem('accessToken'); // or AsyncStorage for React Native
};
```

---

## 📋 Essential Code Snippets

### Get All Songs (Copy-Paste Ready)

```javascript
async function getSongs(page = 1) {
  const response = await fetch(
    `${API_BASE_URL}/api/audio/copyright-free?page=${page}&limit=20`
  );
  const result = await response.json();
  return result.data.songs; // Array of songs
}
```

### Like Button (Copy-Paste Ready)

```javascript
async function toggleLike(songId) {
  const token = getAccessToken();
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
  return result.data; // { liked: true/false, likeCount: 42, viewCount: 1250 }
}
```

### Real-Time Updates (Copy-Paste Ready)

```javascript
import { useEffect } from 'react';
import io from 'socket.io-client';

function useRealtimeLikes(songId, setLikeCount) {
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token } });
    
    socket.emit('join-content', {
      contentId: songId,
      contentType: 'media',
    });
    
    socket.on('audio-like-updated', (data) => {
      if (data.songId === songId) {
        setLikeCount(data.likeCount);
      }
    });

    return () => {
      socket.emit('leave-content', { contentId: songId, contentType: 'media' });
      socket.close();
    };
  }, [songId, setLikeCount]);
}
```

---

## 🎯 Complete Working Example

```javascript
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

function SongCard({ song }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(song.likeCount || 0);
  const [viewCount, setViewCount] = useState(song.viewCount || 0);

  // Real-time updates
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(SOCKET_URL, { auth: { token } });
    socket.emit('join-content', { contentId: song._id, contentType: 'media' });
    
    socket.on('audio-like-updated', (data) => {
      if (data.songId === song._id) {
        setLikeCount(data.likeCount);
        setViewCount(data.viewCount);
      }
    });

    return () => socket.close();
  }, [song._id]);

  // Handle like
  const handleLike = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${API_BASE_URL}/api/audio/copyright-free/${song._id}/like`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      const result = await res.json();
      setLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="song-card">
      <img src={song.thumbnailUrl} alt={song.title} />
      <h3>{song.title}</h3>
      <p>{song.speaker}</p>
      
      <button onClick={handleLike}>
        {liked ? '❤️' : '🤍'} {likeCount}
      </button>
      
      <div>
        👁️ {viewCount} views | 🎵 {song.listenCount || 0} listens
      </div>
    </div>
  );
}
```

---

## ⚠️ Critical: State Updates

**ALWAYS create new objects/arrays:**

```javascript
// ✅ GOOD
setSongs(songs.map(s => s._id === id ? {...s, liked: true} : s));

// ❌ BAD (won't update UI)
songs.find(s => s._id === id).liked = true;
setSongs(songs);
```

---

## 📚 Full Documentation

See `AUDIO_LIBRARY_FRONTEND_COMPLETE_GUIDE.md` for:
- Complete component examples
- Error handling patterns
- Performance optimization
- React Native examples
- State management patterns

---

**Ready to integrate!** 🚀

