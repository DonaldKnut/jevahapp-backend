# Frontend API Endpoints - Quick Reference Guide

**Last Updated:** December 2025  
**Status:** ✅ Production Ready

---

## 🚨 CRITICAL: Content Type Mapping

### ❌ DO NOT USE `/api/content/devotional/:id/like`

**The unified content interaction endpoint does NOT support devotionals.**

---

## ✅ Correct Endpoints by Content Type

### 1. Media Items (Videos, Audio, Ebooks, Podcasts)

**Endpoint:** `POST /api/content/media/:contentId/like`

```typescript
// ✅ CORRECT
POST https://api.jevahapp.com/api/content/media/694cbaa719660a778e14b9aa/like
Authorization: Bearer <token>
```

**Content Types that use this:**
- Videos
- Audio files
- Ebooks
- Podcasts

**All use `contentType: "media"`**

---

### 2. Artists

**Endpoint:** `POST /api/content/artist/:contentId/like`

```typescript
// ✅ CORRECT
POST https://api.jevahapp.com/api/content/artist/694cbaa719660a778e14b9aa/like
Authorization: Bearer <token>
```

**Note:** Artist "likes" are actually follows (increments follower count)

---

### 3. Merchandise

**Endpoint:** `POST /api/content/merch/:contentId/like`

```typescript
// ✅ CORRECT
POST https://api.jevahapp.com/api/content/merch/694cbaa719660a778e14b9aa/like
Authorization: Bearer <token>
```

**Note:** Merch "likes" are actually favorites (increments favorite count)

---

### 4. Devotionals ⚠️ SEPARATE SYSTEM

**❌ WRONG - DO NOT USE:**
```typescript
// ❌ This will return 400 error
POST /api/content/devotional/694cbaa719660a778e14b9aa/like
```

**✅ CORRECT - Use separate devotional endpoint:**
```typescript
// ✅ Use the devotional-specific endpoint
POST https://api.jevahapp.com/api/devotionals/:id/like
Authorization: Bearer <token>
```

**Example:**
```typescript
const response = await fetch(
  `https://api.jevahapp.com/api/devotionals/${devotionalId}/like`,
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

---

## 📋 Complete Endpoint Reference

### Like Endpoints

| Content Type | Endpoint | Notes |
|-------------|----------|-------|
| **Media** (videos, audio, ebooks, podcasts) | `POST /api/content/media/:id/like` | ✅ Use this |
| **Artist** | `POST /api/content/artist/:id/like` | Like = Follow |
| **Merch** | `POST /api/content/merch/:id/like` | Like = Favorite |
| **Devotional** | `POST /api/devotionals/:id/like` | ⚠️ Separate endpoint |
| **Ebook** | `POST /api/content/media/:id/like` | Use `media` type |
| **Podcast** | `POST /api/content/media/:id/like` | Use `media` type |

### Metadata Endpoints

| Content Type | Endpoint | Notes |
|-------------|----------|-------|
| **Media** | `GET /api/content/media/:id/metadata` | ✅ Use this |
| **Artist** | `GET /api/content/artist/:id/metadata` | |
| **Merch** | `GET /api/content/merch/:id/metadata` | |
| **Devotional** | `GET /api/devotionals/:id` | ⚠️ Different endpoint |
| **Ebook** | `GET /api/content/media/:id/metadata` | Use `media` type |
| **Podcast** | `GET /api/content/media/:id/metadata` | Use `media` type |

### Batch Metadata

```typescript
POST /api/content/batch-metadata
Body: {
  "contentIds": ["id1", "id2", "id3"],
  "contentType": "media"  // or "artist", "merch"
}
```

**Note:** Batch metadata does NOT support devotionals. Fetch devotional metadata individually.

---

## 🔧 Frontend Implementation Guide

### Content Type Detection Function

```typescript
function getLikeEndpoint(contentType: string, contentId: string): string {
  const baseUrl = 'https://api.jevahapp.com';
  
  switch (contentType) {
    case 'media':
    case 'video':
    case 'audio':
    case 'ebook':
    case 'podcast':
      // All media items use the media endpoint
      return `${baseUrl}/api/content/media/${contentId}/like`;
    
    case 'artist':
      return `${baseUrl}/api/content/artist/${contentId}/like`;
    
    case 'merch':
      return `${baseUrl}/api/content/merch/${contentId}/like`;
    
    case 'devotional':
      // ⚠️ Separate endpoint for devotionals
      return `${baseUrl}/api/devotionals/${contentId}/like`;
    
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}
```

### Universal Like Function

