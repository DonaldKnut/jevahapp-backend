# Duplicate Endpoints Analysis & Cleanup Plan

## 🚨 **Critical Duplicates Found**

### **1. Bookmark/Save Endpoints** ❌ **DUPLICATES**

#### **Current Duplicates:**

- `POST /api/media/:id/bookmark` (Media-specific)
- `POST /api/media/:id/save` (Media-specific)
- `POST /api/bookmarks/:mediaId` (Old bookmarks)
- `POST /api/bookmark/:mediaId/toggle` (✅ **KEEP** - Unified)

#### **Action:** Remove first 3, keep unified bookmark

### **2. Track View Endpoints** ❌ **DUPLICATES**

#### **Current Duplicates:**

- `POST /api/media/track-view` (Global track view)
- `POST /api/media/:id/track-view` (Media-specific track view)

#### **Action:** Keep one, remove the other

### **3. Download Endpoints** ❌ **DUPLICATES**

#### **Current Duplicates:**

- `POST /api/media/:id/download` (Appears twice in same file!)

#### **Action:** Remove duplicate, keep one

### **4. Share Endpoints** ❌ **REDUNDANT**

#### **Current:**

- `POST /api/media/:id/share` (Legacy - redirects to content interaction)
- `POST /api/content/:contentType/:contentId/share` (✅ **KEEP** - Universal)

#### **Action:** Remove legacy redirect

### **5. Favorite Endpoints** ❌ **REDUNDANT**

#### **Current:**

- `POST /api/media/:id/favorite` (Legacy - redirects to content interaction)
- `POST /api/content/:contentType/:contentId/like` (✅ **KEEP** - Universal)

#### **Action:** Remove legacy redirect

## 📋 **Cleanup Plan**

### **Phase 1: Remove Duplicate Bookmark Endpoints**

**Files to modify:**

- `src/routes/media.route.ts` - Remove bookmark/save endpoints
- `src/routes/bookmarks.routes.ts` - Remove entire file (replaced by unified)

**Endpoints to remove:**

```typescript
// Remove these from media.route.ts
router.post("/:id/bookmark", ...);  // Line ~203
router.post("/:id/save", ...);      // Line ~217
```

**Keep:**

```typescript
// Keep unified bookmark endpoints
POST /api/bookmark/:mediaId/toggle
GET /api/bookmark/:mediaId/status
GET /api/bookmark/user
```

### **Phase 2: Remove Duplicate Track View**

**Decision:** Keep `POST /api/media/:id/track-view` (more specific)
**Remove:** `POST /api/media/track-view` (global)

### **Phase 3: Remove Duplicate Download**

**Remove:** One of the duplicate `POST /api/media/:id/download` endpoints

### **Phase 4: Remove Legacy Redirects**

**Remove:**

- `POST /api/media/:id/share` (legacy redirect)
- `POST /api/media/:id/favorite` (legacy redirect)

### **Phase 5: Remove Old Bookmarks Routes**

**Remove entire file:** `src/routes/bookmarks.routes.ts`
**Remove from app.ts:** `app.use("/api/bookmarks", bookmarksRoutes);`

## 🎯 **Recommended Endpoints (Keep These)**

### **Universal Content Interactions**

- `POST /api/content/:contentType/:contentId/like` - Universal like
- `POST /api/content/:contentType/:contentId/comment` - Universal comment
- `POST /api/content/:contentType/:contentId/share` - Universal share
- `GET /api/content/:contentType/:contentId/metadata` - Content metadata

### **Unified Bookmarks**

- `POST /api/bookmark/:mediaId/toggle` - Toggle bookmark
- `GET /api/bookmark/:mediaId/status` - Check status
- `GET /api/bookmark/user` - Get user bookmarks
- `GET /api/bookmark/:mediaId/stats` - Bookmark stats
- `POST /api/bookmark/bulk` - Bulk operations

### **Media-Specific (Keep These)**

- `POST /api/media/:id/track-view` - Track view
- `POST /api/media/:id/download` - Download (single instance)
- `GET /api/media/:id/stats` - Media stats
- `GET /api/media/:id/action-status` - Action status

## 🚀 **Implementation Steps**

1. **Remove duplicate bookmark endpoints** from media routes
2. **Remove old bookmarks routes** entirely
3. **Remove duplicate track-view endpoint**
4. **Remove duplicate download endpoint**
5. **Remove legacy redirect endpoints**
6. **Update app.ts** to remove old route registration
7. **Test build** to ensure no breaking changes
8. **Update documentation** to reflect changes

## ⚠️ **Breaking Changes**

**Frontend Impact:**

- Any code using old bookmark endpoints will break
- Need to update to unified bookmark endpoints
- Legacy redirects will no longer work

**Migration Required:**

- Update frontend API calls
- Test all bookmark functionality
- Update API documentation

## 📊 **Before vs After**

### **Before (Duplicates)**

```
POST /api/media/:id/bookmark      ❌ Remove
POST /api/media/:id/save          ❌ Remove
POST /api/bookmarks/:mediaId      ❌ Remove
POST /api/bookmark/:mediaId/toggle ✅ Keep

POST /api/media/track-view        ❌ Remove
POST /api/media/:id/track-view    ✅ Keep

POST /api/media/:id/download      ❌ Remove (duplicate)
POST /api/media/:id/download      ✅ Keep (single)

POST /api/media/:id/share         ❌ Remove (legacy)
POST /api/media/:id/favorite      ❌ Remove (legacy)
```

### **After (Clean)**

```
POST /api/bookmark/:mediaId/toggle ✅ Unified bookmark
GET /api/bookmark/:mediaId/status  ✅ Status check
GET /api/bookmark/user             ✅ User bookmarks

POST /api/media/:id/track-view     ✅ Track view
POST /api/media/:id/download       ✅ Download

POST /api/content/*/like           ✅ Universal like
POST /api/content/*/share          ✅ Universal share
```

## 🧪 **Testing Strategy**

1. **Test unified bookmark endpoints** work correctly
2. **Test media-specific endpoints** still work
3. **Verify no broken imports** in controllers
4. **Run build** to check for compilation errors
5. **Test API endpoints** with Postman/curl

## 📝 **Files to Modify**

1. `src/routes/media.route.ts` - Remove duplicates
2. `src/routes/bookmarks.routes.ts` - Delete file
3. `src/app.ts` - Remove old route registration
4. Update any imports that reference removed routes

This cleanup will eliminate confusion, reduce maintenance overhead, and provide a cleaner API surface for frontend integration.
