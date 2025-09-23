# Frontend Media Interaction Integration Guide

This comprehensive guide shows how to consume all media interaction endpoints (likes, comments, bookmarks, shares, downloads) with proper error handling, real-time updates, and sleek UI components.

**Works with:** React Native (Expo) and React Web  
**Transport:** REST + Socket.IO  
**Features:** Real-time updates, optimistic UI, error recovery

---

## 1) Supported Content Types

The backend supports interactions with these content types:

- **`media`** - Audio/video content (songs, videos, podcasts)
- **`devotional`** - Devotional content (Bible studies, prayers)
- **`artist`** - Artist profiles (follow/unfollow functionality)
- **`merch`** - Merchandise items (favorite functionality)
- **`ebook`** - E-books and digital content
- **`podcast`** - Podcast episodes

**Note:** Comments are only supported for `media` and `devotional` content types.

## 🚨 **Quick Fix for Common Errors**

If you're getting **404 errors**, use these correct endpoints:

| ❌ Wrong Endpoint                  | ✅ Correct Endpoint                            |
| ---------------------------------- | ---------------------------------------------- |
| `/api/interactions/media/:id/save` | `/api/bookmark/:mediaId/toggle`                |
| `/api/interactions/like`           | `/api/content/:contentType/:contentId/like`    |
| `/api/interactions/comment`        | `/api/content/:contentType/:contentId/comment` |

---

## 2) API Endpoints Overview

Base URL examples:

- Production: `https://jevahapp-backend.onrender.com`
- Local: `http://localhost:4000`

Headers (all endpoints):

```
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Core Interaction Endpoints

| Method | Endpoint                                        | Purpose                        |
| ------ | ----------------------------------------------- | ------------------------------ |
| POST   | `/api/content/:contentType/:contentId/like`     | Like/unlike content            |
| POST   | `/api/content/:contentType/:contentId/comment`  | Add comment                    |
| GET    | `/api/content/:contentType/:contentId/comments` | Get comments                   |
| DELETE | `/api/content/comments/:commentId`              | Remove comment                 |
| POST   | `/api/bookmark/:mediaId/toggle`                 | Bookmark/unbookmark media      |
| POST   | `/api/bookmark/bulk`                            | Bulk bookmark operations       |
| GET    | `/api/bookmark/:mediaId/status`                 | Get bookmark status            |
| GET    | `/api/bookmark/user`                            | Get user bookmarks             |
| POST   | `/api/content/:contentType/:contentId/share`    | Share content                  |
| GET    | `/api/interactions/media/:mediaId/share-urls`   | Get share URLs                 |
| GET    | `/api/interactions/media/:mediaId/share-stats`  | Get share stats                |
| GET    | `/api/content/:contentType/:contentId/metadata` | Get content metadata           |
| POST   | `/api/media/:id/download`                       | Download media (with fileSize) |
| GET    | `/api/media/:id/download-file`                  | Download media file directly   |
| POST   | `/api/media/:id/interact`                       | Record media interaction       |

---

## 3) Request/Response Shapes

### Like/Unlike Content

```typescript
// POST /api/content/:contentType/:contentId/like
// No request body needed - just toggle
interface LikeResponse {
  success: boolean;
  message: string;
  data: {
    liked: boolean;
    likeCount: number;
  };
}
```

### Add Comment

```typescript
// POST /api/content/:contentType/:contentId/comment
interface CommentRequest {
  content: string;
  parentCommentId?: string; // For replies
}

