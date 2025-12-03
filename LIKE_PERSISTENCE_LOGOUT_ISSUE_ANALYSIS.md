# Like Persistence Issue After Logout/Login - Analysis

## 🚨 Problem Reported

**Symptom**: After logout and login:
1. Like highlight disappears (should stay red)
2. Like count gets cleared/reset

**Expected**: Like state should persist across logout/login sessions

---

## 🔍 Potential Root Causes

### 1. User ID Consistency Issue

**Hypothesis**: The `userId` from JWT token might not match the `userId` stored in like records after re-login.

**Check**: 
- JWT token stores `userId: user._id` (MongoDB ObjectId string)
- Like records store `user: new Types.ObjectId(userId)` (ObjectId)
- After logout/login, the userId in JWT should be the same MongoDB ObjectId

**Current Implementation**:
- JWT creation: `jwt.sign({ userId: user._id }, ...)` ✅ Correct
- Like storage: `user: new Types.ObjectId(userId)` ✅ Correct  
- Like query: `user: new Types.ObjectId(userId)` ✅ Fixed

### 2. Frontend State Clearing

**Hypothesis**: Frontend clears interaction state on logout, and backend doesn't return `hasLiked: true` after login.

**Possible Issues**:
- Frontend clears local storage on logout
- After login, backend metadata endpoints might not return correct `hasLiked` flag
- Frontend doesn't immediately query backend for like state after login

### 3. User ID Format Mismatch

**Hypothesis**: After re-login, userId format might be different (e.g., Clerk ID vs MongoDB ID).

**Check Needed**:
- Is Clerk authentication used? If yes, Clerk ID vs MongoDB ID mapping
- Does JWT contain MongoDB `_id` or Clerk ID?

### 4. Database Query Issue

**Hypothesis**: Query might not be finding like records due to:
- User ID format inconsistency
- Content type mapping issue
- Caching issues

---

## 🔧 Diagnostic Steps

### Step 1: Verify JWT Token Contains MongoDB User ID

Check what `userId` is stored in JWT:
- JWT should contain MongoDB `user._id` (not Clerk ID)
- Verify after login: decode JWT and check `userId` value

### Step 2: Verify Like Records in Database

After user likes content and logs back in:
1. Check database for like record:
```javascript
db.mediaInteractions.findOne({
  user: ObjectId("{actual_user_id_from_jwt}"),
  media: ObjectId("{content_id}"),
  interactionType: "like",
  isRemoved: { $ne: true }
})
```

### Step 3: Test Metadata Endpoint After Re-login

After logout and login, call metadata endpoint:
```bash
GET /api/content/media/{contentId}/metadata
Authorization: Bearer <new_token>
```

Check if `hasLiked: true` is returned.

### Step 4: Check for User ID Mismatch

Compare:
- User ID from JWT token (after login)
- User ID stored in like records
- User ID used in metadata queries

---

## 💡 Potential Fixes

### Fix 1: Ensure Consistent User ID Format

Make sure all queries use the same format:
- JWT contains MongoDB `_id` as string
- Convert to ObjectId for all database queries
- Never mix string and ObjectId in queries

### Fix 2: Add Logging for Debugging

Add logging to track:
- User ID format in JWT
- User ID format in queries
- Whether like records are found

### Fix 3: Verify ObjectId Conversion

Ensure `userId` from `req.userId` is always converted to ObjectId:
```typescript
const userIdObj = new Types.ObjectId(req.userId);
```

### Fix 4: Check Content Type Mapping

Ensure content type is consistent:
- Frontend sends: "video", "audio", etc.
- Backend maps to: "media"
- Like records use same content type

---

## 🧪 Test Cases

1. **User likes content → Logout → Login → Check like state**
   - Expected: `hasLiked: true`, like count preserved

2. **User likes content → Close app → Reopen → Login → Check like state**
   - Expected: `hasLiked: true`, like count preserved

3. **Multiple users like same content → Each logs out/in → Check like state**
   - Expected: Each user sees their own like state correctly

4. **Like count verification**: Check if total like count persists
   - Expected: Like count doesn't decrease on logout/login

---

## 📋 Action Items

1. ✅ Verify ObjectId conversion in all query methods (already fixed)
2. ⚠️ Add logging to track userId format inconsistencies
3. ⚠️ Verify JWT token always contains MongoDB user._id
4. ⚠️ Test like persistence across logout/login cycles
5. ⚠️ Check if frontend needs to reload like state after login

---

**Status**: Investigation needed  
**Priority**: High  
**Next Steps**: Add diagnostic logging and verify user ID consistency

