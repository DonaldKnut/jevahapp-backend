# Frontend Integration Guide - Account & Profile Settings

**Complete guide for consuming Account & Profile Settings API endpoints**

---

## Table of Contents

1. [API Client Setup](#api-client-setup)
2. [TypeScript Types](#typescript-types)
3. [API Client Methods](#api-client-methods)
4. [React Hooks](#react-hooks)
5. [Component Integration](#component-integration)
6. [Error Handling](#error-handling)
7. [Complete Examples](#complete-examples)
8. [Testing Guide](#testing-guide)

---

## API Client Setup

### Base Configuration

**File:** `app/utils/apiClient.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-api-domain.com';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  user?: T; // For profile endpoints
  error?: string;
  code?: string;
  message?: string;
}

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await this.getAuthToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error: any) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // PATCH request
  async patch<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // PUT request
  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

---

## TypeScript Types

### User & Profile Types

**File:** `app/types/user.types.ts`

```typescript
export interface User {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string | null;
  avatarUpload?: string | null;
  bio?: string | null;
  section?: string; // "adults" | "kids"
  role?: string;
  isProfileComplete?: boolean;
  isEmailVerified?: boolean;
  isOnline?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  bio?: string;
  section?: string;
}
```

### Content Types

**File:** `app/types/content.types.ts`

```typescript
export interface Post {
  _id: string;
  userId: string;
  content?: string;
  media: MediaItem[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  _id: string;
  userId: string;
  url: string;
  thumbnail: string;
  type: "image" | "video";
  width?: number;
  height?: number;
  size?: number;
  duration?: number; // For videos
  title?: string; // For videos
  description?: string; // For videos
  viewsCount?: number; // For videos
  likesCount?: number; // For videos
  createdAt: string;
}

export interface Video extends MediaItem {
  type: "video";
  duration: number;
  title: string;
  description?: string;
  viewsCount: number;
  likesCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PostsResponse {
  posts: Post[];
  pagination: Pagination;
}

export interface MediaResponse {
  media: MediaItem[];
  pagination: Pagination;
}

export interface VideosResponse {
  videos: Video[];
  pagination: Pagination;
}
```

### Analytics Types

**File:** `app/types/analytics.types.ts`

```typescript
export interface UserAnalytics {
  posts: {
    total: number;
    published: number;
    drafts: number;
  };
  likes: {
    total: number;
    received: number;
  };
  liveSessions: {
    total: number;
    totalDuration: number; // in seconds
  };
  comments: {
    total: number;
    received: number;
  };
  drafts: {
    total: number;
    posts: number;
    videos: number;
  };
  shares: {
    total: number;
    received: number;
  };
}
```

---

## API Client Methods

### Profile Endpoints

**File:** `app/utils/profileApi.ts`

```typescript
import { apiClient } from './apiClient';
import { User, UpdateProfileData } from '../types/user.types';

export const profileApi = {
  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ user: User }>('/api/auth/me');
    if (!response.success || !response.user) {
      throw new Error(response.error || 'Failed to fetch user profile');
    }
    return response.user;
  },

  /**
   * Update current user profile
   * PATCH /api/users/me
   */
  async updateProfile(data: UpdateProfileData): Promise<User> {
    const response = await apiClient.patch<{ user: User; message: string }>(
      '/api/users/me',
      data
    );
    if (!response.success || !response.user) {
      throw new Error(response.error || 'Failed to update profile');
    }
    return response.user;
  },

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(): Promise<void> {
    const response = await apiClient.post('/api/auth/logout');
    if (!response.success) {
      throw new Error(response.error || 'Failed to logout');
    }
  },
};
```

### Content Endpoints

**File:** `app/utils/contentApi.ts`

```typescript
import { apiClient } from './apiClient';
import {
  PostsResponse,
  MediaResponse,
  VideosResponse,
} from '../types/content.types';

export const contentApi = {
  /**
   * Get user's posts
   * GET /api/users/:userId/posts
   */
  async getUserPosts(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PostsResponse> {
    const response = await apiClient.get<{ data: PostsResponse }>(
      `/api/users/${userId}/posts?page=${page}&limit=${limit}`
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch posts');
    }
    return response.data;
  },

  /**
   * Get user's media (images)
   * GET /api/users/:userId/media
   */
  async getUserMedia(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: 'image' | 'video'
  ): Promise<MediaResponse> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (type) {
      queryParams.append('type', type);
    }
    
    const response = await apiClient.get<{ data: MediaResponse }>(
      `/api/users/${userId}/media?${queryParams.toString()}`
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch media');
    }
    return response.data;
  },

  /**
   * Get user's videos
   * GET /api/users/:userId/videos
   */
  async getUserVideos(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<VideosResponse> {
    const response = await apiClient.get<{ data: VideosResponse }>(
      `/api/users/${userId}/videos?page=${page}&limit=${limit}`
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch videos');
    }
    return response.data;
  },
};
```

### Analytics Endpoint

**File:** `app/utils/analyticsApi.ts`

```typescript
import { apiClient } from './apiClient';
import { UserAnalytics } from '../types/analytics.types';

export const analyticsApi = {
  /**
   * Get user analytics
   * GET /api/users/:userId/analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const response = await apiClient.get<{ data: UserAnalytics }>(
      `/api/users/${userId}/analytics`
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch analytics');
    }
    return response.data;
  },
};
```

---

## React Hooks

### User Profile Hook

**File:** `app/hooks/useUserProfile.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { User, UpdateProfileData } from '../types/user.types';
import { profileApi } from '../utils/profileApi';

interface UseUserProfileResult {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
}

export function useUserProfile(): UseUserProfileResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await profileApi.getCurrentUser();
      setUser(userData);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    try {
      setError(null);
      const updatedUser = await profileApi.updateProfile(data);
      setUser(updatedUser);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      throw err; // Re-throw so caller can handle
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    user,
    loading,
    error,
    refresh: loadProfile,
    updateProfile,
  };
}

/**
 * Helper function to get full name
 */
export function getFullName(user: User | null): string {
  if (!user) return 'User';
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  return `${firstName} ${lastName}`.trim() || 'User';
}

/**
 * Helper function to get avatar URL
 */
export function getAvatarUrl(user: User | null): string | undefined {
  if (!user) return undefined;
  return user.avatarUpload || user.avatar || undefined;
}
```

### Account Content Hook

**File:** `app/hooks/useAccountContent.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Post, MediaItem, Video } from '../types/content.types';
import { UserAnalytics } from '../types/analytics.types';
import { contentApi } from '../utils/contentApi';
import { analyticsApi } from '../utils/analyticsApi';
import { profileApi } from '../utils/profileApi';

interface UseAccountContentResult {
  posts: Post[];
  media: MediaItem[];
  videos: Video[];
  analytics: UserAnalytics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  loadMoreMedia: () => Promise<void>;
  loadMoreVideos: () => Promise<void>;
}

export function useAccountContent(): UseAccountContentResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [postsPage, setPostsPage] = useState(1);
  const [mediaPage, setMediaPage] = useState(1);
  const [videosPage, setVideosPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreMedia, setHasMoreMedia] = useState(true);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user ID first
      const userProfile = await profileApi.getCurrentUser();
      const userId = userProfile._id || userProfile.id;

      if (!userId) {
        throw new Error('User ID not found');
      }

      // Fetch all data in parallel
      const [postsData, mediaData, videosData, analyticsData] =
        await Promise.all([
          contentApi.getUserPosts(userId, 1, 20),
          contentApi.getUserMedia(userId, 1, 20, 'image'),
          contentApi.getUserVideos(userId, 1, 20),
          analyticsApi.getUserAnalytics(userId),
        ]);

      setPosts(postsData.posts);
      setMedia(mediaData.media);
      setVideos(videosData.videos);
      setAnalytics(analyticsData);

      // Update pagination state
      setHasMorePosts(postsData.pagination.hasMore);
      setHasMoreMedia(mediaData.pagination.hasMore);
      setHasMoreVideos(videosData.pagination.hasMore);
      setPostsPage(1);
      setMediaPage(1);
      setVideosPage(1);
    } catch (err: any) {
      setError(err.message || 'Failed to load content');
      console.error('Error loading account content:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (!hasMorePosts || loading) return;

    try {
      const userProfile = await profileApi.getCurrentUser();
      const userId = userProfile._id || userProfile.id;
      if (!userId) return;

      const nextPage = postsPage + 1;
      const postsData = await contentApi.getUserPosts(userId, nextPage, 20);

      setPosts((prev) => [...prev, ...postsData.posts]);
      setHasMorePosts(postsData.pagination.hasMore);
      setPostsPage(nextPage);
    } catch (err: any) {
      console.error('Error loading more posts:', err);
    }
  }, [postsPage, hasMorePosts, loading]);

  const loadMoreMedia = useCallback(async () => {
    if (!hasMoreMedia || loading) return;

    try {
      const userProfile = await profileApi.getCurrentUser();
      const userId = userProfile._id || userProfile.id;
      if (!userId) return;

      const nextPage = mediaPage + 1;
      const mediaData = await contentApi.getUserMedia(
        userId,
        nextPage,
        20,
        'image'
      );

      setMedia((prev) => [...prev, ...mediaData.media]);
      setHasMoreMedia(mediaData.pagination.hasMore);
      setMediaPage(nextPage);
    } catch (err: any) {
      console.error('Error loading more media:', err);
    }
  }, [mediaPage, hasMoreMedia, loading]);

  const loadMoreVideos = useCallback(async () => {
    if (!hasMoreVideos || loading) return;

    try {
      const userProfile = await profileApi.getCurrentUser();
      const userId = userProfile._id || userProfile.id;
      if (!userId) return;

      const nextPage = videosPage + 1;
      const videosData = await contentApi.getUserVideos(userId, nextPage, 20);

      setVideos((prev) => [...prev, ...videosData.videos]);
      setHasMoreVideos(videosData.pagination.hasMore);
      setVideosPage(nextPage);
    } catch (err: any) {
      console.error('Error loading more videos:', err);
    }
  }, [videosPage, hasMoreVideos, loading]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  return {
    posts,
    media,
    videos,
    analytics,
    loading,
    error,
    refresh: loadContent,
    loadMorePosts,
    loadMoreMedia,
    loadMoreVideos,
  };
}
```

---

## Component Integration

### Profile Summary Component

**File:** `app/components/account/ProfileSummary.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserProfile, getFullName, getAvatarUrl } from '../../hooks/useUserProfile';
import { profileApi } from '../../utils/profileApi';

interface ProfileSummaryProps {
  onEdit: () => void;
  onLogout: () => void;
}

export default function ProfileSummary({
  onEdit,
  onLogout,
}: ProfileSummaryProps) {
  const { user, loading, updateProfile } = useUserProfile();
  const [updatingBio, setUpdatingBio] = useState(false);

  const handleAddBio = () => {
    Alert.prompt(
      'Add Bio',
      'Enter your bio (max 500 characters)',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save',
          onPress: async (bioText) => {
            if (!bioText) return;

            if (bioText.length > 500) {
              Alert.alert('Error', 'Bio must be less than 500 characters');
              return;
            }

            try {
              setUpdatingBio(true);
              await updateProfile({ bio: bioText });
              Alert.alert('Success', 'Bio updated successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to update bio');
            } finally {
              setUpdatingBio(false);
            }
          },
        },
      ],
      'plain-text',
      user?.bio || ''
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await profileApi.logout();
              // Clear local storage
              // Navigate to login
              onLogout();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color="#FEA74E" />
      </View>
    );
  }

  const avatarUrl = getAvatarUrl(user);
  const fullName = getFullName(user);

  return (
    <View className="items-center py-6">
      {/* Large Avatar */}
      <View className="mb-4">
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            className="w-24 h-24 rounded-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-24 h-24 rounded-full bg-gray-300 items-center justify-center">
            <Text className="text-2xl font-bold text-gray-600">
              {fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Edit Button */}
      <TouchableOpacity
        onPress={onEdit}
        className="mb-4 px-4 py-2 bg-[#FEA74E] rounded-lg"
      >
        <Text className="text-white font-medium">Edit</Text>
      </TouchableOpacity>

      {/* User Name */}
      <Text className="text-2xl font-bold text-[#3B3B3B] mb-2">
        {fullName}
      </Text>

      {/* Bio Section */}
      {user?.bio ? (
        <View className="px-4 mb-2">
          <Text className="text-[#3B3B3B] text-sm text-center">
            {user.bio}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleAddBio}
          disabled={updatingBio}
          className="mb-2"
        >
          {updatingBio ? (
            <ActivityIndicator size="small" color="#FEA74E" />
          ) : (
            <Text className="text-[#FEA74E] font-medium">+ Add bio</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Logout Button */}
      <TouchableOpacity
        onPress={handleLogout}
        className="mt-4 px-6 py-2 border border-red-500 rounded-lg"
      >
        <Text className="text-red-500 font-medium">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Content Section Component

**File:** `app/components/account/ContentSection.tsx`

```typescript
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountContent } from '../../hooks/useAccountContent';
import { Post, MediaItem, Video } from '../../types/content.types';
import { UserAnalytics } from '../../types/analytics.types';

interface ContentSectionProps {
  selectedIndex: number;
}

export default function ContentSection({ selectedIndex }: ContentSectionProps) {
  const {
    posts,
    media,
    videos,
    analytics,
    loading,
    error,
    loadMorePosts,
    loadMoreMedia,
    loadMoreVideos,
  } = useAccountContent();

  // Format number for display (e.g., 16800 -> "16.8k")
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && selectedIndex !== 3) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <ActivityIndicator size="large" color="#FEA74E" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center py-8">
        <Text className="text-red-500">{error}</Text>
      </View>
    );
  }

  // Posts Tab (Index 0)
  if (selectedIndex === 0) {
    const renderPostItem = ({ item }: { item: Post }) => {
      const thumbnailUrl =
        item.media?.[0]?.thumbnail || item.media?.[0]?.url;

      return (
        <TouchableOpacity
          className="w-[32%] mb-2 aspect-square"
          onPress={() => {
            // Navigate to post detail
            // navigation.navigate('PostDetail', { postId: item._id });
          }}
        >
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              className="w-full h-full rounded-lg"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full rounded-lg bg-gray-200 items-center justify-center">
              <Ionicons name="image-outline" size={32} color="#999" />
            </View>
          )}
        </TouchableOpacity>
      );
    };

    return (
      <FlatList
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={(item) => item._id}
        numColumns={3}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View className="items-center justify-center py-8">
            <Text className="text-gray-500">No posts yet</Text>
          </View>
        }
      />
    );
  }

  // Media Tab (Index 1)
  if (selectedIndex === 1) {
      const renderMediaItem = ({ item }: { item: MediaItem }) => {
        return (
          <TouchableOpacity
            className="w-[32%] mb-2 aspect-square"
            onPress={() => {
              // Navigate to media detail
            }}
          >
            <Image
              source={{ uri: item.thumbnail || item.url }}
              className="w-full h-full rounded-lg"
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      };

    return (
      <FlatList
        data={media}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item._id}
        numColumns={3}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        onEndReached={loadMoreMedia}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View className="items-center justify-center py-8">
            <Text className="text-gray-500">No media yet</Text>
          </View>
        }
      />
    );
  }

  // Videos Tab (Index 2)
  if (selectedIndex === 2) {
      const renderVideoItem = ({ item }: { item: Video }) => {
        return (
          <TouchableOpacity
            className="w-[32%] mb-2 aspect-square relative"
            onPress={() => {
              // Navigate to video player
            }}
          >
            <Image
              source={{ uri: item.thumbnail || item.url }}
              className="w-full h-full rounded-lg"
              resizeMode="cover"
            />
            <View className="absolute inset-0 items-center justify-center">
              <Ionicons name="play-circle" size={40} color="white" />
            </View>
            {item.duration && (
              <View className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded">
                <Text className="text-white text-xs">
                  {formatDuration(item.duration)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      };

    return (
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item._id}
        numColumns={3}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        onEndReached={loadMoreVideos}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View className="items-center justify-center py-8">
            <Text className="text-gray-500">No videos yet</Text>
          </View>
        }
      />
    );
  }

  // Analytics Tab (Index 3)
  if (selectedIndex === 3) {
      if (!analytics) {
        return (
          <View className="flex-1 items-center justify-center py-8">
            <ActivityIndicator size="large" color="#FEA74E" />
          </View>
        );
      }

      const analyticsMetrics = [
        {
          icon: 'albums-outline',
          label: 'Posts',
          value: formatNumber(analytics.posts.published),
          sub: 'Total published posts',
        },
        {
          icon: 'heart-outline',
          label: 'Likes',
          value: formatNumber(analytics.likes.total),
          sub: 'Number of "Like" engagements on all posts',
        },
        {
          icon: 'radio-outline',
          label: 'Live Sessions',
          value: analytics.liveSessions.total.toString(),
          sub: 'Number of times you went Live',
        },
        {
          icon: 'chatbubble-outline',
          label: 'Comments',
          value: formatNumber(analytics.comments.total),
          sub: 'Number of "comments" on all posts',
        },
        {
          icon: 'document-text-outline',
          label: 'Drafts',
          value: analytics.drafts.total.toString(),
          sub: 'Unpublished posts',
        },
        {
          icon: 'share-outline',
          label: 'Shares',
          value: formatNumber(analytics.shares.total),
          sub: 'Number of times people shared your contents',
        },
      ];

      return (
        <View className="px-4 py-4">
          {analyticsMetrics.map((metric, index) => (
            <View
              key={index}
              className="bg-white rounded-lg p-4 mb-4 shadow-sm"
            >
              <View className="flex-row items-center mb-2">
                <Ionicons name={metric.icon as any} size={24} color="#FEA74E" />
                <Text className="ml-3 text-lg font-semibold text-[#3B3B3B]">
                  {metric.label}
                </Text>
                <Text className="ml-auto text-lg font-bold text-[#3B3B3B]">
                  {metric.value}
                </Text>
              </View>
              <Text className="text-sm text-gray-500 ml-9">
                {metric.sub}
              </Text>
            </View>
          ))}
        </View>
      );
    }

  return null;
}
```

### Account Screen (Main Container)

**File:** `app/screens/AccountScreen.tsx`

```typescript
import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import AccountHeader from '../components/account/AccountHeader';
import ProfileSummary from '../components/account/ProfileSummary';
import ContentTabs from '../components/account/ContentTabs';
import ContentSection from '../components/account/ContentSection';

export default function AccountScreen() {
  const [selectedTab, setSelectedTab] = useState<number>(0);

  const handleEdit = () => {
    // Open edit profile modal
    // navigation.navigate('EditProfile');
  };

  const handleLogout = () => {
    // Handle logout
    // navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View className="flex-1 bg-white">
      <AccountHeader />
      <ScrollView className="flex-1">
        <ProfileSummary onEdit={handleEdit} onLogout={handleLogout} />
        <ContentTabs
          selectedIndex={selectedTab}
          onTabChange={setSelectedTab}
        />
        <ContentSection selectedIndex={selectedTab} />
      </ScrollView>
    </View>
  );
}
```

---

## Error Handling

### Error Handler Utility

**File:** `app/utils/errorHandler.ts`

```typescript
import { Alert } from 'react-native';

export function handleApiError(error: any): void {
  const errorMessage = error.message || 'An error occurred';

  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    // Handle authentication error
    Alert.alert('Session Expired', 'Please login again', [
      {
        text: 'OK',
        onPress: () => {
          // Navigate to login
          // navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  } else if (errorMessage.includes('403')) {
    Alert.alert('Error', "You don't have permission to view this content");
  } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
    Alert.alert('Network Error', 'Please check your internet connection');
  } else if (errorMessage.includes('500')) {
    Alert.alert('Server Error', 'Something went wrong. Please try again later.');
  } else if (errorMessage.includes('VALIDATION_ERROR')) {
    Alert.alert('Validation Error', errorMessage);
  } else {
    Alert.alert('Error', errorMessage);
  }
}
```

### Usage in Components

```typescript
import { handleApiError } from '../utils/errorHandler';

try {
  await updateProfile({ bio: bioText });
} catch (error) {
  handleApiError(error);
}
```

---

## Complete Examples

### Example: Complete Account Screen Integration

**File:** `app/screens/AccountScreen.tsx` (Complete)

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import AccountHeader from '../components/account/AccountHeader';
import ProfileSummary from '../components/account/ProfileSummary';
import ContentTabs from '../components/account/ContentTabs';
import ContentSection from '../components/account/ContentSection';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAccountContent } from '../hooks/useAccountContent';

export default function AccountScreen() {
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const { user, loading: profileLoading, refresh: refreshProfile } =
    useUserProfile();
  const {
    loading: contentLoading,
    refresh: refreshContent,
  } = useAccountContent();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), refreshContent()]);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = () => {
    // Navigate to edit profile screen
    // navigation.navigate('EditProfile');
  };

  const handleLogout = async () => {
    // Handle logout logic
    // await profileApi.logout();
    // navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (profileLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FEA74E" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <AccountHeader user={user} />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FEA74E"
          />
        }
      >
        <ProfileSummary onEdit={handleEdit} onLogout={handleLogout} />
        <ContentTabs
          selectedIndex={selectedTab}
          onTabChange={setSelectedTab}
        />
        <ContentSection selectedIndex={selectedTab} />
      </ScrollView>
    </View>
  );
}
```

---

## Testing Guide

### Unit Tests Example

**File:** `__tests__/hooks/useUserProfile.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { useUserProfile } from '../../app/hooks/useUserProfile';
import { profileApi } from '../../app/utils/profileApi';

jest.mock('../../app/utils/profileApi');

describe('useUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load user profile on mount', async () => {
    const mockUser = {
      _id: '123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    };

    (profileApi.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useUserProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.error).toBeNull();
  });

  it('should handle profile update', async () => {
    const mockUser = {
      _id: '123',
      firstName: 'John',
      lastName: 'Doe',
    };

    const updatedUser = {
      ...mockUser,
      bio: 'New bio',
    };

    (profileApi.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (profileApi.updateProfile as jest.Mock).mockResolvedValue(updatedUser);

    const { result } = renderHook(() => useUserProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.updateProfile({ bio: 'New bio' });

    expect(profileApi.updateProfile).toHaveBeenCalledWith({ bio: 'New bio' });
    expect(result.current.user?.bio).toBe('New bio');
  });
});
```

---

## Summary Checklist

### ✅ Implementation Checklist

- [ ] **API Client Setup**
  - [ ] Base API client with authentication
  - [ ] Error handling
  - [ ] Request/response interceptors

- [ ] **TypeScript Types**
  - [ ] User types
  - [ ] Content types
  - [ ] Analytics types
  - [ ] API response types

- [ ] **API Methods**
  - [ ] Profile API methods
  - [ ] Content API methods
  - [ ] Analytics API methods

- [ ] **React Hooks**
  - [ ] `useUserProfile` hook
  - [ ] `useAccountContent` hook
  - [ ] Helper functions

- [ ] **Components**
  - [ ] ProfileSummary component
  - [ ] ContentSection component
  - [ ] AccountScreen integration

- [ ] **Error Handling**
  - [ ] Error handler utility
  - [ ] User-friendly error messages
  - [ ] Network error handling

- [ ] **Testing**
  - [ ] Unit tests for hooks
  - [ ] Component tests
  - [ ] Integration tests

---

## Quick Start

1. **Copy API client setup** (`apiClient.ts`)
2. **Copy TypeScript types** (`user.types.ts`, `content.types.ts`, `analytics.types.ts`)
3. **Copy API methods** (`profileApi.ts`, `contentApi.ts`, `analyticsApi.ts`)
4. **Copy React hooks** (`useUserProfile.ts`, `useAccountContent.ts`)
5. **Integrate components** using the examples provided
6. **Add error handling** using the error handler utility
7. **Test** using the testing guide

---

**Status:** ✅ **READY FOR FRONTEND INTEGRATION**

All endpoints are implemented and ready to consume. Follow this guide step-by-step for seamless integration.
