# Community API Mapping & Implementation Guide

**Version:** 1.0  
**Last Updated:** 2024-01-15  
**Status:** Backend Implementation Analysis

---

## 📋 Executive Summary

This document maps the **frontend API requirements** to the **current backend implementation**, identifies gaps, and provides implementation guidance. The backend has a solid foundation for Community features, but requires enhancements to match the frontend's expectations.

### Implementation Status Overview

| Feature | Status | Implementation Required |
|---------|--------|------------------------|
| Prayer Wall (Basic CRUD) | ✅ **Implemented** | Minor enhancements |
| Prayer Wall (Likes/Comments) | ❌ **Missing** | Create new endpoints |
| Prayer Wall (Search/AI) | ❌ **Missing** | Adapt existing AI service |
| Prayer Wall (Verse/Color/Shape) | ❌ **Missing** | Extend data model |
| Forum (Basic CRUD) | ✅ **Implemented** | Architecture changes |
| Forum (Likes/Comments/Links) | ❌ **Missing** | Create new endpoints |
| Forum (Forum Entity) | ❌ **Missing** | Create new model |
| Groups (Basic CRUD) | ✅ **Implemented** | Minor enhancements |
| Groups (Image Upload) | ❌ **Missing** | Add file upload |
| Groups (Add Members) | ⚠️ **Partial** | Enhance endpoint |
| Polls (Basic CRUD) | ✅ **Implemented** | Minor enhancements |
| Polls (Edit/Delete) | ❌ **Missing** | Add admin endpoints |

---

## 🔄 Endpoint Mapping

### Prayer Wall API

#### ✅ **IMPLEMENTED** - Can be adapted

| Frontend Expects | Current Backend | Action Required |
|------------------|-----------------|----------------|
| `POST /api/community/prayer-wall/create` | `POST /api/community/prayer-wall/posts` | ✅ **Route exists** - Update request body format |
| `GET /api/community/prayer-wall` | `GET /api/community/prayer-wall/posts` | ✅ **Route exists** - Enhance response format |
| `PUT /api/community/prayer-wall/{id}` | `PUT /api/community/prayer-wall/posts/:id` | ✅ **Route exists** - Update logic |
| `DELETE /api/community/prayer-wall/{id}` | `DELETE /api/community/prayer-wall/posts/:id` | ✅ **Route exists** - No changes needed |

#### ❌ **MISSING** - Needs to be created

| Frontend Expects | Current Backend | Action Required |
|------------------|-----------------|----------------|
| `GET /api/community/prayer-wall/search` | ❌ None | 🔨 **Create new endpoint** - Adapt AI search service |
| `POST /api/community/prayer-wall/{id}/like` | ❌ None | 🔨 **Create new endpoint** - Use interaction system |
| `GET /api/community/prayer-wall/{id}/comments` | ❌ None | 🔨 **Create new endpoint** - Use interaction system |
| `POST /api/community/prayer-wall/{id}/comments` | ❌ None | 🔨 **Create new endpoint** - Use interaction system |

#### 📊 **Data Model Differences**

**Frontend Expects:**
```typescript
{
  prayerText: string;
  verse?: { text: string; reference: string };
  color: string;  // Hex color
  shape: string;   // "rectangle" | "circle" | "scalloped" | "square" | ...
  likesCount: number;
  commentsCount: number;
  userLiked?: boolean;
  author: { ... };
}
```

**Current Backend Has:**
```typescript
{
  content: string;
  anonymous?: boolean;
  media?: string[];
  authorId: ObjectId;
  // Missing: verse, color, shape, likesCount, commentsCount
}
```

**Required Changes:**
1. ✅ Update `PrayerPost` model to include: `verse`, `color`, `shape`
2. ✅ Add `likesCount` and `commentsCount` fields (or calculate dynamically)
3. ✅ Update serializer to include `userLiked` flag
4. ✅ Update controller to accept new fields

---

