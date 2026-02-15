# Frontend Like System - Comprehensive Integration Guide

**Last Updated:** December 2025  
**Status:** ✅ Production Ready  
**Version:** 2.0

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Supported Content Types](#supported-content-types)
4. [API Endpoints](#api-endpoints)
5. [Authentication](#authentication)
6. [Request & Response Formats](#request--response-formats)
7. [State Management](#state-management)
8. [Implementation Examples](#implementation-examples)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Complete Code Examples](#complete-code-examples)

---

## 🚀 Quick Start

### Minimal Implementation

```typescript
// 1. Toggle like
const response = await fetch(
  `https://api.jevahapp.com/api/content/media/${contentId}/like`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
);

const result = await response.json();
// result.data.liked = true/false
// result.data.likeCount = number
```

### React Native Example

```typescript
import { useState } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Heart } from 'lucide-react-native';

function LikeButton({ contentId, token }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const toggleLike = async () => {
    if (loading) return;
    
    // Optimistic update
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    setLoading(true);

    try {
      const response = await fetch(
        `https://api.jevahapp.com/api/content/media/${contentId}/like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      
      if (result.success) {
        setLiked(result.data.liked);
        setLikeCount(result.data.likeCount);
      } else {
        // Rollback
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    } catch (error) {
      // Rollback
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity onPress={toggleLike} disabled={loading}>
      <Heart fill={liked ? '#ef4444' : 'none'} color={liked ? '#ef4444' : '#6b7280'} />
      <Text>{likeCount}</Text>
    </TouchableOpacity>
  );
}
```

---

## 🎯 Overview

The like system provides a unified API for liking/unliking different types of content with:

- ✅ **Persistent State** - Likes persist across sessions
- ✅ **Real-time Updates** - See likes from other users instantly
- ✅ **Optimistic UI** - Instant feedback with server sync
- ✅ **Accurate Counts** - Always synchronized with backend
- ✅ **Multi-content Support** - Works with videos, audio, ebooks, podcasts, artists, merch

### Key Concepts

1. **Server is Source of Truth** - Always fetch like state from server on app start/login
2. **Optimistic Updates** - Update UI immediately, then sync with server
3. **Content Type Mapping** - Different content uses different `contentType` values
4. **Token Management** - Handle token refresh automatically

---

## 📦 Supported Content Types

### Valid Content Types

| Content Type | Endpoint `contentType` | Example Content |
|-------------|----------------------|----------------|
| **Media** | `media` | Videos, Audio files, Ebooks, Podcasts |
| **Artist** | `artist` | Artist profiles (like = follow) |
| **Merchandise** | `merch` | Products (like = favorite) |
| **Ebook** | `ebook` | Ebooks (uses `media` endpoint) |
| **Podcast** | `podcast` | Podcasts (uses `media` endpoint) |

### ⚠️ Important Notes

- **Devotional is NOT supported** - Devotionals use a separate like system
- **Media items** (videos, audio, ebooks, podcasts) all use `contentType: "media"`
- **Artist likes** are actually follows (increments follower count)
- **Merch likes** are actually favorites (increments favorite count)

### Content Type Decision Tree

```
Is it a video, audio, ebook, or podcast?
  → Use contentType: "media"

Is it an artist profile?
  → Use contentType: "artist"

Is it a merchandise/product?
  → Use contentType: "merch"

Is it a devotional?
  → ❌ NOT SUPPORTED - Use separate devotional like system
```

---

## 🔌 API Endpoints

### Base URL

```
Production: https://api.jevahapp.com
Development: http://localhost:5000
```

### 1. Toggle Like (Like/Unlike)

**Endpoint:** `POST /api/content/:contentType/:contentId/like`

**Authentication:** Required (Bearer token)

**Rate Limit:** 10 requests per minute per user

**Path Parameters:**
- `contentType`: One of `"media"`, `"artist"`, `"merch"`, `"ebook"`, `"podcast"`
- `contentId`: MongoDB ObjectId (24-character hex string)

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:** None (empty body)

**Example Requests:**

```typescript
// Like a video/audio/media item
POST /api/content/media/66a0f5f7d8e2b2c2a7e2b111/like

// Like an artist (follow)
POST /api/content/artist/66a0f5f7d8e2b2c2a7e2b222/like

// Like merchandise (favorite)
POST /api/content/merch/66a0f5f7d8e2b2c2a7e2b333/like

// Like an ebook
POST /api/content/media/66a0f5f7d8e2b2c2a7e2b444/like

// Like a podcast
POST /api/content/media/66a0f5f7d8e2b2c2a7e2b555/like
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "liked": true,
    "likeCount": 42
  }
}
```

**Response Fields:**
- `liked` (boolean): Current like state after toggle
- `likeCount` (number): Total number of likes

**Error Responses:**

```json
// 401 Unauthorized - Missing or invalid token
{
  "success": false,
  "message": "Authentication required",
  "data": null
}

// 400 Bad Request - Invalid content type
{
  "success": false,
  "message": "Invalid content type: devotional",
  "data": {
    "contentType": "devotional",
    "validTypes": ["media", "artist", "merch", "ebook", "podcast"]
  }
}

// 400 Bad Request - Invalid content ID
{
  "success": false,
  "message": "Invalid content ID: invalid-id",
  "data": {
    "contentId": "invalid-id"
  }
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

// 500 Internal Server Error
{
  "success": false,
  "message": "Internal server error"
}
```

---

### 2. Get Content Metadata (Includes Like State)

**Endpoint:** `GET /api/content/:contentType/:contentId/metadata`

**Authentication:** Optional (but recommended - returns `hasLiked` when authenticated)

**Path Parameters:**
- `contentType`: One of `"media"`, `"artist"`, `"merch"`, `"ebook"`, `"podcast"`
- `contentId`: MongoDB ObjectId

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>  // Optional but recommended
```

**Example Request:**
```typescript
GET /api/content/media/66a0f5f7d8e2b2c2a7e2b111/metadata
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
      "hasBookmarked": true,
      "hasViewed": false
    },
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Use Cases:**
- Load initial like state when opening content detail screen
- Get accurate like count
- Check if current user has liked (`hasLiked`)
- Refresh state after login

---

### 3. Batch Metadata (Get Multiple Like States)

**Endpoint:** `POST /api/content/batch-metadata`

**Authentication:** Optional (but recommended)

**Rate Limit:** 5 requests per minute

**Request Body:**
```json
{
  "contentIds": [
    "66a0f5f7d8e2b2c2a7e2b111",
    "66a0f5f7d8e2b2c2a7e2b222",
    "66a0f5f7d8e2b2c2a7e2b333"
  ],
  "contentType": "media"
}
```

**Headers:**
```http
Authorization: Bearer <JWT_TOKEN>  // Optional but recommended
Content-Type: application/json
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "66a0f5f7d8e2b2c2a7e2b111",
      "likeCount": 42,
      "hasLiked": true,
      "viewCount": 1234,
      "hasViewed": false,
      "commentCount": 15,
      "shareCount": 8
    },
    {
      "id": "66a0f5f7d8e2b2c2a7e2b222",
      "likeCount": 0,
      "hasLiked": false,
      "viewCount": 2,
      "hasViewed": false,
      "commentCount": 0,
      "shareCount": 0
    },
    {
      "id": "66a0f5f7d8e2b2c2a7e2b333",
      "likeCount": 100,
      "hasLiked": true,
      "viewCount": 5000,
      "hasViewed": true,
      "commentCount": 50,
      "shareCount": 20
    }
  ]
}
```

**Use Cases:**
- Load like states for feed/list view
- Hydrate state after login
- Efficiently fetch multiple items at once

**Best Practice:** Use this endpoint instead of making multiple single metadata requests.

---

### 4. Get Likers List (Who Liked)

**Endpoint:** `GET /api/content/:contentType/:contentId/likers`

**Authentication:** Optional

**Query Parameters:**
- `page` (optional): Page number, default: 1
- `limit` (optional): Items per page, default: 20, max: 50

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

**Use Cases:**
- Show "Liked by..." modal
- Display list of users who liked content
- Social proof/engagement metrics

---

## 🔐 Authentication

### Token Requirements

All like endpoints require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <JWT_TOKEN>
```

### Token Refresh

If you receive a `401 Unauthorized` response, refresh the token and retry:

```typescript
async function toggleLikeWithRetry(contentId: string, contentType: string) {
  let token = await getAuthToken();
  
  const response = await fetch(
    `${API_BASE}/api/content/${contentType}/${contentId}/like`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // Handle token expiration
  if (response.status === 401) {
    // Refresh token
    token = await refreshAuthToken();
    
    // Retry request
    const retryResponse = await fetch(
      `${API_BASE}/api/content/${contentType}/${contentId}/like`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return retryResponse.json();
  }

  return response.json();
}
```

### Token Storage

Store tokens securely:
- **React Native:** Use `@react-native-async-storage/async-storage` or `expo-secure-store`
- **Web:** Use `localStorage` or `sessionStorage` (consider security implications)
- **Never** store tokens in plain text or commit them to version control

---

## 💾 State Management

### The Persistence Problem

Users expect likes to persist across:
- App restarts
- Logout/login cycles
- Device changes

### Solution: Server as Source of Truth

**Never store like state in local storage alone.** Always fetch from the server.

### State Management Strategy

#### 1. On App Start / Login

```typescript
// When user logs in or app starts
async function hydrateLikeStates(contentIds: string[], contentType: string = 'media') {
  const token = await getAuthToken();
  
  if (!token) return; // User not logged in
  
  try {
    const response = await fetch(`${API_BASE}/api/content/batch-metadata`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentIds,
        contentType,
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update your state management (Zustand, Redux, Context, etc.)
      result.data.forEach((item: any) => {
        updateContentLikeState(item.id, {
          hasLiked: item.hasLiked,
          likeCount: item.likeCount,
          lastSyncedAt: Date.now(),
        });
      });
    }
  } catch (error) {
    console.error('Failed to hydrate like states:', error);
  }
}
```

#### 2. On Content Load

```typescript
// When loading a content detail screen
async function loadContentMetadata(contentId: string, contentType: string = 'media') {
  const token = await getAuthToken();
  
  const response = await fetch(
    `${API_BASE}/api/content/${contentType}/${contentId}/metadata`,
    {
      headers: token ? {
        'Authorization': `Bearer ${token}`,
      } : {},
    }
  );
  
  const result = await response.json();
  
  if (result.success) {
    // Set initial state from server
    setContentState({
      id: result.data.id,
      hasLiked: result.data.userInteraction?.hasLiked || false,
      likeCount: result.data.stats?.likes || 0,
      // ... other fields
    });
  }
}
```

#### 3. After Toggle Like

```typescript
async function toggleLike(contentId: string, contentType: string = 'media') {
  // 1. Optimistic update (instant UI feedback)
  const previousState = getContentLikeState(contentId);
  updateContentLikeState(contentId, {
    hasLiked: !previousState.hasLiked,
    likeCount: previousState.hasLiked 
      ? previousState.likeCount - 1 
      : previousState.likeCount + 1,
    pending: true,
  });
  
  try {
    // 2. Call backend
    const token = await getAuthToken();
    const response = await fetch(
      `${API_BASE}/api/content/${contentType}/${contentId}/like`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    // 3. Update with server response (source of truth)
    updateContentLikeState(contentId, {
      hasLiked: result.data.liked,
      likeCount: result.data.likeCount,
      pending: false,
      lastSyncedAt: Date.now(),
    });
    
  } catch (error) {
    // 4. Rollback on error
    updateContentLikeState(contentId, previousState);
    console.error('Failed to toggle like:', error);
    showError('Failed to update like. Please try again.');
  }
}
```

---

## 💻 Implementation Examples

### React Native Hook

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseLikeOptions {
  contentId: string;
  contentType?: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
  token: string | null;
}

export function useLike({ 
  contentId, 
  contentType = 'media',
  initialLiked = false, 
  initialLikeCount = 0,
  token,
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
    if (!token) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/api/content/${contentType}/${contentId}/metadata`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setLiked(result.data.userInteraction?.hasLiked || false);
        setLikeCount(result.data.stats?.likes || 0);
      }
    } catch (err) {
      console.error('Failed to refresh like state:', err);
    }
  }, [contentId, contentType, token]);
  
  // Toggle like
  const toggle = useCallback(async () => {
    if (loading || !token) return;
    
    // Save previous state for rollback
    const previousLiked = liked;
    const previousCount = likeCount;
    
    // Optimistic update
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${API_BASE}/api/content/${contentType}/${contentId}/like`,
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
        // Handle token expiration
        if (response.status === 401) {
          setError('Please log in again');
          // Trigger token refresh logic here
          return;
        }
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
  }, [contentId, contentType, liked, likeCount, loading, token]);
  
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
import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useLike } from './hooks/useLike';

function ContentCard({ content, token }: { content: Content, token: string | null }) {
  const { liked, likeCount, loading, toggle } = useLike({
    contentId: content.id,
    contentType: 'media',
    initialLiked: content.hasLiked || false,
    initialLikeCount: content.likeCount || 0,
    token,
  });

  return (
    <View>
      {/* Content preview */}
      
      <TouchableOpacity 
        onPress={toggle} 
        disabled={loading}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Heart 
          size={24} 
          fill={liked ? '#ef4444' : 'none'} 
          color={liked ? '#ef4444' : '#6b7280'} 
        />
        {likeCount > 0 && (
          <Text style={{ fontSize: 14, fontWeight: '500' }}>
            {likeCount}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
```

### Zustand Store Example

```typescript
import create from 'zustand';

interface LikeState {
  hasLiked: boolean;
  likeCount: number;
  lastSyncedAt: number | null;
}

interface LikeStore {
  likes: Record<string, LikeState>;
  setLikeState: (contentId: string, state: LikeState) => void;
  getLikeState: (contentId: string) => LikeState | undefined;
  toggleLike: (contentId: string, contentType: string) => Promise<void>;
  hydrateLikes: (contentIds: string[], contentType: string) => Promise<void>;
}

export const useLikeStore = create<LikeStore>((set, get) => ({
  likes: {},
  
  setLikeState: (contentId, state) => {
    set((store) => ({
      likes: {
        ...store.likes,
        [contentId]: state,
      },
    }));
  },
  
  getLikeState: (contentId) => {
    return get().likes[contentId];
  },
  
  toggleLike: async (contentId, contentType) => {
    const current = get().likes[contentId] || {
      hasLiked: false,
      likeCount: 0,
      lastSyncedAt: null,
    };
    
    // Optimistic update
    get().setLikeState(contentId, {
      hasLiked: !current.hasLiked,
      likeCount: current.hasLiked ? current.likeCount - 1 : current.likeCount + 1,
      lastSyncedAt: Date.now(),
    });
    
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/content/${contentType}/${contentId}/like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        get().setLikeState(contentId, {
          hasLiked: result.data.liked,
          likeCount: result.data.likeCount,
          lastSyncedAt: Date.now(),
        });
      } else {
        // Rollback
        get().setLikeState(contentId, current);
        throw new Error(result.message);
      }
    } catch (error) {
      // Rollback
      get().setLikeState(contentId, current);
      throw error;
    }
  },
  
  hydrateLikes: async (contentIds, contentType) => {
    const token = await getAuthToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/content/batch-metadata`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentIds,
          contentType,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        const likes: Record<string, LikeState> = {};
        result.data.forEach((item: any) => {
          likes[item.id] = {
            hasLiked: item.hasLiked || false,
            likeCount: item.likeCount || 0,
            lastSyncedAt: Date.now(),
          };
        });
        
        set((store) => ({
          likes: {
            ...store.likes,
            ...likes,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to hydrate likes:', error);
    }
  },
}));
```

---

## ⚠️ Error Handling

### Common Errors & Solutions

#### 1. 401 Unauthorized

**Cause:** Token expired or invalid

**Solution:**
```typescript
if (response.status === 401) {
  // Refresh token
  const newToken = await refreshAuthToken();
  
  // Retry request with new token
  return toggleLike(contentId, contentType, newToken);
}
```

#### 2. 400 Bad Request - Invalid Content Type

**Cause:** Using unsupported content type (e.g., "devotional")

**Solution:**
```typescript
// ❌ WRONG
POST /api/content/devotional/123/like

// ✅ CORRECT
// Devotionals use separate system, not this endpoint
```

#### 3. 400 Bad Request - Invalid Content ID

**Cause:** Content ID is not a valid MongoDB ObjectId

**Solution:**
```typescript
// Validate before making request
function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

if (!isValidObjectId(contentId)) {
  console.error('Invalid content ID:', contentId);
  return;
}
```

#### 4. 429 Rate Limited

**Cause:** Too many requests in short time

**Solution:**
```typescript
if (response.status === 429) {
  // Don't rollback - user's action was valid
  showError('Please wait a moment before liking again');
  // Implement exponential backoff for retry
}
```

#### 5. Network Error

**Cause:** No internet connection or server unreachable

**Solution:**
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

#### 6. 404 Not Found

**Cause:** Content was deleted or doesn't exist

**Solution:**
```typescript
if (response.status === 404) {
  showError('This content no longer exists');
  // Navigate away or hide content
  removeContentFromList(contentId);
}
```

### Comprehensive Error Handler

```typescript
async function toggleLikeWithErrorHandling(
  contentId: string,
  contentType: string,
  token: string
) {
  try {
    const response = await fetch(
      `${API_BASE}/api/content/${contentType}/${contentId}/like`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      switch (response.status) {
        case 401:
          // Token expired - refresh and retry
          const newToken = await refreshAuthToken();
          return toggleLikeWithErrorHandling(contentId, contentType, newToken);
        
        case 400:
          throw new Error(result.message || 'Invalid request');
        
        case 404:
          throw new Error('Content not found');
        
        case 429:
          throw new Error('Too many requests. Please wait a moment.');
        
        case 500:
          throw new Error('Server error. Please try again later.');
        
        default:
          throw new Error(result.message || 'Unknown error');
      }
    }

    return result;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('No internet connection');
    }
    throw error;
  }
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
    hydrateLikeStates(visibleContentIds, 'media');
  }
}, [isAuthenticated]);
```

### 5. Use Batch Endpoints for Lists

```typescript
// ❌ BAD: Multiple requests
contentIds.forEach(id => fetchMetadata(id));

// ✅ GOOD: Single batch request
await fetchBatchMetadata(contentIds, 'media');
```

### 6. Validate Content Types

```typescript
const VALID_CONTENT_TYPES = ['media', 'artist', 'merch', 'ebook', 'podcast'];

function validateContentType(type: string): boolean {
  return VALID_CONTENT_TYPES.includes(type);
}

// Before making request
if (!validateContentType(contentType)) {
  throw new Error(`Invalid content type: ${contentType}`);
}
```

### 7. Handle Token Refresh Automatically

```typescript
// ✅ GOOD: Automatic token refresh
async function makeAuthenticatedRequest(url: string, options: RequestInit) {
  let token = await getAuthToken();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (response.status === 401) {
    // Refresh and retry
    token = await refreshAuthToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
  }
  
  return response;
}
```

### 8. Debounce Rapid Toggles

```typescript
import { debounce } from 'lodash';

// Prevent rapid-fire toggles
const debouncedToggle = debounce(toggleLike, 300);

// Use in component
<TouchableOpacity onPress={() => debouncedToggle(contentId, contentType)}>
```

---

## 🔍 Troubleshooting

### Issue: Heart doesn't stay red after login

**Cause:** Not fetching like state from server after login

**Solution:**
```typescript
// After successful login
useEffect(() => {
  if (isAuthenticated) {
    // Fetch like states for all visible content
    hydrateLikeStates(visibleContentIds, 'media');
  }
}, [isAuthenticated]);
```

### Issue: Like count is wrong

**Cause:** Not updating state from server response

**Solution:**
```typescript
// Always use server response as source of truth
const result = await toggleLikeAPI();
setLikeCount(result.data.likeCount);  // Use server value
```

### Issue: 400 error with "Invalid content type: devotional"

**Cause:** Trying to use devotional with like endpoint

**Solution:**
```typescript
// ❌ WRONG
POST /api/content/devotional/123/like

// ✅ CORRECT
// Devotionals use separate like system - don't use this endpoint
```

### Issue: 401 errors after token refresh

**Cause:** Not retrying request after token refresh

**Solution:**
```typescript
if (response.status === 401) {
  const newToken = await refreshAuthToken();
  // Retry with new token
  return makeRequest(url, options, newToken);
}
```

### Issue: Double-like on rapid clicks

**Cause:** No loading state or debouncing

**Solution:**
```typescript
const [loading, setLoading] = useState(false);

const handleToggle = async () => {
  if (loading) return;  // Prevent double-clicks
  setLoading(true);
  // ... toggle logic
  setLoading(false);
};
```

---

## 📝 Complete Code Examples

### Full React Native Implementation

```typescript
// hooks/useLike.ts
import { useState, useEffect, useCallback } from 'react';

interface UseLikeOptions {
  contentId: string;
  contentType?: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
  token: string | null;
  onError?: (error: string) => void;
}

export function useLike({ 
  contentId, 
  contentType = 'media',
  initialLiked = false, 
  initialLikeCount = 0,
  token,
  onError,
}: UseLikeOptions) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sync with props when they change
  useEffect(() => {
    setLiked(initialLiked);
    setLikeCount(initialLikeCount);
  }, [initialLiked, initialLikeCount]);
  
  // Refresh state from server
  const refreshState = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/api/content/${contentType}/${contentId}/metadata`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setLiked(result.data.userInteraction?.hasLiked || false);
        setLikeCount(result.data.stats?.likes || 0);
      }
    } catch (err) {
      console.error('Failed to refresh like state:', err);
    }
  }, [contentId, contentType, token]);
  
  // Toggle like
  const toggle = useCallback(async () => {
    if (loading || !token) return;
    
    const previousLiked = liked;
    const previousCount = likeCount;
    
    // Optimistic update
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${API_BASE}/api/content/${contentType}/${contentId}/like`,
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
        if (response.status === 401) {
          setError('Please log in again');
          onError?.('Authentication required');
          return;
        }
        throw new Error(result.message || 'Failed to toggle like');
      }
      
      // Update with server response
      setLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
      
    } catch (err: any) {
      // Rollback
      setLiked(previousLiked);
      setLikeCount(previousCount);
      const errorMsg = err.message || 'Failed to update like';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [contentId, contentType, liked, likeCount, loading, token, onError]);
  
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

### Component Usage

```typescript
// components/LikeButton.tsx
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useLike } from '../hooks/useLike';

interface LikeButtonProps {
  contentId: string;
  contentType?: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
  token: string | null;
  size?: number;
  showCount?: boolean;
}

export function LikeButton({
  contentId,
  contentType = 'media',
  initialLiked = false,
  initialLikeCount = 0,
  token,
  size = 24,
  showCount = true,
}: LikeButtonProps) {
  const { liked, likeCount, loading, toggle, error } = useLike({
    contentId,
    contentType,
    initialLiked,
    initialLikeCount,
    token,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TouchableOpacity 
        onPress={toggle} 
        disabled={loading}
        style={{ opacity: loading ? 0.5 : 1 }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ef4444" />
        ) : (
          <Heart 
            size={size} 
            fill={liked ? '#ef4444' : 'none'} 
            color={liked ? '#ef4444' : '#6b7280'} 
          />
        )}
      </TouchableOpacity>
      
      {showCount && likeCount > 0 && (
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
          {likeCount}
        </Text>
      )}
      
      {error && (
        <Text style={{ fontSize: 12, color: '#ef4444' }}>
          {error}
        </Text>
      )}
    </View>
  );
}
```

### Batch Hydration Service

```typescript
// services/likeHydration.ts
import { API_BASE } from '../config';

export async function hydrateLikeStates(
  contentIds: string[],
  contentType: string = 'media',
  token: string | null
): Promise<Record<string, { hasLiked: boolean; likeCount: number }>> {
  if (!token || contentIds.length === 0) {
    return {};
  }

  try {
    const response = await fetch(`${API_BASE}/api/content/batch-metadata`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentIds,
        contentType,
      }),
    });

    const result = await response.json();

    if (result.success) {
      const states: Record<string, { hasLiked: boolean; likeCount: number }> = {};
      
      result.data.forEach((item: any) => {
        states[item.id] = {
          hasLiked: item.hasLiked || false,
          likeCount: item.likeCount || 0,
        };
      });
      
      return states;
    }

    return {};
  } catch (error) {
    console.error('Failed to hydrate like states:', error);
    return {};
  }
}
```

---

## 🎯 Key Takeaways

1. **Always use `"media"` for videos, audio, ebooks, and podcasts**
2. **Server is source of truth** - Fetch like state on login/app start
3. **Optimistic updates** - Update UI immediately, then sync with server
4. **Handle errors gracefully** - Rollback optimistic updates on failure
5. **Use batch endpoints** - Fetch multiple like states efficiently
6. **Token management** - Handle 401 errors with automatic refresh
7. **Persistence** - Heart stays red because you fetch from server, not localStorage
8. **Devotional is NOT supported** - Use separate devotional like system

---

## 📞 Support & Resources

### API Base URL
- **Production:** `https://api.jevahapp.com`
- **Development:** `http://localhost:5000`

### Valid Content Types
- `media` - Videos, audio, ebooks, podcasts
- `artist` - Artist profiles (like = follow)
- `merch` - Merchandise (like = favorite)
- `ebook` - Ebooks (use `media` endpoint)
- `podcast` - Podcasts (use `media` endpoint)

### Rate Limits
- **Toggle Like:** 10 requests per minute
- **Batch Metadata:** 5 requests per minute
- **Single Metadata:** No specific limit (but use batch when possible)

### Common Issues
- **401 errors:** Token expired - implement automatic refresh
- **400 errors:** Invalid content type - check contentType value
- **Heart not persisting:** Not fetching state from server after login
- **Wrong counts:** Not using server response as source of truth

---

**Happy Coding! 🚀**

For questions or issues, check the backend logs or contact the backend team.

