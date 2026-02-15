# Like State Persistence – Frontend Integration Guide

## Overview

This document explains how the like state persistence flow works after the backend fixes. The backend now ensures that like states are consistently stored and returned across all endpoints.

---

## Table of Contents

1. [Endpoints](#endpoints)
2. [Response Formats](#response-formats)
3. [Like Flow](#like-flow)
4. [Metadata Endpoints](#metadata-endpoints)
5. [Important Notes](#important-notes)
6. [Error Handling](#error-handling)
7. [Content Type Mapping](#content-type-mapping)

---

## Endpoints

### 1. Toggle Like

**Endpoint:** `POST /api/content/{backendContentType}/{contentId}/like`

**Headers:**
```http
Authorization: Bearer <JWT>
Content-Type: application/json
expo-platform: ios | android
```

**Path Parameters:**
- `backendContentType`: One of `media`, `devotional`, `artist`, `merch`, `ebook`, `podcast`
- `contentId`: MongoDB ObjectId (24-hex string)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Content liked successfully" | "Content unliked successfully",
  "data": {
    "contentId": "<id>",
    "liked": true | false,
    "likeCount": 42
  }
}
```

**Important:** The `data` object now includes `contentId` to help with reconciliation.

---

### 2. Single Content Metadata

**Endpoint:** `GET /api/content/{backendContentType}/{contentId}/metadata`

**Headers:**
```http
Authorization: Bearer <JWT>  // Optional, but required for user-specific flags
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "<id>",
    "likeCount": 42,
    "bookmarkCount": 10,
    "shareCount": 3,
    "viewCount": 123,
    "commentCount": 5,
    "hasLiked": true,
    "hasBookmarked": false,
    "hasShared": false,
    "hasViewed": true
  }
}
```

---

### 3. Batch Metadata

**Endpoint:** `POST /api/content/batch-metadata`

**Headers:**
```http
Authorization: Bearer <JWT>  // Optional, but required for user-specific flags
Content-Type: application/json
```

**Request Body:**
```json
{
  "contentIds": ["<id1>", "<id2>", ...],
  "contentType": "media" | "ebook" | "devotional" | "podcast" | "artist" | "merch"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "<id1>",
      "likeCount": 42,
      "commentCount": 5,
      "shareCount": 1,
      "bookmarkCount": 3,
      "viewCount": 100,
      "hasLiked": true,
      "hasBookmarked": false,
      "hasShared": false,
      "hasViewed": true
    },
    {
      "id": "<id2>",
      "likeCount": 7,
      "commentCount": 0,
      "shareCount": 0,
      "bookmarkCount": 0,
      "viewCount": 20,
      "hasLiked": false,
      "hasBookmarked": false,
      "hasShared": false,
      "hasViewed": false
    }
  ]
}
```

---

## Response Formats

### Toggle Like Response

The toggle like endpoint now returns `contentId` in the response:

```typescript
interface ToggleLikeResponse {
  success: boolean;
  message: string;
  data: {
    contentId: string;  // ← NEW: Added for reconciliation
    liked: boolean;     // Final state after toggle
    likeCount: number;  // Updated total count
  };
}
```

### Metadata Response

Both single and batch metadata endpoints return a flat structure:

```typescript
interface ContentMetadata {
  id: string;
  likeCount: number;
  bookmarkCount: number;
  shareCount: number;
  viewCount: number;
  commentCount: number;
  hasLiked: boolean;      // User-specific flag
  hasBookmarked: boolean;
  hasShared: boolean;
  hasViewed: boolean;
}
```

---

## Like Flow

### Complete Flow Diagram

```
User Taps Like Icon
    ↓
Frontend: Optimistic Update
    ├─ Set liked = !currentLiked
    ├─ Adjust likeCount (+1 or -1)
    └─ Update UI immediately
    ↓
Frontend: Call POST /api/content/{type}/{id}/like
    ↓
Backend: Process Toggle
    ├─ Check if like exists (not soft-deleted)
    ├─ If exists: Soft-delete & decrement count
    ├─ If not exists: Create/restore & increment count
    └─ Return { contentId, liked, likeCount }
    ↓
Frontend: Reconcile with Backend Response
    ├─ Update store with backend data
    ├─ Use backend.liked as source of truth
    └─ Use backend.likeCount as source of truth
    ↓
UI: Reflect Final State
    └─ Icon color based on backend.liked
    └─ Count display based on backend.likeCount
```

### Frontend Implementation Example

```typescript
// app/store/useInteractionStore.tsx
toggleLike: async (contentId, contentType) => {
  // 1) Optimistic update
  set((state) => {
    const s = state.contentStats[contentId] || defaultStats;
    const liked = !s.userInteractions.liked;
    const likes = Math.max(0, (s.likes || 0) + (liked ? 1 : -1));
    
    return {
      ...state,
      contentStats: {
        ...state.contentStats,
        [contentId]: {
          ...s,
          likes,
          userInteractions: {
            ...s.userInteractions,
            liked,
          },
        },
      },
    };
  });

  try {
    // 2) Call backend
    const backendContentType = mapContentTypeToBackend(contentType);
    const response = await fetch(
      `${baseURL}/api/content/${backendContentType}/${contentId}/like`,
      {
        method: "POST",
        headers: await getAuthHeaders(),
      }
    );
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || "Failed to toggle like");
    }

    // 3) Reconcile with backend response (source of truth)
    set((state) => {
      const s = state.contentStats[contentId];
      if (!s) return state;

      return {
        ...state,
        contentStats: {
          ...state.contentStats,
          [contentId]: {
            ...s,
            likes: result.data.likeCount,        // Backend is source of truth
            userInteractions: {
              ...s.userInteractions,
              liked: result.data.liked,           // Backend is source of truth
            },
          },
        },
      };
    });
  } catch (error) {
    // 4) Rollback optimistic update on error
    set((state) => {
      const s = state.contentStats[contentId];
      if (!s) return state;
      
      // Revert to previous state
      const previousLiked = !s.userInteractions.liked;
      const previousLikes = Math.max(0, (s.likes || 0) + (previousLiked ? -1 : 1));
      
      return {
        ...state,
        contentStats: {
          ...state.contentStats,
          [contentId]: {
            ...s,
            likes: previousLikes,
            userInteractions: {
              ...s.userInteractions,
              liked: previousLiked,
            },
          },
        },
      };
    });
    
    // Show error to user
    console.error("Failed to toggle like:", error);
  }
}
```

---

## Metadata Endpoints

### When to Use Metadata Endpoints

1. **Initial Load**: When loading a content detail screen, use `GET /metadata` to hydrate the initial state
2. **List Preload**: When loading a list of content, use `POST /batch-metadata` to preload stats
3. **Refresh**: After navigation or app resume, refresh metadata to ensure consistency

### Consistency Guarantee

The backend now guarantees that:
- After `POST /like` returns `liked: true, likeCount: 42`
- The next `GET /metadata` will return `hasLiked: true, likeCount >= 42`
- The `hasLiked` flag is computed from the same storage used by the toggle endpoint
- The `likeCount` is always accurate and consistent

### Example: Loading Content Detail

```typescript
// Load content detail with metadata
const loadContentDetail = async (contentId: string, contentType: string) => {
  const backendContentType = mapContentTypeToBackend(contentType);
  
  // Fetch content details and metadata in parallel
  const [contentResponse, metadataResponse] = await Promise.all([
    fetch(`${baseURL}/api/content/${backendContentType}/${contentId}`),
    fetch(`${baseURL}/api/content/${backendContentType}/${contentId}/metadata`, {
      headers: await getAuthHeaders(),
    }),
  ]);
  
  const content = await contentResponse.json();
  const metadata = await metadataResponse.json();
  
  // Update store with metadata
  set((state) => ({
    ...state,
    contentStats: {
      ...state.contentStats,
      [contentId]: {
        likes: metadata.data.likeCount,
        saves: metadata.data.bookmarkCount,
        shares: metadata.data.shareCount,
        views: metadata.data.viewCount,
        comments: metadata.data.commentCount,
        userInteractions: {
          liked: metadata.data.hasLiked,
          saved: metadata.data.hasBookmarked,
          shared: metadata.data.hasShared,
          viewed: metadata.data.hasViewed,
        },
      },
    },
  }));
};
```

---

## Important Notes

### 1. Backend is Source of Truth

**Always trust the backend response after a toggle operation.** The backend:
- Uses atomic operations to update counts
- Ensures consistency across all endpoints
- Handles race conditions properly

### 2. Content ID Reconciliation

The toggle like response now includes `contentId`. Use it to verify you're updating the correct content:

```typescript
if (result.data.contentId !== contentId) {
  console.warn("Content ID mismatch in like response");
  // Handle mismatch appropriately
}
```

### 3. Optimistic Updates

Optimistic updates are fine, but **always reconcile with the backend response**. The backend response should override the optimistic state.

### 4. Error Handling

If the toggle fails:
- Rollback the optimistic update
- Show an error message to the user
- Optionally retry the operation

### 5. Content Type Mapping

The frontend maps content types to backend content types:

```typescript
const typeMap: Record<string, string> = {
  video: "media",
  videos: "media",
  audio: "media",
  music: "media",
  sermon: "devotional",
  ebook: "ebook",
  "e-books": "ebook",
  books: "ebook",
  image: "ebook",      // PDFs treated as ebooks
  live: "media",
  podcast: "podcast",
  merch: "merch",
  artist: "artist",
};
```

**Note:** `ebook` and `podcast` are now properly handled by the backend and use the same storage as `media` (MediaInteraction collection).

### 6. Merch Favorites

For `merch` content type:
- The backend uses `interactionType: "favorite"` internally
- But the frontend still calls the `/like` endpoint
- The backend maps this correctly
- The `hasLiked` flag reflects whether the user has favorited the merch

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid content ID format" | "Invalid content type"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Content not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "An unexpected error occurred while processing your request"
}
```

