# Like Persistence After Logout/Login - Diagnostic Guide

## 🚨 Problem

After logout and login:
- Like highlight disappears
- Like count appears cleared

## 🔍 Diagnostic Steps

### Step 1: Verify User ID Consistency

**Check JWT Token After Login**:
1. Get the JWT token from login response
2. Decode it (jwt.io or base64 decode)
3. Check the `userId` value
4. Should be MongoDB ObjectId string

**Check Database User Record**:
```javascript
// MongoDB
db.users.findOne({ email: "user@example.com" }, { _id: 1, clerkId: 1 })
```

**Check Like Records**:
```javascript
// MongoDB - Replace USER_ID with actual userId from JWT
db.mediaInteractions.find({
  user: ObjectId("USER_ID_FROM_JWT"),
  interactionType: "like",
  isRemoved: { $ne: true }
})
```

**Verify**: User ID in JWT should match user._id in database and user field in like records.

---

### Step 2: Test Metadata Endpoint

After logout and login, call metadata endpoint:

```bash
# Get new token after login
TOKEN="<new_jwt_token>"
CONTENT_ID="<content_id_that_was_liked>"

# Call metadata endpoint
curl -X GET "https://your-api.com/api/content/media/${CONTENT_ID}/metadata" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "likeCount": 42,      // ← Should NOT be 0
    "hasLiked": true,     // ← Should be true if user liked it
    ...
  }
}
```

**If `hasLiked` is false or `likeCount` is 0**:
- Check database to see if like records exist
- Check if userId matches
- Check logs for errors

---

### Step 3: Check Backend Logs

Look for:
- Invalid userId warnings
- Query errors
- ObjectId validation failures

**Log messages to look for**:
- `"Invalid userId format in getUserInteraction"`
- `"Error in getUserInteraction"`
- `"Error checking hasViewed"`

---

### Step 4: Verify Like Records Not Deleted

Check if like records are being deleted:

```javascript
// MongoDB - Check all like records for a content
db.mediaInteractions.find({
  media: ObjectId("CONTENT_ID"),
  interactionType: "like",
  isRemoved: { $ne: true }
}).count()

// Check if any were deleted/removed
db.mediaInteractions.find({
  media: ObjectId("CONTENT_ID"),
  interactionType: "like",
  isRemoved: true
}).count()
```

---

## 🐛 Common Issues & Solutions

### Issue 1: User ID Format Mismatch

**Symptom**: userId in JWT doesn't match user._id or like records

**Solution**: 
- Verify authentication returns MongoDB user._id (not Clerk ID)
- Ensure all queries use same userId format

### Issue 2: Like Records Query Not Finding Records

**Symptom**: Queries return empty even though records exist

**Possible Causes**:
- ObjectId format mismatch (already fixed)
- Content type mismatch
- User ID mismatch

**Debug**:
```javascript
// Check what's in database
db.mediaInteractions.findOne({
  interactionType: "like"
})

// Check user field format
// Should be ObjectId type, not string
```

### Issue 3: Frontend Not Querying After Login

**Symptom**: Frontend doesn't reload like state after login

**Solution**: Frontend should query backend metadata after login to restore state

---

## 📝 Testing Checklist

- [ ] User likes content → Like count increases
- [ ] User likes content → hasLiked is true
- [ ] User logs out → Frontend clears state
- [ ] User logs back in → Backend returns hasLiked: true
- [ ] User logs back in → Like count is correct (not 0)
- [ ] Verify userId in JWT matches database user._id
- [ ] Verify like records use same userId
- [ ] Check backend logs for errors

---

## 🔧 Quick Fix Test

If issue persists, test with direct database query:

```javascript
// Test query that should work
const userId = "USER_ID_FROM_JWT"; // MongoDB ObjectId string
const contentId = "CONTENT_ID";    // MongoDB ObjectId string

db.mediaInteractions.findOne({
  user: ObjectId(userId),
  media: ObjectId(contentId),
  interactionType: "like",
  isRemoved: { $ne: true }
})

// If this returns null, the like record doesn't exist
// If this returns a document, the query should work
```

---

**Status**: Diagnostic guide created  
**Next**: Run diagnostics to identify root cause

