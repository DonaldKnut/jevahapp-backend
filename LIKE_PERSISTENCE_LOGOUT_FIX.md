# Like Persistence After Logout/Login - Fix Implementation

## 🚨 Issue Reported

**Symptom**: After user logs out and logs back in:
1. Like highlight disappears (should stay red)
2. Like count appears to be cleared/reset

**Expected**: Like state should persist across logout/login sessions.

---

## 🔍 Root Cause Analysis

### Potential Issues Identified

1. **UserId Validation**: After re-login, userId might not be validated properly before queries
2. **Error Handling**: Silent failures in queries might cause hasLiked to default to false
3. **ObjectId Format**: userId format inconsistencies might cause queries to fail

### Current State

✅ **Fixed Earlier**: ObjectId type mismatch in queries (likes stored with ObjectId, queried with strings)

⚠️ **New Concerns**: 
- UserId validation after re-login
- Error handling in metadata queries
- Frontend might clear state before backend can sync

---

## ✅ Fixes Applied

### 1. Enhanced UserId Validation

Added validation to ensure userId is always a valid ObjectId before querying:

**File**: `src/service/contentInteraction.service.ts`
- Added userId validation in `getUserInteraction()` method
- Returns all false flags if userId is invalid
- Added try-catch for error handling

**File**: `src/controllers/contentInteraction.controller.ts`
- Added `validUserId` check before passing to service
- Ensures only valid ObjectIds are used in queries

### 2. Improved Error Handling

Added comprehensive error handling:
- Logs warnings when userId is invalid
- Logs errors when queries fail
- Returns safe defaults (false) instead of throwing errors
- Prevents UI from breaking if backend has issues

### 3. Batch Metadata Fixes

Updated batch metadata to:
- Validate userId format before querying
- Use validated userId consistently
- Handle errors gracefully

---

## 🔧 Implementation Details

### Enhanced getUserInteraction Method

**Before**:
```typescript
private async getUserInteraction(userId: string, ...) {
  if (!userId) {
    return { hasLiked: false, ... };
  }
  // Query without validation
}
```

**After**:
```typescript
private async getUserInteraction(userId: string, ...) {
  if (!userId) {
    return { hasLiked: false, ... };
  }
  
  // Validate userId format
  if (!Types.ObjectId.isValid(userId)) {
    logger.warn("Invalid userId format", { userId, ... });
    return { hasLiked: false, ... };
  }
  
  try {
    // Query with error handling
  } catch (error) {
    logger.error("Error in getUserInteraction", { error, userId, ... });
    return { hasLiked: false, ... };
  }
}
```

### Enhanced Metadata Controller

**Before**:
```typescript
const metadata = await service.getContentMetadata(userId || "", ...);
```

**After**:
```typescript
const validUserId = userId && Types.ObjectId.isValid(userId) ? userId : "";
const metadata = await service.getContentMetadata(validUserId, ...);
```

---

## 🧪 Testing Recommendations

### Test Scenario 1: Logout/Login Persistence

1. User likes content → Verify like is recorded
2. User logs out → Frontend clears state
3. User logs back in → Backend should return `hasLiked: true`
4. Verify like count persists

**Expected Result**: 
- Like count remains the same
- `hasLiked: true` is returned after login
- Like icon shows as red

### Test Scenario 2: UserId Validation

1. Check what userId format is in JWT token after login
2. Verify userId matches MongoDB user._id
3. Verify like records use same userId format

**Database Query**:
```javascript
// Check like record
db.mediaInteractions.findOne({
  user: ObjectId("{userId_from_jwt}"),
  media: ObjectId("{content_id}"),
  interactionType: "like",
  isRemoved: { $ne: true }
})

// Should return a document if user liked it
```

### Test Scenario 3: Metadata Endpoint After Re-login

After logout and login:
```bash
GET /api/content/media/{contentId}/metadata
Authorization: Bearer <new_token>

Expected Response:
{
  "success": true,
  "data": {
    "hasLiked": true,    // ← Should be true if user liked it
    "likeCount": 42,     // ← Should match actual count
    ...
  }
}
```

---

## 🐛 Diagnostic Checklist

If likes still disappear after logout/login, check:

1. ✅ **UserId Format**
   - Decode JWT token: What is the `userId` value?
   - Check MongoDB user record: What is the `_id`?
   - Verify they match

2. ✅ **Like Records Exist**
   - Query database: Do like records exist for this user?
   - Check `user` field: Is it ObjectId matching JWT userId?
   - Check `isRemoved`: Is it false or undefined?

3. ✅ **Content Type Mapping**
   - Frontend sends: What content type?
   - Backend maps to: What content type?
   - Like records use: What content type?
   - Verify all match

4. ✅ **Query Execution**
   - Check logs: Are queries executing?
   - Check logs: Are queries finding records?
   - Check errors: Any errors in logs?

5. ✅ **Frontend Behavior**
   - Does frontend clear state on logout?
   - Does frontend query backend after login?
   - Does frontend use correct userId?

---

## 💡 Potential Root Causes (If Issue Persists)

### Cause 1: UserId Mismatch After Re-login

**Scenario**: User logs in with different method or email changes

**Solution**: 
- Verify userId in JWT matches MongoDB user._id
- Ensure like records use same userId format

### Cause 2: Frontend Clearing State Too Aggressively

**Scenario**: Frontend clears interaction state on logout before backend sync

**Solution**: 
- Frontend should query backend after login to restore state
- Backend should always return correct hasLiked flag

### Cause 3: Database Records Being Deleted

**Scenario**: Something is deleting like records (unlikely but possible)

**Check**: 
- Verify like records exist in database after logout
- Check for any cleanup scripts or cascading deletes

### Cause 4: Caching Issues

**Scenario**: Cached responses returning stale data

**Solution**: 
- Clear cache after login
- Ensure fresh queries after authentication

---

## 🔧 Additional Safeguards Added

1. **UserId Validation**: All queries now validate userId format
2. **Error Logging**: Comprehensive logging for debugging
3. **Graceful Degradation**: Returns safe defaults on errors
4. **Consistent ObjectId Usage**: All queries use ObjectId consistently

---

## 📋 Next Steps

1. **Deploy fixes** and monitor logs
2. **Test logout/login flow** with actual users
3. **Check logs** for any userId validation warnings
4. **Verify like records** persist in database
5. **Test with different authentication methods** (Clerk, email, OAuth)

---

## 🔍 Debugging Commands

### Check Like Records in Database

```javascript
// MongoDB shell
use your_database_name;

// Find all likes for a user
db.mediaInteractions.find({
  user: ObjectId("USER_ID_FROM_JWT"),
  interactionType: "like",
  isRemoved: { $ne: true }
});

// Find like for specific content
db.mediaInteractions.findOne({
  user: ObjectId("USER_ID_FROM_JWT"),
  media: ObjectId("CONTENT_ID"),
  interactionType: "like",
  isRemoved: { $ne: true }
});

// Check like count on media
db.media.findOne({ _id: ObjectId("CONTENT_ID") }, { likeCount: 1 });
```

### Verify UserId in JWT

```bash
# Decode JWT token (replace YOUR_JWT_TOKEN)
echo "YOUR_JWT_TOKEN" | cut -d. -f2 | base64 -d | jq
```

Look for `userId` field - should match MongoDB user `_id`.

---

**Status**: Fixes Applied ✅  
**Ready for**: Testing & Monitoring  
**Next Review**: After deployment to verify issue is resolved

