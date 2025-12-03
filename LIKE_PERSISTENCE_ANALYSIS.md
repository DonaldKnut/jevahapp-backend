# Like Persistence Issue - Root Cause Analysis

## 🚨 CRITICAL BUG IDENTIFIED

**Date**: 2024-12-19  
**Issue**: Likes are not persisting - like count increases but `hasLiked` flag is not returned correctly by metadata endpoints

---

## Root Cause: ObjectId Type Mismatch

### The Problem

When a user likes content, the backend stores the like with **ObjectId types**:
- `toggleMediaLike()` stores like with: `user: new Types.ObjectId(userId)`, `media: new Types.ObjectId(contentId)`

But when checking if user has liked content, the backend queries with **string types**:
- `checkUserLike()` queries with: `user: userId` (string), `media: contentId` (string)

**MongoDB cannot match ObjectId fields with string values**, so the query fails silently and always returns `hasLiked: false`.

### Code Evidence

**✅ CORRECT - How likes are stored (toggleMediaLike, line 1651):**
```typescript
const existingLike = await MediaInteraction.findOne({
  user: new Types.ObjectId(userId),    // ← ObjectId
  media: new Types.ObjectId(contentId), // ← ObjectId
  interactionType: "like",
  isRemoved: { $ne: true },
}).session(session);
```

**❌ WRONG - How likes are queried (checkUserLike, line 1287-1292):**
```typescript
const mediaLike = await MediaInteraction.findOne({
  user: userId,        // ← STRING! Won't match ObjectId in DB
  media: contentId,    // ← STRING! Won't match ObjectId in DB
  interactionType: "like",
  isRemoved: { $ne: true },
});
return !!mediaLike; // Always returns false!
```

### Affected Methods

The same bug exists in multiple methods that query user interactions:
1. ✅ `checkUserBookmark()` - **CORRECTLY uses ObjectId** (line 1382-1383)
2. ❌ `checkUserLike()` - Uses strings (line 1288-1289)
3. ❌ `checkUserComment()` - Uses strings (line 1319-1320)
4. ❌ `checkUserShare()` - Uses strings (line 1336-1337)
5. ❌ `checkUserFavorite()` - Uses strings (line 1353-1354)

---

## Secondary Issues

### Issue 2: Response Structure Mismatch

The frontend spec expects a **flat structure**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "likeCount": 42,
    "hasLiked": true,
    ...
  }
}
```

But the backend returns a **nested structure**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "stats": { "likes": 42, ... },
    "userInteraction": { "hasLiked": true, ... }
  }
}
```

**Location**: `getContentMetadata()` return value (line 1167-1187)

The batch metadata endpoint (`getBatchContentMetadata`) **does return the correct flat structure**, so it's only the single metadata endpoint that has this issue.

### Issue 3: Authentication Not Required

The metadata endpoints don't require authentication:
- `GET /api/content/:contentType/:contentId/metadata` - No `verifyToken` middleware
- `POST /api/content/batch-metadata` - No `verifyToken` middleware

This means `req.userId` might be `undefined`, which causes:
- `userId || ""` passes empty string to `getUserInteraction()`
- Empty string causes all user flags to return `false`
- Frontend never gets user-specific like state

**Note**: The spec says endpoints should work with optional auth, but for user-scoped flags to work correctly, auth should be required (or at least recommended).

---

## Fix Strategy

### Fix 1: Convert String IDs to ObjectIds in Query Methods

Update all query methods to use ObjectId:
- `checkUserLike()` 
- `checkUserComment()`
- `checkUserShare()`
- `checkUserFavorite()`

**Pattern to follow** (already correct in `checkUserBookmark`):
```typescript
if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(contentId)) {
  return false;
}
const result = await Model.findOne({
  user: new Types.ObjectId(userId),
  media: new Types.ObjectId(contentId),
  ...
});
```

### Fix 2: Fix Response Structure

Update `getContentMetadata()` to return flat structure matching the frontend spec, similar to how `getBatchContentMetadata()` already does.

### Fix 3: Add Authentication Middleware (Recommended)

Add `verifyToken` middleware to metadata endpoints to ensure `req.userId` is always available when needed.

---

## Testing Checklist

After fixes, verify:

- [ ] User likes content → `hasLiked: true` in toggle response
- [ ] User likes content → `hasLiked: true` in single metadata endpoint
- [ ] User likes content → `hasLiked: true` in batch metadata endpoint
- [ ] User navigates away and returns → `hasLiked` still `true`
- [ ] User logs out and back in → `hasLiked` still `true`
- [ ] Response structure matches frontend spec exactly

---

## Files to Modify

1. `src/service/contentInteraction.service.ts`
   - Fix `checkUserLike()` (line ~1280)
   - Fix `checkUserComment()` (line ~1311)
   - Fix `checkUserShare()` (line ~1330)
   - Fix `checkUserFavorite()` (line ~1347)
   - Fix `getContentMetadata()` response structure (line ~1167)

2. `src/routes/contentInteraction.routes.ts`
   - Consider adding `verifyToken` middleware to metadata endpoints (optional, but recommended)

3. `src/controllers/contentInteraction.controller.ts`
   - Ensure proper error handling for unauthenticated requests

---

## Impact

**Severity**: CRITICAL 🔴

- All user interaction flags (`hasLiked`, `hasCommented`, `hasShared`, `hasFavorited`) are broken
- Only `hasBookmarked` works correctly (already uses ObjectId)
- This explains why frontend shows like count but not the liked state

---

**Analysis Complete** ✅

