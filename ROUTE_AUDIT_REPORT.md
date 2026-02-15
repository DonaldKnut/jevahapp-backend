# 🔍 BACKEND ROUTE WIRING AUDIT REPORT
**Generated:** December 28, 2025  
**Backend:** Node.js + Express (TypeScript)  
**Production Domain:** https://api.jevahapp.com  
**Internal Server:** http://127.0.0.1:4000

---
x
## 📋 TASK 1 — ROUTE WIRING AUDIT

### Entry Points
- **Main Entry:** `src/index.ts` → imports `server` from `src/app.ts`
- **App Configuration:** `src/app.ts` → Express app setup and route mounting

### Route Mounting Structure

All routes are mounted with `/api` prefix in `app.ts` (lines 320-366), **EXCEPT**:
- `/` (root) - defined directly in app.ts (line 249)
- `/health` - defined directly in app.ts (line 293)
- `/api-docs` - Swagger UI (line 304)
- `/api-docs.json` - Swagger spec (line 314)

### Route Tree for Frontend-Endpoints

```
GET /api/media/public/all-content
  → app.use("/api/media", mediaRoutes) [app.ts:323]
  → router.get("/public/all-content", ...) [media.route.ts:101-106]
  ✅ VERIFIED: Route exists and is PUBLIC (no auth required)

GET /api/media/default
  → app.use("/api/media", mediaRoutes) [app.ts:323]
  → router.get("/default", ...) [media.route.ts:272-277]
  ✅ VERIFIED: Route exists and is PUBLIC (no auth required)

GET /api/notifications/stats
  → app.use("/api/notifications", notificationRoutes) [app.ts:325, 351]
  → router.get("/stats", verifyToken, ...) [notification.routes.ts:71-75]
  ✅ VERIFIED: Route exists but REQUIRES AUTHENTICATION

GET /health
  → Defined directly in app.ts (line 293-301)
  ✅ VERIFIED: Route exists and is PUBLIC (no auth required)
  ⚠️  NOTE: This is NOT under /api prefix
```

### Complete Route Mounting Map

```typescript
// From src/app.ts lines 320-366

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/media", mediaRoutes);                    // ← Media routes
app.use("/api/media", mediaReportRoutes);              // ← Also mounted at /api/media
app.use("/api/notifications", notificationRoutes);     // ← Notifications (mounted TWICE - line 325 & 351)
app.use("/api/push-notifications", pushNotificationRoutes);
app.use("/api/ai-reengagement", aiReengagementRoutes);
app.use("/api/bible-facts", bibleFactsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/devotionals", devotionalsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/bookmark", bookmarksRoutes);
app.use("/api/bookmarks", bookmarksRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/content", contentInteractionRoutes);
app.use("/api/ai-chatbot", aiChatbotRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/user-profiles", userProfileRoutes);
app.use("/api/health", healthRoutes);                 // ← Health routes
app.use("/api/enhanced-media", enhancedMediaRoutes);
app.use("/api/merchandise", merchandiseRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/hymns", hymnsRoutes);
app.use("/api", placesRoutes);                        // ← Routes define their own paths
app.use("/api", churchesAdminRoutes);                 // ← Routes define their own paths
app.use("/api", userContentRoutes);                   // ← Routes define their own paths
app.use("/api/ebooks", ebookRoutes);
app.use("/api/tts", ebookRoutes);
app.use("/api/bible", bibleRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/media", playbackSessionRoutes);         // ← Also mounted at /api/media
app.use("/api/comments", commentRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/metrics", metricsRoutes);
```

### ⚠️ Potential Issues Identified

1. **Duplicate Mounting:** `notificationRoutes` is mounted twice (lines 325 and 351)
2. **Multiple Routes at Same Path:** 
   - `/api/media` has 3 routers mounted: `mediaRoutes`, `mediaReportRoutes`, `playbackSessionRoutes`
   - This is valid in Express (routes are checked in order), but can cause confusion

---

## 📊 TASK 2 — CONFIRMED ACTIVE ENDPOINTS

### Media Endpoints

