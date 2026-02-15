# Comment System API - Frontend Integration Guide

**Last Updated:** January 2025  
**Status:** ✅ Ready for Production  
**API Base URL:** `/api/content` and `/api/comments`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [GET Comments (Public Endpoint)](#1-get-comments-public-endpoint)
4. [POST Create Comment (Authenticated)](#2-post-create-comment-authenticated)
5. [POST Like Comment (Authenticated)](#3-post-like-comment-authenticated)
6. [DELETE Comment (Authenticated)](#4-delete-comment-authenticated)
7. [Real-time Updates (Socket.io)](#real-time-updates-socketio)
8. [Error Handling](#error-handling)
9. [Complete Example Implementation](#complete-example-implementation)

---

## Overview

The Jevah app comment system supports:
- ✅ **Public viewing** - Comments can be viewed without authentication (like Instagram/Facebook)
- ✅ **Authenticated actions** - Creating comments, liking, and deleting requires authentication
- ✅ **Nested replies** - One level deep (comment → reply)
- ✅ **Real-time updates** - Socket.io integration for live comment feeds
- ✅ **Pagination** - Efficient loading with page-based pagination
- ✅ **Sorting** - Sort by newest, oldest, or top (most liked/replied)

**Content Types Supported:**
- `media` - Videos, audio content
- `devotional` - Devotional articles
- `ebook` - E-book content

---

## Authentication

### Public Endpoints (No Auth Required)
- `GET /api/content/:contentType/:contentId/comments` - Viewing comments

### Authenticated Endpoints (Auth Required)
- `POST /api/comments` - Creating comments
- `POST /api/comments/:commentId/like` - Liking/unliking comments
- `DELETE /api/comments/:commentId` - Deleting comments
- `PUT /api/comments/:commentId` - Updating comments (optional)

### Authentication Header Format
```typescript
Headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'expo-platform': 'ios' | 'android' // Optional but recommended
}
```

**Token Storage:**
- Store JWT token in AsyncStorage (React Native) or localStorage (Web)
- Key: `userToken` or `token` (both are supported)

---

## 1. GET Comments (Public Endpoint)

**Endpoint:** `GET /api/content/:contentType/:contentId/comments`

**Authentication:** ❌ **NOT REQUIRED** (Public endpoint)

**Description:**  
Fetches paginated comments for a piece of content. Works **without authentication**, but if a token is provided, includes `isLiked` status for each comment.

### Request

```typescript
GET /api/content/media/64f8abcdef1234567890abcd/comments?page=1&limit=20&sortBy=newest
```

**URL Parameters:**
- `contentType` (string, required): `"media"` | `"devotional"` | `"ebook"`
- `contentId` (string, required): MongoDB ObjectId of the content

**Query Parameters:**
- `page` (number, optional): Page number (1-based, default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `sortBy` (string, optional): `"newest"` | `"oldest"` | `"top"` (default: "newest")

**Headers (Optional):**
```typescript
// If you want isLiked status, include token:
{
  'Authorization': `Bearer ${token}` // Optional
}
```

### Response (200 OK)

```typescript
{
  success: true,
  data: {
    comments: [
      {
        _id: "64fa1234567890abcdef1234",
        id: "64fa1234567890abcdef1234", // Alias
        contentId: "64f8abcdef1234567890abcd",
        contentType: "media", // Optional field
        content: "This blessed me so much 🙏",
        comment: "This blessed me so much 🙏", // Alias
        userId: "64f7user1234567890abcdef",
        user: {
          _id: "64f7user1234567890abcdef",
          id: "64f7user1234567890abcdef",
          firstName: "John",
          lastName: "Doe",
          avatar: "https://cdn.jevahapp.com/avatars/user123.jpg",
          username: "john_doe"
        },
        likesCount: 5,
        likes: 5, // Alias
        isLiked: false, // true if token provided and user liked it
        createdAt: "2025-01-20T10:30:00.000Z",
        timestamp: "2025-01-20T10:30:00.000Z", // Alias
        parentCommentId: null, // null for top-level comments
        replyCount: 2,
        replies: [
          {
            _id: "64fb9876543210fedcba9876",
            id: "64fb9876543210fedcba9876",
            content: "Amen! 🙌",
            comment: "Amen! 🙌",
            userId: "64f7user9876543210fedcba",
            user: {
              _id: "64f7user9876543210fedcba",
              id: "64f7user9876543210fedcba",
              firstName: "Mary",
              lastName: "Smith",
              avatar: "https://cdn.jevahapp.com/avatars/mary.jpg",
              username: "mary_smith"
            },
            likesCount: 2,
            likes: 2,
            isLiked: false,
            createdAt: "2025-01-20T10:35:00.000Z",
            timestamp: "2025-01-20T10:35:00.000Z",
            parentCommentId: "64fa1234567890abcdef1234",
            replyCount: 0,
            replies: [] // Nested replies not supported (one level only)
          }
        ]
      }
    ],
    total: 37, // Total comments including replies
    totalComments: 37, // Alias
    hasMore: true, // Whether more pages are available
    page: 1,
    limit: 20
  }
}
```

### TypeScript Interface

```typescript
interface Comment {
  _id: string;
  id: string; // Alias for _id
  contentId: string;
  contentType?: string;
  content: string;
  comment: string; // Alias for content
  userId: string;
  user: {
    _id: string;
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    username: string;
  };
  likesCount: number;
  likes: number; // Alias for likesCount
  isLiked: boolean; // false if no token, true/false if token provided
  createdAt: string; // ISO 8601 date string
  timestamp: string; // Alias for createdAt
  parentCommentId: string | null;
  replyCount: number;
  replies: Comment[]; // Nested replies (one level deep)
}

interface GetCommentsResponse {
  success: true;
  data: {
    comments: Comment[];
    total: number;
    totalComments: number; // Alias
    hasMore: boolean;
    page: number;
    limit: number;
  };
}
```

### Frontend Implementation Example

```typescript
// TypeScript/React Native Example
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GetCommentsParams {
  contentType: 'media' | 'devotional' | 'ebook';
  contentId: string;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'top';
}

async function getComments(params: GetCommentsParams): Promise<GetCommentsResponse> {
  const { contentType, contentId, page = 1, limit = 20, sortBy = 'newest' } = params;
  
  // Get token (optional - comments work without it)
  const token = await AsyncStorage.getItem('userToken') || 
                await AsyncStorage.getItem('token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Include token if available (for isLiked status)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
  });
  
  const url = `${API_BASE_URL}/content/${contentType}/${contentId}/comments?${queryParams}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid request');
    }
    if (response.status === 404) {
      throw new Error('Content not found');
    }
    throw new Error('Failed to fetch comments');
  }
  
  return await response.json();
}

// Usage
try {
  const result = await getComments({
    contentType: 'media',
    contentId: '64f8abcdef1234567890abcd',
    page: 1,
    limit: 20,
    sortBy: 'newest',
  });
  
  console.log(`Loaded ${result.data.comments.length} comments`);
  console.log(`Total: ${result.data.total}, Has more: ${result.data.hasMore}`);
} catch (error) {
  console.error('Error fetching comments:', error);
}
```

### Important Notes

1. **No Authentication Required:** This endpoint works **without a token**. If no token is provided, all comments will have `isLiked: false`.

2. **isLiked Field:** 
   - If **no token** provided → `isLiked: false` for all comments
   - If **token provided** → `isLiked: true/false` based on user's like status

3. **Nested Replies:** Replies are included in the `replies` array of each top-level comment. Maximum nesting depth is **one level** (comment → reply, no replies to replies).

4. **Pagination:** 
   - `hasMore` indicates if more comments are available
   - `total` includes both top-level comments and replies
   - Pagination is based on top-level comments only

5. **Sorting:**
   - `"newest"` - Most recent first (default)
   - `"oldest"` - Oldest first
   - `"top"` - Highest engagement (likes + replies) first

---

## 2. POST Create Comment (Authenticated)

**Endpoint:** `POST /api/comments`

**Authentication:** ✅ **REQUIRED** (Bearer token)

**Description:**  
Creates a new comment on a piece of content. Can be a top-level comment or a reply to an existing comment.

### Request

```typescript
POST /api/comments
```

**Headers:**
```typescript
{
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'expo-platform': 'ios' | 'android' // Optional
}
```

**Request Body:**
```typescript
{
  contentId: "64f8abcdef1234567890abcd", // Required: MongoDB ObjectId
  contentType: "media", // Required: "media" | "devotional" | "ebook"
  content: "This blessed me so much 🙏", // Required: Comment text (max 1000 chars)
  parentCommentId: null // Optional: null for top-level, ObjectId for reply
}
```

### Response (201 Created)

```typescript
{
  success: true,
  message: "Comment created successfully",
  data: {
    _id: "64fa1234567890abcdef1234",
    id: "64fa1234567890abcdef1234",
    contentId: "64f8abcdef1234567890abcd",
    contentType: "media",
    content: "This blessed me so much 🙏",
    comment: "This blessed me so much 🙏", // Alias
    userId: "64f7user1234567890abcdef",
    user: {
      _id: "64f7user1234567890abcdef",
      id: "64f7user1234567890abcdef",
      firstName: "John",
      lastName: "Doe",
      avatar: "https://cdn.jevahapp.com/avatars/user123.jpg",
      username: "john_doe"
    },
    likesCount: 0,
    likes: 0,
    isLiked: false,
    createdAt: "2025-01-20T10:30:00.000Z",
    timestamp: "2025-01-20T10:30:00.000Z",
    parentCommentId: null, // null for top-level, ObjectId for replies
    replyCount: 0,
    replies: []
  }
}
```

### TypeScript Interface

```typescript
interface CreateCommentRequest {
  contentId: string; // MongoDB ObjectId
  contentType: 'media' | 'devotional' | 'ebook';
  content: string; // Max 1000 characters
  parentCommentId?: string | null; // Optional: ObjectId of parent comment for replies
}

interface CreateCommentResponse {
  success: true;
  message: string;
  data: Comment; // Same Comment interface as GET response
}
```

### Frontend Implementation Example

```typescript
async function createComment(params: CreateCommentRequest): Promise<CreateCommentResponse> {
  const token = await AsyncStorage.getItem('userToken') || 
                await AsyncStorage.getItem('token');
  
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }
  
  // Validation
  if (!params.content || params.content.trim().length === 0) {
    throw new Error('Comment content cannot be empty');
  }
  
  if (params.content.trim().length > 1000) {
    throw new Error('Comment must be less than 1000 characters');
  }
  
  const response = await fetch(`${API_BASE_URL}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentId: params.contentId,
      contentType: params.contentType,
      content: params.content.trim(),
      parentCommentId: params.parentCommentId || null,
    }),
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required. Please log in.');
    }
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid request');
    }
    if (response.status === 404) {
      throw new Error('Content or parent comment not found');
    }
    throw new Error('Failed to create comment');
  }
  
  return await response.json();
}

// Usage - Top-level comment
try {
  const result = await createComment({
    contentId: '64f8abcdef1234567890abcd',
    contentType: 'media',
    content: 'This blessed me so much 🙏',
    parentCommentId: null, // Top-level comment
  });
  
  console.log('Comment created:', result.data.id);
} catch (error) {
  console.error('Error creating comment:', error);
}

// Usage - Reply to comment
try {
  const result = await createComment({
    contentId: '64f8abcdef1234567890abcd',
    contentType: 'media',
    content: 'Amen! 🙌',
    parentCommentId: '64fa1234567890abcdef1234', // Reply to this comment
  });
  
  console.log('Reply created:', result.data.id);
} catch (error) {
  console.error('Error creating reply:', error);
}
```

### Optimistic UI Pattern

```typescript
// React/React Native Example with Optimistic Updates
function CommentForm({ contentId, contentType, parentCommentId, onSuccess }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    // Optimistic update: Create temporary comment immediately
    const tempComment = {
      _id: `temp-${Date.now()}`,
      id: `temp-${Date.now()}`,
      contentId,
      contentType,
      content: content.trim(),
      userId: currentUser.id,
      user: currentUser,
      likesCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      parentCommentId: parentCommentId || null,
      replyCount: 0,
      replies: [],
    };
    
    // Add to UI immediately
    onSuccess(tempComment, true); // true = isOptimistic
    
    setIsSubmitting(true);
    
    try {
      // Create comment on server
      const result = await createComment({
        contentId,
        contentType,
        content: content.trim(),
        parentCommentId: parentCommentId || null,
      });
      
      // Replace optimistic comment with real one
      onSuccess(result.data, false); // false = isReal
      
      setContent(''); // Clear form
    } catch (error) {
      // Remove optimistic comment on error
      onSuccess(tempComment, 'error');
      alert(error.message || 'Failed to create comment');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <View>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Write a comment..."
        multiline
        maxLength={1000}
      />
      <Button
        title="Post"
        onPress={handleSubmit}
        disabled={isSubmitting || !content.trim()}
      />
    </View>
  );
}
```

### Important Notes

1. **Authentication Required:** This endpoint **requires** a valid JWT token.

2. **Content Validation:**
   - Must not be empty (whitespace-only comments are rejected)
   - Maximum length: 1000 characters
   - Content is automatically trimmed

3. **Parent Comment:**
   - Set `parentCommentId: null` for top-level comments
   - Set `parentCommentId: "<commentId>"` to create a reply
   - Parent comment must exist and belong to the same content

4. **Real-time Updates:** 
   - Socket.io event `content:comment` is emitted automatically
   - Frontend should listen for this event to update UI (see Socket.io section)

5. **Comment Count:** 
   - Comment count on content is automatically incremented
   - No need to manually update counters

---

## 3. POST Like Comment (Authenticated)

**Endpoint:** `POST /api/comments/:commentId/like`

**Authentication:** ✅ **REQUIRED** (Bearer token)

**Description:**  
Toggles the like status on a comment. If the user hasn't liked it, adds a like. If already liked, removes the like (unlike).

### Request

```typescript
POST /api/comments/64fa1234567890abcdef1234/like
```

**URL Parameters:**
- `commentId` (string, required): MongoDB ObjectId of the comment

**Headers:**
```typescript
{
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Response (200 OK)

```typescript
{
  success: true,
  message: "Comment liked" | "Comment unliked",
  data: {
    liked: true, // Current like status after toggle
    likesCount: 6, // Updated total likes count
    totalLikes: 6 // Alias for likesCount
  }
}
```

### TypeScript Interface

```typescript
interface LikeCommentResponse {
  success: true;
  message: string;
  data: {
    liked: boolean; // Current like status
    likesCount: number; // Total likes count
    totalLikes: number; // Alias
  };
}
```

### Frontend Implementation Example

```typescript
async function toggleCommentLike(commentId: string): Promise<LikeCommentResponse> {
  const token = await AsyncStorage.getItem('userToken') || 
                await AsyncStorage.getItem('token');
  
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }
  
  const response = await fetch(`${API_BASE_URL}/comments/${commentId}/like`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required. Please log in.');
    }
    if (response.status === 404) {
      throw new Error('Comment not found');
    }
    throw new Error('Failed to toggle like');
  }
  
  return await response.json();
}

// Usage with Optimistic UI
function CommentLikeButton({ comment, onUpdate }) {
  const [isLiked, setIsLiked] = useState(comment.isLiked);
  const [likesCount, setLikesCount] = useState(comment.likesCount);
  const [isToggling, setIsToggling] = useState(false);
  
  const handleLike = async () => {
    // Optimistic update
    const newLiked = !isLiked;
    const newCount = newLiked ? likesCount + 1 : likesCount - 1;
    
    setIsLiked(newLiked);
    setLikesCount(newCount);
    setIsToggling(true);
    
    try {
      const result = await toggleCommentLike(comment.id);
      
      // Update with server response
      setIsLiked(result.data.liked);
      setLikesCount(result.data.likesCount);
      
      // Notify parent component
      onUpdate?.(comment.id, result.data);
    } catch (error) {
      // Rollback on error
      setIsLiked(!newLiked);
      setLikesCount(likesCount);
      alert(error.message || 'Failed to toggle like');
    } finally {
      setIsToggling(false);
    }
  };
  
  return (
    <TouchableOpacity onPress={handleLike} disabled={isToggling}>
      <Text>{isLiked ? '❤️' : '🤍'}</Text>
      <Text>{likesCount}</Text>
    </TouchableOpacity>
  );
}
```

### Important Notes

1. **Toggle Behavior:** This endpoint **toggles** the like status. If already liked, it unlikes. If not liked, it likes.

2. **Real-time Updates:** Socket.io event `content:comment` with `action: "liked"` is emitted automatically.

3. **Idempotent:** Multiple calls with the same state are safe (won't cause duplicates).

---

## 4. DELETE Comment (Authenticated)

**Endpoint:** `DELETE /api/comments/:commentId`

**Authentication:** ✅ **REQUIRED** (Bearer token)

**Description:**  
Deletes a comment. Only the comment owner can delete their own comments.

### Request

```typescript
DELETE /api/comments/64fa1234567890abcdef1234
```

**URL Parameters:**
- `commentId` (string, required): MongoDB ObjectId of the comment

**Headers:**
```typescript
{
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Response (200 OK)

```typescript
{
  success: true,
  message: "Comment deleted successfully"
}
```

### Frontend Implementation Example

```typescript
async function deleteComment(commentId: string): Promise<void> {
  const token = await AsyncStorage.getItem('userToken') || 
                await AsyncStorage.getItem('token');
  
  if (!token) {
    throw new Error('Authentication required. Please log in.');
  }
  
  const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required. Please log in.');
    }
    if (response.status === 403) {
      throw new Error('You can only delete your own comments');
    }
    if (response.status === 404) {
      throw new Error('Comment not found');
    }
    throw new Error('Failed to delete comment');
  }
  
  return await response.json();
}

// Usage
try {
  await deleteComment('64fa1234567890abcdef1234');
  console.log('Comment deleted successfully');
  // Remove from UI
  removeCommentFromList('64fa1234567890abcdef1234');
} catch (error) {
  console.error('Error deleting comment:', error);
  alert(error.message || 'Failed to delete comment');
}
```

### Important Notes

1. **Ownership Required:** Only the comment owner can delete their own comments.

2. **Soft Delete:** Comments are soft-deleted (marked as removed, not physically deleted).

3. **Comment Count:** Comment count on content is automatically decremented.

4. **Real-time Updates:** Socket.io event `content:comment` with `action: "deleted"` is emitted automatically.

---

## Real-time Updates (Socket.io)

The backend emits Socket.io events for real-time comment updates. Frontend should listen to these events to update the UI automatically.

### Socket.io Room Structure

Join room when user opens comment modal:
```
Room: "content:{contentType}:{contentId}"
```

Example: `"content:media:64f8abcdef1234567890abcd"`

### Events to Listen For

#### 1. Comment Created/Updated/Deleted

**Event:** `content:comment`

**Payload:**
```typescript
{
  contentId: string;
  contentType: string;
  commentId: string;
  action: "created" | "deleted" | "liked";
  commentCount?: number; // Updated total comment count (for created/deleted)
  likesCount?: number; // Updated likes count (for liked action)
}
```

**Example Implementation:**
```typescript
import { io, Socket } from 'socket.io-client';

class CommentSocketService {
  private socket: Socket | null = null;
  private currentRoom: string | null = null;
  
  connect(token: string) {
    this.socket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
    });
    
    this.socket.on('connect', () => {
      console.log('Socket connected');
    });
    
    this.socket.on('content:comment', (payload) => {
      this.handleCommentEvent(payload);
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }
  
  joinContentRoom(contentType: string, contentId: string) {
    if (!this.socket) return;
    
    const roomKey = `content:${contentType}:${contentId}`;
    
    // Leave previous room if any
    if (this.currentRoom) {
      this.socket.emit('leave-content', {
        contentId: this.currentRoom.split(':')[2],
        contentType: this.currentRoom.split(':')[1],
      });
    }
    
    // Join new room
    this.socket.emit('join-content', {
      contentId,
      contentType,
    });
    
    this.currentRoom = roomKey;
    console.log(`Joined room: ${roomKey}`);
  }
  
  leaveContentRoom() {
    if (!this.socket || !this.currentRoom) return;
    
    const [_, contentType, contentId] = this.currentRoom.split(':');
    
    this.socket.emit('leave-content', {
      contentId,
      contentType,
    });
    
    this.currentRoom = null;
    console.log('Left content room');
  }
  
  private handleCommentEvent(payload: {
    contentId: string;
    contentType: string;
    commentId: string;
    action: 'created' | 'deleted' | 'liked';
    commentCount?: number;
    likesCount?: number;
  }) {
    switch (payload.action) {
      case 'created':
        // Refetch comments or add new comment to list
        this.onCommentCreated?.(payload);
        break;
      case 'deleted':
        // Remove comment from list
        this.onCommentDeleted?.(payload.commentId);
        break;
      case 'liked':
        // Update like count for specific comment
        this.onCommentLiked?.(payload.commentId, payload.likesCount);
        break;
    }
  }
  
  // Callbacks (set these from your component)
  onCommentCreated?: (payload: any) => void;
  onCommentDeleted?: (commentId: string) => void;
  onCommentLiked?: (commentId: string, likesCount: number) => void;
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentRoom = null;
    }
  }
}

// Usage in React component
const commentSocket = new CommentSocketService();

useEffect(() => {
  const token = await AsyncStorage.getItem('userToken');
  if (token) {
    commentSocket.connect(token);
    
    commentSocket.onCommentCreated = (payload) => {
      // Refetch comments or add to list
      refetchComments();
    };
    
    commentSocket.onCommentDeleted = (commentId) => {
      // Remove from list
      setComments(prev => prev.filter(c => c.id !== commentId));
    };
    
    commentSocket.onCommentLiked = (commentId, likesCount) => {
      // Update like count
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, likesCount, isLiked: true } : c
      ));
    };
    
    // Join room when modal opens
    commentSocket.joinContentRoom(contentType, contentId);
    
    return () => {
      commentSocket.leaveContentRoom();
      commentSocket.disconnect();
    };
  }
}, [contentType, contentId]);
```

#### 2. Full Comment Object (Alternative)

**Event:** `new-comment`

**Payload:** Full comment object (same format as POST response)

This event includes the complete comment object, useful for immediately adding to UI without refetching.

---

## Error Handling

### Error Response Format

All endpoints return errors in a consistent format:

```typescript
{
  success: false,
  message: "Error message",
  error?: string // Additional error details (development only)
}
```

### HTTP Status Codes

- **200 OK** - Success (GET, PUT, POST like, DELETE)
- **201 Created** - Comment created successfully (POST create)
- **400 Bad Request** - Invalid request (validation errors, invalid IDs)
- **401 Unauthorized** - Authentication required or invalid token
- **403 Forbidden** - Permission denied (e.g., deleting someone else's comment)
- **404 Not Found** - Content or comment not found
- **500 Internal Server Error** - Server error

### Error Handling Best Practices

```typescript
async function handleApiCall<T>(
  apiCall: () => Promise<T>
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    // Handle network errors
    if (error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    
    // Handle HTTP errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          // Redirect to login
          throw new Error('Please log in to continue.');
        case 403:
          throw new Error(data.message || 'Permission denied.');
        case 404:
          throw new Error(data.message || 'Not found.');
        case 400:
          throw new Error(data.message || 'Invalid request.');
        default:
          throw new Error(data.message || 'An error occurred.');
      }
    }
    
    // Handle other errors
    throw error;
  }
}

// Usage
try {
  const comments = await handleApiCall(() => 
    getComments({ contentType: 'media', contentId: '...' })
  );
} catch (error) {
  // Show user-friendly error message
  showToast(error.message);
}
```

---

## Complete Example Implementation

### React Native / Expo Example

```typescript
// api/comments.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://api.jevahapp.com/api';

export interface Comment {
  _id: string;
  id: string;
  contentId: string;
  contentType?: string;
  content: string;
  comment: string;
  userId: string;
  user: {
    _id: string;
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
    username: string;
  };
  likesCount: number;
  likes: number;
  isLiked: boolean;
  createdAt: string;
  timestamp: string;
  parentCommentId: string | null;
  replyCount: number;
  replies: Comment[];
}

export interface GetCommentsResponse {
  success: boolean;
  data: {
    comments: Comment[];
    total: number;
    totalComments: number;
    hasMore: boolean;
    page: number;
    limit: number;
  };
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem('userToken') || 
                await AsyncStorage.getItem('token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export async function getComments(
  contentType: 'media' | 'devotional' | 'ebook',
  contentId: string,
  page: number = 1,
  limit: number = 20,
  sortBy: 'newest' | 'oldest' | 'top' = 'newest'
): Promise<GetCommentsResponse> {
  const headers = await getAuthHeaders();
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
  });
  
  const response = await fetch(
    `${API_BASE_URL}/content/${contentType}/${contentId}/comments?${queryParams}`,
    { method: 'GET', headers }
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch comments');
  }
  
  return await response.json();
}

export async function createComment(
  contentId: string,
  contentType: 'media' | 'devotional' | 'ebook',
  content: string,
  parentCommentId?: string | null
): Promise<{ success: boolean; message: string; data: Comment }> {
  const headers = await getAuthHeaders();
  
  if (!headers['Authorization']) {
    throw new Error('Authentication required');
  }
  
  const response = await fetch(`${API_BASE_URL}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contentId,
      contentType,
      content: content.trim(),
      parentCommentId: parentCommentId || null,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to create comment');
  }
  
  return await response.json();
}

export async function toggleCommentLike(commentId: string): Promise<{
  success: boolean;
  data: { liked: boolean; likesCount: number };
}> {
  const headers = await getAuthHeaders();
  
  if (!headers['Authorization']) {
    throw new Error('Authentication required');
  }
  
  const response = await fetch(`${API_BASE_URL}/comments/${commentId}/like`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to toggle like');
  }
  
  return await response.json();
}

export async function deleteComment(commentId: string): Promise<void> {
  const headers = await getAuthHeaders();
  
  if (!headers['Authorization']) {
    throw new Error('Authentication required');
  }
  
  const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete comment');
  }
}
```

### React Component Example

```typescript
// components/CommentList.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { getComments, createComment, toggleCommentLike, Comment } from '../api/comments';

interface CommentListProps {
  contentType: 'media' | 'devotional' | 'ebook';
  contentId: string;
}

export function CommentList({ contentType, contentId }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const loadComments = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const result = await getComments(contentType, contentId, pageNum);
      
      if (pageNum === 1) {
        setComments(result.data.comments);
      } else {
        setComments(prev => [...prev, ...result.data.comments]);
      }
      
      setHasMore(result.data.hasMore);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadComments(1);
  }, [contentType, contentId]);
  
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadComments(nextPage);
    }
  };
  
  const handleLike = async (commentId: string) => {
    try {
      const result = await toggleCommentLike(commentId);
      
      // Update comment in list
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return {
            ...c,
            isLiked: result.data.liked,
            likesCount: result.data.likesCount,
            likes: result.data.likesCount,
          };
        }
        
        // Also update in replies
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map(r => 
              r.id === commentId
                ? { ...r, isLiked: result.data.liked, likesCount: result.data.likesCount }
                : r
            ),
          };
        }
        
        return c;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };
  
  const renderComment = ({ item }: { item: Comment }) => (
    <View>
      <Text>{item.user.firstName} {item.user.lastName}</Text>
      <Text>{item.content}</Text>
      <TouchableOpacity onPress={() => handleLike(item.id)}>
        <Text>{item.isLiked ? '❤️' : '🤍'} {item.likesCount}</Text>
      </TouchableOpacity>
      
      {/* Render replies */}
      {item.replies && item.replies.map(reply => (
        <View key={reply.id} style={{ marginLeft: 20 }}>
          <Text>{reply.user.firstName} {reply.user.lastName}</Text>
          <Text>{reply.content}</Text>
          <TouchableOpacity onPress={() => handleLike(reply.id)}>
            <Text>{reply.isLiked ? '❤️' : '🤍'} {reply.likesCount}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
  
  return (
    <FlatList
      data={comments}
      renderItem={renderComment}
      keyExtractor={item => item.id}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={loading ? <ActivityIndicator /> : null}
    />
  );
}
```

---

## Summary

### Quick Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/content/:contentType/:contentId/comments` | GET | Optional | Get comments (public) |
| `/api/comments` | POST | Required | Create comment |
| `/api/comments/:commentId/like` | POST | Required | Toggle like |
| `/api/comments/:commentId` | DELETE | Required | Delete comment |

### Key Points

1. ✅ **GET comments is PUBLIC** - Works without authentication
2. ✅ **POST/DELETE/LIKE require authentication** - Include Bearer token
3. ✅ **Real-time updates via Socket.io** - Listen for `content:comment` events
4. ✅ **Nested replies supported** - One level deep (comment → reply)
5. ✅ **Pagination and sorting** - Efficient loading of comments
6. ✅ **Optimistic UI recommended** - Update UI immediately, sync with server

---

**For backend implementation details, see:** `COMMENT_SYSTEM_BACKEND_IMPLEMENTATION_GUIDE.md`  
**Last Updated:** January 2025

