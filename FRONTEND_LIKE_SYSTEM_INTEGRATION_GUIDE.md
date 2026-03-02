# Frontend Like System Integration Guide

## Overview

This guide explains how to integrate the Jevah Like System into your React Native app to achieve an **Instagram/TikTok-style** like experience. The system is optimized for performance with optimistic updates, real-time sync, and efficient batch operations.

---

## Core Concepts

### How It Works (The TikTok/IG Model)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LIKE SYSTEM ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   USER ACTION          FRONTEND              BACKEND                │
│   ───────────          ────────              ────────               │
│                                                                     │
│   Tap Like     →    Optimistic UI      →   Redis (instant)          │
│   (0-16ms)          Update (+1/-1)          Counter Update          │
│                                          ↓                          │
│   See Result   ←    Return New Count   ←   Immediate Response       │
│   (10-50ms)         (liked, likeCount)      (fast path)             │
│                                          ↓                          │
│   Other Users  ←    Socket.IO Event    ←   Background DB Sync       │
│   See Update        (broadcast)             (async, non-blocking)   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Optimistic Updates** - UI updates immediately, no waiting
2. **Server Reconciliation** - Always trust the API response as source of truth
3. **Batch Loading** - Load like status for multiple items in one request
4. **Real-time Sync** - Socket.IO keeps multiple clients in sync

---

## API Endpoints

### 1. Toggle Like (The Main Action)

```http
POST /api/content/{contentType}/{contentId}/like
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

Body: {}  // Empty object
```

**Content Types:**
| Type | Description | What It Actually Does |
|------|-------------|----------------------|
| `media` | Videos, audio, music | Like the content |
| `ebook` | E-books | Like (normalized to media) |
| `podcast` | Podcasts | Like (normalized to media) |
| `artist` | Artist profiles | Follow the artist |
| `merch` | Merchandise | Favorite the item |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "contentId": "66a0f5f7d8e2b2c2a7e2b111",
    "liked": true,        // Current state after toggle
    "likeCount": 42       // Updated total count
  }
}
```

**Error Responses:**
```json
// 401 Unauthorized
{ "success": false, "message": "Authentication required" }

// 404 Not Found
{ "success": false, "message": "Content not found: {id} (type: {type})" }

// 400 Bad Request
{ "success": false, "message": "Invalid content type: {type}" }
```

---

### 2. Get Single Content Metadata

Use this when opening a detail screen (e.g., video player).

```http
GET /api/content/{contentType}/{contentId}/metadata
Authorization: Bearer {JWT_TOKEN}  // Optional, but required for hasLiked
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contentId": "66a0f5f7d8e2b2c2a7e2b111",
    "likes": 42,
    "saves": 10,
    "shares": 3,
    "views": 123,
    "comments": 5,
    "userInteractions": {
      "liked": true,      // ⭐ CRITICAL: Current user's like status
      "saved": false,
      "shared": false,
      "viewed": true
    }
  }
}
```

> ⚠️ **Without auth token**, `userInteractions.liked` is always `false`.

---

### 3. Batch Metadata (FOR FEEDS - CRITICAL)

**⚠️ IMPORTANT:** The feed endpoint (`GET /api/media/all-content`) does **NOT** include `hasLiked` status. You **MUST** call this after loading any feed.

```http
POST /api/content/batch-metadata
Authorization: Bearer {JWT_TOKEN}  // Required for hasLiked
Content-Type: application/json