### Forum API

#### ⚠️ **ARCHITECTURE MISMATCH** - Needs restructuring

The frontend expects a **two-level structure** (Forum → Posts), but the backend currently has a **single-level structure** (ForumThreads).

**Frontend Expects:**
```
Forum (Admin creates)
  └── Posts (Users create in forum)
      └── Comments (Nested replies)
```

**Current Backend Has:**
```
ForumThread (User creates)
  └── (No forum entity, no comments)
```

#### ✅ **IMPLEMENTED** - Can be adapted

| Frontend Expects | Current Backend | Action Required |
|------------------|-----------------|----------------|
| `POST /api/community/forum/threads` | `POST /api/community/forum/threads` | ✅ **Route exists** - Update to match Forum Post format |
| `GET /api/community/forum/threads` | `GET /api/community/forum/threads` | ✅ **Route exists** - Restructure response |

#### ❌ **MISSING** - Needs to be created

| Frontend Expects | Current Backend | Action Required |
|------------------|-----------------|----------------|
| `POST /api/community/forum/create` | ❌ None | 🔨 **Create Forum model** - Admin-only endpoint |
| `GET /api/community/forum` | ❌ None | 🔨 **Create endpoint** - List forums |
| `GET /api/community/forum/{forumId}/posts` | ❌ None | 🔨 **Restructure** - Forum threads → Forum posts |
| `POST /api/community/forum/{forumId}/posts` | ❌ None | 🔨 **Restructure** - Create posts within forums |
| `POST /api/community/forum/posts/{postId}/like` | ❌ None | 🔨 **Create endpoint** - Use interaction system |
| `GET /api/community/forum/posts/{postId}/comments` | ❌ None | 🔨 **Create endpoint** - Use interaction system |
| `POST /api/community/forum/posts/{postId}/comments` | ❌ None | 🔨 **Create endpoint** - Use interaction system |
| `POST /api/community/forum/comments/{commentId}/like` | ❌ None | 🔨 **Create endpoint** - Use interaction system |

#### 📊 **Data Model Differences**

**Frontend Expects - Forum Entity:**
```typescript
{
  _id: string;
  title: string;
  description: string;
  createdBy: string;  // Admin
  postsCount: number;
  participantsCount: number;
}
```

**Frontend Expects - Forum Post:**
```typescript
{
  _id: string;
  forumId: string;
  userId: string;
  content: string;
  embeddedLinks?: Array<{
    url: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    type: "video" | "article" | "resource" | "other";
  }>;
  likesCount: number;
  commentsCount: number;
  userLiked?: boolean;
}
```

**Current Backend Has:**
```typescript
{
  _id: string;
  title: string;
  body: string;
  tags?: string[];
  authorId: ObjectId;
  // Missing: forumId, embeddedLinks, likesCount, commentsCount
}
```

**Required Changes:**
1. 🔨 Create new `Forum` model (admin-created)
2. 🔨 Update `ForumThread` → `ForumPost` model (add forumId, embeddedLinks)
3. 🔨 Add likesCount and commentsCount fields

---

### Groups API

#### ✅ **MOSTLY IMPLEMENTED** - Minor enhancements needed

| Frontend Expects | Current Backend | Action Required |
|------------------|-----------------|----------------|
| `POST /api/community/groups/create` | `POST /api/community/groups` | ✅ **Route exists** - Add image upload support |
| `GET /api/community/groups/my-groups` | `GET /api/community/groups?mine=true` | ✅ **Query param exists** - Update response format |
| `GET /api/community/groups/explore` | `GET /api/community/groups` | ✅ **Route exists** - Add search/sort params |
| `GET /api/community/groups/{id}` | `GET /api/community/groups/:id` | ✅ **Route exists** - Enhance response |
| `PUT /api/community/groups/{id}` | `PUT /api/community/groups/:id` | ✅ **Route exists** - Add image update |
| `DELETE /api/community/groups/{id}` | `DELETE /api/community/groups/:id` | ✅ **Route exists** - No changes needed |
| `POST /api/community/groups/{id}/join` | `POST /api/community/groups/:id/join` | ✅ **Route exists** - No changes needed |
| `POST /api/community/groups/{id}/leave` | `POST /api/community/groups/:id/leave` | ✅ **Route exists** - No changes needed |

