# Comment System - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Production Ready

---

## 🎯 Overview

Complete commenting system with create, edit, delete, like, and reply functionality. Each comment is independently stored - **multiple comments per user per content are fully supported**.

---

## 🐛 Important: Fix for Comment Array Issue

### The Problem

If comments are disappearing when new ones are added, this is likely a **frontend array management issue**.

### The Fix

**❌ WRONG:**
```typescript
// This REPLACES the entire array - deletes all previous comments!
setComments([newComment]);
```

**✅ CORRECT:**
```typescript
// This APPENDS to the array - preserves all comments!
setComments(prev => [...prev, newComment]);
```

**Always append, never replace!**

---

## 📡 API Endpoints

### Base URL
```
/api/comments
```

All endpoints require authentication (Bearer token).

---

## 1. Create Comment

**POST** `/api/comments`

**Request Body:**
```json
{
  "contentId": "media123",           // Required: Content ID
  "contentType": "media",            // Required: "media" | "devotional"
  "content": "This is a comment",    // Required: Comment text (max 1000 chars)
  "parentCommentId": "comment456"    // Optional: For replies
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Comment created successfully",
  "data": {
    "id": "comment789",
    "content": "This is a comment",
    "user": {
      "id": "user123",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://...",
      "username": "johndoe"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "likesCount": 0,
    "isLiked": false,
    "replyCount": 0,
    "parentCommentId": null
  }
}
```

**Example:**
```typescript
const createComment = async (contentId: string, contentType: "media" | "devotional", content: string, parentId?: string) => {
  const response = await fetch("/api/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      contentId,
      contentType,
      content: content.trim(),
      parentCommentId: parentId,
    }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    // ✅ APPEND to comments array (don't replace!)
    setComments(prev => [...prev, data.data]);
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

---

## 2. Edit Comment (Owner Only)

**PUT** `/api/comments/:commentId`

**Request Body:**
```json
{
  "content": "Updated comment text"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Comment updated successfully",
  "data": {
    "id": "comment789",
    "content": "Updated comment text",
    "updatedAt": "2024-01-15T10:35:00.000Z",
    // ... other fields
  }
}
```

**Error (403) - Not Owner:**
```json
{
  "success": false,
  "message": "You can only edit your own comments"
}
```

**Example:**
```typescript
const editComment = async (commentId: string, newContent: string) => {
  const response = await fetch(`/api/comments/${commentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: newContent.trim(),
    }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    // ✅ UPDATE in comments array
    setComments(prev => prev.map(c => 
      c.id === commentId ? { ...c, ...data.data } : c
    ));
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

---

## 3. Delete Comment (Owner Only)

**DELETE** `/api/comments/:commentId`

**Response (200):**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

**Error (403) - Not Owner:**
```json
{
  "success": false,
  "message": "You can only delete your own comments"
}
```

**Example:**
```typescript
const deleteComment = async (commentId: string) => {
  const response = await fetch(`/api/comments/${commentId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  
  if (data.success) {
    // ✅ REMOVE from comments array
    setComments(prev => prev.filter(c => c.id !== commentId));
  } else {
    throw new Error(data.message);
  }
};
```

---

## 4. Like/Unlike Comment

**POST** `/api/comments/:commentId/like`

**Response (200):**
```json
{
  "success": true,
  "message": "Comment liked",
  "data": {
    "liked": true,
    "likesCount": 5
  }
}
```

**Example:**
```typescript
const toggleLike = async (commentId: string) => {
  const response = await fetch(`/api/comments/${commentId}/like`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  
  if (data.success) {
    // ✅ UPDATE like status in comments array
    setComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, isLiked: data.data.liked, likesCount: data.data.likesCount }
        : c
    ));
    return data.data;
  } else {
    throw new Error(data.message);
  }
};
```

---

## 5. Reply to Comment

Same as create comment, but include `parentCommentId`:

**Example:**
```typescript
const replyToComment = async (
  contentId: string,
  contentType: "media" | "devotional",
  content: string,
  parentCommentId: string
) => {
  // Use createComment with parentCommentId
  const reply = await createComment(contentId, contentType, content, parentCommentId);
  
  // ✅ UPDATE parent comment's reply count
  setComments(prev => prev.map(c => 
    c.id === parentCommentId 
      ? { ...c, replyCount: (c.replyCount || 0) + 1 }
      : c
  ));
  
  return reply;
};
```

---

## 📋 Complete React/React Native Example

```typescript
import { useState, useEffect } from "react";

interface Comment {
  id: string;
  content: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  isLiked: boolean;
  replyCount: number;
  parentCommentId: string | null;
}

const CommentSection = ({ contentId, contentType }: { contentId: string; contentType: "media" | "devotional" }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");

  // Fetch comments on mount
  useEffect(() => {
    fetchComments();
  }, [contentId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/content/${contentType}/${contentId}/comments`);
      const data = await response.json();
      if (data.success) {
        setComments(data.data.comments || []);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleCreateComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentId,
          contentType,
          content: newComment.trim(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // ✅ APPEND (don't replace!)
        setComments(prev => [...prev, data.data]);
        setNewComment("");
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error creating comment:", error);
      alert("Failed to create comment");
    } finally {
      setLoading(false);
    }
  };

  const handleEditComment = async (commentId: string, newContent: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newContent.trim() }),
      });

      const data = await response.json();
      
      if (data.success) {
        // ✅ UPDATE in array
        setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, ...data.data } : c
        ));
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error editing comment:", error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        // ✅ REMOVE from array
        setComments(prev => prev.filter(c => c.id !== commentId));
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleToggleLike = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}/like`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        // ✅ UPDATE like status
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, isLiked: data.data.liked, likesCount: data.data.likesCount }
            : c
        ));
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  return (
    <div>
      {/* Comment Input */}
      <input
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        placeholder="Write a comment..."
        maxLength={1000}
      />
      <button onClick={handleCreateComment} disabled={loading}>
        Post
      </button>

      {/* Comments List */}
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          onEdit={handleEditComment}
          onDelete={handleDeleteComment}
          onLike={handleToggleLike}
        />
      ))}
    </div>
  );
};
```

---

## ✅ Checklist

- [x] Use `POST /api/comments` to create comments
- [x] **APPEND** new comments to array (don't replace!)
- [x] Use `PUT /api/comments/:id` to edit (owner only)
- [x] Use `DELETE /api/comments/:id` to delete (owner only)
- [x] Use `POST /api/comments/:id/like` to toggle like
- [x] Check `comment.user.id === currentUserId` for ownership
- [x] Handle error responses (403 for ownership, 404 for not found)
- [x] Update array correctly (append, update, filter)

---

## 🎯 Key Points

1. **Multiple comments per user are allowed** - backend supports this
2. **Always append, never replace** - critical for preserving comments
3. **Each comment is independent** - has unique ID
4. **Ownership checks** - backend validates owner for edit/delete
5. **Real-time updates** - Socket.IO events for new comments

---

**Ready to integrate!** The backend is complete and supports all features. Just ensure frontend array management is correct! 🚀