{
  "contentIds": ["id1", "id2", "id3", "..."],
  "contentType": "media"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id1": {
      "contentId": "id1",
      "likes": 42,
      "saves": 10,
      "shares": 3,
      "views": 123,
      "comments": 5,
      "userInteractions": {
        "liked": true,    // ⭐ User's like status for this item
        "saved": false,
        "shared": false,
        "viewed": true
      }
    },
    "id2": { ... },
    "id3": { ... }
  }
}
```

**Access pattern:**
```javascript
const itemData = response.data[contentId];
const hasLiked = itemData.userInteractions.liked;
const likeCount = itemData.likes;
```

---

## React Native Implementation

### Feed Screen (The Critical Pattern)

This is the **most important** pattern to get right. Feeds don't include like status, so you must batch-load it.

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, ActivityIndicator } from 'react-native';

const API_BASE_URL = 'https://your-api.com';

interface FeedItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  // Like status (loaded separately)
  likeCount: number;
  hasLiked: boolean;
}

export function FeedScreen() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  
  const authToken = useAuthToken(); // Your auth hook

  // ⭐ STEP 1: Load feed items
  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      // Load feed (NO like status included!)
      const feedRes = await fetch(
        `${API_BASE_URL}/api/media/all-content?page=${page}&limit=20`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const feedData = await feedRes.json();
      const feedItems = feedData.data.media;

      // ⭐ STEP 2: Extract all content IDs
      const contentIds = feedItems.map((item: any) => item._id);

      // ⭐ STEP 3: Batch load like status (REQUIRED!)
      const batchRes = await fetch(
        `${API_BASE_URL}/api/content/batch-metadata`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contentIds,
            contentType: 'media'
          })
        }
      );
      const batchData = await batchRes.json();

      // ⭐ STEP 4: Merge like status into feed items
      const itemsWithLikes: FeedItem[] = feedItems.map((item: any) => {
        const metadata = batchData.data[item._id];
        return {
          id: item._id,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl,
          videoUrl: item.fileUrl,
          likeCount: metadata?.likes || item.likeCount || 0,
          hasLiked: metadata?.userInteractions?.liked || false,
        };
      });

      setItems(prev => page === 1 ? itemsWithLikes : [...prev, ...itemsWithLikes]);
    } catch (error) {
      console.error('Feed load failed:', error);
    } finally {
      setLoading(false);
    }
  }, [page, authToken]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // ⭐ STEP 5: Handle like toggle
  const handleLike = async (item: FeedItem) => {
    // Optimistic update (immediate UI feedback)
    setItems(prev => prev.map(i => 
      i.id === item.id 
        ? { 
            ...i, 
            hasLiked: !i.hasLiked,
            likeCount: i.hasLiked ? i.likeCount - 1 : i.likeCount + 1
          }
        : i
    ));

    try {
      // API call
      const res = await fetch(
        `${API_BASE_URL}/api/content/media/${item.id}/like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );
      const result = await res.json();
      
      // ⭐ Reconcile with server (source of truth)
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { 
              ...i, 
              hasLiked: result.data.liked,
              likeCount: result.data.likeCount
            }
          : i
      ));
    } catch (error) {
      // Revert on error
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { 
              ...i, 
              hasLiked: item.hasLiked,
              likeCount: item.likeCount
            }
          : i
      ));
      console.error('Like failed:', error);
    }
  };

  return (
    <FlatList
      data={items}
      renderItem={({ item }) => (
        <VideoCard 
          item={item} 
          onLike={() => handleLike(item)}
        />
      )}
      keyExtractor={item => item.id}
      onEndReached={() => setPage(p => p + 1)}
      onEndReachedThreshold={0.5}
    />
  );
}
```

---

### Video Card Component

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface VideoCardProps {
  item: {
    id: string;
    title: string;
    thumbnailUrl: string;
    likeCount: number;
    hasLiked: boolean;
  };
  onLike: () => void;
}

export function VideoCard({ item, onLike }: VideoCardProps) {
  // Format large numbers (1.2k, 1.5m)
  const formatCount = (count: number): string => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'm';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return count.toString();
  };

  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: item.thumbnailUrl }} 
        style={styles.thumbnail}
      />
      
      <View style={styles.overlay}>
        {/* Right-side action buttons (TikTok style) */}
        <View style={styles.actions}>
          
          {/* Like Button */}
          <TouchableOpacity 
            onPress={onLike}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Icon 
              name={item.hasLiked ? 'heart' : 'heart-outline'}
              size={32}
              color={item.hasLiked ? '#ff3040' : '#fff'}
            />
            <Text style={styles.actionText}>
              {formatCount(item.likeCount)}
            </Text>
          </TouchableOpacity>

          {/* Comments Button */}
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="message-text" size={32} color="#fff" />
            <Text style={styles.actionText}>Comments</Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="share" size={32} color="#fff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom info */}
        <View style={styles.info}>
          <Text style={styles.title}>{item.title}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    width: '100%',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  actions: {
    position: 'absolute',
    right: 8,
    bottom: 100,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  info: {
    marginBottom: 80,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
```

---

### Detail Screen with Real-time Updates

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Video from 'react-native-video';
import io from 'socket.io-client';

const API_BASE_URL = 'https://your-api.com';
const SOCKET_URL = 'https://your-api.com';

