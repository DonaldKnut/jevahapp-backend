# Community Endpoints - Quick Reference for Frontend

**Status Guide:**
- ✅ **Ready** - Endpoint exists and works (may need minor format adjustments)
- ⚠️ **Partial** - Endpoint exists but needs enhancements
- ❌ **Missing** - Needs to be created
- 🔄 **Route Mismatch** - Endpoint exists but route path differs

---

## Prayer Wall Endpoints

| Frontend Needs | Backend Status | Current Route | Notes |
|----------------|----------------|---------------|-------|
| `POST /api/community/prayer-wall/create` | ✅ **Ready** | `POST /api/community/prayer-wall/posts` | ✅ Route exists, just update request body format |
| `GET /api/community/prayer-wall` | ✅ **Ready** | `GET /api/community/prayer-wall/posts` | ✅ Route exists, enhance response format |
| `GET /api/community/prayer-wall/search` | ❌ **Missing** | ❌ None | 🔨 **Create new endpoint** |
| `GET /api/community/prayer-wall/{id}` | ✅ **Ready** | `GET /api/community/prayer-wall/posts/:id` | ✅ Route exists |
| `POST /api/community/prayer-wall/{id}/like` | ❌ **Missing** | ❌ None | 🔨 **Create new endpoint** (use interaction system) |
| `GET /api/community/prayer-wall/{id}/comments` | ❌ **Missing** | ❌ None | 🔨 **Create new endpoint** (use interaction system) |
| `POST /api/community/prayer-wall/{id}/comments` | ❌ **Missing** | ❌ None | 🔨 **Create new endpoint** (use interaction system) |
| `PUT /api/community/prayer-wall/{id}` | ✅ **Ready** | `PUT /api/community/prayer-wall/posts/:id` | ✅ Route exists |
| `DELETE /api/community/prayer-wall/{id}` | ✅ **Ready** | `DELETE /api/community/prayer-wall/posts/:id` | ✅ Route exists |

### Prayer Wall Request/Response Format

**Current Backend Accepts:**
```json
POST /api/community/prayer-wall/posts
{
  "content": "Prayer text",
  "anonymous": false,
  "media": ["url1", "url2"]
}
```

**Frontend Sends:**
```json
POST /api/community/prayer-wall/create
{
  "prayerText": "Prayer text",
  "verse": { "text": "...", "reference": "John 3:16" },
  "color": "#A16CE5",
  "shape": "square"
}
```

**Action Required:** Update controller to accept both formats OR migrate to new format.

---

## Forum Endpoints

| Frontend Needs | Backend Status | Current Route | Notes |
|----------------|----------------|---------------|-------|
| `POST /api/community/forum/create` | ❌ **Missing** | ❌ None | 🔨 **Create Forum model + endpoint** (admin only) |
| `GET /api/community/forum` | ❌ **Missing** | ❌ None | 🔨 **Create endpoint** - List forums |
| `GET /api/community/forum/{forumId}/posts` | ❌ **Missing** | ❌ None | 🔨 **Restructure** - Current: `/forum/threads` |
| `POST /api/community/forum/{forumId}/posts` | ⚠️ **Partial** | `POST /api/community/forum/threads` | ⚠️ Route exists but needs forumId + embeddedLinks |
| `POST /api/community/forum/posts/{postId}/like` | ❌ **Missing** | ❌ None | 🔨 **Create new endpoint** |
| `GET /api/community/forum/posts/{postId}/comments` | ❌ **Missing** | ❌ None | 🔨 **Create new endpoint** |
| `POST /api/community/forum/posts/{postId}/comments` | ❌ **Missing** | ❌ None | 🔨 **Create new endpoint** |
| `POST /api/community/forum/comments/{commentId}/like` | ❌ **Missing** | ❌ None | 🔨 **Create new endpoint** |
| `PUT /api/community/forum/posts/{postId}` | ⚠️ **Partial** | `PUT /api/community/forum/threads/:id` | ⚠️ Route exists but needs embeddedLinks support |
| `DELETE /api/community/forum/posts/{postId}` | ⚠️ **Partial** | `DELETE /api/community/forum/threads/:id` | ⚠️ Route exists |

