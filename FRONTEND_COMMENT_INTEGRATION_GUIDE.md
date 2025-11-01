# 📱 Frontend Comment Integration Guide

## ✅ **Updated & Ready for Frontend Integration**

This guide provides everything the frontend team needs to integrate with the comment system **without searching through the backend codebase**.

---

## 🎯 **What's Implemented**

✅ **Nested Replies** - Comments now include nested `replies` array in GET response  
✅ **Comment Like/Reaction** - Full like/unlike functionality  
✅ **Field Aliases** - Supports both `user`/`author`, `userId`/`authorId`, etc.  
✅ **hasMore Flag** - Pagination indicator for frontend  
✅ **reactionsCount** - Total reaction count on all comments  
✅ **Real-time Updates** - Socket.IO events for new comments  

---

## 🔌 **API Endpoints**

### **Base URL**
```
Development: http://localhost:4000
Production: https://jevahapp-backend.onrender.com
```

---

### **1. Get Comments (with nested replies)**

```http
GET /api/content/:contentType/:contentId/comments?page=1&limit=20&sortBy=newest
```

**Parameters:**
- `contentType`: `"media"` or `"devotional"`
- `contentId`: MongoDB ObjectId of content
- `page`: Page number (default: 1)
- `limit`: Comments per page (default: 20)
- `sortBy`: `"newest"` | `"oldest"` | `"top"` (default: "newest")

**Response:**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "_id": "commentId123",
        "id": "commentId123",
        "content": "Great content!",
        "authorId": "userId456",
        "userId": "userId456",
        "author": {
          "_id": "userId456",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "https://..."
        },
        "user": {
          "_id": "userId456",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "https://..."
        },
        "createdAt": "2024-01-15T10:30:00Z",
        "timestamp": "2024-01-15T10:30:00Z",
        "reactionsCount": 5,
        "likes": 5,
        "replyCount": 2,
        "replies": [
          {
            "_id": "replyId789",
            "id": "replyId789",
            "content": "@John Doe Thanks!",
            "authorId": "userId101",
            "userId": "userId101",
            "author": {
              "_id": "userId101",
              "firstName": "Jane",
              "lastName": "Smith",
              "avatar": "https://..."
            },
            "user": {
              "_id": "userId101",
              "firstName": "Jane",
              "lastName": "Smith",
              "avatar": "https://..."
            },
            "createdAt": "2024-01-15T10:35:00Z",
            "timestamp": "2024-01-15T10:35:00Z",
            "reactionsCount": 2,
            "likes": 2,
            "replyCount": 0,
            "replies": []
          }
        ]
      }
    ],
    "totalComments": 45,
    "hasMore": true,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

**Key Points:**
- ✅ **Nested replies included** - Each comment has a `replies` array (up to 50 replies per comment)
- ✅ **Field aliases** - Use `user` OR `author`, `userId` OR `authorId`, `id` OR `_id`
- ✅ **hasMore flag** - Use `hasMore: true` to show "Load More" button
- ✅ **reactionsCount** - Also available as `likes` alias

---

### **2. Post Comment**

```http
POST /api/content/:contentType/:contentId/comment
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "User's comment text here",
  "parentCommentId": "optional-parent-id-for-replies"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "_id": "newCommentId",
    "id": "newCommentId",
    "content": "User's comment text here",
    "authorId": "userId456",
    "userId": "userId456",
    "author": {
      "_id": "userId456",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://..."
    },
    "user": {
      "_id": "userId456",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://..."
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "timestamp": "2024-01-15T10:30:00Z",
    "reactionsCount": 0,
    "likes": 0,
    "replyCount": 0,
    "replies": []
  }
}
```

**Notes:**
- If `parentCommentId` is provided, comment is saved as a reply
- Response includes formatted comment ready for display
- All field aliases included for compatibility

---

### **3. Like/Comment Reaction**

```http
POST /api/interactions/comments/:commentId/reaction
Authorization: Bearer <token>
Content-Type: application/json

{
  "reactionType": "like"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "liked": true,
    "totalLikes": 6
  }
}
```

**Behavior:**
- First call: Adds like, returns `liked: true`
- Second call: Removes like, returns `liked: false`
- Frontend should track `isLiked` state locally

---

### **4. Delete Comment**