#### Public Routes (No Authentication Required)
| METHOD | PATH | AUTH | CONTROLLER |
|--------|------|------|------------|
| GET | `/api/media/public` | ❌ | `getPublicMedia` |
| GET | `/api/media/public/all-content` | ❌ | `getPublicAllContent` |
| GET | `/api/media/public/search` | ❌ | `searchPublicMedia` |
| GET | `/api/media/public/:id` | ❌ | `getPublicMediaByIdentifier` |
| GET | `/api/media/default` | ❌ | `getDefaultContent` |
| GET | `/api/media/:mediaId/engagement` | ❌ | `getMediaWithEngagement` |

#### Authenticated Routes
| METHOD | PATH | AUTH | CONTROLLER |
|--------|------|------|------------|
| GET | `/api/media` | ✅ | `getAllMedia` |
| GET | `/api/media/all-content` | ✅ | `getAllContentForAllTab` |
| GET | `/api/media/search` | ✅ | `searchMedia` |
| GET | `/api/media/:id` | ✅ | `getMediaByIdentifier` |
| GET | `/api/media/:id/stats` | ✅ | `getMediaStats` |
| GET | `/api/media/analytics` | ✅ | `getAnalyticsDashboard` |
| GET | `/api/media/analytics/creator` | ✅ | `getCreatorAnalytics` |
| GET | `/api/media/:mediaId/analytics` | ✅ | `getMediaAnalytics` |
| POST | `/api/media/upload` | ✅ | `uploadMedia` |
| POST | `/api/media/generate-description` | ✅ | `generateMediaDescription` |
| DELETE | `/api/media/:id` | ✅ | `deleteMedia` |
| POST | `/api/media/:id/interact` | ✅ | `recordMediaInteraction` |
| POST | `/api/media/:id/track-view` | ✅ | `trackViewWithDuration` |
| GET | `/api/media/upload-counts` | ✅ | `getUploadCounts` |
| POST | `/api/media/:mediaId/download` | ✅ | `downloadMedia` |
| GET | `/api/media/:id/download-file` | ✅ | `downloadMediaFile` |
| GET | `/api/media/offline-downloads` | ✅ | `getOfflineDownloads` |
| PATCH | `/api/media/offline-downloads/:mediaId` | ✅ | `updateDownloadStatus` |
| GET | `/api/media/offline-downloads/:mediaId` | ✅ | `getDownloadStatus` |
| DELETE | `/api/media/offline-downloads/:mediaId` | ✅ | `removeFromOfflineDownloads` |
| GET | `/api/media/:id/action-status` | ✅ | `getUserActionStatus` |
| POST | `/api/media/viewed` | ✅ | `addToViewedMedia` |
| GET | `/api/media/viewed` | ✅ | `getViewedMedia` |
| GET | `/api/media/onboarding` | ✅ | `getOnboardingContent` |
| GET | `/api/media/refresh-url/:mediaId` | ✅ | `refreshVideoUrl` |

#### Live Streaming Routes
| METHOD | PATH | AUTH | CONTROLLER |
|--------|------|------|------------|
| POST | `/api/media/live/start` | ✅ | `startMuxLiveStream` |
| POST | `/api/media/live/go-live` | ✅ | `goLive` |
| POST | `/api/media/live/:id/end` | ✅ | `endMuxLiveStream` |
| GET | `/api/media/live` | ✅ | `getLiveStreams` |
| POST | `/api/media/live/schedule` | ✅ | `scheduleLiveStream` |
| GET | `/api/media/live/:streamId/status` | ✅ | `getStreamStatus` |
| GET | `/api/media/live/:streamId/stats` | ✅ | `getStreamStats` |

#### Recording Routes
| METHOD | PATH | AUTH | CONTROLLER |
|--------|------|------|------------|
| POST | `/api/media/recording/start` | ✅ | `startRecording` |
| POST | `/api/media/recording/:streamId/stop` | ✅ | `stopRecording` |
| GET | `/api/media/recording/:streamId/status` | ✅ | `getRecordingStatus` |
| GET | `/api/media/recordings` | ✅ | `getUserRecordings` |

### Notification Endpoints

