# Delete Media Endpoint - Debugging Guide

## ✅ Backend Implementation Status

### Route Registration
- **Route:** `DELETE /api/media/:id` ✅
- **Location:** `src/routes/media.route.ts:196`
- **Mounted at:** `/api/media` in `src/app.ts:256`
- **Full Path:** `DELETE /api/media/:id` ✅

### Middleware Chain
1. `verifyToken` - Authenticates user ✅
2. `deleteMedia` - Controller function ✅

### CORS Configuration
- **DELETE method:** ✅ Allowed
- **Headers:** ✅ `Authorization`, `Content-Type`, `expo-platform` allowed
- **Location:** `src/app.ts:122`

### Controller Implementation
- **File:** `src/controllers/media.controller.ts:486`
- **Authorization:** Checks if user is creator OR admin ✅
- **Response:** Returns `{ success: true, message: "Media deleted successfully" }` ✅

---

## 🔍 Debugging Steps

### 1. Verify Server is Running

```bash
# Check if server is running
curl http://localhost:4000/health

# Expected response:
# { "status": "healthy", ... }
```

### 2. Test DELETE Endpoint Directly

```bash
# Replace YOUR_TOKEN and MEDIA_ID with actual values
curl -X DELETE \
  http://localhost:4000/api/media/690cc621f629c697f52d7206 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "expo-platform: ios" \
  -v
```

**Expected Success Response:**
```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

**Expected Error Responses:**

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

**403 Forbidden (not creator):**
```json
{
  "success": false,
  "message": "Unauthorized to delete this media"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Media not found"
}
```

### 3. Check Backend Logs

When the frontend makes a DELETE request, you should see in backend logs:

```
Incoming request { method: 'DELETE', url: '/api/media/690cc621f629c697f52d7206', ... }
```

If you don't see this log, the request is not reaching the backend.

### 4. Verify Route Order

The DELETE route is correctly placed after GET routes:

```typescript
// Line 178: GET /api/media/:id
router.get("/:id", verifyToken, apiRateLimiter, getMediaByIdentifier);

// Line 187: GET /api/media/:id/stats
router.get("/:id/stats", verifyToken, apiRateLimiter, getMediaStats);

// Line 196: DELETE /api/media/:id ✅
router.delete("/:id", verifyToken, deleteMedia);
```

This is correct - Express matches routes by HTTP method, so order doesn't matter here.

---

## 🐛 Common Issues & Solutions

### Issue 1: Network Error / Connection Refused

**Symptoms:**
- Frontend shows "Network Error"
- Request never reaches backend
- No logs in backend

**Solutions:**
1. **Check if server is running:**
   ```bash
   # Check if port 4000 is in use
   lsof -i :4000
   
   # Or check process
   ps aux | grep node
   ```

2. **Start the server:**
   ```bash
   npm run dev
   # or
   npm start
   ```

3. **Check server URL in frontend:**
   - Ensure frontend is using correct backend URL
   - Check if using `localhost` vs actual IP address
   - For mobile apps, use actual IP (e.g., `http://192.168.1.100:4000`)

### Issue 2: CORS Error

**Symptoms:**
- Browser console shows CORS error
- Request is blocked by browser
- OPTIONS preflight fails

**Solutions:**
1. **Verify CORS configuration** (already correct in `src/app.ts:122`):
   ```typescript
   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
   ```

2. **Check if origin is allowed:**
   - Backend logs will show CORS errors
   - Add your frontend origin to `allowedOrigins` array

3. **For mobile apps (Expo):**
   - Mobile apps don't have CORS restrictions
   - If using web, ensure origin is in allowed list

### Issue 3: 404 Not Found

**Symptoms:**
- Backend returns 404
- Route not found error

**Solutions:**
1. **Verify route is registered:**
   ```bash
   # Check if route exists
   grep -r "router.delete" src/routes/media.route.ts
   ```

2. **Check route mounting:**
   ```bash
   # Verify media routes are mounted
   grep -r "app.use.*media" src/app.ts
   ```

3. **Verify URL path:**
   - Frontend should use: `/api/media/:id`
   - Not: `/media/:id` or `/api/v1/media/:id`

### Issue 4: 401 Unauthorized

**Symptoms:**
- Backend returns 401
- "Unauthorized: User not authenticated"

**Solutions:**
1. **Check token is being sent:**
   ```typescript
   // Frontend should include:
   headers: {
     'Authorization': `Bearer ${token}`
   }
   ```

2. **Verify token is valid:**
   - Token might be expired
   - Token format might be wrong
   - Check `verifyToken` middleware

3. **Check token extraction:**
   - Backend extracts token from `Authorization` header
   - Format: `Bearer <token>`

### Issue 5: 403 Forbidden

**Symptoms:**
- Backend returns 403
- "Unauthorized to delete this media"

