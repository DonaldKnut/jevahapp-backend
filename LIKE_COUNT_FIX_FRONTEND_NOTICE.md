# Like Count Fix - Backend Update Notice

**Status:** ✅ CODE FIXED & PUSHED | ⏳ PENDING: Data Migration  
**Date:** March 2, 2026  
**Issue:** `POST /api/content/:type/:id/like` returning `likeCount: 0` after successful like

---

## Root Cause

The backend code was fixed, but **existing Media documents have stale `likeCount: 0`** because:

1. The old code wasn't updating `Media.likeCount` when likes were created
2. Likes were stored in the `Like` collection correctly
3. But `Media.likeCount` remained at 0 for all existing content
4. The feed reads from `Media.likeCount`, so it shows 0

**The fix is deployed, but existing data needs migration.**

---

## Current Status

| Component | Status |
|-----------|--------|
| Backend code fix | ✅ Deployed |
| New likes update Media.likeCount | ✅ Working |
| Feed cache invalidation | ✅ Working |
| Existing data migration | ⏳ Pending |

---

## Temporary Frontend Workaround (Until Migration)

Until the data migration runs, use **batch-metadata endpoint** to get accurate like counts:

```typescript
// After loading feed, fetch accurate counts from batch-metadata
async function getAccurateLikeCounts(contentIds: string[]) {
  const response = await fetch('/api/content/batch-metadata', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contentIds,
      contentType: 'media'
    })
  });
  
  const result = await response.json();
  
  // Returns accurate counts from Like collection
  return result.data; // { [contentId]: { likes: 5, ... } }
}

// Merge with feed data
const feed = await fetch('/api/media/all-content').then(r => r.json());
const accurateCounts = await getAccurateLikeCounts(
  feed.data.media.map(m => m._id)
);

const feedWithAccurateCounts = feed.data.media.map(item => ({
  ...item,
  likeCount: accurateCounts[item._id]?.likes ?? item.likeCount
}));
```

---

## After Migration (Expected Soon)

Once the migration runs, `Media.likeCount` will be synced with actual likes and:

- Feed will show correct counts directly
- No workaround needed
- Like/unlike will update counts in real-time

---

## Frontend Integration Guide

### 1. Remove ALL Workarounds

Delete any frontend logic that worked around the `likeCount: 0` bug:

```typescript
// ❌ REMOVE THIS WORKAROUND
const finalLikes = userJustLiked && serverCount === 0 && optimisticCount > 0
  ? optimisticCount
  : Math.max(serverCount, userJustLiked ? 1 : 0);

// ✅ TRUST THE SERVER - Use response directly
const finalLikes = response.data.likeCount;
```

### 2. Standard Like Flow

```typescript
async function toggleLike(contentId: string, contentType: string = 'media') {
  const token = await getAuthToken();
  
  // Call the toggle endpoint
  const response = await fetch(
    `/api/content/${contentType}/${contentId}/like`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to toggle like');
  }
  
  const result = await response.json();
  
  // ✅ Use server response as source of truth
  return {
    liked: result.data.liked,        // Current like state
    likeCount: result.data.likeCount // Accurate total count
  };
}
```

### 3. Optimistic UI Pattern (Recommended)

```typescript
function LikeButton({ contentId, initialLiked, initialCount }) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleLike = async () => {
    // 1. Optimistic update for instant feedback
    const optimisticLiked = !liked;
    const optimisticCount = optimisticLiked ? likeCount + 1 : likeCount - 1;
    
    setLiked(optimisticLiked);
    setLikeCount(Math.max(0, optimisticCount));
    setIsLoading(true);

    try {
      // 2. API call
      const result = await toggleLike(contentId);
      
      // 3. Reconcile with server (source of truth)
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (error) {
      // 4. Revert on error
      setLiked(liked);
      setLikeCount(likeCount);
      showErrorToast('Failed to update like');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onPress={handleLike} disabled={isLoading}>
      <Heart filled={liked} />
      <Text>{likeCount}</Text>
    </button>
  );
}
```

### 4. Feed Integration

The feed now automatically shows updated like counts. No special handling needed.

```typescript
// Load feed - counts are accurate
const feed = await fetch('/api/media/all-content', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// After liking, refresh feed to see updated count
// (Or use Socket.IO for real-time updates)
```

### 5. Getting Initial Like State

For detail screens, use metadata endpoint:

```typescript
// Single content metadata
const metadata = await fetch(
  `/api/content/media/${contentId}/metadata`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

const hasLiked = metadata.data.userInteractions.liked;
const likeCount = metadata.data.likes;
```

For feeds/lists, use batch metadata:

```typescript
// Batch metadata for multiple items
const batch = await fetch('/api/content/batch-metadata', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    contentIds: ['id1', 'id2', 'id3'],
    contentType: 'media'
  })
}).then(r => r.json());

const itemData = batch.data[contentId];
const hasLiked = itemData.userInteractions.liked;
const likeCount = itemData.likes;
```

---

## API Reference

### Toggle Like
```http
POST /api/content/{contentType}/{contentId}/like
Authorization: Bearer {JWT_TOKEN}
```

**Content Types:** `media`, `artist`, `merch`, `ebook`, `podcast`

**Response:**
```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "contentId": "69a2d2dc365de0f3eed7637e",
    "liked": true,
    "likeCount": 42
  }
}
```

### Single Metadata
```http
GET /api/content/{contentType}/{contentId}/metadata
Authorization: Bearer {JWT_TOKEN}  // Optional, required for hasLiked
```

### Batch Metadata
```http
POST /api/content/batch-metadata
Authorization: Bearer {JWT_TOKEN}  // Optional, required for hasLiked
Content-Type: application/json

{
  "contentIds": ["id1", "id2"],
  "contentType": "media"
}
```

---

## Real-Time Updates (Socket.IO)

Subscribe to like updates for live sync across clients:

```typescript
import { io } from 'socket.io-client';

const socket = io('wss://api.jevahapp.com');

// Join content room
socket.emit('join', `content:media:${contentId}`);

// Listen for updates
socket.on('like-updated', (payload) => {
  // payload: { contentId, contentType, likeCount, userLiked, userId, timestamp }
  if (payload.contentId === contentId) {
    setLikeCount(payload.likeCount);
  }
});

// Or listen to global events
socket.on('content-like-update', (payload) => {
  updateContentLike(payload.contentId, payload.likeCount);
});
```

---

## Testing Checklist

Verify these scenarios work correctly:

- [ ] Like content with 0 likes → returns `likeCount: 1`
- [ ] Like content with N likes → returns `likeCount: N+1`
- [ ] Unlike content → returns decremented count
- [ ] Rapid like/unlike → count stays consistent
- [ ] Feed refresh after like → shows updated count
- [ ] Metadata endpoint → returns matching count
- [ ] Batch metadata → returns matching counts
- [ ] Real-time updates → receive Socket.IO events

---

## Expected Behavior

| Action | Expected Result |
|--------|-----------------|
| Like content (0 → 1) | `likeCount: 1` in response |
| Unlike content (1 → 0) | `likeCount: 0` in response |
| Refresh feed after like | Shows updated count immediately |
| Multiple users like | Count increments correctly |
| Rapid taps | No race conditions, consistent state |

---

## Questions?

Contact backend team if you see any discrepancies.