#### ❌ **MISSING** - Needs to be created

| Frontend Expects | Current Backend | Action Required |
|------------------|-----------------|----------------|
| `POST /api/community/groups/{id}/members` | ❌ None | 🔨 **Create endpoint** - Add members to group |
| `DELETE /api/community/groups/{id}/members/{userId}` | ❌ None | 🔨 **Create endpoint** - Remove member |

#### 📊 **Data Model Differences**

**Frontend Expects:**
```typescript
{
  name: string;
  description: string;
  profileImageUrl?: string;  // NEW
  createdBy: string;
  isPublic: boolean;  // Current: visibility: "public" | "private"
  membersCount: number;
  members: Array<{
    userId: string;
    role: "admin" | "member";  // NEW
    joinedAt: string;
    user: { ... };
  }>;
}
```

**Current Backend Has:**
```typescript
{
  name: string;
  description: string;
  visibility: "public" | "private";  // Different from isPublic boolean
  ownerId: ObjectId;
  members: Array<{
    userId: ObjectId;
    joinedAt: Date;
    // Missing: role
  }>;
  // Missing: profileImageUrl
}
```

**Required Changes:**
1. ✅ Add `profileImageUrl` field to Group model
2. ✅ Add `role` field to members (default: "member", owner: "admin")
3. ✅ Update serializer to map `visibility` → `isPublic`
4. ✅ Add image upload middleware/controller

---

### Polls API

#### ✅ **MOSTLY IMPLEMENTED** - Minor enhancements needed

| Frontend Expects | Current Backend | Action Required |
|------------------|-----------------|----------------|
| `POST /api/community/polls/create` | `POST /api/community/polls` | ✅ **Route exists** - Add admin check, update request format |
| `GET /api/community/polls` | `GET /api/community/polls` | ✅ **Route exists** - Enhance response format |
| `GET /api/community/polls/{id}` | `GET /api/community/polls/:id` | ✅ **Route exists** - Enhance response format |
| `POST /api/community/polls/{id}/vote` | `POST /api/community/polls/:id/votes` | ✅ **Route exists** - Update request format (optionId vs optionIndex) |

#### ❌ **MISSING** - Needs to be created

| Frontend Expects | Current Backend | Action Required |
|------------------|-----------------|----------------|
| `PUT /api/community/polls/{id}` | ❌ None | 🔨 **Create endpoint** - Admin-only, update poll |
| `DELETE /api/community/polls/{id}` | ❌ None | 🔨 **Create endpoint** - Admin-only, delete poll |

#### 📊 **Data Model Differences**

**Frontend Expects:**
```typescript
{
  _id: string;
  title: string;  // Current: question
  description?: string;  // NEW
  createdBy: string;
  options: Array<{
    _id: string;  // NEW - Each option needs ID
    text: string;
    votesCount: number;
    percentage: number;  // Calculated
  }>;
  totalVotes: number;
  expiresAt?: string;  // Current: closesAt
  isActive: boolean;
  userVoted?: boolean;
  userVoteOptionId?: string;  // NEW
  createdByUser: { ... };
}
```

**Current Backend Has:**
```typescript
{
  _id: string;
  question: string;  // Different from "title"
  options: string[];  // Simple array, no IDs
  multiSelect?: boolean;
  closesAt?: Date;  // Different from "expiresAt"
  authorId: ObjectId;
  votes: Array<{
    userId: ObjectId;
    optionIndexes: number[];  // Different from optionId
    votedAt: Date;
  }>;
  // Missing: description, isActive, userVoted, userVoteOptionId
}
```

