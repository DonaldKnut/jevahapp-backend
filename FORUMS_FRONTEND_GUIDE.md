# Forums - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024-01-15  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Understanding Forum Structure](#understanding-forum-structure)
3. [Quick Reference](#quick-reference)
4. [Authentication](#authentication)
5. [API Endpoints](#api-endpoints)
6. [Implementation Guide](#implementation-guide)
7. [Complete Examples](#complete-examples)
8. [Error Handling](#error-handling)
9. [UI/UX Best Practices](#uiux-best-practices)

---

## Overview

The forum system has **TWO separate structures** - this guide explains both clearly:

### System 1: Forum Categories (Main System) ✅ **RECOMMENDED**

**Structure:**

```
Forum Category (Admin-created)
  └── Posts (Users create posts within categories)
      └── Comments (Users comment on posts)
```

**Example:**

- Forum Category: "Bible Study & Teaching"
  - Post 1: "How to study the Bible effectively"
    - Comment 1: "Great tips!"
    - Comment 2: "I use this method..."
  - Post 2: "Favorite Bible study methods"

### System 2: Forum Threads (Legacy/Simple)

**Structure:**

```
Forum Thread (User-created standalone thread)
  └── (No nested structure, simpler)
```

**Example:**

- Thread 1: "Prayer Request - Need healing"
- Thread 2: "Testimony - God provided!"

---

## Understanding Forum Structure

### Forum Categories (Recommended)

**Who Creates What:**

- ✅ **Users create Forum Categories** (e.g., "Bible Study & Teaching", "Youth Ministry")
- ✅ **Users create Posts** within those categories
- ✅ **Users comment** on posts

**Use Cases:**

- Organized discussions by topic
- Better content discovery
- Community structure

### Forum Threads (Legacy)

**Who Creates What:**

- ✅ **Users create standalone threads**
- ✅ No categories needed
- ✅ Simpler structure

**Use Cases:**

- Quick discussions
- Simple Q&A
- General topics

---

## Quick Reference

### Forum Categories Endpoints (Recommended)

```typescript
// Forums (Authenticated users)
POST   /api/community/forum/create          // Create forum category
GET    /api/community/forum                 // List all forum categories

// Posts (Users)
GET    /api/community/forum/:forumId/posts   // Get posts in forum
POST   /api/community/forum/:forumId/posts   // Create post in forum
PUT    /api/community/forum/posts/:postId   // Update post (creator only)
DELETE /api/community/forum/posts/:postId    // Delete post (creator only)

// Interactions
POST   /api/community/forum/posts/:postId/like              // Like/unlike post
GET    /api/community/forum/posts/:postId/comments          // Get comments
POST   /api/community/forum/posts/:postId/comments         // Add comment
POST   /api/community/forum/comments/:commentId/like        // Like comment
```

### Forum Threads Endpoints (Legacy)

```typescript
// Threads (Users)
POST   /api/community/forum/threads         // Create thread
GET    /api/community/forum/threads         // List threads
GET    /api/community/forum/threads/:id     // Get thread
PUT    /api/community/forum/threads/:id     // Update thread (creator only)
DELETE /api/community/forum/threads/:id     // Delete thread (creator only)
```

---

## Authentication

All endpoints require authentication (except public GET):

```typescript
Headers: {
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

---

## API Endpoints

### FORUM CATEGORIES SYSTEM (Recommended)

#### 1. Get All Forum Categories

**Endpoint:** `GET /api/community/forum`  
**Access:** Public (no auth required)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |

**Example Request:**

```typescript
GET /api/community/forum?page=1&limit=20
```

**Success Response (200):**

```typescript
{
  success: true,
  data: {
    forums: [
      {
        _id: "forum-id",
        title: "Bible Study & Teaching",
        description: "Deep dive into scripture...",
        createdBy: {
          _id: "admin-id",
          firstName: "Admin",
          lastName: "User",
          username: "jevah_admin"
        },
        postsCount: 25,
        participantsCount: 15,
        isActive: true,
        createdAt: "2024-01-15T10:00:00Z"
      }
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 15,
      totalPages: 1,
      hasMore: false
    }
  }
}
```

---

#### 2. Create Forum Category (Authenticated Users)

**Endpoint:** `POST /api/community/forum/create`  
**Access:** Authenticated users  
**Rate Limit:** 10 requests per hour

**Request Body:**

```typescript
{
  title: string; // Required - 3-100 characters
  description: string; // Required - 10-500 characters
}
```

**Example Request:**

```typescript
POST /api/community/forum/create
{
  "title": "Youth Ministry",
  "description": "Discussions and resources for youth ministry leaders"
}
```

**Success Response (201):**

```typescript
{
  success: true,
  data: {
    _id: "forum-id",
    title: "Youth Ministry",
    description: "...",
    postsCount: 0,
    participantsCount: 0,
    isActive: true
  }
}
```

**Error Response (401):**

```typescript
{
  success: false,
  error: "Unauthorized: Authentication required"
}
```

---

#### 3. Get Posts in Forum Category

**Endpoint:** `GET /api/community/forum/:forumId/posts`  
**Access:** Public (no auth required)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `sortBy` | string | "createdAt" | Sort: "createdAt", "likesCount", "commentsCount" |
| `sortOrder` | string | "desc" | Order: "asc" or "desc" |

**Example Request:**

```typescript
GET /api/community/forum/123/posts?page=1&limit=20&sortBy=likesCount&sortOrder=desc
```

**Success Response (200):**

```typescript
{
  success: true,
  data: {
    posts: [
      {
        _id: "post-id",
        forumId: "forum-id",
        content: "How to study the Bible effectively...",
        embeddedLinks: [
          {
            url: "https://example.com/article",
            title: "Bible Study Guide",
            description: "Comprehensive guide...",
            thumbnail: "https://...",
            type: "article"
          }
        ],
        likesCount: 15,
        commentsCount: 5,
        userLiked: false,
        createdAt: "2024-01-15T10:00:00Z",
        author: {
          _id: "user-id",
          firstName: "John",
          lastName: "Doe",
          username: "john_doe",
          avatar: "url"
        },
        forum: {
          _id: "forum-id",
          title: "Bible Study & Teaching"
        }
      }
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 50,
      totalPages: 3,
      hasMore: true
    }
  }
}
```

---

#### 4. Create Post in Forum Category

**Endpoint:** `POST /api/community/forum/:forumId/posts`  
**Access:** Authenticated users  
**Rate Limit:** 20 requests per 15 minutes

**Request Body:**

```typescript
{
  content: string;                    // Required - 1-5000 characters
  embeddedLinks?: Array<{              // Optional - Max 5 links
    url: string;                       // Required - Valid URL
    title?: string;                    // Optional - Max 200 chars
    description?: string;              // Optional - Max 500 chars
    thumbnail?: string;                // Optional - Valid URL
    type: "video" | "article" | "resource" | "other"; // Required
  }>;
  tags?: string[];                     // Optional - Array of tags
}
```

**Example Request:**

```typescript
POST /api/community/forum/123/posts
{
  "content": "I've been studying the book of Romans and found these insights helpful...",
  "embeddedLinks": [
    {
      "url": "https://example.com/bible-study-guide",
      "title": "Romans Study Guide",
      "description": "Comprehensive guide to studying Romans",
      "type": "article"
    }
  ],
  "tags": ["bible-study", "romans", "teaching"]
}
```

**Success Response (201):**

```typescript
{
  success: true,
  data: {
    _id: "post-id",
    forumId: "forum-id",
    content: "...",
    embeddedLinks: [...],
    likesCount: 0,
    commentsCount: 0,
    userLiked: false,
    createdAt: "2024-01-15T10:00:00Z",
    author: {...}
  }
}
```

---

#### 5. Update Forum Post (Creator Only)

**Endpoint:** `PUT /api/community/forum/posts/:postId`  
**Access:** Post creator only  
**Rate Limit:** 20 requests per 15 minutes

**Request Body:**

```typescript
{
  content?: string;                    // Optional - Update content
  embeddedLinks?: Array<{...}>;        // Optional - Update links
  tags?: string[];                     // Optional - Update tags
}
```

**Example Request:**

```typescript
PUT /api/community/forum/posts/123
{
  "content": "Updated content...",
  "embeddedLinks": [...]
}
```

**Success Response (200):**

```typescript
{
  success: true,
  data: {
    // Updated post object
  }
}
```

**Error Response (403):**

```typescript
{
  success: false,
  error: "Forbidden: Only author can edit"
}
```

---

#### 6. Delete Forum Post (Creator Only)

**Endpoint:** `DELETE /api/community/forum/posts/:postId`  
**Access:** Post creator only  
**Rate Limit:** 20 requests per 15 minutes

**Example Request:**

```typescript
DELETE / api / community / forum / posts / 123;
```

**Success Response (200):**

```typescript
{
  success: true,
  message: "Post deleted successfully"
}
```

---

#### 7. Like/Unlike Forum Post

**Endpoint:** `POST /api/community/forum/posts/:postId/like`  
**Access:** Authenticated users  
**Rate Limit:** 60 requests per 5 minutes

**Example Request:**

```typescript
POST / api / community / forum / posts / 123 / like;
```

**Success Response (200):**

```typescript
{
  success: true,
  data: {
    liked: true,           // true if liked, false if unliked
    likesCount: 16         // Updated like count
  }
}
```

**Note:** This is a toggle - if already liked, it unlikes. If not liked, it likes.

---

#### 8. Get Comments on Forum Post

**Endpoint:** `GET /api/community/forum/posts/:postId/comments`  
**Access:** Public (no auth required)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `includeReplies` | boolean | true | Include nested replies |

**Example Request:**

```typescript
GET /api/community/forum/posts/123/comments?page=1&limit=20&includeReplies=true
```

**Success Response (200):**

```typescript
{
  success: true,
  data: {
    comments: [
      {
        _id: "comment-id",
        content: "Great post!",
        user: {
          _id: "user-id",
          firstName: "Jane",
          lastName: "Smith",
          username: "jane_smith",
          avatar: "url"
        },
        likesCount: 5,
        userLiked: false,
        createdAt: "2024-01-15T10:00:00Z",
        replies: [                    // Nested replies (max 3 levels)
          {
            _id: "reply-id",
            content: "I agree!",
            user: {...},
            likesCount: 2,
            createdAt: "2024-01-15T10:05:00Z"
          }
        ]
      }
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 10,
      totalPages: 1,
      hasMore: false
    }
  }
}
```

---

#### 9. Add Comment to Forum Post

**Endpoint:** `POST /api/community/forum/posts/:postId/comments`  
**Access:** Authenticated users  
**Rate Limit:** 20 requests per minute

**Request Body:**

```typescript
{
  content: string;              // Required - 1-2000 characters
  parentCommentId?: string;     // Optional - For nested replies (max 3 levels)
}
```

**Example Request (Top-level comment):**

```typescript
POST /api/community/forum/posts/123/comments
{
  "content": "Great insights! Thanks for sharing."
}
```

**Example Request (Reply to comment):**

```typescript
POST /api/community/forum/posts/123/comments
{
  "content": "I completely agree!",
  "parentCommentId": "comment-id"
}
```

**Success Response (201):**

```typescript
{
  success: true,
  data: {
    _id: "comment-id",
    content: "Great insights!",
    user: {...},
    likesCount: 0,
    createdAt: "2024-01-15T10:00:00Z",
    parentCommentId: null
  }
}
```

---

#### 10. Like Forum Comment

**Endpoint:** `POST /api/community/forum/comments/:commentId/like`  
**Access:** Authenticated users  
**Rate Limit:** 60 requests per 5 minutes

**Example Request:**

```typescript
POST / api / community / forum / comments / 123 / like;
```

**Success Response (200):**

```typescript
{
  success: true,
  data: {
    liked: true,
    likesCount: 6
  }
}
```

---

### FORUM THREADS SYSTEM (Legacy)

#### 1. Create Forum Thread

**Endpoint:** `POST /api/community/forum/threads`  
**Access:** Authenticated users  
**Rate Limit:** 20 requests per 15 minutes

**Request Body:**

```typescript
{
  title: string;        // Required - Thread title
  body: string;         // Required - Thread content
  tags?: string[];      // Optional - Array of tags
}
```

**Example Request:**

```typescript
POST /api/community/forum/threads
{
  "title": "Prayer Request - Need Healing",
  "body": "I'm asking for prayer for healing...",
  "tags": ["prayer", "healing", "request"]
}
```

**Success Response (201):**

```typescript
{
  success: true,
  thread: {
    id: "thread-id",
    title: "Prayer Request - Need Healing",
    body: "...",
    tags: ["prayer", "healing"],
    author: {
      id: "user-id",
      firstName: "John",
      lastName: "Doe"
    },
    createdAt: "2024-01-15T10:00:00Z"
  }
}
```

---

#### 2. List Forum Threads

**Endpoint:** `GET /api/community/forum/threads`  
**Access:** Public (no auth required)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `sort` | string | "recent" | Sort: "recent" or "active" |

**Success Response (200):**

```typescript
{
  success: true,
  items: [...],
  page: 1,
  pageSize: 20,
  total: 50
}
```

---

#### 3. Get Single Forum Thread

**Endpoint:** `GET /api/community/forum/threads/:id`  
**Access:** Public (no auth required)

**Success Response (200):**

```typescript
{
  success: true,
  thread: {
    id: "thread-id",
    title: "...",
    body: "...",
    author: {...},
    createdAt: "..."
  }
}
```

---

#### 4. Update Forum Thread (Creator Only)

**Endpoint:** `PUT /api/community/forum/threads/:id`  
**Access:** Thread creator only

**Request Body:**

```typescript
{
  title?: string;       // Optional
  body?: string;        // Optional
  tags?: string[];      // Optional
}
```

**Success Response (200):**

```typescript
{
  success: true,
  thread: {
    // Updated thread
  }
}
```

---

#### 5. Delete Forum Thread (Creator Only)

**Endpoint:** `DELETE /api/community/forum/threads/:id`  
**Access:** Thread creator only

**Success Response (200):**

```typescript
{
  success: true,
  message: "Thread deleted"
}
```

---

## Implementation Guide

### Step 1: Create API Service

```typescript
// services/forumService.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://your-api-domain.com/api/community/forum';

interface Forum {
  _id: string;
  title: string;
  description: string;
  postsCount: number;
  participantsCount: number;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
  };
  isActive: boolean;
  createdAt: string;
}

interface ForumPost {
  _id: string;
  forumId: string;
  content: string;
  embeddedLinks?: Array<{
    url: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    type: string;
  }>;
  likesCount: number;
  commentsCount: number;
  userLiked: boolean;
  createdAt: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
  };
  forum: {
    _id: string;
    title: string;
  };
}

interface ForumComment {
  _id: string;
  content: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
  };
  likesCount: number;
  userLiked: boolean;
  createdAt: string;
  replies?: ForumComment[];
}

const getAuthToken = async (): Promise<string> => {
  const token = await SecureStore.getItemAsync('authToken');
  if (!token) throw new Error('Authentication required');
  return token;
};

/**
 * Get all forum categories
 */
export const getForums = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{
  forums: Forum[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}> => {
  const response = await axios.get<{
    success: boolean;
    data: {
      forums: Forum[];
      pagination: any;
    };
  }>(`${API_BASE_URL}`, {
    params: {
      page: params?.page || 1,
      limit: params?.limit || 20,
    },
  });

  return {
    forums: response.data.data.forums,
    pagination: response.data.data.pagination,
  };
};

/**
 * Create forum category
 */
export const createForum = async (data: {
  title: string;
  description: string;
}): Promise<Forum> => {
  const token = await getAuthToken();

  const response = await axios.post<{
    success: boolean;
    data: Forum;
  }>(
    `${API_BASE_URL}/create`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.data;
};

/**
 * Get posts in a forum category
 */
export const getForumPosts = async (
  forumId: string,
  params?: {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'likesCount' | 'commentsCount';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<{
  posts: ForumPost[];
  pagination: any;
}> => {
  const response = await axios.get<{
    success: boolean;
    data: {
      posts: ForumPost[];
      pagination: any;
    };
  }>(`${API_BASE_URL}/${forumId}/posts`, {
    params: {
      page: params?.page || 1,
      limit: params?.limit || 20,
      sortBy: params?.sortBy || 'createdAt',
      sortOrder: params?.sortOrder || 'desc',
    },
  });

  return {
    posts: response.data.data.posts,
    pagination: response.data.data.pagination,
  };
};

/**
 * Create post in forum category
 */
export const createForumPost = async (
  forumId: string,
  data: {
    content: string;
    embeddedLinks?: Array<{
      url: string;
      title?: string;
      description?: string;
      thumbnail?: string;
      type: 'video' | 'article' | 'resource' | 'other';
    }>;
    tags?: string[];
  }
): Promise<ForumPost> => {
  const token = await getAuthToken();

  const response = await axios.post<{
    success: boolean;
    data: ForumPost;
  }>(
    `${API_BASE_URL}/${forumId}/posts`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.data;
};

/**
 * Update forum post (creator only)
 */
export const updateForumPost = async (
  postId: string,
  data: {
    content?: string;
    embeddedLinks?: Array<{...}>;
    tags?: string[];
  }
): Promise<ForumPost> => {
  const token = await getAuthToken();

  const response = await axios.put<{
    success: boolean;
    data: ForumPost;
  }>(
    `${API_BASE_URL}/posts/${postId}`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.data;
};

/**
 * Delete forum post (creator only)
 */
export const deleteForumPost = async (postId: string): Promise<void> => {
  const token = await getAuthToken();

  await axios.delete<{
    success: boolean;
    message: string;
  }>(
    `${API_BASE_URL}/posts/${postId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
};

/**
 * Like/unlike forum post
 */
export const likeForumPost = async (
  postId: string
): Promise<{ liked: boolean; likesCount: number }> => {
  const token = await getAuthToken();

  const response = await axios.post<{
    success: boolean;
    data: {
      liked: boolean;
      likesCount: number;
    };
  }>(
    `${API_BASE_URL}/posts/${postId}/like`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return response.data.data;
};

/**
 * Get comments on forum post
 */
export const getForumPostComments = async (
  postId: string,
  params?: {
    page?: number;
    limit?: number;
    includeReplies?: boolean;
  }
): Promise<{
  comments: ForumComment[];
  pagination: any;
}> => {
  const response = await axios.get<{
    success: boolean;
    data: {
      comments: ForumComment[];
      pagination: any;
    };
  }>(`${API_BASE_URL}/posts/${postId}/comments`, {
    params: {
      page: params?.page || 1,
      limit: params?.limit || 20,
      includeReplies: params?.includeReplies !== false,
    },
  });

  return {
    comments: response.data.data.comments,
    pagination: response.data.data.pagination,
  };
};

/**
 * Add comment to forum post
 */
export const commentOnForumPost = async (
  postId: string,
  data: {
    content: string;
    parentCommentId?: string;
  }
): Promise<ForumComment> => {
  const token = await getAuthToken();

  const response = await axios.post<{
    success: boolean;
    data: ForumComment;
  }>(
    `${API_BASE_URL}/posts/${postId}/comments`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.data;
};

/**
 * Like forum comment
 */
export const likeForumComment = async (
  commentId: string
): Promise<{ liked: boolean; likesCount: number }> => {
  const token = await getAuthToken();

  const response = await axios.post<{
    success: boolean;
    data: {
      liked: boolean;
      likesCount: number;
    };
  }>(
    `${API_BASE_URL}/comments/${commentId}/like`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return response.data.data;
};

// ===== Forum Threads (Legacy) =====

/**
 * Create forum thread
 */
export const createForumThread = async (data: {
  title: string;
  body: string;
  tags?: string[];
}): Promise<any> => {
  const token = await getAuthToken();

  const response = await axios.post<{
    success: boolean;
    thread: any;
  }>(
    `${API_BASE_URL}/threads`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.thread;
};

/**
 * List forum threads
 */
export const listForumThreads = async (params?: {
  page?: number;
  limit?: number;
  sort?: 'recent' | 'active';
}): Promise<{
  items: any[];
  page: number;
  pageSize: number;
  total: number;
}> => {
  const response = await axios.get<{
    success: boolean;
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(`${API_BASE_URL}/threads`, {
    params: {
      page: params?.page || 1,
      limit: params?.limit || 20,
      sort: params?.sort || 'recent',
    },
  });

  return response.data;
};

/**
 * Get single forum thread
 */
export const getForumThread = async (threadId: string): Promise<any> => {
  const response = await axios.get<{
    success: boolean;
    thread: any;
  }>(`${API_BASE_URL}/threads/${threadId}`);

  return response.data.thread;
};

/**
 * Update forum thread (creator only)
 */
export const updateForumThread = async (
  threadId: string,
  data: {
    title?: string;
    body?: string;
    tags?: string[];
  }
): Promise<any> => {
  const token = await getAuthToken();

  const response = await axios.put<{
    success: boolean;
    thread: any;
  }>(
    `${API_BASE_URL}/threads/${threadId}`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.thread;
};

/**
 * Delete forum thread (creator only)
 */
export const deleteForumThread = async (threadId: string): Promise<void> => {
  const token = await getAuthToken();

  await axios.delete<{
    success: boolean;
    message: string;
  }>(
    `${API_BASE_URL}/threads/${threadId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
};
```

---

## Complete Examples

### Example: Forum Categories Screen

```typescript
// screens/ForumsScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useForums } from '../hooks/useForums';
import { useNavigation } from '@react-navigation/native';

export const ForumsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { forums, loading, error, refresh } = useForums();

  const renderForumItem = ({ item }: { item: Forum }) => (
    <TouchableOpacity
      style={styles.forumItem}
      onPress={() => navigation.navigate('ForumPosts', { forumId: item._id })}
    >
      <View style={styles.forumHeader}>
        <Text style={styles.forumTitle}>{item.title}</Text>
        <View style={styles.stats}>
          <Text style={styles.statText}>{item.postsCount} posts</Text>
          <Text style={styles.statText}>•</Text>
          <Text style={styles.statText}>{item.participantsCount} participants</Text>
        </View>
      </View>
      <Text style={styles.forumDescription}>{item.description}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forums</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={forums}
        renderItem={renderForumItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No forums available</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  forumItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  forumHeader: {
    marginBottom: 8,
  },
  forumTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    color: '#666',
  },
  forumDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#fee',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c00',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
```

---

### Example: Forum Posts Screen

```typescript
// screens/ForumPostsScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useForumPosts } from '../hooks/useForumPosts';
import { ForumPostCard } from '../components/ForumPostCard';

export const ForumPostsScreen: React.FC = ({ route }) => {
  const { forumId } = route.params;
  const { posts, loading, error, refresh, pagination } = useForumPosts(forumId);

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => <ForumPostCard post={item} />}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
        onEndReached={() => {
          if (pagination.hasMore && !loading) {
            loadMore();
          }
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to post!</Text>
          </View>
        }
      />
    </View>
  );
};
```

---

## Error Handling

### Error Response Codes

| Status Code | Meaning      | User Message                                       |
| ----------- | ------------ | -------------------------------------------------- |
| `200`       | Success      | Operation completed                                |
| `201`       | Created      | Post/comment created successfully                  |
| `400`       | Bad Request  | Validation error - check your input                |
| `401`       | Unauthorized | Please log in to continue                          |
| `403`       | Forbidden    | You can only modify posts you created / Admin only |
| `404`       | Not Found    | Forum/post not found                               |
| `429`       | Rate Limited | Too many requests - please slow down               |
| `500`       | Server Error | Server error - please try again later              |

---

## UI/UX Best Practices

### 1. Show Edit/Delete Only for User's Own Posts

```typescript
const isOwner = post.author._id === currentUserId;

{isOwner && (
  <View style={styles.actions}>
    <TouchableOpacity onPress={() => handleEdit(post._id)}>
      <Text>Edit</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => handleDelete(post._id)}>
      <Text>Delete</Text>
    </TouchableOpacity>
  </View>
)}
```

### 2. Display Embedded Links

```typescript
{post.embeddedLinks && post.embeddedLinks.length > 0 && (
  <View style={styles.embeddedLinks}>
    {post.embeddedLinks.map((link, index) => (
      <TouchableOpacity
        key={index}
        style={styles.linkCard}
        onPress={() => openUrl(link.url)}
      >
        {link.thumbnail && (
          <Image source={{ uri: link.thumbnail }} style={styles.linkThumbnail} />
        )}
        <View style={styles.linkContent}>
          <Text style={styles.linkTitle}>{link.title || link.url}</Text>
          {link.description && (
            <Text style={styles.linkDescription}>{link.description}</Text>
          )}
          <Text style={styles.linkType}>{link.type}</Text>
        </View>
      </TouchableOpacity>
    ))}
  </View>
)}
```

### 3. Nested Comments Display

```typescript
const renderComment = (comment: ForumComment, depth = 0) => {
  if (depth > 3) return null; // Max 3 levels

  return (
    <View style={[styles.comment, { marginLeft: depth * 20 }]}>
      <Text>{comment.content}</Text>
      <Text>By {comment.user.username}</Text>

      {comment.replies && comment.replies.length > 0 && (
        <View style={styles.replies}>
          {comment.replies.map((reply) => renderComment(reply, depth + 1))}
        </View>
      )}
    </View>
  );
};
```

---

## Summary

### Quick Reference

**Forum Categories (Recommended):**

```typescript
GET    /api/community/forum                 // List categories
GET    /api/community/forum/:forumId/posts  // Get posts
POST   /api/community/forum/:forumId/posts  // Create post
PUT    /api/community/forum/posts/:postId   // Update post (creator)
DELETE /api/community/forum/posts/:postId   // Delete post (creator)
POST   /api/community/forum/posts/:postId/like              // Like post
GET    /api/community/forum/posts/:postId/comments         // Get comments
POST   /api/community/forum/posts/:postId/comments         // Add comment
POST   /api/community/forum/comments/:commentId/like      // Like comment
```

**Forum Threads (Legacy):**

```typescript
POST   /api/community/forum/threads         // Create thread
GET    /api/community/forum/threads         // List threads
GET    /api/community/forum/threads/:id     // Get thread
PUT    /api/community/forum/threads/:id     // Update thread (creator)
DELETE /api/community/forum/threads/:id     // Delete thread (creator)
```

### Key Points

✅ **Forum Categories** - Organized by topic (we seeded 15 categories)  
✅ **Forum Posts** - Users create posts within categories  
✅ **Forum Threads** - Simple standalone threads (legacy)  
✅ **Comments** - Nested replies (max 3 levels)  
✅ **Likes** - Toggle like/unlike on posts and comments  
✅ **Ownership** - Only creators can update/delete their posts  
✅ **Embedded Links** - Support for rich link previews

---

**Last Updated:** 2024-01-15  
**Version:** 1.0
