# Account & Profile Settings - Backend Assessment

## Executive Summary

**Status: 🟡 PARTIALLY READY** - You have approximately **60-70%** of what's needed. The foundation is solid, but several key endpoints and features need to be implemented or modified.

---

## ✅ What You Already Have

### 1. **User Model & Schema**
- ✅ `bio` field exists in User schema (`src/models/user.model.ts:280`)
- ✅ `firstName` and `lastName` fields exist
- ✅ `avatar` and `avatarUpload` fields exist
- ✅ `section` field exists (enum: "kids" | "adults")

### 2. **Existing Endpoints**
- ✅ `GET /api/auth/me` - Returns current user (via `auth.controller.ts`)
- ✅ `GET /api/users/me` - Alternative endpoint (via `user.controller.ts`)
- ✅ `PUT /api/users/:userId` - Updates user profile
- ✅ `POST /api/auth/logout` - Logout functionality exists

### 3. **Content Endpoints (Partial)**
- ✅ `GET /api/user-content/user/posts` - Get user posts
- ✅ `GET /api/user-content/user/photos` - Get user photos/media
- ✅ `GET /api/user-content/user/videos` - Get user videos
- ✅ `GET /api/user-content/my-content` - Unified content endpoint

### 4. **Analytics Infrastructure**
- ✅ `AnalyticsService` exists (`src/service/analytics.service.ts`)
- ✅ `MediaAnalyticsService` exists (`src/service/mediaAnalytics.service.ts`)
- ✅ Analytics routes exist (`src/routes/analytics.routes.ts`)

### 5. **Live Streaming Support**
- ✅ Media model has `isLive`, `liveStreamStatus` fields
- ✅ Live streaming service exists (`contaboStreaming.service.ts`)

---

## ❌ What's Missing or Needs Modification

### 1. **Profile Endpoints - CRITICAL**

#### Issue: `GET /api/auth/me` doesn't return `bio`
**Current State:**
- `src/service/user.service.ts:70-71` - `bio` not selected in query
- `src/service/user.service.ts:81-94` - `bio` not included in response

**Required Fix:**
```typescript
// In getCurrentUser method, add bio to select:
.select("firstName lastName email avatar avatarUpload bio section role isProfileComplete isEmailVerified createdAt updatedAt")

// Add bio to response:
bio: user.bio || null,
```

#### Issue: `PUT /api/users/:userId` may not support `bio` updates
**Current State:**
- `src/service/user.service.ts:297` - Filters out certain fields but may allow bio
- Need to verify `bio` is in allowed updates

**Required Fix:**
- Ensure `bio` field is allowed in `updateUserProfile` method
- Add validation for bio length (max 500 characters)

#### Missing: `PATCH /api/users/me` endpoint
**Spec Requirement:** `PATCH /api/users/me` or `PUT /api/auth/update-profile`

**Current State:** Only `PUT /api/users/:userId` exists

**Required:** Add endpoint that allows users to update their own profile without specifying userId in path

---

### 2. **Content Endpoints - PATH MISMATCH**

**Spec Requires:**
- `GET /api/users/{userId}/posts`
- `GET /api/users/{userId}/media`
- `GET /api/users/{userId}/videos`

**Current State:**
- `GET /api/user-content/user/posts` (different path structure)
- `GET /api/user-content/user/photos`
- `GET /api/user-content/user/videos`

**Options:**
1. **Add new routes** matching spec format (recommended)
2. **Modify existing routes** to support both formats
3. **Update frontend** to use existing routes

**Recommendation:** Add new routes for consistency with spec, keep old ones for backward compatibility.

---

### 3. **Analytics Endpoint - MISSING**

**Spec Requires:** `GET /api/users/{userId}/analytics`

**Current State:**
- Analytics services exist but no user-specific endpoint
- `GET /api/analytics/user-engagement` exists but may not match spec format

**Required Implementation:**
```typescript
// New endpoint needed:
GET /api/users/:userId/analytics

// Should return:
{
  posts: { total, published, drafts },
  likes: { total, received },
  liveSessions: { total, totalDuration },
  comments: { total, received },
  drafts: { total, posts, videos },
  shares: { total, received }
}
```

**Data Sources:**
- Posts: `Media` collection (contentType: "ebook", "devotional", "sermon")
- Likes: Aggregate `likeCount` from `Media` collection
- Comments: Aggregate `commentCount` from `Media` collection
- Shares: Aggregate `shareCount` from `Media` collection
- Live Sessions: Count `Media` where `isLive: true` or `liveStreamStatus: "ended"`
- Drafts: Count unpublished content (need `isPublished` field or similar)

---

### 4. **Live Sessions Tracking**

**Spec Requires:** Track number of live sessions and total duration

**Current State:**
- Media model has `isLive`, `liveStreamStatus`, `actualStart`, `actualEnd`
- Need to verify if duration is calculated/stored