```http
DELETE /api/content/comments/:commentId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

---

### **5. Edit Comment**

```http
PATCH /api/content/comments/:commentId
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated comment text"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment updated successfully",
  "data": {
    "_id": "commentId",
    "content": "Updated comment text",
    ...
  }
}
```

---

## 📝 **TypeScript Interfaces**

### **Comment Interface (Frontend)**

```typescript
interface CommentData {
  // ID fields (multiple options for compatibility)
  _id: string;
  id: string;  // Alias
  
  // Content
  content: string;
  comment?: string;  // Alias
  
  // Author fields (multiple options for compatibility)
  authorId: string;
  userId: string;  // Alias
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  user: {  // Alias
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  
  // Timestamps (multiple options for compatibility)
  createdAt: string;  // ISO 8601
  timestamp: string;  // Alias
  
  // Reactions (multiple options for compatibility)
  reactionsCount: number;
  likes: number;  // Alias
  
  // Replies
  replyCount: number;
  replies: CommentData[];  // Nested replies (up to 50)
}
```

### **Response Interface**

```typescript
interface CommentListResponse {
  success: boolean;
  data: {
    comments: CommentData[];
    totalComments: number;
    hasMore: boolean;  // Pagination flag
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}
```

---

## 💻 **Frontend API Service Example**

```typescript
// api/commentService.ts

const API_BASE_URL = process.env.API_BASE_URL || 'https://jevahapp-backend.onrender.com';

export interface Comment {
  _id: string;
  id: string;
  content: string;
  authorId: string;
  userId: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  createdAt: string;
  timestamp: string;
  reactionsCount: number;
  likes: number;
  replyCount: number;
  replies: Comment[];
}

export interface CommentListResponse {
  success: boolean;
  data: {
    comments: Comment[];
    totalComments: number;
    hasMore: boolean;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// Get comments with nested replies
export async function getComments(
  contentType: "media" | "devotional",
  contentId: string,
  page: number = 1,
  limit: number = 20,
  sortBy: "newest" | "oldest" | "top" = "newest"
): Promise<CommentListResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/content/${contentType}/${contentId}/comments?page=${page}&limit=${limit}&sortBy=${sortBy}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch comments: ${response.statusText}`);
  }
  
  return response.json();
}

// Post comment
export async function addComment(
  contentType: "media" | "devotional",
  contentId: string,
  content: string,
  parentCommentId?: string,
  token?: string
): Promise<{ success: boolean; data: Comment; message: string }> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const response = await fetch(
    `${API_BASE_URL}/api/content/${contentType}/${contentId}/comment`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        content,
        parentCommentId: parentCommentId || undefined,
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to add comment");
  }
  
  return response.json();
}

// Like/Unlike comment
export async function toggleCommentReaction(
  commentId: string,
  reactionType: string = "like",
  token: string
): Promise<{ success: boolean; data: { liked: boolean; totalLikes: number } }> {
  const response = await fetch(
    `${API_BASE_URL}/api/interactions/comments/${commentId}/reaction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reactionType }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to toggle reaction");
  }
  
