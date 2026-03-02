# Like Count Fix - Backend Update Notice

**Status:** ✅ FIXED & DEPLOYED  
**Date:** March 2, 2026  
**Issue:** `POST /api/content/:type/:id/like` returning `likeCount: 0` after successful like

---

## The Fix

The backend now returns the **correct like count** immediately after a like/unlike operation.

### What Changed
- Fixed race condition between Redis cache and database
- Like count now reads directly from database after transaction commits
- Redis is synced with the correct value for future requests

---

## Frontend Action Required

### 1. Remove the Workaround (If Applied)

If you implemented frontend logic to handle the `likeCount: 0` bug, you can now remove it:

```typescript
// BEFORE (Workaround - Remove this)
const finalLikes = userJustLiked && serverCount === 0 && optimisticCount > 0
  ? optimisticCount  // Use frontend count
  : Math.max(serverCount, userJustLiked ? 1 : 0);

// AFTER (Trust the server)
const finalLikes = response.data.likeCount;  // Always correct now
```

### 2. Standard Integration Pattern

```typescript
async function handleLike(contentId: string) {
  // 1. Optimistic update (optional but recommended for UX)
  const newLiked = !currentLiked;
  const optimisticCount = newLiked ? likeCount + 1 : likeCount - 1;
  setLiked(newLiked);
  setLikeCount(optimisticCount);

  // 2. Call API
  const response = await fetch(
    `/api/content/media/${contentId}/like`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const result = await response.json();

  // 3. Reconcile with server response (source of truth)
  setLiked(result.data.liked);
  setLikeCount(result.data.likeCount);  // ✅ Now always accurate
}
```

---

## API Contract (Unchanged)

### Request
```http
POST /api/content/media/{contentId}/like
Authorization: Bearer {JWT_TOKEN}
```

### Response (Now Correct)
```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "contentId": "69a2d2dc365de0f3eed7637e",
    "liked": true,
    "likeCount": 1
  }
}
```

---

## Verification Checklist

Test these scenarios to confirm the fix:

- [ ] Like content with 0 likes → returns `likeCount: 1`
- [ ] Like content with 5 likes → returns `likeCount: 6`
- [ ] Unlike content → returns decremented count
- [ ] Rapid like/unlike → count stays consistent
- [ ] `GET /api/content/media/{id}/metadata` → returns matching count
- [ ] `POST /api/content/batch-metadata` → returns matching counts

---

## Questions?

Contact backend team if you see any discrepancies.