export function VideoDetailScreen({ route }: { route: any }) {
  const { videoId } = route.params;
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const authToken = useAuthToken();

  useEffect(() => {
    // 1. Load initial metadata
    loadMetadata();

    // 2. Setup Socket.IO for real-time updates
    const socket = io(SOCKET_URL, {
      auth: { token: authToken }
    });

    // Join content room
    socket.emit('join-content', { 
      contentId: videoId, 
      contentType: 'media' 
    });

    // Listen for like updates from other users
    socket.on('content-like-update', (data) => {
      if (data.contentId === videoId) {
        // Update like count in real-time
        setMetadata(prev => prev ? {
          ...prev,
          likes: data.likeCount
        } : null);
      }
    });

    // Listen for new comments
    socket.on('content:comment', (data) => {
      if (data.contentId === videoId && data.action === 'created') {
        setMetadata(prev => prev ? {
          ...prev,
          comments: data.commentCount
        } : null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [videoId]);

  const loadMetadata = async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/content/media/${videoId}/metadata`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const data = await res.json();
      setMetadata(data.data);
    } catch (error) {
      console.error('Failed to load metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!metadata) return;

    // Save previous state for rollback
    const prevLiked = metadata.userInteractions.liked;
    const prevCount = metadata.likes;

    // Optimistic update
    setMetadata({
      ...metadata,
      likes: prevLiked ? prevCount - 1 : prevCount + 1,
      userInteractions: {
        ...metadata.userInteractions,
        liked: !prevLiked
      }
    });

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/content/media/${videoId}/like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );
      const result = await res.json();
      
      // Reconcile with server response
      setMetadata(prev => prev ? {
        ...prev,
        likes: result.data.likeCount,
        userInteractions: {
          ...prev.userInteractions,
          liked: result.data.liked
        }
      } : null);
    } catch (error) {
      // Revert on error
      setMetadata({
        ...metadata,
        likes: prevCount,
        userInteractions: {
          ...metadata.userInteractions,
          liked: prevLiked
        }
      });
    }
  };

  if (loading || !metadata) return <ActivityIndicator size="large" />;

  return (
    <View style={{ flex: 1 }}>
      <Video
        source={{ uri: videoUrl }}
        style={{ flex: 1 }}
        resizeMode="cover"
        repeat
      />
      
      {/* Bottom action bar */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.3)'
      }}>
        <TouchableOpacity 
          onPress={handleLike}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}
        >
          <Icon 
            name={metadata.userInteractions.liked ? 'heart' : 'heart-outline'}
            size={28}
            color={metadata.userInteractions.liked ? '#ff3040' : '#fff'}
          />
          <Text style={{ color: '#fff', marginLeft: 6 }}>
            {metadata.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
          <Icon name="comment-outline" size={28} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 6 }}>
            {metadata.comments}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="share-outline" size={28} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 6 }}>
            {metadata.shares}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

---

## Critical Implementation Rules

### ✅ DO

1. **Always call batch-metadata after loading feeds**
   ```typescript
   const feed = await loadFeed();
   const ids = feed.map(item => item.id);
   const batch = await fetchBatchMetadata(ids); // ⭐ REQUIRED
   ```

2. **Always reconcile with server response**
   ```typescript
   const result = await toggleLike(id);
   setLiked(result.data.liked);        // ⭐ Use server value
   setCount(result.data.likeCount);    // ⭐ Use server value
   ```

3. **Use optimistic updates for responsive UI**
   ```typescript
   // Update UI immediately
   setLiked(!liked);
   // Then reconcile with server
   ```

4. **Handle errors by reverting optimistic updates**
   ```typescript
   const prevState = { liked, count };
   try {
     setLiked(!liked); // Optimistic
     await toggleLike(id);
   } catch (e) {
     setLiked(prevState.liked); // Revert
   }
   ```

### ❌ DON'T

1. **Don't use feed data for like status**
   ```typescript
   // WRONG
   const feed = await loadFeed();
   console.log(feed[0].hasLiked); // undefined!
   ```

2. **Don't ignore the server response**
   ```typescript
   // WRONG
   setLiked(!liked);
   await toggleLike(id); // Ignoring result!
   ```

3. **Don't forget auth token**
   ```typescript
   // WRONG - hasLiked will always be false
   fetch('/api/content/batch-metadata', {
     // No Authorization header!
   });
   ```

4. **Don't call batch-metadata without contentIds**
   ```typescript
   // WRONG
   fetch('/api/content/batch-metadata', {
     body: JSON.stringify({ contentType: 'media' }) // Missing contentIds!
   });
   ```

---

## Performance Optimization

### 1. Debounce Rapid Taps

```typescript
import { useCallback } from 'react';
import debounce from 'lodash/debounce';

const handleLike = useCallback(
  debounce((item) => {
    toggleLike(item.id);
  }, 300, { leading: true, trailing: false }),
  []
);
```

### 2. Request Deduplication

```typescript
const pendingRequests = new Map();

const toggleLikeWithDedup = async (contentId: string) => {
  if (pendingRequests.has(contentId)) {
    return pendingRequests.get(contentId);
  }

  const promise = fetch(`/api/content/media/${contentId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({})
  }).then(res => res.json());

  pendingRequests.set(contentId, promise);
  
  try {
    const result = await promise;
    return result;
  } finally {
    pendingRequests.delete(contentId);
  }
};
```

### 3. Cache Metadata

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Cache metadata for 5 minutes
const useContentMetadata = (contentId: string) => {
  return useQuery({
    queryKey: ['metadata', contentId],
    queryFn: () => fetchMetadata(contentId),
    staleTime: 5 * 60 * 1000,
  });
};

// Optimistic update with React Query
const useToggleLike = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: toggleLike,
    onMutate: async (contentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['metadata', contentId] });
      
      // Snapshot previous value
      const previous = queryClient.getQueryData(['metadata', contentId]);
      
      // Optimistically update
      queryClient.setQueryData(['metadata', contentId], (old: any) => ({
        ...old,
        liked: !old.liked,
        likeCount: old.liked ? old.likeCount - 1 : old.likeCount + 1
      }));
      
      return { previous };
    },
    onError: (err, contentId, context) => {
      // Revert on error
      queryClient.setQueryData(['metadata', contentId], context?.previous);
    },
    onSettled: (data, error, contentId) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['metadata', contentId] });
    }
  });
};
```

---

## Socket.IO Events (Real-time)

### Events to Listen For

| Event | Payload | When |
|-------|---------|------|
| `content-like-update` | `{ contentId, contentType, likeCount, userLiked, userId }` | Any user likes/unlikes |
| `like-updated` | Same as above | Room-scoped version |
| `content:comment` | `{ contentId, contentType, commentId, action, commentCount }` | Comment added/deleted |
| `new-comment` | Full comment object | New comment posted |

### Joining Rooms

```typescript
// Join when entering content detail screen
socket.emit('join-content', {
  contentId: videoId,
  contentType: 'media'  // Always use normalized type
});

