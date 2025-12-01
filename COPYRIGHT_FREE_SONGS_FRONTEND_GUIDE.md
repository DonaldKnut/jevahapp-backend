# Copyright-Free Songs - Frontend Integration Guide

**Status:** ✅ Complete Separation from Music  
**Model:** `CopyrightFreeSong` (independent)  
**No associations with Music model**

---

## ✅ Verification: Complete Separation

- ✅ **Separate Model:** `CopyrightFreeSong` model (NOT Media)
- ✅ **Separate Routes:** `/api/audio/copyright-free` (NOT `/api/media`)
- ✅ **Separate Service:** `CopyrightFreeSongService` (independent)
- ✅ **No Cross-References:** Zero associations between Music and Copyright-Free Songs

---

## 🔌 API Endpoints

### Base URL
```
/api/audio/copyright-free
```

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/audio/copyright-free` | ❌ Public | Get all songs |
| GET | `/api/audio/copyright-free/:songId` | ❌ Public | Get single song |
| GET | `/api/audio/copyright-free/search?q=...` | ❌ Public | Search songs |
| POST | `/api/audio/copyright-free/:songId/like` | ✅ Auth | Toggle like |
| POST | `/api/audio/copyright-free/:songId/share` | ✅ Auth | Share song |

---

## 📋 Request/Response Examples

### 1. Get All Songs

```javascript
GET /api/audio/copyright-free?page=1&limit=20

Response:
{
  "success": true,
  "data": {
    "songs": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Call To Worship",
        "singer": "Engelis",
        "fileUrl": "https://pub-xxx.r2.dev/jevah/media-music/xxx.mp3",
        "thumbnailUrl": "https://pub-xxx.r2.dev/jevah/media-thumbnails/xxx.jpg",
        "likeCount": 42,
        "shareCount": 10,
        "duration": 180,
        "uploadedBy": {
          "_id": "...",
          "firstName": "Admin",
          "lastName": "User"
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 14,
      "page": 1,
      "totalPages": 1,
      "limit": 20
    }
  }
}
```

### 2. Get Single Song

```javascript
GET /api/audio/copyright-free/:songId

Response (if authenticated, includes isLiked):
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Call To Worship",
    "singer": "Engelis",
    "fileUrl": "https://...",
    "thumbnailUrl": "https://...",
    "likeCount": 42,
    "shareCount": 10,
    "duration": 180,
    "isLiked": false,  // Only if authenticated
    ...
  }
}
```

### 3. Search Songs

```javascript
GET /api/audio/copyright-free/search?q=worship&page=1&limit=20

Response: Same format as "Get All Songs"
```

### 4. Like/Unlike Song

```javascript
POST /api/audio/copyright-free/:songId/like
Headers: { Authorization: "Bearer <token>" }

Response:
{
  "success": true,
  "data": {
    "liked": true,
    "likeCount": 43,
    "shareCount": 10
  }
}
```

### 5. Share Song

```javascript
POST /api/audio/copyright-free/:songId/share
Headers: { Authorization: "Bearer <token>" }

Response:
{
  "success": true,
  "data": {
    "shareCount": 11,
    "likeCount": 43
  }
}
```

---

## 💻 Frontend Implementation

### API Service (React Native/React)

```javascript
// services/copyrightFreeSongsAPI.js
const API_BASE = process.env.API_BASE_URL || 'https://your-api.com';