**Required Changes:**
1. ✅ Consider renaming `question` → `title` OR update serializer to map it
2. ✅ Add `description` field to Poll model
3. ✅ Add `isActive` computed field (based on expiresAt/closesAt)
4. ✅ Update serializer to include option IDs, percentages, userVoted flag
5. ✅ Update vote endpoint to accept `optionId` instead of `optionIndex` (or keep both)

---

## 🛠️ Implementation Priority

### Phase 1: Quick Wins (Adapt Existing) ⚡
**Estimated Time: 2-3 days**

1. **Prayer Wall Enhancements**
   - [ ] Update PrayerPost model (add verse, color, shape)
   - [ ] Update prayer endpoints request/response format
   - [ ] Add likes/comments endpoints (use existing interaction system)

2. **Groups Enhancements**
   - [ ] Add profileImageUrl field
   - [ ] Add member roles
   - [ ] Add image upload endpoint
   - [ ] Update response format (visibility → isPublic)

3. **Polls Enhancements**
   - [ ] Add description field
   - [ ] Update response format (include percentages, userVoted)
   - [ ] Add admin-only edit/delete endpoints

### Phase 2: New Features (Use Existing Systems) 🚀
**Estimated Time: 3-4 days**

1. **Prayer Wall Search**
   - [ ] Create search endpoint
   - [ ] Adapt AIBibleSearchService for prayer search
   - [ ] Add relevance scoring

2. **Forum Restructure**
   - [ ] Create Forum model (admin-created)
   - [ ] Restructure ForumThread → ForumPost
   - [ ] Add embedded links support
   - [ ] Add likes/comments endpoints

3. **Groups Member Management**
   - [ ] Add members endpoint (bulk add)
   - [ ] Add remove member endpoint

### Phase 3: Integration & Testing 🧪
**Estimated Time: 2-3 days**

1. **Integration**
   - [ ] Connect all endpoints to existing interaction system
   - [ ] Add proper error handling
   - [ ] Add pagination consistently
   - [ ] Add rate limiting

2. **Testing**
   - [ ] Test all endpoints
   - [ ] Verify response formats match frontend expectations
   - [ ] Performance testing

---

## 📝 Detailed Implementation Guide

### Prayer Wall Implementation

#### 1. Update PrayerPost Model

```typescript
// src/models/prayerPost.model.ts
export interface IPrayerPost {
  content: string;  // Keep for backward compatibility
  prayerText?: string;  // New - alias for content
  verse?: {
    text: string;
    reference: string;
  };
  color: string;  // Hex color code
  shape: string;  // "rectangle" | "circle" | "scalloped" | "square" | "square2" | "square3" | "square4"
  anonymous?: boolean;
  media?: string[];
  authorId: mongoose.Types.ObjectId;
  likesCount?: number;  // Denormalized count
  commentsCount?: number;  // Denormalized count
  createdAt?: Date;
  updatedAt?: Date;
}
```

#### 2. Create Prayer Interaction Endpoints

Use the existing `ContentInteractionService` but extend it for community content:

```typescript
// src/controllers/prayerInteraction.controller.ts
import { ContentInteractionService } from "../service/contentInteraction.service";

export const likePrayer = async (req: Request, res: Response) => {
  const prayerId = req.params.id;
  const userId = req.userId;
  
  // Use existing interaction service
  const result = await contentInteractionService.toggleLike(
    userId,
    prayerId,
    "prayer"  // New content type
  );
  
  res.json({ success: true, data: result });
};

export const commentOnPrayer = async (req: Request, res: Response) => {
  const prayerId = req.params.id;
  const userId = req.userId;
  const { content, parentCommentId } = req.body;
  
  const comment = await contentInteractionService.addComment(
    userId,
    prayerId,
    "prayer",
    content,
    parentCommentId
  );
  
  res.json({ success: true, data: comment });
};
```