interface CommentResponse {
  success: boolean;
  message: string;
  data: {
    comment: {
      _id: string;
      content: string;
      user: {
        _id: string;
        firstName: string;
        lastName: string;
        avatar?: string;
      };
      createdAt: string;
      parentCommentId?: string;
      replies?: Comment[];
    };
    commentCount: number;
  };
}
```

### Get Comments

```typescript
// GET /api/content/:contentType/:contentId/comments?page=1&limit=20
interface CommentsResponse {
  success: boolean;
  data: {
    comments: Comment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
```

### Bookmark Toggle

```typescript
// POST /api/bookmark/:mediaId/toggle
// No request body needed - just toggle
interface BookmarkResponse {
  success: boolean;
  message: string;
  data: {
    bookmarked: boolean;
    bookmarkCount: number;
  };
}
```

### Bulk Bookmark

```typescript
// POST /api/bookmark/bulk
interface BulkBookmarkRequest {
  mediaIds: string[];
  action: "add" | "remove";
}

interface BulkBookmarkResponse {
  success: boolean;
  message: string;
  data: {
    success: number;
    failed: number;
    results: Array<{
      mediaId: string;
      success: boolean;
      error?: string;
    }>;
  };
}
```

### Share Content

```typescript
// POST /api/content/:contentType/:contentId/share
interface ShareRequest {
  platform?: string;
  message?: string;
}

interface ShareResponse {
  success: boolean;
  message: string;
  data: {
    shareUrls: object;
    platform: string;
  };
}
```

### Get Content Metadata

```typescript
// GET /api/content/:contentType/:contentId/metadata
interface ContentMetadataResponse {
  success: boolean;
  data: {
    contentId: string;
    contentType: string;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    bookmarkCount: number;
    hasLiked: boolean;
    hasBookmarked: boolean;
    hasCommented: boolean;
    user: {
      _id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
    };
    createdAt: string;
    updatedAt: string;
  };
}
```

### Download Endpoints

There are two download endpoints for different use cases:

#### 1. Download with Metadata (POST)

```typescript
// POST /api/media/:id/download
interface DownloadRequest {
  fileSize: number;
}

interface DownloadResponse {
  success: boolean;
  message: string;
  downloadUrl: string;
}
```

#### 2. Direct File Download (GET)

```typescript
// GET /api/media/:id/download-file
// Returns: File buffer with appropriate headers
// Content-Type: Based on media type
// Content-Disposition: attachment; filename="filename"
// Content-Length: File size
```

**Use Cases:**

- **POST endpoint**: For tracking downloads, getting download URLs, and offline download management
- **GET endpoint**: For direct file downloads in UI components (like your DownloadScreen)

---

## 4) Real-time Socket Events

The backend emits these events to user-specific rooms:

### Like Events

```typescript
// Emitted to: room: content:<contentId>
{
  event: "like-updated",
  data: {
    contentId: string;
    liked: boolean;
    likeCount: number;
    userId: string;
  }
}
```

### Comment Events

```typescript
// Emitted to: room: content:<contentId>
{
  event: "comment-added",
  data: {
    contentId: string;
    comment: Comment;
    commentCount: number;
  }
}

{
  event: "comment-reply",
  data: {
    contentId: string;
    parentCommentId: string;
    reply: Comment;
  }
}
```

### Bookmark Events

```typescript
// Emitted to: room: content:<contentId>
{
  event: "bookmark-updated",
  data: {
    mediaId: string;
    bookmarked: boolean;
    bookmarkCount: number;
    userId: string;
  }
}
```

### Share Events

```typescript
// Emitted to: room: content:<contentId>
{
  event: "share-updated",
  data: {
    contentId: string;
    shareCount: number;
    userId: string;
  }
}
```

---

## 5) Client Service Implementation

```typescript
// services/mediaInteractionService.ts
import { io, Socket } from "socket.io-client";

export interface MediaInteractionClient {
  baseURL: string;
  token: string;
  socket: Socket | null;
}

export class MediaInteractionService {
  private baseURL: string;
  private token: string;
  private socket: Socket | null = null;

  constructor(baseURL: string, token: string) {
    this.baseURL = baseURL;
    this.token = token;
  }

  // Socket connection
  connect() {
    if (this.socket) return;

    this.socket = io(this.baseURL, {
      auth: { token: this.token },
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      console.log("Connected to media interaction socket");
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from media interaction socket");
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Join content room for real-time updates
  joinContentRoom(contentId: string) {
    this.socket?.emit("join-room", `content:${contentId}`);
  }

  leaveContentRoom(contentId: string) {
    this.socket?.emit("leave-room", `content:${contentId}`);
  }

  // Event listeners
  onLikeUpdate(callback: (data: any) => void) {
    this.socket?.on("like-updated", callback);
  }

  onCommentAdded(callback: (data: any) => void) {
    this.socket?.on("comment-added", callback);
  }

  onCommentReply(callback: (data: any) => void) {
    this.socket?.on("comment-reply", callback);
  }

  onBookmarkUpdate(callback: (data: any) => void) {
    this.socket?.on("bookmark-updated", callback);
  }

  onShareUpdate(callback: (data: any) => void) {
    this.socket?.on("share-updated", callback);
  }

  // API Methods
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Network error" }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Like/Unlike
  async toggleLike(
    contentId: string,
    contentType:
      | "media"
      | "devotional"
      | "artist"
      | "merch"
      | "ebook"
      | "podcast"
  ) {
    return this.request(`/api/content/${contentType}/${contentId}/like`, {
      method: "POST",
    });
  }

  // Comments
  async addComment(
    contentId: string,
    contentType: "media" | "devotional",
    content: string,
    parentCommentId?: string
  ) {
    return this.request(`/api/content/${contentType}/${contentId}/comment`, {
      method: "POST",
      body: JSON.stringify({
        content,
        parentCommentId,
      }),
    });
  }

  async getComments(
    contentId: string,
    contentType: "media" | "devotional",
    page = 1,
    limit = 20
  ) {
    return this.request(
      `/api/content/${contentType}/${contentId}/comments?page=${page}&limit=${limit}`
    );
  }

  async removeComment(commentId: string) {
    return this.request(`/api/content/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  // Bookmarks
  async toggleBookmark(mediaId: string) {
    return this.request(`/api/bookmark/${mediaId}/toggle`, {
      method: "POST",
    });
  }

  async getBookmarkStatus(mediaId: string) {
    return this.request(`/api/bookmark/${mediaId}/status`);
  }

  async getUserBookmarks(page = 1, limit = 20) {
    return this.request(`/api/bookmark/user?page=${page}&limit=${limit}`);
  }

  async bulkBookmark(mediaIds: string[], action: "add" | "remove") {
    return this.request("/api/bookmark/bulk", {
      method: "POST",
      body: JSON.stringify({ mediaIds, action }),
    });
  }

  // Share
  async shareContent(
    contentId: string,
    contentType:
      | "media"
      | "devotional"
      | "artist"
      | "merch"
      | "ebook"
      | "podcast",
    platform?: string,
    message?: string
  ) {
    return this.request(`/api/content/${contentType}/${contentId}/share`, {
      method: "POST",
      body: JSON.stringify({ platform, message }),
    });
  }

  async getShareUrls(mediaId: string) {
    return this.request(`/api/interactions/media/${mediaId}/share-urls`);
  }

  async getShareStats(mediaId: string) {
    return this.request(`/api/interactions/media/${mediaId}/share-stats`);
  }

  // Content Metadata
  async getContentMetadata(contentId: string, contentType: string) {
    return this.request(`/api/content/${contentType}/${contentId}/metadata`);
  }

  // Download
  async downloadMedia(mediaId: string, fileSize?: number) {
    const response = await fetch(
      `${this.baseURL}/api/media/${mediaId}/download`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: fileSize ? JSON.stringify({ fileSize }) : undefined,
      }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return response.json();
  }

  // Download file directly (for UI components)
  async downloadMediaFile(mediaId: string) {
    const response = await fetch(
      `${this.baseURL}/api/media/${mediaId}/download-file`,
      {
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    return response.blob();
  }
}
```

---

## 6) React Native UI Components

### Like Button Component

```tsx
// components/LikeButton.tsx
import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface Props {
  contentId: string;
  contentType: "media" | "artist" | "playlist";
  initialLiked: boolean;
  initialLikeCount: number;
  onLikeUpdate?: (liked: boolean, count: number) => void;
  service: MediaInteractionService;
}

export const LikeButton: React.FC<Props> = ({
  contentId,
  contentType,
  initialLiked,
  initialLikeCount,
  onLikeUpdate,
  service,
}) => {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for real-time updates
    const handleLikeUpdate = (data: any) => {
      if (data.contentId === contentId) {
        setLiked(data.liked);
        setLikeCount(data.likeCount);
        onLikeUpdate?.(data.liked, data.likeCount);
      }
    };

    service.onLikeUpdate(handleLikeUpdate);
    service.joinContentRoom(contentId);

    return () => {
      service.leaveContentRoom(contentId);
    };
  }, [contentId, service, onLikeUpdate]);

  const handlePress = async () => {
    if (loading) return;

    setLoading(true);
    const previousLiked = liked;
    const previousCount = likeCount;

    // Optimistic update
    setLiked(!liked);
    setLikeCount(prev => prev + (liked ? -1 : 1));

    try {
      const response = await service.toggleLike(contentId, contentType);
      if (response.success) {
        setLiked(response.data.liked);
        setLikeCount(response.data.likeCount);
        onLikeUpdate?.(response.data.liked, response.data.likeCount);
      } else {
        // Revert on failure
        setLiked(previousLiked);
        setLikeCount(previousCount);
      }
    } catch (error) {
      // Revert on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      console.error("Like toggle failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, liked && styles.liked]}
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#EF4444" />
      ) : (
        <Icon
          name={liked ? "favorite" : "favorite-border"}
          size={24}
          color={liked ? "#EF4444" : "#6B7280"}
        />
      )}
      <Text style={[styles.count, liked && styles.countLiked]}>
        {likeCount}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  liked: {
    backgroundColor: "#FEF2F2",
  },
  count: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  countLiked: {
    color: "#EF4444",
  },
});
```

### Comment Section Component

```tsx
// components/CommentSection.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";

interface Comment {
  _id: string;
  content: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  createdAt: string;
  parentCommentId?: string;
  replies?: Comment[];
}

interface Props {
  contentId: string;
  contentType:
    | "media"
    | "devotional"
    | "artist"
    | "merch"
    | "ebook"
    | "podcast";
  service: MediaInteractionService;
}

export const CommentSection: React.FC<Props> = ({
  contentId,
  contentType,
  service,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadComments();

    // Listen for real-time comment updates
    const handleCommentAdded = (data: any) => {
      if (data.contentId === contentId) {
        setComments(prev => [data.comment, ...prev]);
      }
    };

    const handleCommentReply = (data: any) => {
      if (data.contentId === contentId) {
        setComments(prev =>
          prev.map(comment =>
            comment._id === data.parentCommentId
              ? {
                  ...comment,
                  replies: [...(comment.replies || []), data.reply],
                }
              : comment
          )
        );
      }
    };

    service.onCommentAdded(handleCommentAdded);
    service.onCommentReply(handleCommentReply);
    service.joinContentRoom(contentId);

    return () => {
      service.leaveContentRoom(contentId);
    };
  }, [contentId, service]);

  const loadComments = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await service.getComments(contentId, contentType, page);
      if (response.success) {
        setComments(prev =>
          page === 1
            ? response.data.comments
            : [...prev, ...response.data.comments]
        );
        setHasMore(
          response.data.pagination.page < response.data.pagination.totalPages
        );
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    const commentText = newComment.trim();
    setNewComment("");

    try {
      const response = await service.addComment(
        contentId,
        contentType,
        commentText
      );
      if (response.success) {
        // Comment will be added via socket event
        setNewComment("");
      } else {
        setNewComment(commentText); // Restore on failure
      }
    } catch (error) {
      setNewComment(commentText); // Restore on error
      console.error("Failed to submit comment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.comment}>
      <Image
        source={
          item.user.avatar
            ? { uri: item.user.avatar }
            : require("../assets/avatar-placeholder.png")
        }
        style={styles.avatar}
      />
      <View style={styles.commentContent}>
        <Text style={styles.userName}>
          {item.user.firstName} {item.user.lastName}
        </Text>
        <Text style={styles.commentText}>{item.content}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comments ({comments.length})</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!newComment.trim() || submitting) && styles.submitDisabled,
          ]}
          onPress={submitComment}
          disabled={!newComment.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={item => item._id}
        onEndReached={loadComments}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loading ? <ActivityIndicator style={styles.loader} /> : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
  },
  submitButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  submitDisabled: {
    backgroundColor: "#9CA3AF",
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
  },
  comment: {
    flexDirection: "row",
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  commentText: {
    fontSize: 14,
    color: "#374151",
    marginTop: 4,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  loader: {
    marginVertical: 16,
  },
});
```

### Bookmark Button Component

```tsx
// components/BookmarkButton.tsx
import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface Props {
  mediaId: string;
  initialBookmarked: boolean;
  initialBookmarkCount: number;
  onBookmarkUpdate?: (bookmarked: boolean, count: number) => void;
  service: MediaInteractionService;
}

export const BookmarkButton: React.FC<Props> = ({
  mediaId,
  initialBookmarked,
  initialBookmarkCount,
  onBookmarkUpdate,
  service,
}) => {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for real-time updates
    const handleBookmarkUpdate = (data: any) => {
      if (data.mediaId === mediaId) {
        setBookmarked(data.bookmarked);
        setBookmarkCount(data.bookmarkCount);
        onBookmarkUpdate?.(data.bookmarked, data.bookmarkCount);
      }
    };

    service.onBookmarkUpdate(handleBookmarkUpdate);
    service.joinContentRoom(mediaId);

    return () => {
      service.leaveContentRoom(mediaId);
    };
  }, [mediaId, service, onBookmarkUpdate]);

  const handlePress = async () => {
    if (loading) return;

    setLoading(true);
    const previousBookmarked = bookmarked;
    const previousCount = bookmarkCount;

    // Optimistic update
    setBookmarked(!bookmarked);
    setBookmarkCount(prev => prev + (bookmarked ? -1 : 1));

    try {
      const response = await service.toggleBookmark(mediaId);
      if (response.success) {
        setBookmarked(response.data.bookmarked);
        setBookmarkCount(response.data.bookmarkCount);
        onBookmarkUpdate?.(
          response.data.bookmarked,
          response.data.bookmarkCount
        );
      } else {
        // Revert on failure
        setBookmarked(previousBookmarked);
        setBookmarkCount(previousCount);
      }
    } catch (error) {
      // Revert on error
      setBookmarked(previousBookmarked);
      setBookmarkCount(previousCount);
      console.error("Bookmark toggle failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, bookmarked && styles.bookmarked]}
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#10B981" />
      ) : (
        <Icon
          name={bookmarked ? "bookmark" : "bookmark-border"}
          size={24}
          color={bookmarked ? "#10B981" : "#6B7280"}
        />
      )}
      <Text style={[styles.count, bookmarked && styles.countBookmarked]}>
        {bookmarkCount}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  bookmarked: {
    backgroundColor: "#ECFDF5",
  },
  count: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  countBookmarked: {
    color: "#10B981",
  },
});
```

### Share Button Component

```tsx
// components/ShareButton.tsx
import React, { useState } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import Share from "react-native-share";

interface Props {
  contentId: string;
  contentType:
    | "media"
    | "devotional"
    | "artist"
    | "merch"
    | "ebook"
    | "podcast";
  initialShareCount: number;
  onShareUpdate?: (count: number) => void;
  service: MediaInteractionService;
}

export const ShareButton: React.FC<Props> = ({
  contentId,
  contentType,
  initialShareCount,
  onShareUpdate,
  service,
}) => {
  const [shareCount, setShareCount] = useState(initialShareCount);
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;

    setLoading(true);

    try {
      // Show share options
      const shareOptions = {
        title: "Share Content",
        message: `Check out this ${contentType} on Jevah!`,
        url: `https://jevahapp.com/${contentType}/${contentId}`,
      };

      const result = await Share.open(shareOptions);

      if (result.action === Share.sharedAction) {
        // Record the share
        const response = await service.shareContent(contentId, contentType);
        if (response.success) {
          setShareCount(response.data.shareCount);
          onShareUpdate?.(response.data.shareCount);
        }
      }
    } catch (error) {
      if (error.message !== "User did not share") {
        console.error("Share failed:", error);
        Alert.alert("Error", "Failed to share content");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#3B82F6" />
      ) : (
        <Icon name="share" size={24} color="#3B82F6" />
      )}
      <Text style={styles.count}>{shareCount}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  count: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
});
```

---

## 7) Usage Example

```tsx
// screens/MediaDetailScreen.tsx
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { MediaInteractionService } from "../services/mediaInteractionService";
import { LikeButton } from "../components/LikeButton";
import { BookmarkButton } from "../components/BookmarkButton";
import { ShareButton } from "../components/ShareButton";
import { CommentSection } from "../components/CommentSection";

interface Props {
  mediaId: string;
  token: string;
}

export const MediaDetailScreen: React.FC<Props> = ({ mediaId, token }) => {
  const [service] = useState(
    () => new MediaInteractionService("https://your-api.com", token)
  );
  const [mediaData, setMediaData] = useState({
    liked: false,
    likeCount: 0,
    bookmarked: false,
    bookmarkCount: 0,
    shareCount: 0,
  });

  useEffect(() => {
    service.connect();

    return () => {
      service.disconnect();
    };
  }, [service]);

  return (
    <View style={styles.container}>
      {/* Media content */}

      {/* Interaction buttons */}
      <View style={styles.interactions}>
        <LikeButton
          contentId={mediaId}
          contentType="media"
          initialLiked={mediaData.liked}
          initialLikeCount={mediaData.likeCount}
          onLikeUpdate={(liked, count) =>
            setMediaData(prev => ({ ...prev, liked, likeCount: count }))
          }
          service={service}
        />

        <BookmarkButton
          mediaId={mediaId}
          initialBookmarked={mediaData.bookmarked}
          initialBookmarkCount={mediaData.bookmarkCount}
          onBookmarkUpdate={(bookmarked, count) =>
            setMediaData(prev => ({
              ...prev,
              bookmarked,
              bookmarkCount: count,
            }))
          }
          service={service}
        />

        <ShareButton
          contentId={mediaId}
          contentType="media"
          initialShareCount={mediaData.shareCount}
          onShareUpdate={count =>
            setMediaData(prev => ({ ...prev, shareCount: count }))
          }
          service={service}
        />
      </View>

      {/* Comments section */}
      <CommentSection
        contentId={mediaId}
        contentType="media"
        service={service}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  interactions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
});
```

---

## 8) Error Handling & Best Practices

### Network Error Recovery

```typescript
// Retry logic for failed requests
const retryRequest = async (requestFn: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### Offline Support

```typescript
// Queue actions when offline
class OfflineQueue {
  private queue: Array<() => Promise<void>> = [];

  add(action: () => Promise<void>) {
    this.queue.push(action);
  }

  async process() {
    while (this.queue.length > 0) {
      const action = this.queue.shift();
      if (action) {
        try {
          await action();
        } catch (error) {
          console.error("Offline action failed:", error);
        }
      }
    }
  }
}
```

### Rate Limiting

```typescript
// Prevent spam clicking
const useRateLimit = (delay: number) => {
  const [lastAction, setLastAction] = useState(0);

  const canPerformAction = () => {
    const now = Date.now();
    if (now - lastAction < delay) return false;
    setLastAction(now);
    return true;
  };

  return canPerformAction;
};
```

---

## 9) Testing Checklist

- [ ] Like/unlike works with optimistic updates
- [ ] Comments load and submit correctly
- [ ] Real-time updates work via socket
- [ ] Bookmark toggle functions properly
- [ ] Share opens native share sheet
- [ ] Error states are handled gracefully
- [ ] Offline scenarios work with queue
- [ ] Rate limiting prevents spam
- [ ] UI updates reflect server state
- [ ] Socket reconnection works

---

## 10) Performance Tips

1. **Debounce rapid interactions** to prevent API spam
2. **Use optimistic updates** for better UX
3. **Implement pagination** for comments
4. **Cache interaction counts** locally
5. **Lazy load** comment sections
6. **Batch bulk operations** when possible
7. **Use React.memo** for interaction components
8. **Implement proper cleanup** for socket listeners

## 11) Common Frontend Issues & Solutions

### ❌ **Error: Route not found for `/api/interactions/media/:id/save`**

**Problem:** Frontend is calling a non-existent endpoint.

**Solution:** Use the correct bookmark endpoint:

```typescript
// ❌ WRONG - This endpoint doesn't exist
const response = await fetch(`/api/interactions/media/${mediaId}/save`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});

// ✅ CORRECT - Use the unified bookmark endpoint
const response = await fetch(`/api/bookmark/${mediaId}/toggle`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
```

**Updated Service Method:**

```typescript
// In your MediaInteractionService
async toggleBookmark(mediaId: string) {
  return this.request(`/api/bookmark/${mediaId}/toggle`, {
    method: "POST",
  });
}
```

### ❌ **Error: 404 for `/api/interactions/like`**

**Problem:** Frontend using old endpoint structure.

**Solution:** Use the correct content interaction endpoint:

```typescript
// ❌ WRONG
const response = await fetch(`/api/interactions/like`, {
  method: "POST",
  body: JSON.stringify({ contentId, contentType }),
});

// ✅ CORRECT
const response = await fetch(`/api/content/${contentType}/${contentId}/like`, {
  method: "POST",
});
```

## 12) Download Integration Example

Here's how to integrate the new download endpoint with your DownloadScreen component:

```typescript
// In your DownloadScreen component
const handleDownload = async (mediaId: string) => {
  try {
    const token = await authUtils.getStoredToken();
    if (!token) {
      console.error("No authentication token found");
      return;
    }

    // Use the new direct download endpoint
    const response = await fetch(
      `${API_BASE_URL}/api/media/${mediaId}/download-file`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    // Get the file blob
    const blob = await response.blob();

    // Create object URL for the blob
    const fileUrl = URL.createObjectURL(blob);

    // Add to your download store
    const downloadItem: DownloadItem = {
      id: mediaId,
      title: "Downloaded Media", // You might want to get this from metadata
      description: "Downloaded content",
      author: "Unknown", // Get from metadata
      fileUrl: fileUrl,
      thumbnailUrl: "", // Get from metadata
      contentType: "audio", // or "video", "ebook", etc.
      size: blob.size.toString(),
      status: "Downloaded",
      downloadedAt: new Date().toISOString(),
    };

    // Add to your download store
    addToDownloads(downloadItem);

    console.log("Download completed successfully");
  } catch (error) {
    console.error("Download failed:", error);
  }
};
```

**Key Benefits:**

- ✅ **Direct file download** - No need to specify file size
- ✅ **Automatic tracking** - Downloads are automatically recorded
- ✅ **Notification support** - Content owners get notified
- ✅ **Offline storage** - Files are added to user's offline downloads
- ✅ **Proper headers** - Content-Type and Content-Disposition set correctly

This guide provides everything needed to implement a robust media interaction system with real-time updates and excellent user experience.