| METHOD | PATH | AUTH | CONTROLLER |
|--------|------|------|------------|
| GET | `/api/notifications` | ✅ | `getUserNotifications` |
| GET | `/api/notifications/stats` | ✅ | `getNotificationStats` |
| PATCH | `/api/notifications/:notificationId/read` | ✅ | `markAsRead` |
| PATCH | `/api/notifications/mark-all-read` | ✅ | `markAllAsRead` |
| GET | `/api/notifications/preferences` | ✅ | `getNotificationPreferences` |
| PUT | `/api/notifications/preferences` | ✅ | `updateNotificationPreferences` |
| POST | `/api/notifications/share` | ✅ | `shareContent` |
| GET | `/api/notifications/trending` | ❌ | `getTrendingContent` |
| GET | `/api/notifications/mentions/suggestions` | ❌ | `getMentionSuggestions` |
| GET | `/api/notifications/viral-stats` | ❌ | `getViralStats` |

### System Endpoints

| METHOD | PATH | AUTH | CONTROLLER |
|--------|------|------|------------|
| GET | `/health` | ❌ | Direct handler in app.ts |
| GET | `/api/health/database` | ❌ | Health routes |
| GET | `/api/health/full` | ❌ | Health routes |
| GET | `/api/health/warmup` | ❌ | Health routes |
| GET | `/` | ❌ | API info endpoint |
| GET | `/api/test` | ❌ | Test endpoint |

### Other Key Endpoints

| METHOD | PATH | AUTH | CONTROLLER FILE |
|--------|------|------|-----------------|
| POST | `/api/auth/login` | ❌ | `auth.route.ts` |
| POST | `/api/auth/register` | ❌ | `auth.route.ts` |
| POST | `/api/auth/refresh` | ❌ | `auth.route.ts` |
| GET | `/api/places/suggest` | ❌ | `places.routes.ts` |
| GET | `/api/churches/:id` | ❌ | `places.routes.ts` |
| POST | `/api/churches` | ✅ | `churches.admin.routes.ts` |
| GET | `/api/user-content/my-content` | ✅ | `userContent.routes.ts` |

---

## ⚙️ TASK 3 — ENV & PORT CONFIRMATION

### Port Configuration

**Source:** `src/index.ts` lines 24-33

```typescript
const PORT = parseInt(process.env.PORT || "4000", 10);
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`✅ Server running on port ${PORT}`);
});
```

- **Default Port:** `4000`
- **Listen Address:** `0.0.0.0` (all interfaces)
- **Environment Variable:** `PORT` (optional, defaults to 4000)

### Required Environment Variables

**Source:** `src/index.ts` lines 12-21

```typescript
const requiredEnvVars = ["MONGODB_URI", "PORT", "JWT_SECRET"];
```

**Required:**
- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (defaults to 4000 if not set)
- `JWT_SECRET` - JWT signing secret

**Optional but Important:**
- `NODE_ENV` - Environment mode (development/production)
- `REDIS_URL` - Redis connection string (defaults to `redis://127.0.0.1:6379`)
- `JWT_REFRESH_SECRET` - Refresh token secret
- `SESSION_SECRET` - Session secret (falls back to JWT_SECRET)
- `FRONTEND_URL` - Frontend URL for CORS
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins

### Environment-Specific Behavior

**Development vs Production Differences:**

1. **CORS:** More permissive in development (allows localhost, network IPs)
   - Source: `src/app.ts` lines 122-132

2. **Error Messages:** Full stack traces in development, generic messages in production
   - Source: `src/app.ts` lines 409-415

3. **Self-Ping:** Enabled by default, configurable via `SELF_PING_ENABLED`
   - Source: `src/app.ts` lines 420-462

---

## 🌐 TASK 4 — NGINX COMPATIBILITY CHECK

### Current Route Structure Analysis

**All API routes are under `/api/*` prefix:**
- ✅ `/api/media/*`
- ✅ `/api/notifications/*`
- ✅ `/api/auth/*`
- ✅ `/api/users/*`
- etc.

**Exceptions (NOT under `/api`):**
- ⚠️ `/health` - Direct route, NOT under `/api`
- ⚠️ `/` - Root endpoint, NOT under `/api`
- ⚠️ `/api-docs` - Swagger UI, NOT under `/api` (but starts with `/api`)

### Nginx Configuration Recommendations