```typescript
async function toggleLike(contentType: string, contentId: string, token: string) {
  let endpoint: string;
  
  // Handle devotional separately
  if (contentType === 'devotional') {
    endpoint = `https://api.jevahapp.com/api/devotionals/${contentId}/like`;
  } else {
    // Map content types to unified endpoint
    const unifiedType = 
      contentType === 'video' || 
      contentType === 'audio' || 
      contentType === 'ebook' || 
      contentType === 'podcast'
        ? 'media'
        : contentType;
    
    endpoint = `https://api.jevahapp.com/api/content/${unifiedType}/${contentId}/like`;
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message);
  }
  
  return result.data;
}
```

### React Hook Example

```typescript
import { useState, useCallback } from 'react';

interface UseLikeOptions {
  contentType: string;
  contentId: string;
  token: string | null;
}

export function useLike({ contentType, contentId, token }: UseLikeOptions) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
      // Determine endpoint based on content type
      let endpoint: string;
      
      if (contentType === 'devotional') {
        endpoint = `https://api.jevahapp.com/api/devotionals/${contentId}/like`;
      } else {
        // Normalize content type
        const unifiedType = 
          ['video', 'audio', 'ebook', 'podcast'].includes(contentType)
            ? 'media'
            : contentType;
        
        endpoint = `https://api.jevahapp.com/api/content/${unifiedType}/${contentId}/like`;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // Update with server response
      setLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
      
    } catch (err: any) {
      // Rollback
      setLiked(previousLiked);
      setLikeCount(previousCount);
      setError(err.message || 'Failed to toggle like');
    } finally {
      setLoading(false);
    }
  }, [contentType, contentId, liked, likeCount, loading, token]);
  
  return { liked, likeCount, loading, error, toggle };
}
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake 1: Using Devotional with Unified Endpoint

```typescript
// ❌ WRONG - Will return 400 error
POST /api/content/devotional/123/like
```

```typescript
// ✅ CORRECT
POST /api/devotionals/123/like
```

### ❌ Mistake 2: Using Wrong Content Type for Media

```typescript
// ❌ WRONG
POST /api/content/video/123/like
POST /api/content/audio/123/like
POST /api/content/podcast/123/like
```

```typescript
// ✅ CORRECT - All use "media"
POST /api/content/media/123/like
```

### ❌ Mistake 3: Not Handling Devotional Separately

```typescript
// ❌ WRONG - Generic function that doesn't handle devotional
function toggleLike(contentType: string, id: string) {
  return fetch(`/api/content/${contentType}/${id}/like`, {
    method: 'POST',
  });
}
```

```typescript
// ✅ CORRECT - Handles devotional separately
function toggleLike(contentType: string, id: string) {
  if (contentType === 'devotional') {
    return fetch(`/api/devotionals/${id}/like`, { method: 'POST' });
  }
  return fetch(`/api/content/${contentType}/${id}/like`, { method: 'POST' });
}
```

---

## 📝 Response Formats

### Unified Content Interaction Endpoint

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

### Devotional Like Endpoint

```json
{
  "success": true,
  "message": "Devotional liked",
  "data": {
    "liked": true,
    "likeCount": 15
  }
}
```

**Note:** Both endpoints return the same response format, just different endpoints.

---

## 🔍 Error Responses

### 400 Bad Request - Invalid Content Type

```json
{
  "success": false,
  "message": "Invalid content type: devotional",
  "data": {
    "contentType": "devotional",
    "validTypes": ["media", "artist", "merch", "ebook", "podcast"]
  }
}
```

**This error means:** You're trying to use `/api/content/devotional/:id/like` which is not supported. Use `/api/devotionals/:id/like` instead.

---

## ✅ Quick Fix for Your Current Code

### Find and Replace in Your Frontend Code

**Search for:**
```typescript
/api/content/devotional/
```

**Replace with:**
```typescript
/api/devotionals/
```

**Example:**
```typescript
// Before (WRONG)
const url = `https://api.jevahapp.com/api/content/devotional/${id}/like`;

// After (CORRECT)
const url = `https://api.jevahapp.com/api/devotionals/${id}/like`;
```

---

## 📚 Additional Resources

- **Comprehensive Like System Guide:** `FRONTEND_LIKE_SYSTEM_COMPREHENSIVE_GUIDE.md`
- **Comment API Guide:** `COMMENT_API_FRONTEND_GUIDE.md`
- **Socket.IO Guide:** `SOCKET_IO_WEBSOCKET_FIX_GUIDE.md`

---

## 🎯 Summary

1. **Media items** (videos, audio, ebooks, podcasts) → Use `/api/content/media/:id/like`
2. **Artists** → Use `/api/content/artist/:id/like`
3. **Merchandise** → Use `/api/content/merch/:id/like`
4. **Devotionals** → Use `/api/devotionals/:id/like` ⚠️ **SEPARATE ENDPOINT**

**Key Rule:** If content type is `devotional`, use `/api/devotionals/:id/like`, NOT `/api/content/devotional/:id/like`

---

**Need Help?** Check the error message - if you see "Invalid content type: devotional", you're using the wrong endpoint!