### Forum Architecture Change Required

**Frontend Expects:**
```
Forum (Admin creates) → Posts (Users create in forum) → Comments
```

**Current Backend:**
```
ForumThread (User creates) → (No forum entity, no comments)
```

**Action Required:** Major restructure needed. Create Forum model, convert ForumThreads to ForumPosts.

---

## Groups Endpoints

| Frontend Needs | Backend Status | Current Route | Notes |
|----------------|----------------|---------------|-------|
| `POST /api/community/groups/create` | ✅ **Ready** | `POST /api/community/groups` | ✅ Route exists, add image upload |
| `GET /api/community/groups/my-groups` | ✅ **Ready** | `GET /api/community/groups?mine=true` | ✅ Query param exists |
| `GET /api/community/groups/explore` | ✅ **Ready** | `GET /api/community/groups` | ✅ Route exists, add search/sort |
| `GET /api/community/groups/{id}` | ✅ **Ready** | `GET /api/community/groups/:id` | ✅ Route exists |
| `POST /api/community/groups/{id}/members` | ❌ **Missing** | ❌ None | 🔨 **Create endpoint** - Bulk add members |
| `POST /api/community/groups/{id}/join` | ✅ **Ready** | `POST /api/community/groups/:id/join` | ✅ Route exists |
| `POST /api/community/groups/{id}/leave` | ✅ **Ready** | `POST /api/community/groups/:id/leave` | ✅ Route exists |
| `DELETE /api/community/groups/{id}/members/{userId}` | ❌ **Missing** | ❌ None | 🔨 **Create endpoint** - Remove member |
| `PUT /api/community/groups/{id}` | ✅ **Ready** | `PUT /api/community/groups/:id` | ✅ Route exists, add image update |
| `DELETE /api/community/groups/{id}` | ✅ **Ready** | `DELETE /api/community/groups/:id` | ✅ Route exists |

### Groups Request/Response Format

**Current Backend Accepts:**
```json
POST /api/community/groups
{
  "name": "Group Name",
  "description": "Description",
  "visibility": "public"  // or "private"
}
```

**Frontend Sends:**
```json
POST /api/community/groups/create
FormData:
  name: "Group Name"
  description: "Description"
  isPublic: true
  profileImage: <file>
```

**Action Required:** Add image upload support, map `isPublic` ↔ `visibility`.

---

## Polls Endpoints

| Frontend Needs | Backend Status | Current Route | Notes |
|----------------|----------------|---------------|-------|
| `POST /api/community/polls/create` | ✅ **Ready** | `POST /api/community/polls` | ✅ Route exists, add admin check |
| `GET /api/community/polls` | ✅ **Ready** | `GET /api/community/polls` | ✅ Route exists, enhance response |
| `GET /api/community/polls/{id}` | ✅ **Ready** | `GET /api/community/polls/:id` | ✅ Route exists, enhance response |
| `POST /api/community/polls/{id}/vote` | ✅ **Ready** | `POST /api/community/polls/:id/votes` | ✅ Route exists, update request format |
| `PUT /api/community/polls/{id}` | ❌ **Missing** | ❌ None | 🔨 **Create endpoint** (admin only) |
| `DELETE /api/community/polls/{id}` | ❌ **Missing** | ❌ None | 🔨 **Create endpoint** (admin only) |

### Polls Request/Response Format

**Current Backend Accepts:**
```json
POST /api/community/polls/:id/votes
{
  "optionIndex": 0  // or [0, 1] for multiSelect
}
```

**Frontend Sends:**
```json
POST /api/community/polls/{id}/vote
{
  "optionId": "507f1f77bcf86cd799439041"
}
```

**Action Required:** Update controller to accept `optionId` OR generate option IDs in response.

---

## Summary Statistics

