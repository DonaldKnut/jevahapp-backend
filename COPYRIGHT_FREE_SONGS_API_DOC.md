# Copyright-Free Songs API - Frontend Integration Guide

**Base URL:** `/api/audio/copyright-free`  
**Model:** `CopyrightFreeSong` (separate from Media)  
**Status:** ✅ Production Ready

---

## 📋 All Endpoints

### Public (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audio/copyright-free` | Get all songs |
| GET | `/api/audio/copyright-free/:songId` | Get single song |
| GET | `/api/audio/copyright-free/search?q=...` | Search songs |

### Authenticated

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audio/copyright-free/:songId/like` | Toggle like |
| POST | `/api/audio/copyright-free/:songId/share` | Share song |

### Admin Only

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audio/copyright-free` | Create song |
| PUT | `/api/audio/copyright-free/:songId` | Update song |
| DELETE | `/api/audio/copyright-free/:songId` | Delete song |

---

## 1. Get All Songs

```javascript
GET /api/audio/copyright-free?page=1&limit=20

// Example
const response = await fetch('/api/audio/copyright-free?page=1&limit=20');
const data = await response.json();

// Response:
{
  "success": true,
  "data": {
    "songs": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Call To Worship",
        "singer": "Engelis",
        "fileUrl": "https://...",
        "thumbnailUrl": "https://...",
        "likeCount": 42,
        "shareCount": 10,
        "duration": 180,
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
      "total": 14,
      "page": 1,
      "totalPages": 1,
      "limit": 20
    }
  }
}
```

---

## 2. Get Single Song

```javascript
GET /api/audio/copyright-free/:songId

// Example
const songId = "507f1f77bcf86cd799439011";
const response = await fetch(`/api/audio/copyright-free/${songId}`);
const data = await response.json();

// Response (if authenticated, includes isLiked):
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Call To Worship",
    "singer": "Engelis",
    "fileUrl": "https://...",
    "thumbnailUrl": "https://...",
    "likeCount": 42,
    "shareCount": 10,
    "duration": 180,
    "isLiked": false,  // Only if authenticated
    "uploadedBy": {...},
    ...
  }
}
```

---

## 3. Search Songs

```javascript
GET /api/audio/copyright-free/search?q=worship&page=1&limit=20

// Example
const query = "worship";
const response = await fetch(
  `/api/audio/copyright-free/search?q=${encodeURIComponent(query)}&page=1&limit=20`
);
const data = await response.json();
```

---

## 4. Like/Unlike Song

```javascript
POST /api/audio/copyright-free/:songId/like
Headers: { Authorization: "Bearer <token>" }

// Example
const response = await fetch(`/api/audio/copyright-free/${songId}/like`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

// Response:
{
  "success": true,
  "data": {
    "liked": true,
    "likeCount": 43,
    "shareCount": 10
  }
}
```

**Note:** Same endpoint for like and unlike (toggles).

---

## 5. Share Song

```javascript
POST /api/audio/copyright-free/:songId/share
Headers: { Authorization: "Bearer <token>" }

// Example
const response = await fetch(`/api/audio/copyright-free/${songId}/share`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

// Response:
{
  "success": true,
  "data": {
    "shareCount": 11,
    "likeCount": 43
  }
}
```

---

## 📦 Song Object Structure

```typescript
interface CopyrightFreeSong {
  _id: string;
  title: string;
  singer: string;              // Artist name
  fileUrl: string;             // Audio file URL (use with { uri: fileUrl })
  thumbnailUrl?: string;       // Image URL (use with { uri: thumbnailUrl })
  likeCount: number;
  shareCount: number;
  duration?: number;           // Duration in seconds
  uploadedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  isLiked?: boolean;           // Only in single song response if authenticated
}
```

---

## ⚠️ Important Notes

### 1. **DO NOT use `/api/media` endpoint**
- Copyright-free songs use `/api/audio/copyright-free`
- Music uses `/api/media?contentType=music`
- They are **completely separate**

### 2. **URLs are strings, not require()**
```javascript
// ✅ CORRECT
<Image source={{ uri: song.thumbnailUrl }} />
const { sound } = await Audio.Sound.createAsync({ uri: song.fileUrl });

// ❌ WRONG
<Image source={require(song.thumbnailUrl)} />
```

### 3. **No associations with Music**
- Copyright-free songs have their own model (`CopyrightFreeSong`)
- Music has its own model (`Media`)
- They do **NOT** share data

---

## 🔄 React Example

```javascript
// services/copyrightFreeSongsAPI.js
const API_BASE = 'https://your-api.com';

export const getCopyrightFreeSongs = async (page = 1) => {
  const response = await fetch(`${API_BASE}/api/audio/copyright-free?page=${page}&limit=20`);
  const data = await response.json();
  return data.data.songs;
};

export const toggleLike = async (songId, token) => {
  const response = await fetch(`${API_BASE}/api/audio/copyright-free/${songId}/like`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  return data.data;
};

// Component
function CopyrightFreeSongsList() {
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
      const token = getAccessToken();
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

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {songs.map(song => (
        <div key={song._id}>
          <Image source={{ uri: song.thumbnailUrl }} />
          <Text>{song.title}</Text>
          <Text>{song.singer}</Text>
          <Text>❤️ {song.likeCount}</Text>
          <Text>🔗 {song.shareCount}</Text>
          <Button onPress={() => handleLike(song._id)}>
            {song.isLiked ? 'Unlike' : 'Like'}
          </Button>
        </div>
      ))}
    </div>
  );
}
```

---

## ✅ Summary

- **Endpoint:** `/api/audio/copyright-free` (NOT `/api/media`)
- **Model:** `CopyrightFreeSong` (separate from `Media`)
- **Fields:** title, singer, fileUrl, thumbnailUrl, likeCount, shareCount
- **No associations** with Music model
- **Use `{ uri: url }`** for images and audio files