### Error Handling Example

```typescript
try {
  const response = await fetch(`${baseURL}/api/content/${type}/${id}/like`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  
  const result = await response.json();
  
  if (!response.ok || !result.success) {
    // Handle specific error cases
    if (response.status === 401) {
      // Redirect to login
      return;
    }
    if (response.status === 404) {
      // Content was deleted
      return;
    }
    throw new Error(result.message || "Failed to toggle like");
  }
  
  // Success - reconcile with backend
  // ... (reconciliation code)
} catch (error) {
  // Rollback optimistic update
  // Show error to user
}
```

---

## Content Type Mapping

### Frontend → Backend Mapping

| Frontend Type | Backend Type | Notes |
|--------------|--------------|-------|
| `video`, `videos`, `audio`, `music`, `live` | `media` | All media content |
| `sermon` | `devotional` | Devotional content |
| `ebook`, `e-books`, `books`, `image` | `ebook` | E-books and PDFs |
| `podcast` | `podcast` | Podcast episodes |
| `merch` | `merch` | Merchandise (uses favorites internally) |
| `artist` | `artist` | Artist profiles (uses follows) |

### Backend Content Types

The backend supports these content types:
- `media` - Videos, audio, live streams
- `devotional` - Devotionals/sermons
- `ebook` - E-books and PDFs
- `podcast` - Podcast episodes
- `merch` - Merchandise
- `artist` - Artist profiles