### By Status
- ✅ **Ready to Use:** 15 endpoints (52%)
- ⚠️ **Needs Enhancement:** 4 endpoints (14%)
- ❌ **Missing:** 10 endpoints (34%)

### By Feature
- **Prayer Wall:** 60% ready, 40% missing
- **Forum:** 20% ready, 80% missing (major restructure needed)
- **Groups:** 80% ready, 20% missing
- **Polls:** 67% ready, 33% missing

---

## Quick Implementation Guide

### For Frontend Team - What You Can Use Now

#### ✅ **Ready to Use** (with minor adjustments)

1. **Prayer Wall CRUD**
   - Use: `POST /api/community/prayer-wall/posts`
   - Use: `GET /api/community/prayer-wall/posts`
   - Use: `GET /api/community/prayer-wall/posts/:id`
   - Use: `PUT /api/community/prayer-wall/posts/:id`
   - Use: `DELETE /api/community/prayer-wall/posts/:id`
   - **Note:** Request body format differs slightly (see above)

2. **Groups CRUD**
   - Use: `POST /api/community/groups`
   - Use: `GET /api/community/groups?mine=true`
   - Use: `GET /api/community/groups/:id`
   - Use: `POST /api/community/groups/:id/join`
   - Use: `POST /api/community/groups/:id/leave`
   - **Note:** Image upload not yet supported, use `visibility` instead of `isPublic`

3. **Polls CRUD**
   - Use: `POST /api/community/polls`
   - Use: `GET /api/community/polls`
   - Use: `GET /api/community/polls/:id`
   - Use: `POST /api/community/polls/:id/votes`
   - **Note:** Use `optionIndex` instead of `optionId`, use `question` instead of `title`

#### ❌ **Cannot Use Yet** (needs backend implementation)

1. **Prayer Wall Interactions**
   - Search, Like, Comments - **Not available yet**

2. **Forum**
   - Forum entity, embedded links, comments - **Needs major restructure**

3. **Groups**
   - Bulk add members, remove members - **Not available yet**

4. **Polls**
   - Edit/Delete polls - **Not available yet**

---

## Recommended Frontend Approach

### Option 1: Use Existing Endpoints (Quick Start)
- Start with Prayer Wall, Groups, and Polls basic CRUD
- Use current request/response formats
- Adapt frontend to match backend format
- **Pros:** Can start immediately
- **Cons:** May need refactoring when new endpoints are ready

### Option 2: Wait for Full Implementation
- Wait for all endpoints to be implemented
- Frontend matches documented API exactly
- **Pros:** Clean implementation, no refactoring
- **Cons:** Delayed start

### Option 3: Hybrid Approach (Recommended)
- Start with ready endpoints (Groups, Polls basic CRUD)
- Implement Prayer Wall with current format, update when ready
- Wait for Forum restructure
- **Pros:** Balanced approach, continuous progress
- **Cons:** Some refactoring needed

---

## Backend Implementation Priority for Frontend

### High Priority (Blocks Frontend)
1. ✅ Prayer Wall: Likes/Comments endpoints
2. ✅ Prayer Wall: Search endpoint
3. ✅ Prayer Wall: Update request format (verse, color, shape)
4. ✅ Groups: Image upload
5. ✅ Groups: Add/remove members endpoints

### Medium Priority (Enhances Frontend)
1. ⚠️ Forum: Restructure to Forum → Posts
2. ⚠️ Polls: Update response format (percentages, userVoted)
3. ⚠️ Polls: Edit/Delete endpoints

### Low Priority (Nice to Have)
1. 🔄 Standardize all response formats
2. 🔄 Add pagination metadata consistently
3. 🔄 Add sorting/filtering options

---

## Contact & Support

For questions about:
- **Endpoint availability:** Check this document
- **Implementation timeline:** See `COMMUNITY_API_MAPPING.md`
- **Technical details:** See `COMMUNITY_API_MAPPING.md` implementation guide

---

**Last Updated:** 2024-01-15  
**Status:** Backend Analysis Complete - Ready for Implementation Planning