#### 3. Create Prayer Search Endpoint

Adapt the existing AI search service:

```typescript
// src/controllers/prayerSearch.controller.ts
import aiBibleSearchService from "../service/aiBibleSearch.service";

export const searchPrayers = async (req: Request, res: Response) => {
  const { query, page = 1, limit = 20 } = req.query;
  
  // Use AI to analyze query
  const aiAnalysis = await aiBibleSearchService.analyzeQuery(query);
  
  // Search prayers by semantic meaning
  const prayers = await PrayerPost.find({
    $or: [
      { content: { $regex: query, $options: "i" } },
      { "verse.text": { $regex: query, $options: "i" } },
      { "verse.reference": { $regex: query, $options: "i" } }
    ]
  })
  .populate("authorId")
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);
  
  // Calculate relevance scores (simplified)
  const results = prayers.map(prayer => ({
    ...serialize(prayer),
    relevanceScore: calculateRelevance(prayer, query, aiAnalysis)
  }));
  
  res.json({ success: true, data: { prayers: results, pagination: {...} } });
};
```

### Forum Implementation

#### 1. Create Forum Model

```typescript
// src/models/forum.model.ts
export interface IForum {
  title: string;
  description: string;
  createdBy: mongoose.Types.ObjectId;  // Admin
  isActive: boolean;
  postsCount?: number;  // Denormalized
  participantsCount?: number;  // Denormalized
  createdAt?: Date;
  updatedAt?: Date;
}
```

#### 2. Update ForumThread → ForumPost Model

```typescript
// src/models/forumPost.model.ts
export interface IForumPost {
  forumId: mongoose.Types.ObjectId;  // Reference to Forum
  userId: mongoose.Types.ObjectId;
  content: string;  // Renamed from "body"
  embeddedLinks?: Array<{
    url: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    type: "video" | "article" | "resource" | "other";
  }>;
  tags?: string[];
  likesCount?: number;
  commentsCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
```

#### 3. Create Migration Script

```typescript
// scripts/migrate-forum-threads.ts
// Migrate existing ForumThreads to ForumPosts
// Create a default Forum for existing threads
```

### Groups Implementation

#### 1. Update Group Model

```typescript
// src/models/group.model.ts
export interface IGroup {
  name: string;
  description: string;
  profileImageUrl?: string;  // NEW
  visibility: "public" | "private";
  ownerId: mongoose.Types.ObjectId;
  members: Array<{
    userId: mongoose.Types.ObjectId;
    role: "admin" | "member";  // NEW - default: "member"
    joinedAt: Date;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}
```

#### 2. Add Image Upload Support

Use existing file upload service:

```typescript
// src/controllers/groupImage.controller.ts
import { uploadToCloudStorage } from "../utils/fileUpload.service";

export const uploadGroupImage = async (req: Request, res: Response) => {
  const file = req.file;  // Multer middleware
  const groupId = req.params.id;
  
  const imageUrl = await uploadToCloudStorage(file, `groups/${groupId}`);
  
  const group = await Group.findByIdAndUpdate(
    groupId,
    { profileImageUrl: imageUrl },
    { new: true }
  );
  
  res.json({ success: true, data: group });
};
```

### Polls Implementation

#### 1. Update Poll Model

```typescript
// src/models/poll.model.ts
export interface IPoll {
  title: string;  // Keep "question" for backward compatibility
  question?: string;  // Alias
  description?: string;  // NEW
  options: string[];  // Keep simple, but add IDs in serializer
  multiSelect?: boolean;
  closesAt?: Date;
  expiresAt?: Date;  // Alias for closesAt
  authorId: mongoose.Types.ObjectId;
  votes: IPollVote[];
  createdAt?: Date;
  updatedAt?: Date;
}
```

#### 2. Update Poll Serializer