---

## Testing Checklist

When testing the like functionality, verify:

- [ ] Like icon turns red immediately (optimistic update)
- [ ] Like icon stays red after backend response
- [ ] Like count increases correctly
- [ ] Unlike works correctly (icon turns gray, count decreases)
- [ ] Like state persists after app reload
- [ ] Like state is consistent across different screens
- [ ] Batch metadata returns correct `hasLiked` flags
- [ ] Single metadata returns correct `hasLiked` flag
- [ ] Error handling works (network errors, 401, 404, etc.)
- [ ] Works for all content types (media, ebook, podcast, devotional, merch, artist)

---

## Migration Notes

### What Changed

1. **Toggle Like Response**: Now includes `contentId` in the `data` object
2. **Consistency**: Backend now ensures `hasLiked` and `likeCount` are always consistent
3. **Content Types**: `ebook` and `podcast` are now fully supported
4. **Merch**: Properly handles favorites (mapped from likes)

### No Breaking Changes

The response structure is backward compatible. The only addition is the `contentId` field in the toggle response, which is optional to use but recommended for verification.

---

## Support

If you encounter any issues with like state persistence:

1. Check the browser/network console for error messages
2. Verify the `contentId` matches between request and response
3. Ensure you're using the correct `backendContentType` mapping
4. Verify the user is authenticated (check for 401 errors)
5. Check that the backend response is being used as the source of truth

---

## Summary

The backend now guarantees:
- ✅ Like states are persisted correctly
- ✅ Like counts are accurate and consistent
- ✅ `hasLiked` flags match the actual like state
- ✅ All content types are supported
- ✅ Responses are consistent across all endpoints

The frontend should:
- ✅ Use optimistic updates for better UX
- ✅ Always reconcile with backend responses
- ✅ Trust the backend as the source of truth
- ✅ Handle errors gracefully with rollback