// Leave when leaving screen
socket.emit('leave-content', {
  contentId: videoId,
  contentType: 'media'
});
```

---

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Missing/invalid token | Check auth token, redirect to login |
| `404 Not Found` | Invalid content ID | Verify content exists before liking |
| `400 Bad Request` | Invalid content type | Use valid types: media, artist, merch, ebook, podcast |
| `429 Too Many Requests` | Rate limit exceeded | Implement debouncing, slow down requests |

### Error Response Format

```typescript
interface ApiError {
  success: false;
  message: string;
  data?: {
    contentId?: string;
    contentType?: string;
    validTypes?: string[];
    error?: string;
  }
}
```

---

## Testing Checklist

Before releasing, verify:

- [ ] Like button updates immediately on tap (optimistic)
- [ ] Like count matches server response after API call
- [ ] Feed shows correct like status after batch-metadata call
- [ ] Real-time updates work when another user likes same content
- [ ] Error handling reverts UI to previous state
- [ ] Rapid taps don't cause flickering or incorrect counts
- [ ] Logout clears like state, login restores it
- [ ] Works offline (queues requests, syncs when online)

---

## Quick Reference

### Minimal Like Implementation

```typescript
// 1. Get metadata (initial load)
const metadata = await fetch(`/api/content/media/${id}/metadata`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// 2. Toggle like
const result = await fetch(`/api/content/media/${id}/like`, {
  method: 'POST',
  headers: { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
}).then(r => r.json());

// 3. Use result.data.liked and result.data.likeCount
```

### Feed with Likes (Complete)

```typescript
// Load feed
const feed = await fetch('/api/media/all-content').then(r => r.json());

// Get like status
const batch = await fetch('/api/content/batch-metadata', {
  method: 'POST',
  headers: { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    contentIds: feed.data.media.map(m => m._id),
    contentType: 'media'
  })
}).then(r => r.json());

// Merge
const items = feed.data.media.map(m => ({
  ...m,
  hasLiked: batch.data[m._id]?.userInteractions?.liked || false,
  likeCount: batch.data[m._id]?.likes || 0
}));
```