#### Option 1: Proxy `/api/*` to Backend (RECOMMENDED)

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# Handle /health separately (not under /api)
location = /health {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**⚠️ CRITICAL:** `proxy_pass` should **NOT** end with `/` when using `location /api/`
- ✅ Correct: `proxy_pass http://127.0.0.1:4000;`
- ❌ Wrong: `proxy_pass http://127.0.0.1:4000/;`

#### Option 2: Proxy Everything to Backend

```nginx
location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### Frontend URL Mismatch Analysis

**Frontend is calling:**
- ✅ `GET /api/media/public/all-content` → **MATCHES** backend route
- ✅ `GET /api/media/default` → **MATCHES** backend route
- ✅ `GET /api/notifications/stats` → **MATCHES** backend route (but requires auth)
- ✅ `GET /health` → **MATCHES** backend route

**All frontend URLs match backend routes!** ✅

### Potential Issues

1. **`/api/notifications/stats` requires authentication** - Frontend must send valid JWT token
2. **`/health` is not under `/api`** - Nginx must handle this separately if using `/api/` proxy

---

## 🔧 TASK 5 — REQUIRED FIXES & RECOMMENDATIONS

### Issues Found

1. **⚠️ Duplicate Route Mounting**
   - `notificationRoutes` mounted twice (lines 325 and 351 in app.ts)
   - **Impact:** Low (Express handles this, but redundant)
   - **Fix:** Remove one of the duplicate mounts

2. **⚠️ Multiple Routers at `/api/media`**
   - Three routers mounted: `mediaRoutes`, `mediaReportRoutes`, `playbackSessionRoutes`
   - **Impact:** None (Express checks routes in order)
   - **Status:** Valid but could be confusing

3. **✅ All Frontend URLs Match Backend Routes**
   - No mismatches found

### Recommended Nginx Configuration

```nginx
# Main API proxy
location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# Health check (not under /api)
location = /health {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 📝 FINAL RECOMMENDED URL CONTRACT

### Public Endpoints (No Authentication)

```
GET  /api/media/public/all-content
GET  /api/media/public
GET  /api/media/public/search
GET  /api/media/public/:id
GET  /api/media/default
GET  /api/media/:mediaId/engagement
GET  /api/notifications/trending
GET  /api/notifications/mentions/suggestions
GET  /api/notifications/viral-stats
GET  /health
GET  /api/health/database
GET  /api/health/full
GET  /api/health/warmup
```

### Authenticated Endpoints (Require JWT Token)

```
GET  /api/notifications
GET  /api/notifications/stats          ← Frontend calls this (needs auth!)
PATCH /api/notifications/:id/read
PATCH /api/notifications/mark-all-read
GET  /api/notifications/preferences
PUT  /api/notifications/preferences
POST /api/notifications/share
GET  /api/media
GET  /api/media/all-content
GET  /api/media/search
GET  /api/media/:id
... (all other /api/media/* routes except public ones)
```

### Frontend Should Call

```
✅ GET /api/media/public/all-content  (Public - no auth)
✅ GET /api/media/default             (Public - no auth)
✅ GET /api/notifications/stats       (Protected - requires Authorization header)
✅ GET /health                         (Public - no auth)
```

**⚠️ IMPORTANT:** `/api/notifications/stats` requires authentication. Frontend must include:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## ✅ VERIFICATION CHECKLIST

- [x] All routes traced from app.ts to router files
- [x] Port configuration confirmed (4000, configurable via PORT env)
- [x] Environment variables documented
- [x] Nginx compatibility analyzed
- [x] Frontend URL matches verified
- [x] Authentication requirements documented
- [x] Route tree mapped for key endpoints

---

**Report Generated:** December 28, 2025  
**Backend Version:** 2.0.0 (from package.json)  
**Node.js:** TypeScript + Express

---

## 🚀 QUICK REFERENCE — FRONTEND ENDPOINTS

| Endpoint | Method | Auth Required | Status | Notes |
|----------|--------|---------------|--------|-------|
| `/api/media/public/all-content` | GET | ❌ No | ✅ VERIFIED | Public route, works without auth |
| `/api/media/default` | GET | ❌ No | ✅ VERIFIED | Public route, works without auth |
| `/api/notifications/stats` | GET | ✅ Yes | ✅ VERIFIED | **Requires JWT token in Authorization header** |
| `/health` | GET | ❌ No | ✅ VERIFIED | Not under `/api`, handle separately in Nginx |

### Authentication Header Format
```http
Authorization: Bearer <JWT_TOKEN>
```