**Solutions:**
1. **Verify user is the creator:**
   ```typescript
   // In service: src/service/media.service.ts:948
   if (
     media.uploadedBy.toString() !== userIdentifier &&
     userRole !== "admin"
   ) {
     throw new Error("Unauthorized to delete this media");
   }
   ```

2. **Check media ownership:**
   - Verify `media.uploadedBy` matches `req.userId`
   - Admin users can delete any media

3. **Debug ownership check:**
   ```typescript
   console.log("Media uploadedBy:", media.uploadedBy);
   console.log("User ID:", userIdentifier);
   console.log("User Role:", userRole);
   ```

---

## 🧪 Testing Checklist

### Backend Tests

- [ ] Server is running and accessible
- [ ] Health endpoint responds: `GET /health`
- [ ] DELETE endpoint exists: `DELETE /api/media/:id`
- [ ] CORS allows DELETE method
- [ ] Authentication middleware works
- [ ] Authorization check works (creator or admin)
- [ ] Media deletion from database works
- [ ] File deletion from Cloudflare R2 works

### Frontend Tests

- [ ] Frontend can reach backend (network connectivity)
- [ ] Token is being sent in Authorization header
- [ ] Request URL is correct: `/api/media/:id`
- [ ] Request method is DELETE
- [ ] Headers include: `Authorization`, `Content-Type`, `expo-platform`
- [ ] Success response is handled correctly
- [ ] Error responses are handled correctly

---

## 📝 Frontend Request Example

```typescript
// Correct frontend implementation
const deleteMedia = async (mediaId: string) => {
  const token = await SecureStore.getItemAsync("authToken");
  
  const response = await axios.delete(
    `${API_BASE_URL}/api/media/${mediaId}`, // ✅ Correct path
    {
      headers: {
        'Authorization': `Bearer ${token}`, // ✅ Correct format
        'Content-Type': 'application/json',
        'expo-platform': 'ios'
      },
      timeout: 30000
    }
  );
  
  return response.data; // { success: true, message: "..." }
};
```

**Common Frontend Mistakes:**

❌ **Wrong URL:**
```typescript
// Wrong - missing /api
`${API_BASE_URL}/media/${mediaId}`

// Wrong - wrong path
`${API_BASE_URL}/media/delete/${mediaId}`
```

❌ **Wrong Header Format:**
```typescript
// Wrong - missing Bearer
'Authorization': token

// Wrong - wrong format
'Authorization': `Token ${token}`
```

✅ **Correct:**
```typescript
// Correct
`${API_BASE_URL}/api/media/${mediaId}`
'Authorization': `Bearer ${token}`
```

---

## 🔧 Quick Fixes

### If Request Not Reaching Backend:

1. **Check server is running:**
   ```bash
   npm run dev
   ```

2. **Check backend URL in frontend:**
   ```typescript
   // Use actual backend URL, not localhost for mobile
   const API_BASE_URL = "http://192.168.1.100:4000"; // Your server IP
   ```

3. **Check network connectivity:**
   - Mobile device and server on same network
   - Firewall not blocking port 4000
   - Server accessible from frontend device

### If Getting CORS Error:

1. **Add origin to allowed list** in `src/app.ts`:
   ```typescript
   const allowedOrigins = [
     // ... existing origins
     "http://your-frontend-url.com", // Add your frontend URL
   ];
   ```

2. **For development, allow all:**
   ```typescript
   // Temporarily for debugging
   origin: "*" // ⚠️ Only for development!
   ```

### If Getting 401/403:

1. **Check token is valid:**
   ```typescript
   // Log token in frontend (for debugging)
   console.log("Token:", token);
   ```

2. **Verify user is creator:**
   - Check `media.uploadedBy === currentUserId`
   - Or user has `role === "admin"`

---

## 📊 Backend Route Verification

Run this to verify the route exists:

```bash
# Check route registration
grep -A 5 "router.delete" src/routes/media.route.ts

# Check route mounting
grep "app.use.*media" src/app.ts

# Check controller exists
grep "export const deleteMedia" src/controllers/media.controller.ts
```

**Expected Output:**
```
router.delete("/:id", verifyToken, deleteMedia);
app.use("/api/media", mediaRoutes);
export const deleteMedia = async (request: Request, response: Response)
```

---

## 🎯 Summary

The backend implementation is **correct**:

✅ Route registered: `DELETE /api/media/:id`  
✅ CORS configured: DELETE method allowed  
✅ Authentication: `verifyToken` middleware  
✅ Authorization: Creator or admin check  
✅ Response format: `{ success: true, message: "..." }`

**If frontend is having issues, check:**

1. ✅ Server is running
2. ✅ Frontend URL is correct (`/api/media/:id`)
3. ✅ Token is being sent (`Authorization: Bearer <token>`)
4. ✅ Network connectivity (server reachable)
5. ✅ CORS allows your origin (if web app)

**Most likely issue:** Server not running or frontend using wrong URL.

---

**Last Updated:** 2024-01-15  
**Status:** Backend Implementation ✅ Complete

