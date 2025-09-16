# Notification System & Endpoint Analysis

## 🚨 **Critical Issues Found**

### 1. **Missing Notification Triggers** ❌

The like service is **NOT** triggering notifications when users like content!

**Problem**: In `src/service/contentInteraction.service.ts`, the `toggleLike` method doesn't call `NotificationService.notifyContentLike()`.

**Impact**:

- Content owners don't get notified when someone likes their content
- Users miss engagement notifications
- Reduced user engagement and retention

### 2. **Duplicate Endpoints** ⚠️

Multiple endpoints doing the same thing:

#### **Like Endpoints:**

- `POST /api/content/{contentType}/{contentId}/like` (Universal - ✅ RECOMMENDED)
- `POST /api/media/{id}/bookmark` (Media-specific - ❌ DUPLICATE)
- `POST /api/media/{id}/save` (Media-specific - ❌ DUPLICATE)

#### **Bookmark/Save Endpoints:**

- `POST /api/bookmark/{mediaId}/toggle` (Unified - ✅ RECOMMENDED)
- `POST /api/bookmarks/{mediaId}` (Old - ❌ DUPLICATE)
- `POST /api/media/{id}/bookmark` (Media-specific - ❌ DUPLICATE)
- `POST /api/media/{id}/save` (Media-specific - ❌ DUPLICATE)

### 3. **Like Visibility Issue** ❓

**Question**: "If I liked a media and logout, will other users see I liked an item?"

**Answer**: **YES** - Like visibility is **backend-controlled**, not frontend. The like count and like status are stored in the database and visible to all users regardless of login status.

**How it works**:

- Likes are stored in `MediaInteraction` collection
- Like counts are stored in `Media.likeCount` field
- Public endpoints return like counts to all users
- Individual like status requires authentication

## 🔧 **Fixes Needed**

### 1. **Fix Missing Notifications**

Add notification triggers to the like service:

```typescript
// In src/service/contentInteraction.service.ts
import { NotificationService } from "./notification.service";

// After successful like operation
if (liked) {
  // Send notification to content owner
  await NotificationService.notifyContentLike(userId, contentId, contentType);
}
```

### 2. **Endpoint Consolidation**

**Recommended Endpoints** (Keep these):

- `POST /api/content/{contentType}/{contentId}/like` - Universal like
- `POST /api/bookmark/{mediaId}/toggle` - Unified bookmark
- `GET /api/bookmark/{mediaId}/status` - Check bookmark status
- `GET /api/bookmark/user` - Get user bookmarks

**Deprecated Endpoints** (Remove these):

- `POST /api/media/{id}/bookmark` - Use unified bookmark instead
- `POST /api/media/{id}/save` - Use unified bookmark instead
- `POST /api/bookmarks/{mediaId}` - Use unified bookmark instead

### 3. **Notification System Status**

**Current Status**: ❌ **NOT WORKING**

- Notification service exists but isn't triggered
- Like notifications are missing
- Comment notifications may be missing
- Push notifications may not be working

## 📊 **Endpoint Analysis**

### **Like Endpoints**

| Endpoint                                           | Status       | Recommendation                    |
| -------------------------------------------------- | ------------ | --------------------------------- |
| `POST /api/content/{contentType}/{contentId}/like` | ✅ Working   | **KEEP** - Universal solution     |
| `POST /api/media/{id}/bookmark`                    | ❌ Duplicate | **REMOVE** - Use unified bookmark |
| `POST /api/media/{id}/save`                        | ❌ Duplicate | **REMOVE** - Use unified bookmark |

### **Bookmark Endpoints**

| Endpoint                              | Status     | Recommendation                    |
| ------------------------------------- | ---------- | --------------------------------- |
| `POST /api/bookmark/{mediaId}/toggle` | ✅ Working | **KEEP** - Unified solution       |
| `GET /api/bookmark/{mediaId}/status`  | ✅ Working | **KEEP** - Status check           |
| `GET /api/bookmark/user`              | ✅ Working | **KEEP** - User bookmarks         |
| `POST /api/bookmarks/{mediaId}`       | ❌ Old     | **REMOVE** - Use unified bookmark |
| `DELETE /api/bookmarks/{mediaId}`     | ❌ Old     | **REMOVE** - Use unified bookmark |

### **Notification Endpoints**

| Endpoint                                  | Status     | Recommendation                 |
| ----------------------------------------- | ---------- | ------------------------------ |
| `GET /api/notifications`                  | ✅ Working | **KEEP** - Get notifications   |
| `PATCH /api/notifications/{id}`           | ✅ Working | **KEEP** - Mark as read        |
| `PATCH /api/notifications/mark-all-read`  | ✅ Working | **KEEP** - Mark all read       |
| `POST /api/push-notifications/register`   | ✅ Working | **KEEP** - Device registration |
| `PUT /api/push-notifications/preferences` | ✅ Working | **KEEP** - Update preferences  |

## 🎯 **Immediate Actions Required**

### **Priority 1: Fix Notifications** 🔥

1. Add notification triggers to like service
2. Test notification flow end-to-end
3. Verify push notifications work

### **Priority 2: Clean Up Duplicates** ⚠️

1. Remove duplicate bookmark endpoints
2. Update frontend to use unified endpoints
3. Add deprecation warnings to old endpoints

### **Priority 3: Documentation** 📚

1. Create comprehensive frontend integration guide
2. Document all working endpoints
3. Provide migration guide for old endpoints

## 🔍 **Like Visibility Details**

### **Public Like Information** (Visible to all users)

- Total like count (`likeCount`)
- Like statistics
- Recent likes (if implemented)

### **Private Like Information** (Requires authentication)

- Whether current user liked the content
- User's like history
- Like notifications

### **Database Structure**

```typescript
// Media model
{
  likeCount: number,        // Public - visible to all
  // ... other fields
}

// MediaInteraction model
{
  user: ObjectId,          // Private - requires auth
  media: ObjectId,         // Private - requires auth
  interactionType: "like", // Private - requires auth
  isRemoved: boolean,      // Private - requires auth
}
```

## 🚀 **Next Steps**

1. **Fix notification triggers** in like service
2. **Test notification system** end-to-end
3. **Remove duplicate endpoints** safely
4. **Create frontend integration guide**
5. **Update API documentation**

## ⚠️ **Breaking Changes**

When removing duplicate endpoints:

- Frontend code using old endpoints will break
- Need to provide migration timeline
- Should implement deprecation warnings first
- Test thoroughly before removal

## 📝 **Recommendations**

1. **Keep universal endpoints** (`/api/content/*` and `/api/bookmark/*`)
2. **Remove media-specific duplicates** (`/api/media/*/bookmark`, `/api/media/*/save`)
3. **Fix notification triggers** immediately
4. **Create comprehensive documentation** for frontend team
5. **Implement gradual migration** strategy
