# Frontend Integration Guide - Community API

**Version:** 1.0  
**Last Updated:** 2024-01-15  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Base URL & Configuration](#base-url--configuration)
4. [Error Handling Strategy](#error-handling-strategy)
5. [Prayer Wall API](#prayer-wall-api)
6. [Forum API](#forum-api)
7. [Groups API](#groups-api)
8. [Polls API](#polls-api)
9. [Best Practices](#best-practices)
10. [Common Patterns](#common-patterns)
11. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- Authentication token (JWT) stored in AsyncStorage/SecureStore
- Base API URL: `https://your-api-domain.com/api/community`
- Network request library (axios, fetch, etc.)

### Response Format Standard

All endpoints return responses in this format:

```typescript
// Success Response
{
  success: true,
  data: { ... },
  message?: string
}

// Error Response
{
  success: false,
  error: string,
  code?: string,
  details?: any
}

// List Response with Pagination
{
  success: true,
  data: {
    items: [...],
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number,
      hasMore: boolean
    }
  }
}
```

---

## Authentication

### Token Storage

Store JWT token securely:

```typescript
// React Native - SecureStore
import * as SecureStore from 'expo-secure-store';

// Store token
await SecureStore.setItemAsync('authToken', token);

// Retrieve token
const token = await SecureStore.getItemAsync('authToken');

// Remove token
await SecureStore.deleteItemAsync('authToken');
```

### Adding Authentication Header

```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Create axios instance
const apiClient = axios.create({
  baseURL: 'https://your-api-domain.com/api/community',
  timeout: 30000,
});

// Add request interceptor for authentication
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      await SecureStore.deleteItemAsync('authToken');
      // Navigate to login screen
    }
    return Promise.reject(error);
  }
);
```

---

## Base URL & Configuration

### Environment Configuration

```typescript
// config/api.ts
const API_CONFIG = {
  baseURL: __DEV__ 
    ? 'http://localhost:3000/api/community'
    : 'https://api.jevahapp.com/api/community',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};
```

---

## Error Handling Strategy

### Comprehensive Error Handler

```typescript
// utils/apiErrorHandler.ts
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

export class ApiErrorHandler {
  static handle(error: any): ApiError {
    // Network error
    if (!error.response) {
      return {
        success: false,
        error: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      };
    }

    // Server error response
    const { status, data } = error.response;

    // Handle specific status codes
    switch (status) {
      case 400:
        return {
          success: false,
          error: data.error || 'Invalid request. Please check your input.',
          code: data.code || 'VALIDATION_ERROR',
          details: data.details,
        };
      
      case 401:
        return {
          success: false,
          error: 'Unauthorized. Please login again.',
          code: 'UNAUTHORIZED',
        };
      
      case 403:
        return {
          success: false,
          error: data.error || 'You do not have permission to perform this action.',
          code: 'FORBIDDEN',
        };
      
      case 404:
        return {
          success: false,
          error: data.error || 'Resource not found.',
          code: 'NOT_FOUND',
        };
      
      case 429:
        return {
          success: false,
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        };
      
      case 500:
      case 502:
      case 503:
        return {
          success: false,
          error: 'Server error. Please try again later.',
          code: 'SERVER_ERROR',
        };
      
      default:
        return {
          success: false,
          error: data.error || 'An unexpected error occurred.',
          code: data.code || 'UNKNOWN_ERROR',
          details: data.details,
        };
    }
  }

  static showError(error: ApiError, showToast?: (message: string) => void) {
    if (showToast) {
      showToast(error.error);
    } else {
      console.error('API Error:', error);
    }
  }
}
```

### Graceful Error Handling in Components

```typescript
// hooks/useApiCall.ts
import { useState, useCallback } from 'react';
import { ApiErrorHandler, ApiError } from '../utils/apiErrorHandler';

export function useApiCall<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = useCallback(
    async (apiCall: () => Promise<T>): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiCall();
        return result;
      } catch (err: any) {
        const apiError = ApiErrorHandler.handle(err);
        setError(apiError);
        ApiErrorHandler.showError(apiError);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { execute, loading, error };
}
```

---

## Prayer Wall API

### 1. Create Prayer Request

**Endpoint:** `POST /api/community/prayer-wall/create`

**Request:**
```typescript
interface CreatePrayerRequest {
  prayerText: string; // Required, 1-2000 characters
  verse?: {
    text: string;
    reference: string; // e.g., "John 3:16"
  };
  color: string; // Hex color code, e.g., "#A16CE5"
  shape: "rectangle" | "circle" | "scalloped" | "square" | "square2" | "square3" | "square4";
  anonymous?: boolean;
  media?: string[]; // Array of media URLs
}

// Example
const createPrayer = async (prayerData: CreatePrayerRequest) => {
  try {
    const response = await apiClient.post('/prayer-wall/create', prayerData);
    if (response.data.success) {
      return response.data.data; // Prayer object
    }
    throw new Error('Failed to create prayer');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    _id: string;
    userId: string;
    prayerText: string;
    verse?: {
      text: string;
      reference: string;
    };
    color: string;
    shape: string;
    createdAt: string; // ISO timestamp
    updatedAt: string;
    likesCount: number;
    commentsCount: number;
    userLiked: boolean;
    author: {
      _id: string;
      username: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    };
    anonymous: boolean;
    media: string[];
  }
}
```

**Error Handling:**
```typescript
try {
  const prayer = await createPrayer({
    prayerText: "Prayer for my job interview...",
    verse: {
      text: "For I know the plans I have for you...",
      reference: "Jeremiah 29:11"
    },
    color: "#A16CE5",
    shape: "square"
  });
  
  if (prayer) {
    // Success - navigate or show success message
    showToast('Prayer created successfully!');
  }
} catch (error: any) {
  // Error already handled by useApiCall
  // Additional custom handling if needed
  if (error.code === 'VALIDATION_ERROR') {
    // Show specific validation errors
    showValidationErrors(error.details);
  }
}
```

### 2. Get Prayer Requests (Paginated)

**Endpoint:** `GET /api/community/prayer-wall`

**Request:**
```typescript
interface GetPrayersParams {
  page?: number; // Default: 1
  limit?: number; // Default: 20, max: 100
  sortBy?: "createdAt" | "likesCount" | "commentsCount"; // Default: "createdAt"
  sortOrder?: "asc" | "desc"; // Default: "desc"
}

const getPrayers = async (params?: GetPrayersParams) => {
  try {
    const response = await apiClient.get('/prayer-wall', { params });
    if (response.data.success) {
      return response.data.data; // { prayers: [], pagination: {} }
    }
    throw new Error('Failed to fetch prayers');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    prayers: Array<{
      _id: string;
      userId: string;
      prayerText: string;
      verse?: { text: string; reference: string };
      color: string;
      shape: string;
      createdAt: string;
      likesCount: number;
      commentsCount: number;
      userLiked: boolean;
      author: {
        _id: string;
        username: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
      };
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
  }
}
```

**Usage with Infinite Scroll:**
```typescript
// hooks/usePrayers.ts
import { useState, useEffect, useCallback } from 'react';

export function usePrayers() {
  const [prayers, setPrayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<ApiError | null>(null);

  const loadPrayers = useCallback(async (reset = false) => {
    if (loading || (!hasMore && !reset)) return;

    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      const response = await getPrayers({
        page: currentPage,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (response && response.prayers) {
        if (reset) {
          setPrayers(response.prayers);
        } else {
          setPrayers(prev => [...prev, ...response.prayers]);
        }
        
        setHasMore(response.pagination.hasMore);
        setPage(currentPage + 1);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  const refresh = useCallback(() => {
    setPage(1);
    setHasMore(true);
    loadPrayers(true);
  }, [loadPrayers]);

  useEffect(() => {
    loadPrayers(true);
  }, []);

  return { prayers, loading, error, loadMore: () => loadPrayers(false), refresh };
}
```

### 3. Search Prayer Requests (AI-Enhanced)

**Endpoint:** `GET /api/community/prayer-wall/search`

**Request:**
```typescript
interface SearchPrayersParams {
  query: string; // Required - search query
  page?: number;
  limit?: number;
}

const searchPrayers = async (params: SearchPrayersParams) => {
  try {
    const response = await apiClient.get('/prayer-wall/search', { params });
    if (response.data.success) {
      return response.data.data; // { prayers: [], pagination: {} }
    }
    throw new Error('Failed to search prayers');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    prayers: Array<{
      // Same as prayer object above
      relevanceScore: number; // 0-1, how relevant this prayer is to the query
    }>;
    pagination: { ... };
  }
}
```

**Usage with Debouncing:**
```typescript
// hooks/useSearchPrayers.ts
import { useState, useEffect } from 'react';
import { debounce } from 'lodash';

export function useSearchPrayers() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const debouncedSearch = debounce(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await searchPrayers({ query: searchQuery, page: 1, limit: 20 });
      if (response && response.prayers) {
        setResults(response.prayers);
      }
    } catch (err: any) {
      setError(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, 500); // 500ms debounce

  useEffect(() => {
    debouncedSearch(query);
    return () => {
      debouncedSearch.cancel();
    };
  }, [query]);

  return { query, setQuery, results, loading, error };
}
```

### 4. Like/Unlike Prayer

**Endpoint:** `POST /api/community/prayer-wall/:id/like`

**Request:**
```typescript
const likePrayer = async (prayerId: string) => {
  try {
    const response = await apiClient.post(`/prayer-wall/${prayerId}/like`);
    if (response.data.success) {
      return response.data.data; // { liked: boolean, likesCount: number }
    }
    throw new Error('Failed to toggle like');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    liked: boolean;
    likesCount: number;
  }
}
```

**Optimistic Update Pattern:**
```typescript
// Optimistic update for better UX
const handleLikePrayer = async (prayerId: string, currentLiked: boolean, currentLikesCount: number) => {
  // Optimistically update UI
  updatePrayerInList(prayerId, {
    userLiked: !currentLiked,
    likesCount: currentLiked ? currentLikesCount - 1 : currentLikesCount + 1,
  });

  try {
    const result = await likePrayer(prayerId);
    if (result) {
      // Update with actual server response
      updatePrayerInList(prayerId, {
        userLiked: result.liked,
        likesCount: result.likesCount,
      });
    }
  } catch (error) {
    // Revert optimistic update on error
    updatePrayerInList(prayerId, {
      userLiked: currentLiked,
      likesCount: currentLikesCount,
    });
    ApiErrorHandler.showError(error);
  }
};
```

### 5. Get Prayer Comments

**Endpoint:** `GET /api/community/prayer-wall/:id/comments`

**Request:**
```typescript
interface GetCommentsParams {
  page?: number;
  limit?: number;
}

const getPrayerComments = async (prayerId: string, params?: GetCommentsParams) => {
  try {
    const response = await apiClient.get(`/prayer-wall/${prayerId}/comments`, { params });
    if (response.data.success) {
      return response.data.data; // { comments: [], pagination: {} }
    }
    throw new Error('Failed to fetch comments');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    comments: Array<{
      _id: string;
      userId: string;
      content: string;
      createdAt: string;
      likesCount: number;
      userLiked: boolean;
      author: {
        _id: string;
        username: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
      };
      replies: Array<{
        // Same structure as comment
        parentCommentId: string;
      }>;
    }>;
    pagination: { ... };
  }
}
```

### 6. Add Comment to Prayer

**Endpoint:** `POST /api/community/prayer-wall/:id/comments`

**Request:**
```typescript
interface CreateCommentRequest {
  content: string; // Required, 1-2000 characters
  parentCommentId?: string; // For nested replies
}

const commentOnPrayer = async (prayerId: string, commentData: CreateCommentRequest) => {
  try {
    const response = await apiClient.post(`/prayer-wall/${prayerId}/comments`, commentData);
    if (response.data.success) {
      return response.data.data; // Comment object
    }
    throw new Error('Failed to create comment');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

---

## Forum API

### 1. Create Forum (Admin Only)

**Endpoint:** `POST /api/community/forum/create`

**Request:**
```typescript
interface CreateForumRequest {
  title: string; // Required, 3-100 characters
  description: string; // Required, 10-500 characters
}

const createForum = async (forumData: CreateForumRequest) => {
  try {
    const response = await apiClient.post('/forum/create', forumData);
    if (response.data.success) {
      return response.data.data; // Forum object
    }
    throw new Error('Failed to create forum');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    if (apiError.code === 'FORBIDDEN') {
      showToast('Only admins can create forums');
    }
    throw apiError;
  }
};
```

### 2. Get All Forums

**Endpoint:** `GET /api/community/forum`

**Request:**
```typescript
const getForums = async () => {
  try {
    const response = await apiClient.get('/forum');
    if (response.data.success) {
      return response.data.data.forums; // Array of forums
    }
    throw new Error('Failed to fetch forums');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

### 3. Create Forum Post

**Endpoint:** `POST /api/community/forum/:forumId/posts`

**Request:**
```typescript
interface CreateForumPostRequest {
  content: string; // Required, 1-5000 characters
  embeddedLinks?: Array<{
    url: string; // Required, valid URL
    title?: string; // Max 200 characters
    description?: string; // Max 500 characters
    thumbnail?: string; // Valid URL
    type: "video" | "article" | "resource" | "other"; // Required
  }>; // Max 5 links
}

const createForumPost = async (forumId: string, postData: CreateForumPostRequest) => {
  try {
    const response = await apiClient.post(`/forum/${forumId}/posts`, postData);
    if (response.data.success) {
      return response.data.data; // Post object
    }
    throw new Error('Failed to create post');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

**Link Embedding Helper:**
```typescript
// utils/linkEmbedder.ts
export const extractLinkMetadata = async (url: string): Promise<{
  title?: string;
  description?: string;
  thumbnail?: string;
  type: "video" | "article" | "resource" | "other";
}> => {
  // Detect link type
  const isVideo = /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/i.test(url);
  const isArticle = /medium\.com|blog|article|news/i.test(url);
  
  let type: "video" | "article" | "resource" | "other" = "other";
  if (isVideo) type = "video";
  else if (isArticle) type = "article";
  else type = "resource";

  // You can fetch OG tags here if needed
  // For now, return basic detection
  return {
    type,
    // title, description, thumbnail would come from OG tag fetching
  };
};
```

### 4. Get Forum Posts

**Endpoint:** `GET /api/community/forum/:forumId/posts`

**Request:**
```typescript
interface GetForumPostsParams {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "likesCount" | "commentsCount";
  sortOrder?: "asc" | "desc";
}

const getForumPosts = async (forumId: string, params?: GetForumPostsParams) => {
  try {
    const response = await apiClient.get(`/forum/${forumId}/posts`, { params });
    if (response.data.success) {
      return response.data.data; // { posts: [], pagination: {} }
    }
    throw new Error('Failed to fetch posts');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

### 5. Like/Unlike Forum Post

**Endpoint:** `POST /api/community/forum/posts/:postId/like`

Same pattern as prayer like endpoint.

### 6. Add Comment to Forum Post

**Endpoint:** `POST /api/community/forum/posts/:postId/comments`

**Request:**
```typescript
interface CreateForumCommentRequest {
  content: string; // Required, 1-2000 characters
  parentCommentId?: string; // For nested replies (max 3 levels)
}

const commentOnForumPost = async (postId: string, commentData: CreateForumCommentRequest) => {
  try {
    const response = await apiClient.post(`/forum/posts/${postId}/comments`, commentData);
    if (response.data.success) {
      return response.data.data; // Comment object
    }
    throw new Error('Failed to create comment');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

---

## Groups API

### 1. Create Group

**Endpoint:** `POST /api/community/groups/create`

**Request:**
```typescript
interface CreateGroupRequest {
  name: string; // Required, 3-100 characters
  description: string; // Required, 10-500 characters
  isPublic: boolean; // Required
  profileImage?: File | Blob; // Optional, max 5MB, JPEG/PNG/WebP
}

const createGroup = async (groupData: CreateGroupRequest) => {
  try {
    const formData = new FormData();
    formData.append('name', groupData.name);
    formData.append('description', groupData.description);
    formData.append('isPublic', String(groupData.isPublic));
    
    if (groupData.profileImage) {
      formData.append('profileImage', {
        uri: groupData.profileImage.uri, // For React Native
        type: groupData.profileImage.type || 'image/jpeg',
        name: 'profileImage.jpg',
      } as any);
    }

    const response = await apiClient.post('/groups/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.success) {
      return response.data.data; // Group object
    }
    throw new Error('Failed to create group');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    _id: string;
    name: string;
    description: string;
    profileImageUrl?: string;
    createdBy: string;
    isPublic: boolean;
    membersCount: number;
    createdAt: string;
    members: Array<{
      _id: string;
      userId: string;
      role: "admin" | "member";
      joinedAt: string;
      user: {
        _id: string;
        username: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
      };
    }>;
    creator: {
      _id: string;
      username: string;
      avatarUrl?: string;
    };
    isMember: boolean;
    userRole?: "admin" | "member";
  }
}
```

### 2. Get My Groups

**Endpoint:** `GET /api/community/groups/my-groups`

**Request:**
```typescript
const getMyGroups = async (params?: { page?: number; limit?: number }) => {
  try {
    const response = await apiClient.get('/groups/my-groups', { params });
    if (response.data.success) {
      return response.data.data; // { groups: [], pagination: {} }
    }
    throw new Error('Failed to fetch my groups');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

### 3. Explore Public Groups

**Endpoint:** `GET /api/community/groups/explore`

**Request:**
```typescript
interface ExploreGroupsParams {
  page?: number;
  limit?: number;
  search?: string; // Search by name or description
  sortBy?: "membersCount" | "createdAt" | "name";
  sortOrder?: "asc" | "desc";
}

const exploreGroups = async (params?: ExploreGroupsParams) => {
  try {
    const response = await apiClient.get('/groups/explore', { params });
    if (response.data.success) {
      return response.data.data; // { groups: [], pagination: {} }
    }
    throw new Error('Failed to explore groups');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

### 4. Upload Group Image

**Endpoint:** `POST /api/community/groups/:id/image`

**Request:**
```typescript
const uploadGroupImage = async (groupId: string, image: File | Blob) => {
  try {
    const formData = new FormData();
    formData.append('profileImage', {
      uri: image.uri, // React Native
      type: image.type || 'image/jpeg',
      name: 'profileImage.jpg',
    } as any);

    const response = await apiClient.post(`/groups/${groupId}/image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.success) {
      return response.data.data.profileImageUrl;
    }
    throw new Error('Failed to upload image');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

### 5. Add Members to Group

**Endpoint:** `POST /api/community/groups/:id/members`

**Request:**
```typescript
interface AddMembersRequest {
  userIds: string[]; // Array of user IDs, max 50
}

const addGroupMembers = async (groupId: string, userIds: string[]) => {
  try {
    if (userIds.length > 50) {
      throw new Error('Maximum 50 users per request');
    }

    const response = await apiClient.post(`/groups/${groupId}/members`, { userIds });
    if (response.data.success) {
      return response.data.data; // { addedMembers: [], failedUsers: [] }
    }
    throw new Error('Failed to add members');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    addedMembers: Array<{
      _id: string;
      userId: string;
      role: "member";
      joinedAt: string;
      user: { ... };
    }>;
    failedUsers: Array<{
      userId: string;
      reason: string;
    }>;
  }
}
```

### 6. Remove Member from Group

**Endpoint:** `DELETE /api/community/groups/:id/members/:userId`

**Request:**
```typescript
const removeGroupMember = async (groupId: string, userId: string) => {
  try {
    const response = await apiClient.delete(`/groups/${groupId}/members/${userId}`);
    if (response.data.success) {
      return true;
    }
    throw new Error('Failed to remove member');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

---

## Polls API

### 1. Create Poll (Admin Only)

**Endpoint:** `POST /api/community/polls/create`

**Request:**
```typescript
interface CreatePollRequest {
  title: string; // Required, 5-200 characters (or use "question")
  description?: string; // Optional, max 500 characters
  options: string[]; // Required, 2-10 options, each max 200 characters
  expiresAt?: string; // ISO date string, must be future date
}

const createPoll = async (pollData: CreatePollRequest) => {
  try {
    const response = await apiClient.post('/polls/create', pollData);
    if (response.data.success) {
      return response.data.data; // Poll object
    }
    throw new Error('Failed to create poll');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    if (apiError.code === 'FORBIDDEN') {
      showToast('Only admins can create polls');
    }
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    _id: string;
    title: string;
    question: string; // Same as title
    description?: string;
    createdBy: string;
    options: Array<{
      _id: string; // Format: "pollId_optionIndex"
      text: string;
      votesCount: number;
      percentage: number; // 0-100
    }>;
    totalVotes: number;
    expiresAt?: string;
    createdAt: string;
    isActive: boolean;
    userVoted: boolean;
    userVoteOptionId?: string;
    createdByUser: {
      _id: string;
      username: string;
      avatarUrl?: string;
    };
  }
}
```

### 2. Get All Polls

**Endpoint:** `GET /api/community/polls`

**Request:**
```typescript
interface GetPollsParams {
  page?: number;
  limit?: number;
  status?: "active" | "expired" | "all"; // Default: "active"
  sortBy?: "createdAt" | "totalVotes";
  sortOrder?: "asc" | "desc";
}

const getPolls = async (params?: GetPollsParams) => {
  try {
    const response = await apiClient.get('/polls', { params });
    if (response.data.success) {
      return response.data.data; // { polls: [], pagination: {} }
    }
    throw new Error('Failed to fetch polls');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

### 3. Vote on Poll

**Endpoint:** `POST /api/community/polls/:id/vote`

**Request:**
```typescript
interface VotePollRequest {
  optionId: string; // Format: "pollId_optionIndex", e.g., "507f1f77bcf86cd799439040_0"
  // OR
  optionIndex?: number; // Alternative format
}

const voteOnPoll = async (pollId: string, voteData: VotePollRequest) => {
  try {
    const response = await apiClient.post(`/polls/${pollId}/vote`, voteData);
    if (response.data.success) {
      return response.data.data; // Updated poll object with percentages
    }
    throw new Error('Failed to vote');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    if (apiError.code === 'VALIDATION_ERROR' && apiError.error.includes('expired')) {
      showToast('This poll has expired');
    }
    throw apiError;
  }
};
```

**Response:**
```typescript
{
  success: true,
  data: {
    // Same as poll object above, but with updated percentages
    // Percentages are only visible after user votes
    options: Array<{
      _id: string;
      text: string;
      votesCount: number;
      percentage: number; // Now visible
    }>;
    userVoted: true;
    userVoteOptionId: string;
  }
}
```

**Important Poll UI Logic:**
```typescript
// PollsScreen.tsx
const PollCard = ({ poll }) => {
  const [localPoll, setLocalPoll] = useState(poll);
  const { execute, loading } = useApiCall();

  const handleVote = async (optionId: string) => {
    // Check if already voted
    if (localPoll.userVoted) {
      showToast('You have already voted on this poll');
      return;
    }

    // Check if poll is active
    if (!localPoll.isActive) {
      showToast('This poll has expired');
      return;
    }

    // Optimistically update UI
    const optimisticPoll = {
      ...localPoll,
      userVoted: true,
      userVoteOptionId: optionId,
      totalVotes: localPoll.totalVotes + 1,
    };
    setLocalPoll(optimisticPoll);

    // Submit vote
    const result = await execute(() => voteOnPoll(localPoll._id, { optionId }));
    
    if (result) {
      // Update with server response (includes percentages)
      setLocalPoll(result);
    } else {
      // Revert on error
      setLocalPoll(poll);
    }
  };

  return (
    <View>
      <Text>{localPoll.title}</Text>
      {localPoll.options.map(option => (
        <TouchableOpacity
          key={option._id}
          onPress={() => handleVote(option._id)}
          disabled={localPoll.userVoted || !localPoll.isActive}
        >
          <Text>{option.text}</Text>
          {/* Show percentages only if user voted */}
          {localPoll.userVoted && (
            <Text>{option.percentage}% ({option.votesCount} votes)</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

### 4. Update Poll (Admin Only)

**Endpoint:** `PUT /api/community/polls/:id`

**Request:**
```typescript
interface UpdatePollRequest {
  title?: string;
  description?: string;
  expiresAt?: string | null; // null to remove expiry
  isActive?: boolean;
  // Note: Cannot update options after poll is created
}

const updatePoll = async (pollId: string, updates: UpdatePollRequest) => {
  try {
    const response = await apiClient.put(`/polls/${pollId}`, updates);
    if (response.data.success) {
      return response.data.data; // Updated poll object
    }
    throw new Error('Failed to update poll');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

### 5. Delete Poll (Admin Only)

**Endpoint:** `DELETE /api/community/polls/:id`

**Request:**
```typescript
const deletePoll = async (pollId: string) => {
  try {
    const response = await apiClient.delete(`/polls/${pollId}`);
    if (response.data.success) {
      return true;
    }
    throw new Error('Failed to delete poll');
  } catch (error) {
    const apiError = ApiErrorHandler.handle(error);
    throw apiError;
  }
};
```

---

## Best Practices

### 1. Loading States

Always show loading indicators:

```typescript
const PrayerList = () => {
  const { prayers, loading, error, loadMore } = usePrayers();

  if (loading && prayers.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <FlatList
      data={prayers}
      renderItem={({ item }) => <PrayerCard prayer={item} />}
      onEndReached={loadMore}
      ListFooterComponent={loading ? <LoadingSpinner /> : null}
      refreshing={loading}
      onRefresh={loadMore}
    />
  );
};
```

### 2. Error Boundaries

Wrap components with error boundaries:

```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### 3. Retry Logic

Implement retry for failed requests:

```typescript
const retryApiCall = async (apiCall: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### 4. Offline Support

Handle offline scenarios:

```typescript
import NetInfo from '@react-native-community/netinfo';

const checkNetworkAndCall = async (apiCall: () => Promise<any>) => {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) {
    throw {
      success: false,
      error: 'No internet connection',
      code: 'OFFLINE',
    };
  }
  return await apiCall();
};
```

### 5. Caching Strategy

Implement caching for better performance:

```typescript
// Simple in-memory cache
const cache = new Map();

const getCachedOrFetch = async (key: string, fetchFn: () => Promise<any>, ttl = 60000) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};
```

---

## Common Patterns

### 1. Optimistic Updates

Always update UI immediately, then sync with server:

```typescript
const handleLike = async (itemId: string) => {
  // Immediate UI update
  const currentItem = items.find(i => i._id === itemId);
  updateItemInState(itemId, {
    userLiked: !currentItem.userLiked,
    likesCount: currentItem.userLiked 
      ? currentItem.likesCount - 1 
      : currentItem.likesCount + 1,
  });

  try {
    await likeItem(itemId);
  } catch (error) {
    // Revert on error
    updateItemInState(itemId, currentItem);
    ApiErrorHandler.showError(error);
  }
};
```

### 2. Form Validation

Validate before submitting:

```typescript
const validatePrayerForm = (data: CreatePrayerRequest): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.prayerText || data.prayerText.trim().length === 0) {
    errors.push('Prayer text is required');
  } else if (data.prayerText.length > 2000) {
    errors.push('Prayer text must be less than 2000 characters');
  }

  if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
    errors.push('Invalid color format');
  }

  const validShapes = ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"];
  if (data.shape && !validShapes.includes(data.shape)) {
    errors.push('Invalid shape');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
```

### 3. Image Upload Helper

```typescript
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const pickAndResizeImage = async (maxWidth = 800, maxHeight = 800, quality = 0.8) => {
  // Request permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission denied');
  }

  // Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.cancelled) {
    return null;
  }

  // Resize if needed
  const manipulated = await ImageManipulator.manipulateAsync(
    result.uri,
    [{ resize: { width: maxWidth, height: maxHeight } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );

  return {
    uri: manipulated.uri,
    type: 'image/jpeg',
    name: 'image.jpg',
  };
};
```

---

## Troubleshooting

### Common Issues

#### 1. 401 Unauthorized
**Problem:** Token expired or invalid  
**Solution:**
```typescript
// Refresh token or redirect to login
if (error.response?.status === 401) {
  await SecureStore.deleteItemAsync('authToken');
  navigation.navigate('Login');
}
```

#### 2. 429 Rate Limit Exceeded
**Problem:** Too many requests  
**Solution:**
```typescript
// Implement exponential backoff
const retryWithBackoff = async (apiCall, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};
```

#### 3. Network Timeout
**Problem:** Slow network or server timeout  
**Solution:**
```typescript
// Increase timeout for slow connections
const apiClient = axios.create({
  timeout: 60000, // 60 seconds
});
```

#### 4. FormData Not Working
**Problem:** Image upload failing  
**Solution:**
```typescript
// Ensure proper FormData format for React Native
const formData = new FormData();
formData.append('profileImage', {
  uri: image.uri,
  type: 'image/jpeg',
  name: 'profileImage.jpg',
} as any);
```

---

## Testing Checklist

- [ ] All endpoints tested with valid data
- [ ] Error handling tested (400, 401, 403, 404, 500)
- [ ] Loading states working correctly
- [ ] Pagination working (infinite scroll)
- [ ] Optimistic updates working
- [ ] Image upload working
- [ ] Offline handling implemented
- [ ] Rate limiting handled gracefully
- [ ] Token refresh working
- [ ] Form validation working

---

**Last Updated:** 2024-01-15  
**Status:** Production Ready for Frontend Integration