**Required:**
- Ensure live sessions are properly tracked
- Calculate `totalDuration` from `actualStart` and `actualEnd` timestamps
- Count sessions where `liveStreamStatus: "ended"` or `isLive: false` with `actualEnd` set

---

### 5. **Drafts Tracking**

**Spec Requires:** Track draft posts and videos separately

**Current State:**
- Need to verify if `Media` model has `isPublished` or similar field
- If not, may need to add this field or use another indicator

**Required:**
- Add `isPublished` field to Media schema if not exists
- Or use existing field to determine draft status
- Count drafts by content type

---

## 📋 Implementation Checklist

### Phase 1: Profile Endpoints (High Priority)

- [ ] **Fix `GET /api/auth/me` to return `bio`**
  - Update `user.service.ts` `getCurrentUser` method
  - Add `bio` to select query
  - Add `bio` to response object

- [ ] **Fix `PUT /api/users/:userId` to support `bio`**
  - Verify `bio` is in allowed updates
  - Add validation (max 500 characters)
  - Test bio update functionality

- [ ] **Add `PATCH /api/users/me` endpoint**
  - Create new route handler
  - Allow users to update own profile
  - Support: `firstName`, `lastName`, `bio`, `section`

### Phase 2: Content Endpoints (Medium Priority)

- [ ] **Add `GET /api/users/:userId/posts`**
  - Create new route matching spec format
  - Reuse logic from existing `getUserPosts`
  - Add authorization check (users can only view own posts)

- [ ] **Add `GET /api/users/:userId/media`**
  - Create new route matching spec format
  - Filter by `contentType: "image"`
  - Add authorization check

- [ ] **Add `GET /api/users/:userId/videos`**
  - Create new route matching spec format
  - Filter by video content types
  - Add authorization check

### Phase 3: Analytics Endpoint (High Priority)

- [ ] **Create `GET /api/users/:userId/analytics` endpoint**
  - Create controller method
  - Aggregate data from Media collection
  - Calculate:
    - Total posts (published + drafts)
    - Total likes received
    - Total comments received
    - Total shares received
    - Live sessions count and duration
    - Draft counts (posts and videos)

- [ ] **Verify/Add draft tracking**
  - Check if `isPublished` field exists in Media model
  - Add if missing
  - Update content creation to set `isPublished: true` by default

### Phase 4: Response Format Alignment (Medium Priority)

- [ ] **Ensure all endpoints return spec-compliant responses**
  - Standardize response format: `{ success: boolean, data: {...} }`
  - Ensure pagination format matches spec
  - Add proper error responses

---

## 🔧 Quick Wins (Can Be Done Immediately)

1. **Add `bio` to `getCurrentUser` response** (15 minutes)
2. **Add `bio` validation to `updateUserProfile`** (10 minutes)
3. **Add `PATCH /api/users/me` endpoint** (30 minutes)

---

## 📊 Estimated Effort

| Task | Estimated Time | Priority |
|------|---------------|----------|
| Fix bio in GET /api/auth/me | 15 min | 🔴 High |
| Fix bio in PUT /api/users/:userId | 30 min | 🔴 High |
| Add PATCH /api/users/me | 30 min | 🔴 High |
| Add GET /api/users/:userId/posts | 1 hour | 🟡 Medium |
| Add GET /api/users/:userId/media | 1 hour | 🟡 Medium |
| Add GET /api/users/:userId/videos | 1 hour | 🟡 Medium |
| Create analytics endpoint | 3-4 hours | 🔴 High |
| Verify/Add draft tracking | 1-2 hours | 🟡 Medium |
| Testing & Documentation | 2-3 hours | 🟡 Medium |

**Total Estimated Time: 10-14 hours**

---

## 🎯 Recommendations

### Immediate Actions:
1. **Fix bio support** - This is quick and critical
2. **Add PATCH /api/users/me** - Matches spec expectations
3. **Create analytics endpoint** - This is the most complex missing piece

### Architecture Decisions:
1. **Route Structure:** Add new routes matching spec format while keeping existing ones for backward compatibility
2. **Authorization:** Ensure all new endpoints check that users can only access their own data
3. **Draft Tracking:** Decide on draft indicator (add `isPublished` field or use existing mechanism)

### Testing Strategy:
1. Test bio CRUD operations
2. Test content endpoints with pagination
3. Test analytics aggregation accuracy
4. Test authorization (users can't access others' data)
5. Test edge cases (empty data, large datasets)

---

## ✅ Conclusion

**You have a solid foundation!** The main gaps are:

1. **Bio field support** - Easy fix, just needs to be added to responses/updates
2. **Route path alignment** - Need to add routes matching spec format
3. **Analytics endpoint** - Needs to be built but you have the infrastructure

**Estimated completion time: 1-2 days** for a developer familiar with the codebase.

The good news is that most of the heavy lifting (models, services, authentication) is already done. You mainly need to:
- Wire up existing functionality to new routes
- Add the analytics aggregation endpoint
- Ensure bio is fully supported

**You can definitely achieve this!** 🚀