```typescript
function serializePoll(poll: IPollDocument, userId?: string) {
  const obj = poll.toObject();
  
  // Calculate percentages
  const totalVotes = poll.votes.length;
  const optionsWithStats = poll.options.map((text, index) => {
    const votesCount = poll.votes.filter(v => 
      v.optionIndexes.includes(index)
    ).length;
    const percentage = totalVotes > 0 
      ? Math.round((votesCount / totalVotes) * 100) 
      : 0;
    
    return {
      _id: `${poll._id}_${index}`,  // Generate option ID
      text,
      votesCount,
      percentage
    };
  });
  
  // Check if user voted
  const userVote = userId 
    ? poll.votes.find(v => String(v.userId) === String(userId))
    : null;
  
  return {
    _id: obj._id,
    title: obj.question || obj.title,
    question: obj.question,
    description: obj.description,
    options: optionsWithStats,
    totalVotes,
    expiresAt: obj.closesAt,
    closesAt: obj.closesAt,
    isActive: !obj.closesAt || obj.closesAt > new Date(),
    userVoted: !!userVote,
    userVoteOptionId: userVote 
      ? `${poll._id}_${userVote.optionIndexes[0]}`
      : undefined,
    createdBy: obj.authorId,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
}
```

---

## 🔌 Integration with Existing Systems

### Using Existing Interaction System

The backend already has a robust `ContentInteractionService` for likes and comments. Extend it for community content:

```typescript
// Extend ContentInteractionService to support community content types
const contentTypes = [
  "media",
  "devotional",
  "prayer",      // NEW
  "forumPost",   // NEW
  "forumComment" // NEW
];
```

### Using Existing AI Services

The `AIBibleSearchService` can be adapted for prayer search:

```typescript
// Create new service: PrayerSearchService
// Reuse AI query analysis logic
// Adapt scoring for prayer content
```

### Using Existing File Upload

The existing file upload service can handle group images:

```typescript
// Use existing uploadToCloudStorage function
// Add validation for image types/sizes
```

---

## 🎯 Response Format Standardization

All endpoints should follow this format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### List Response with Pagination
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasMore": true
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

---

## ✅ Testing Checklist

### Prayer Wall
- [ ] Create prayer with verse, color, shape
- [ ] List prayers with pagination
- [ ] Search prayers with AI
- [ ] Like/unlike prayer
- [ ] Comment on prayer
- [ ] Get prayer comments
- [ ] Update prayer
- [ ] Delete prayer

### Forum
- [ ] Create forum (admin)
- [ ] List forums
- [ ] Create post in forum
- [ ] List posts in forum
- [ ] Like/unlike post
- [ ] Comment on post
- [ ] Nested replies
- [ ] Like/unlike comment

### Groups
- [ ] Create group with image
- [ ] List my groups
- [ ] Explore public groups
- [ ] Get group details
- [ ] Add members to group
- [ ] Join group
- [ ] Leave group
- [ ] Update group
- [ ] Delete group

### Polls
- [ ] Create poll (admin)
- [ ] List polls
- [ ] Get poll details
- [ ] Vote on poll
- [ ] Update poll (admin)
- [ ] Delete poll (admin)

---

## 📚 Additional Notes

### Backward Compatibility
- Keep existing field names where possible (`question` alongside `title`)
- Use serializers to map old → new format
- Support both old and new endpoints during transition

### Performance Considerations
- Index frequently queried fields
- Cache popular prayers/posts
- Use denormalized counts (likesCount, commentsCount)
- Paginate all list endpoints

### Security
- Validate all inputs
- Sanitize user-generated content
- Rate limit sensitive endpoints
- Check permissions for admin operations

---

## 🚀 Next Steps

1. **Review this document** with the team
2. **Prioritize features** based on frontend needs
3. **Create implementation tickets** for each phase
4. **Start with Phase 1** (Quick Wins)
5. **Test incrementally** with frontend team

---

**Questions or Clarifications?**  
Please refer to the frontend code in the specified screens or reach out to the backend team.

