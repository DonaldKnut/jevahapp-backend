# Like System - Frontend Integration Guide

**Last Updated:** January 2025  
**Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Request & Response Formats](#request--response-formats)
4. [State Management & Persistence](#state-management--persistence)
5. [UI Integration](#ui-integration)
6. [Real-time Updates](#real-time-updates)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Complete Example](#complete-example)

---

## 🎯 Overview

The like system allows users to like/unlike content (videos, audio, ebooks, podcasts) with:
- ✅ **Persistent state** - Heart stays red after logout/login
- ✅ **Real-time updates** - See likes from other users instantly
- ✅ **Optimistic UI** - Instant feedback, then sync with backend
- ✅ **Like counts** - Always accurate, updated in real-time
- ✅ **Who liked** - See list of users who liked content

### Content Types Supported

| Content Type | Endpoint contentType | Example |
|-------------|---------------------|---------|
| Video | `media` | `POST /api/content/media/:contentId/like` |
| Audio/Music | `media` | `POST /api/content/media/:contentId/like` |
| Ebook | `media` | `POST /api/content/media/:contentId/like` |
| Podcast | `media` | `POST /api/content/media/:contentId/like` |

**Important:** All Media collection items use `"media"` as the contentType in the endpoint URL.

---

## 🔌 API Endpoints

### 1. Toggle Like (Like/Unlike)

**Endpoint:** `POST /api/content/:contentType/:contentId/like`

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Path Parameters:**
- `contentType`: Always use `"media"` for videos, audio, ebooks, podcasts
- `contentId`: MongoDB ObjectId (24-character hex string)

**Example Request:**
```typescript
POST /api/content/media/66a0f5f7d8e2b2c2a7e2b111/like
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "contentId": "66a0f5f7d8e2b2c2a7e2b111",
    "liked": true,
    "likeCount": 42
  }
}
```

**Error Responses:**

```json
// 401 Unauthorized - Missing or invalid token
{
  "success": false,
  "message": "Authentication required"
}

// 400 Bad Request - Invalid content type
{
  "success": false,
  "message": "Unsupported content type: invalid"
}

// 404 Not Found - Content doesn't exist
{
  "success": false,
  "message": "Content not found"
}

// 429 Too Many Requests - Rate limited
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

---

### 2. Get Content Metadata (Includes Like State)

**Endpoint:** `GET /api/content/:contentType/:contentId/metadata`

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>  // Optional but recommended for hasLiked
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "66a0f5f7d8e2b2c2a7e2b111",
    "title": "Amazing Video",
    "description": "Video description...",
    "contentType": "media",
    "author": {
      "id": "66a0f5f7d8e2b2c2a7e2b222",
      "name": "John Doe",
      "avatar": "https://..."
    },
    "stats": {
      "likes": 42,
      "comments": 15,
      "shares": 8,
      "views": 1234,
      "downloads": 56
    },
    "userInteraction": {
      "hasLiked": true,        // ⭐ KEY: Use this for heart icon state
      "hasCommented": false,
      "hasShared": false,
      "hasFavorited": false,
      "hasBookmarked": true
    },
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Use this endpoint to:**
- Load initial like state when opening content detail screen
- Get accurate like count
- Check if current user has liked (`hasLiked`)

---

### 3. Get Who Liked (List of Likers)

**Endpoint:** `GET /api/content/:contentType/:contentId/likers`

**Query Parameters:**
- `page` (optional): Page number, default: 1
- `limit` (optional): Items per page, default: 20, max: 50

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>  // Optional
```

**Example Request:**
```typescript
GET /api/content/media/66a0f5f7d8e2b2c2a7e2b111/likers?page=1&limit=20
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "userId": "66a0f5f7d8e2b2c2a7e2b333",
        "username": "jane_doe",
        "avatarUrl": "https://...",
        "likedAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "userId": "66a0f5f7d8e2b2c2a7e2b444",
        "username": "john_smith",
        "avatarUrl": "https://...",
        "likedAt": "2025-01-15T09:15:00.000Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 42,
    "hasMore": true
  }
}
```

---

## 💾 State Management & Persistence

### The Problem: Heart Icon Persistence

Users expect the heart icon to stay red after:
- Logging out and logging back in
- Closing and reopening the app
- Refreshing the page

### The Solution: Server as Source of Truth

**Never store like state in local storage alone.** Always fetch from the server on app start/login.

### Implementation Strategy

#### 1. On App Start / Login

Fetch like states for all visible content:

```typescript
// When user logs in or app starts
async function loadUserLikeStates(contentIds: string[]) {
  const token = await getAuthToken();
  
  // Use batch metadata endpoint for efficiency
  const response = await fetch(`${API_BASE}/api/content/batch-metadata`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: contentIds.map(id => ({
        contentId: id,
        contentType: 'media'  // All Media items use 'media'
      }))
    })
  });
  
  const result = await response.json();
  
  // Update your state management (Zustand, Redux, Context, etc.)
  result.data.forEach((item: any) => {
    updateContentState(item.id, {
      hasLiked: item.userInteraction.hasLiked,
      likeCount: item.stats.likes
    });
  });
}
```

#### 2. On Content Load

When loading a content detail screen:

```typescript
async function loadContentDetail(contentId: string) {
  const token = await getAuthToken();
  
  const response = await fetch(
    `${API_BASE}/api/content/media/${contentId}/metadata`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    }
  );
  
  const result = await response.json();
  
  // Set initial state from server
  setContentState({
    id: result.data.id,
    hasLiked: result.data.userInteraction.hasLiked,  // ⭐ Server truth
    likeCount: result.data.stats.likes,
    // ... other fields
  });
}
```

#### 3. After Toggle Like

Update state from API response:

```typescript
async function toggleLike(contentId: string) {
  // 1. Optimistic update (instant UI feedback)
  setContentState(prev => ({
    ...prev,
    hasLiked: !prev.hasLiked,
    likeCount: prev.hasLiked ? prev.likeCount - 1 : prev.likeCount + 1
  }));
  
  try {
    // 2. Call backend
    const response = await fetch(
      `${API_BASE}/api/content/media/${contentId}/like`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
        }
      }
    );
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    // 3. Update with server response (source of truth)
    setContentState(prev => ({
      ...prev,
      hasLiked: result.data.liked,        // ⭐ Server truth
      likeCount: result.data.likeCount    // ⭐ Server truth
    }));
    
  } catch (error) {
    // 4. Rollback on error
    setContentState(prev => ({
      ...prev,
      hasLiked: !prev.hasLiked,
      likeCount: prev.hasLiked ? prev.likeCount + 1 : prev.likeCount - 1
    }));
    
    showError('Failed to update like');
  }
}
```

---

## 🎨 UI Integration

### Heart Icon Component

```typescript
import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react'; // or your icon library

interface LikeButtonProps {
  contentId: string;
  initialLiked: boolean;
  initialLikeCount: number;
}

function LikeButton({ contentId, initialLiked, initialLikeCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);
  
  // Sync with server state when prop changes (e.g., after login)
  useEffect(() => {
    setLiked(initialLiked);
    setLikeCount(initialLikeCount);
  }, [initialLiked, initialLikeCount]);
  
  const handleToggle = async () => {
    if (loading) return;
    
    // Optimistic update
    const previousLiked = liked;
    const previousCount = likeCount;
    
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    setLoading(true);
    
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/content/media/${contentId}/like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // Update with server response
      setLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
      
    } catch (error) {
      // Rollback on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      console.error('Failed to toggle like:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="flex items-center gap-2"
      aria-label={liked ? 'Unlike' : 'Like'}
    >
      <Heart
        size={24}
        fill={liked ? '#ef4444' : 'none'}      // Red when liked
        stroke={liked ? '#ef4444' : '#6b7280'} // Red border when liked
        className={loading ? 'opacity-50' : ''}
      />
      <span className="text-sm font-medium">
        {likeCount > 0 ? likeCount : ''}
      </span>
    </button>
  );
}
```

### Content Card with Like

```typescript
function ContentCard({ content }: { content: Content }) {
  const [contentState, setContentState] = useState({
    hasLiked: content.hasLiked || false,
    likeCount: content.likeCount || 0,
  });
  
  // Load fresh state when component mounts (after login)
  useEffect(() => {
    loadContentMetadata(content.id).then(metadata => {
      setContentState({
        hasLiked: metadata.userInteraction.hasLiked,
        likeCount: metadata.stats.likes,
      });
    });
  }, [content.id]);
  
  return (
    <div className="content-card">
      {/* Content preview */}
      
      <div className="flex items-center justify-between p-4">
        <LikeButton
          contentId={content.id}
          initialLiked={contentState.hasLiked}
          initialLikeCount={contentState.likeCount}
        />
        
        {/* Other actions */}
      </div>
    </div>
  );
}
```

---

## 🔔 Real-time Updates

The backend emits Socket.io events when likes change. Subscribe to stay in sync:

### Socket.io Integration

```typescript
import { io } from 'socket.io-client';

// Connect to Socket.io
const socket = io(API_BASE, {
  auth: {
    token: await getAuthToken()
  }
});

// Join content room to receive updates
socket.emit('join', `content:media:${contentId}`);

// Listen for like updates
socket.on('content-like-update', (payload: {
  contentId: string;
  contentType: string;
  likeCount: number;
  userLiked: boolean;
  userId: string;
  timestamp: string;
}) => {
  // Only update if it's for current content
  if (payload.contentId === contentId) {
    setContentState(prev => ({
      ...prev,
      likeCount: payload.likeCount,
      // Only update hasLiked if it's the current user
      hasLiked: payload.userId === currentUserId 
        ? payload.userLiked 
        : prev.hasLiked
    }));
  }
});

// Also listen to room-specific events
socket.on('like-updated', (payload) => {
  // Same handling as above
});
```

### When to Use Real-time Updates

- ✅ **Content detail screen** - Show live like count updates
- ✅ **Feed/list view** - Update counts when others like
- ❌ **Don't rely solely on Socket.io** - Always fetch from server on load

---

## ⚠️ Error Handling

### Common Errors & Solutions

#### 1. 401 Unauthorized

```typescript
if (response.status === 401) {
  // Token expired or invalid
  await refreshToken();
  // Retry the request
  return toggleLike(contentId);
}
```

#### 2. 429 Rate Limited

```typescript
if (response.status === 429) {
  // Too many requests
  showError('Please wait a moment before liking again');
  // Don't rollback - user's action was valid, just rate limited
}
```

#### 3. Network Error

```typescript
catch (error) {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    // Network error
    showError('No internet connection. Please try again.');
    // Rollback optimistic update
    rollbackLikeState();
  }
}
```

#### 4. 404 Not Found

```typescript
if (response.status === 404) {
  // Content was deleted
  showError('This content no longer exists');
  // Navigate away or hide content
}
```

---

## ✅ Best Practices

### 1. Always Use Server State as Source of Truth

```typescript
// ❌ BAD: Store in localStorage only
localStorage.setItem(`liked_${contentId}`, 'true');

// ✅ GOOD: Fetch from server on load
const metadata = await fetchMetadata(contentId);
setHasLiked(metadata.userInteraction.hasLiked);
```

### 2. Implement Optimistic Updates

```typescript
// ✅ GOOD: Update UI immediately, then sync
setLiked(!liked);  // Instant feedback
await toggleLikeAPI();  // Sync with server
```

### 3. Handle Race Conditions

```typescript
// ✅ GOOD: Use loading state to prevent double-clicks
const [loading, setLoading] = useState(false);

const handleToggle = async () => {
  if (loading) return;  // Prevent double-clicks
  setLoading(true);
  // ... toggle logic
  setLoading(false);
};
```

### 4. Fetch State on Login/App Start

```typescript
// ✅ GOOD: Load all like states when user logs in
useEffect(() => {
  if (isAuthenticated) {
    loadAllLikeStates(visibleContentIds);
  }
}, [isAuthenticated]);
```

### 5. Use Batch Endpoints for Lists

```typescript
// ❌ BAD: Multiple requests
contentIds.forEach(id => fetchMetadata(id));

// ✅ GOOD: Single batch request
fetchBatchMetadata(contentIds);
```

---

## 📝 Complete Example

### React Hook for Like Management

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseLikeOptions {
  contentId: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
}

export function useLike({ 
  contentId, 
  initialLiked = false, 
  initialLikeCount = 0 
}: UseLikeOptions) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sync with props when they change (e.g., after login)
  useEffect(() => {
    setLiked(initialLiked);
    setLikeCount(initialLikeCount);
  }, [initialLiked, initialLikeCount]);
  
  // Load fresh state from server
  const refreshState = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/content/media/${contentId}/metadata`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setLiked(result.data.userInteraction.hasLiked);
        setLikeCount(result.data.stats.likes);
      }
    } catch (err) {
      console.error('Failed to refresh like state:', err);
    }
  }, [contentId]);
  
  // Toggle like
  const toggle = useCallback(async () => {
    if (loading) return;
    
    // Save previous state for rollback
    const previousLiked = liked;
    const previousCount = likeCount;
    
    // Optimistic update
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    setLoading(true);
    setError(null);
    
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/content/media/${contentId}/like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to toggle like');
      }
      
      // Update with server response (source of truth)
      setLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
      
    } catch (err: any) {
      // Rollback on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      setError(err.message || 'Failed to update like');
    } finally {
      setLoading(false);
    }
  }, [contentId, liked, likeCount, loading]);
  
  return {
    liked,
    likeCount,
    loading,
    error,
    toggle,
    refreshState,
  };
}
```

### Usage in Component

```typescript
function ContentDetailScreen({ contentId }: { contentId: string }) {
  const [metadata, setMetadata] = useState(null);
  
  // Load initial metadata
  useEffect(() => {
    loadContentMetadata(contentId).then(setMetadata);
  }, [contentId]);
  
  const { liked, likeCount, loading, toggle } = useLike({
    contentId,
    initialLiked: metadata?.userInteraction.hasLiked || false,
    initialLikeCount: metadata?.stats.likes || 0,
  });
  
  // Refresh when metadata changes (e.g., after login)
  useEffect(() => {
    if (metadata) {
      // Sync hook state with fresh metadata
      // (The hook will handle this via initialLiked/initialLikeCount)
    }
  }, [metadata]);
  
  return (
    <div>
      {/* Content display */}
      
      <button
        onClick={toggle}
        disabled={loading}
        className="flex items-center gap-2"
      >
        <Heart
          fill={liked ? '#ef4444' : 'none'}
          stroke={liked ? '#ef4444' : '#6b7280'}
        />
        <span>{likeCount}</span>
      </button>
    </div>
  );
}
```

---

## 🎯 Key Takeaways

1. **Always use `"media"` as contentType** for videos, audio, ebooks, podcasts
2. **Server is source of truth** - Fetch like state on login/app start
3. **Optimistic updates** - Update UI immediately, then sync with server
4. **Handle errors gracefully** - Rollback optimistic updates on failure
5. **Use batch endpoints** - Fetch multiple like states efficiently
6. **Real-time updates** - Subscribe to Socket.io for live updates
7. **Persistence** - Heart stays red because you fetch from server, not localStorage

---

## 📞 Support

If you encounter issues:
1. Check the response status code
2. Verify the `contentType` is `"media"` for Media items
3. Ensure Authorization header is included
4. Check network tab for actual request/response
5. Verify token is valid and not expired

---

**Happy Coding! 🚀**