export const getCopyrightFreeSongs = async (page = 1, limit = 20) => {
  const response = await fetch(
    `${API_BASE}/api/audio/copyright-free?page=${page}&limit=${limit}`
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data.data.songs;
};

export const getCopyrightFreeSong = async (songId, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const response = await fetch(
    `${API_BASE}/api/audio/copyright-free/${songId}`,
    { headers }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
};

export const searchCopyrightFreeSongs = async (query, page = 1, limit = 20) => {
  const response = await fetch(
    `${API_BASE}/api/audio/copyright-free/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data.data.songs;
};

export const toggleLike = async (songId, token) => {
  if (!token) throw new Error('Authentication required');
  
  const response = await fetch(
    `${API_BASE}/api/audio/copyright-free/${songId}/like`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
};

export const shareSong = async (songId, token) => {
  if (!token) throw new Error('Authentication required');
  
  const response = await fetch(
    `${API_BASE}/api/audio/copyright-free/${songId}/share`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data.data;
};
```

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, Image, Button, ScrollView } from 'react-native';
import { getCopyrightFreeSongs, toggleLike } from './services/copyrightFreeSongsAPI';

function CopyrightFreeSongsScreen() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      const songsData = await getCopyrightFreeSongs();
      setSongs(songsData);
    } catch (error) {
      console.error('Error loading songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (songId) => {
    try {
      const token = await getAccessToken(); // Your auth function
      const result = await toggleLike(songId, token);
      
      // Update local state
      setSongs(songs.map(s => 
        s._id === songId 
          ? { ...s, isLiked: result.liked, likeCount: result.likeCount }
          : s
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  if (loading) return <Text>Loading...</Text>;

  return (
    <ScrollView>
      {songs.map(song => (
        <View key={song._id} style={{ marginBottom: 20 }}>
          {/* ✅ CORRECT - Use URI for backend URLs */}
          <Image 
            source={{ uri: song.thumbnailUrl }} 
            style={{ width: 200, height: 200 }}
          />
          <Text>{song.title}</Text>
          <Text>{song.singer}</Text>
          <Text>❤️ {song.likeCount}</Text>
          <Text>🔗 {song.shareCount}</Text>
          <Button 
            title={song.isLiked ? 'Unlike' : 'Like'}
            onPress={() => handleLike(song._id)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

export default CopyrightFreeSongsScreen;
```

---

## ⚠️ Critical: Separation Rules

### ❌ DO NOT

1. **Don't use Music endpoints:**
   ```javascript
   // ❌ WRONG
   fetch('/api/media?contentType=music') // This is for user-uploaded music
   ```

2. **Don't use Music components:**
   ```javascript
   // ❌ WRONG
   <MusicCard song={copyrightFreeSong} /> // Use separate component
   ```

3. **Don't mix data:**
   ```javascript
   // ❌ WRONG
   const allSongs = [...userMusic, ...copyrightFreeSongs]; // Keep separate
   ```

### ✅ DO

1. **Use copyright-free endpoints only:**
   ```javascript
   // ✅ CORRECT
   fetch('/api/audio/copyright-free')
   ```

2. **Use separate component:**
   ```javascript
   // ✅ CORRECT
   <CopyrightFreeSongCard song={song} />
   ```

3. **Keep them separate:**
   ```javascript
   // ✅ CORRECT
   const [userMusic, setUserMusic] = useState([]);
   const [copyrightFreeSongs, setCopyrightFreeSongs] = useState([]);
   ```

---

## 📊 Data Structure

```typescript
interface CopyrightFreeSong {
  _id: string;
  title: string;
  singer: string;              // Artist name
  fileUrl: string;             // Audio URL (use { uri: fileUrl })
  thumbnailUrl?: string;       // Image URL (use { uri: thumbnailUrl })
  likeCount: number;
  shareCount: number;
  duration?: number;           // Seconds
  uploadedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  isLiked?: boolean;           // Only if authenticated
}
```

---

## 🔑 Key Differences from Music

| Feature | Music | Copyright-Free Songs |
|---------|-------|---------------------|
| **Endpoint** | `/api/media?contentType=music` | `/api/audio/copyright-free` |
| **Model** | `Media` | `CopyrightFreeSong` |
| **Uploaded By** | Regular users | Admins only |
| **Fields** | Many (description, topics, etc.) | Simple (title, singer, fileUrl) |
| **Component** | `MusicCard` | `CopyrightFreeSongCard` |
| **Purpose** | User-generated content | Platform library |

---

**✅ Complete separation verified. No associations between Music and Copyright-Free Songs.**

