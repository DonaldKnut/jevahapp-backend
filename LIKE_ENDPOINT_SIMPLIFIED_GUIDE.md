# Like Endpoint - Simplified Guide

**Date:** January 2025  
**Status:** ✅ Simplified & Corrected

---

## 🎯 Simple Rule: One Endpoint for All Media

**For ALL content in the Media collection (videos, music, audio, ebooks, podcasts, etc.):**
```
POST /api/content/media/:contentId/like
```

That's it. No exceptions. No confusion.

---

## ✅ Correct Endpoint Usage

| Your Content Type | Endpoint contentType | Database Collection |
|-------------------|---------------------|---------------------|
| Video | `media` | Media |
| Music | `media` | Media |
| Audio | `media` | Media |
| Ebook | `media` | Media |
| Podcast | `media` | Media |
| Merch | `media` | Media |

**All Media collection items use `"media"` in the endpoint URL.**

---

## 📝 Frontend Implementation

### Simple Helper Function

```typescript
// ✅ SIMPLE: Everything in Media collection uses "media"
function getContentTypeForEndpoint(content: any): string {
  // If it has fileUrl, thumbnailUrl, or is from Media collection → use "media"
  // (This covers videos, music, audio, ebooks, podcasts, merch - everything)
  return 'media';
}
```

### Complete Example

```typescript
// api/contentInteraction.ts
export async function toggleContentLike(
  contentId: string
): Promise<{
  success: boolean;
  message: string;
  data: {
    liked: boolean;
    likeCount: number;
  };
}> {
  const token = await AsyncStorage.getItem('userToken');
  
  // ✅ Always use "media" for Media collection items
  const response = await fetch(
    `${API_BASE_URL}/content/media/${contentId}/like`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to toggle like');
  }
  
  return await response.json();
}

// Component usage
function ContentCard({ content }) {
  const [liked, setLiked] = useState(content.hasLiked || false);
  const [likeCount, setLikeCount] = useState(content.likes || 0);
  
  const handleLike = async () => {
    // Optimistic update
    const optimisticLiked = !liked;
    const optimisticCount = optimisticLiked ? likeCount + 1 : likeCount - 1;
    
    setLiked(optimisticLiked);
    setLikeCount(optimisticCount);
    
    try {
      const response = await toggleContentLike(content.id);
      
      // ✅ CRITICAL: Update count from server response
      setLiked(response.data.liked);
      setLikeCount(response.data.likeCount); // ✅ This line fixes the count issue!
      
    } catch (error) {
      // Rollback on error
      setLiked(!optimisticLiked);
      setLikeCount(likeCount);
      console.error('Like failed:', error);
    }
  };
  
  return (
    <View>
      <TouchableOpacity onPress={handleLike}>
        <Text>{liked ? '❤️' : '🤍'}</Text>
      </TouchableOpacity>
      <Text>{likeCount}</Text>
    </View>
  );
}
```

---

## 🔍 Why This Confusion Existed

The backend code has this pattern:
```typescript
case "media":
case "ebook":
case "podcast":
  // All query Media collection - same code!
  const media = await Media.findById(contentId).select("likeCount").lean();
  dbCount = media?.likeCount || 0;
  break;
```

**All three (`media`, `ebook`, `podcast`) are handled identically** - they all query the Media collection. The separate contentType values are unnecessary complexity.

---

## ✅ Best Practice

**Simple and Clear:**
- All Media collection items → Use `"media"` in endpoint
- No need to check `content.contentType` field for the endpoint
- The `content.contentType` field (videos, music, ebook, etc.) is just metadata, not the endpoint parameter

---

## 📋 Response Format

**Endpoint:** `POST /api/content/media/:contentId/like`

**Response (200 OK):**
```typescript
{
  success: true,
  message: "Like toggled successfully",
  data: {
    liked: boolean,      // Current like status
    likeCount: number    // ✅ Updated total like count - USE THIS!
  }
}
```

---

## 🐛 Common Issues & Fixes

### Issue 1: Using Wrong contentType
❌ **Wrong:** `/api/content/devotional/:contentId/like` (for a video)  
✅ **Correct:** `/api/content/media/:contentId/like`

### Issue 2: Count Not Updating
❌ **Wrong:** Only updating `liked` status  
✅ **Correct:** Update both `liked` and `likeCount` from response

```typescript
// ✅ Correct
setLiked(response.data.liked);
setLikeCount(response.data.likeCount); // Don't forget this!
```

---

## 📝 Summary

1. ✅ **Use `"media"` for ALL Media collection items** (videos, music, audio, ebooks, podcasts, merch)
2. ✅ **Update `likeCount` from response** - Don't just update the liked status
3. ✅ **Keep it simple** - No need to check content.contentType field for endpoint

**The endpoint:** `/api/content/media/:contentId/like`  
**The response:** `{ data: { liked: boolean, likeCount: number } }`  
**Update both** in your UI state.

---

**Last Updated:** January 2025

