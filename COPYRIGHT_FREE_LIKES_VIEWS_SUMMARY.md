# Copyright-Free Songs - Likes & Views Summary

## ✅ Both Features Working Correctly

Both **likes** and **views** are fully implemented and working according to frontend requirements.

---

## 👍 Like Functionality

### Endpoint
```
POST /api/audio/copyright-free/:songId/like
```

### How It Works

1. **User clicks like button** → Frontend calls endpoint
2. **Backend toggles like**:
   - If not liked → Sets `hasLiked: true` → **Increments** `likeCount`
   - If already liked → Sets `hasLiked: false` → **Decrements** `likeCount`
3. **Returns updated counts**:
   ```json
   {
     "success": true,
     "data": {
       "liked": true,           // Current like status for user
       "likeCount": 125,        // Total likes (incremented/decremented)
       "viewCount": 1251,        // Current view count
       "listenCount": 0          // Listen count (if applicable)
     }
   }
   ```
4. **Real-time update** → WebSocket emits to all clients

### Key Features

✅ **Toggle behavior**: Can like and unlike  
✅ **Count increments**: When user likes  
✅ **Count decrements**: When user unlikes  
✅ **Real-time updates**: All clients see changes instantly  
✅ **One like per user**: User can only like once (toggle on/off)

### Example Flow

```
Initial State:
- User hasn't liked → likeCount: 100

User clicks like:
POST /api/audio/copyright-free/song123/like
→ hasLiked: false → true
→ likeCount: 100 → 101 ✅ INCREASED

User clicks like again (unlike):
POST /api/audio/copyright-free/song123/like
→ hasLiked: true → false
→ likeCount: 101 → 100 ✅ DECREASED
```

---

## 👁️ View Functionality

### Endpoint
```
POST /api/audio/copyright-free/:songId/view
```

### How It Works

1. **User views/listens to song** → Frontend calls endpoint when engagement threshold met
2. **Backend records view**:
   - Checks if user already viewed
   - If **first view** → Creates interaction record → **Increments** `viewCount`
   - If **already viewed** → Updates engagement metrics → **Does NOT increment** count
3. **Returns updated counts**:
   ```json
   {
     "success": true,
     "data": {
       "viewCount": 1251,      // Total views (incremented if first view)
       "hasViewed": true        // User has viewed this song
     }
   }
   ```
4. **Real-time update** → WebSocket emits to all clients

### Key Features

✅ **One view per user**: Each user counts as one view only  
✅ **Count increments**: Only on first view  
✅ **Deduplication**: Prevents duplicate counting  
✅ **Engagement tracking**: Tracks durationMs, progressPct, isComplete  
✅ **Real-time updates**: All clients see changes instantly  
✅ **Race condition safe**: Uses transactions to handle concurrent requests

### Example Flow

```
Initial State:
- User hasn't viewed → viewCount: 1000

User views song (first time):
POST /api/audio/copyright-free/song123/view
Body: { durationMs: 5000, progressPct: 30 }
→ Creates view record
→ viewCount: 1000 → 1001 ✅ INCREASED

User views song again (same user):
POST /api/audio/copyright-free/song123/view
Body: { durationMs: 10000, progressPct: 50 }
→ Updates engagement metrics
→ viewCount: 1001 → 1001 ✅ NOT INCREASED (deduplication)
```

---

## 📊 Frontend Integration

### Like Button

```typescript
// Frontend: Toggle like
async function toggleLike(songId: string) {
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

  const data = await response.json();
  
  if (data.success) {
    // Update UI immediately
    setLikeCount(data.data.likeCount);  // ✅ Count updated
    setLiked(data.data.liked);          // ✅ Like status updated
    setViewCount(data.data.viewCount);   // ✅ View count included
  }
}
```

### View Tracking

```typescript
// Frontend: Record view when engagement threshold met
async function recordView(songId: string, engagement: {
  durationMs?: number;
  progressPct?: number;
  isComplete?: boolean;
}) {
  const response = await fetch(
    `/api/audio/copyright-free/${songId}/view`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(engagement)
    }
  );

  const data = await response.json();
  
  if (data.success) {
    // Update UI immediately
    setViewCount(data.data.viewCount);   // ✅ Count updated (if first view)
    setHasViewed(data.data.hasViewed);  // ✅ View status updated
  }
}
```

---

## 🔄 Real-Time Updates

Both endpoints emit WebSocket events for real-time updates:

### WebSocket Event
```typescript
socket.on('copyright-free-song-interaction-updated', (data) => {
  if (data.songId === currentSongId) {
    // Update counts in real-time
    setLikeCount(data.likeCount);   // ✅ Updated from like action
    setViewCount(data.viewCount);   // ✅ Updated from view action
    setLiked(data.liked);            // ✅ Updated from like action
  }
});
```

### Event Payload
```json
{
  "songId": "song123",
  "likeCount": 125,      // Updated when someone likes/unlikes
  "viewCount": 1251,     // Updated when someone views
  "liked": true          // Current like status (for like events)
}
```

---

## 📈 Count Behavior Summary

| Action | Count Field | Behavior | Can Repeat? |
|--------|-------------|----------|-------------|
| **Like** | `likeCount` | ✅ Increments when liked<br>✅ Decrements when unliked | ✅ Yes (toggle) |
| **View** | `viewCount` | ✅ Increments on first view<br>❌ Does NOT increment on repeat views | ❌ No (one per user) |

---

## 🎯 Key Differences

### Likes
- **Toggleable**: User can like and unlike
- **Count changes**: Increments AND decrements
- **Multiple actions**: User can like/unlike multiple times
- **No deduplication needed**: Toggle behavior handles it

### Views
- **One-time**: User counts as one view only
- **Count changes**: Only increments (on first view)
- **Deduplication**: Prevents duplicate counting
- **Engagement tracking**: Tracks metrics (duration, progress, completion)

---

## ✅ Verification Checklist

### Likes
- [x] User can like a song → `likeCount` increases
- [x] User can unlike a song → `likeCount` decreases
- [x] Count is returned in response
- [x] Real-time updates work
- [x] Frontend receives correct data

### Views
- [x] User can view a song → `viewCount` increases (first time)
- [x] Repeat views don't increment count
- [x] Count is returned in response
- [x] Real-time updates work
- [x] Frontend receives correct data
- [x] Engagement metrics tracked

---

## 🚀 Both Features Ready

✅ **Likes**: Fully working, counts increment/decrement correctly  
✅ **Views**: Fully working, counts increment correctly with deduplication  
✅ **Real-time**: Both emit WebSocket events  
✅ **Frontend compatible**: Both return data in expected format

---

## 📝 API Endpoints Summary

### Like Endpoint
```
POST /api/audio/copyright-free/:songId/like
Response: {
  success: true,
  data: {
    liked: boolean,        // Current like status
    likeCount: number,     // Total likes (incremented/decremented)
    viewCount: number,     // Current view count
    listenCount: number    // Listen count
  }
}
```

### View Endpoint
```
POST /api/audio/copyright-free/:songId/view
Body: {
  durationMs?: number,     // Optional: Listening duration
  progressPct?: number,    // Optional: Progress percentage
  isComplete?: boolean     // Optional: Whether completed
}
Response: {
  success: true,
  data: {
    viewCount: number,     // Total views (incremented if first view)
    hasViewed: boolean     // User has viewed this song
  }
}
```

---

**Status**: ✅ Both features working correctly and ready for frontend use