  return response.json();
}

// Delete comment
export async function deleteComment(
  commentId: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/content/comments/${commentId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete comment");
  }
  
  return response.json();
}
```

---

## 🎨 **UI/UX Implementation Notes**

### **1. Display Comments**

```typescript
// Comments are already nested - just render recursively
function CommentItem({ comment }: { comment: Comment }) {
  return (
    <View>
      {/* Main comment */}
      <View>
        <Image source={{ uri: comment.author.avatar }} />
        <Text>{comment.author.firstName} {comment.author.lastName}</Text>
        <Text>{comment.content}</Text>
        <Text>{comment.reactionsCount} likes</Text>
        <Button onPress={() => handleLike(comment._id)}>Like</Button>
      </View>
      
      {/* Nested replies */}
      {comment.replies.map((reply) => (
        <View style={{ marginLeft: 36 }}>
          <CommentItem comment={reply} />
        </View>
      ))}
      
      {/* Reply button */}
      <Button onPress={() => handleReply(comment._id)}>Reply</Button>
    </View>
  );
}
```

### **2. Pagination**

```typescript
// Use hasMore flag to show "Load More" button
function CommentList({ comments, hasMore, onLoadMore }) {
  return (
    <View>
      {comments.map(comment => (
        <CommentItem key={comment._id} comment={comment} />
      ))}
      
      {hasMore && (
        <Button onPress={onLoadMore}>Load More Comments</Button>
      )}
    </View>
  );
}
```

### **3. Optimistic Updates**

```typescript
// Add comment optimistically
function addCommentOptimistic(newComment: Comment) {
  setComments(prev => [newComment, ...prev]);
  
  // Call API in background
  addComment(contentType, contentId, content)
    .then(response => {
      // Replace optimistic comment with server response
      setComments(prev => prev.map(c => 
        c._id === newComment._id ? response.data : c
      ));
    })
    .catch(error => {
      // Remove optimistic comment on error
      setComments(prev => prev.filter(c => c._id !== newComment._id));
      showError(error.message);
    });
}
```

---

## 🔄 **Real-Time Events (Socket.IO)**

Backend emits these events:

```typescript
// Connect to Socket.IO
import { io } from "socket.io-client";

const socket = io(API_BASE_URL, {
  withCredentials: true,
  transports: ["websocket"],
});

// Listen for new comments
socket.on("content-comment", ({ contentId, contentType, comment }) => {
  if (contentId === currentContentId) {
    // Prepend new comment to list
    setComments(prev => [comment, ...prev]);
  }
});

socket.on("new-comment", (comment) => {
  // Same as above - new comment added
});

socket.on("comment-removed", ({ commentId }) => {
  // Remove comment from list
  setComments(prev => prev.filter(c => c._id !== commentId));
});

// Join content room for targeted updates
socket.emit("join-content", { 
  contentId: "contentId123", 
  contentType: "media" 
});
```

---

## ✅ **Field Name Compatibility**

The backend provides **multiple field names** for maximum compatibility:

| Frontend Expects | Backend Provides | Status |
|------------------|------------------|--------|
| `id` | ✅ `_id` AND `id` | Both provided |
| `authorId` | ✅ `authorId` AND `userId` | Both provided |
| `author` | ✅ `author` AND `user` | Both provided |
| `timestamp` | ✅ `timestamp` AND `createdAt` | Both provided |
| `likes` | ✅ `likes` AND `reactionsCount` | Both provided |
| `comment` | ✅ `content` (use `content`) | Standardized |

**You can use ANY of these field names** - backend provides all for compatibility!

---

## 🚨 **Error Handling**

### **Authentication Errors**

```typescript
// 401 Unauthorized
if (response.status === 401) {
  // Token expired or invalid
  // Redirect to login
}
```

### **Validation Errors**

```typescript
// 400 Bad Request
if (response.status === 400) {
  const error = await response.json();
  // Show error.message to user
}
```

### **Network Errors**

```typescript
try {
  await addComment(...);
} catch (error) {
  if (error.message.includes("Network")) {
    // Show "No internet connection"
  } else {
    // Show error.message
  }
}
```

---

## 📋 **Quick Integration Checklist**

- [ ] Import comment service functions
- [ ] Display nested replies from `comment.replies` array
- [ ] Use `hasMore` flag for pagination
- [ ] Handle field aliases (`author` OR `user`, `id` OR `_id`)
- [ ] Implement optimistic updates
- [ ] Add like/unlike functionality
- [ ] Connect Socket.IO for real-time updates
- [ ] Handle authentication errors
- [ ] Test with empty comments list
- [ ] Test with many comments (pagination)

---

## 🎯 **Key Points for Frontend**

1. **✅ Nested replies are included** - No need to fetch replies separately (though endpoint exists if needed)
2. **✅ Use field aliases** - Choose `author` OR `user`, `id` OR `_id`, etc.
3. **✅ hasMore flag** - Shows if more comments are available
4. **✅ reactionsCount** - Total likes/reactions on comment
5. **✅ All endpoints working** - POST, GET, DELETE, LIKE all implemented

---

## 📞 **Need Help?**

If frontend team has questions:
- Check this guide first
- All endpoints are documented above
- Field formats are provided
- Example code included

---

## ✅ **Summary**

**Everything is ready!** The backend comment system:
- ✅ Saves comments to database
- ✅ Returns nested replies
- ✅ Supports likes/reactions
- ✅ Has pagination with `hasMore`
- ✅ Provides field aliases for compatibility
- ✅ Emits real-time events
- ✅ All endpoints working

**Frontend can integrate immediately** using the examples above! 🚀
