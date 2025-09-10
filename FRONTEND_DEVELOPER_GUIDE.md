# Frontend Developer Guide - Default Content Integration

## 🎯 **Status: READY TO IMPLEMENT**

The backend is now fully fixed and ready for your Instagram-style content cards implementation.

## 📡 **API Endpoint**

### **Default Content Endpoint**

```
GET /api/media/default
```

### **Query Parameters**

- `page` (optional) - Page number for pagination (default: 1)
- `limit` (optional) - Number of items per page (default: 10)
- `contentType` (optional) - Filter by content type (default: all)

### **Example Requests**

```bash
# Basic request
GET /api/media/default

# With pagination
GET /api/media/default?page=1&limit=10

# Filter by content type
GET /api/media/default?contentType=videos&limit=5

# Full example
GET /api/media/default?page=1&limit=10&contentType=all
```

## 📱 **Response Format**

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "title": "Thank You My God - Kefee",
        "description": "Gospel music by Kefee",
        "mediaUrl": "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-music/kefee_thank-you-my-god.mp3",
        "thumbnailUrl": "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/Kefee-2.webp",
        "contentType": "audio",
        "duration": 180,
        "author": {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
          "firstName": "Kefee",
          "lastName": "Branama",
          "avatar": "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-thumbnails/Kefee-2.webp"
        },
        "likeCount": 42,
        "commentCount": 8,
        "shareCount": 12,
        "viewCount": 1250,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    }
  }
}
```

## 🔧 **Implementation Steps**

### **Step 1: Update `allMediaAPI.ts`**

Add this method to your existing `allMediaAPI.ts`:

```typescript
// Add this method to allMediaAPI.ts
export const getDefaultContent = async (
  params: {
    page?: number;
    limit?: number;
    contentType?: string;
  } = {}
) => {
  try {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.contentType)
      queryParams.append("contentType", params.contentType);

    const queryString = queryParams.toString();
    const endpoint = `/media/default${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Add auth token if needed
        ...(await getAuthHeaders()),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch default content");
    }

    return {
      success: true,
      data: data.data,
      content: data.data.content, // Array of content items
      pagination: data.data.pagination,
    };
  } catch (error) {
    console.error("Error fetching default content:", error);
    return {
      success: false,
      error: error.message,
      data: {
        content: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      },
    };
  }
};

// Helper function to get auth headers
const getAuthHeaders = async () => {
  // Get token from your auth store or AsyncStorage
  const token = await AsyncStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};
```

### **Step 2: Update `useMediaStore.tsx`**

Add these to your existing Zustand store:

```typescript
// Add to your existing MediaStore interface
interface MediaStore {
  // ... existing properties
  defaultContent: any[];
  defaultContentLoading: boolean;
  defaultContentError: string | null;
  defaultContentPagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };

  // ... existing methods
  fetchDefaultContent: (params?: {
    page?: number;
    limit?: number;
    contentType?: string;
  }) => Promise<void>;
  loadMoreDefaultContent: () => Promise<void>;
  refreshDefaultContent: () => Promise<void>;
}

// Add to your existing store implementation
export const useMediaStore = create<MediaStore>((set, get) => ({
  // ... existing state
  defaultContent: [],
  defaultContentLoading: false,
  defaultContentError: null,
  defaultContentPagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },

  // ... existing methods

  fetchDefaultContent: async (params = {}) => {
    set({ defaultContentLoading: true, defaultContentError: null });

    try {
      const response = await getDefaultContent(params);

      if (response.success) {
        set({
          defaultContent: response.content,
          defaultContentPagination: response.pagination,
          defaultContentLoading: false,
        });
      } else {
        set({
          defaultContentError: response.error,
          defaultContentLoading: false,
        });
      }
    } catch (error) {
      set({
        defaultContentError: error.message,
        defaultContentLoading: false,
      });
    }
  },

  loadMoreDefaultContent: async () => {
    const { defaultContentPagination, defaultContentLoading } = get();

    if (
      defaultContentLoading ||
      defaultContentPagination.page >= defaultContentPagination.pages
    ) {
      return;
    }

    set({ defaultContentLoading: true });

    try {
      const response = await getDefaultContent({
        page: defaultContentPagination.page + 1,
        limit: defaultContentPagination.limit,
      });

      if (response.success) {
        set(state => ({
          defaultContent: [...state.defaultContent, ...response.content],
          defaultContentPagination: response.pagination,
          defaultContentLoading: false,
        }));
      }
    } catch (error) {
      set({ defaultContentLoading: false });
    }
  },

  refreshDefaultContent: async () => {
    await get().fetchDefaultContent({ page: 1, limit: 10 });
  },
}));
```

### **Step 3: Update `Allcontent.tsx`**

Replace your existing `Allcontent.tsx` with this:

```typescript
import React, { useEffect, useCallback } from 'react';
import { FlatList, RefreshControl, ActivityIndicator, View, Text } from 'react-native';
import { useMediaStore } from '../store/useMediaStore';
import ContentCard from '../components/ContentCard'; // You'll create this

const AllContent = () => {
  const {
    defaultContent,
    defaultContentLoading,
    defaultContentError,
    defaultContentPagination,
    fetchDefaultContent,
    loadMoreDefaultContent,
    refreshDefaultContent,
  } = useMediaStore();

  // Load default content on mount
  useEffect(() => {
    fetchDefaultContent({ page: 1, limit: 10 });
  }, [fetchDefaultContent]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refreshDefaultContent();
  }, [refreshDefaultContent]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    loadMoreDefaultContent();
  }, [loadMoreDefaultContent]);

  // Handle like
  const handleLike = useCallback(async (contentId: string, liked: boolean) => {
    try {
      // Call your like API
      const response = await toggleLike('media', contentId);
      if (response.success) {
        // Update local state
        // You can add this to your store or handle locally
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  }, []);

  // Handle comment
  const handleComment = useCallback((contentId: string) => {
    // Navigate to comments screen
    console.log('Navigate to comments for:', contentId);
  }, []);

  // Handle share
  const handleShare = useCallback(async (contentId: string) => {
    try {
      // Call your share API
      const response = await shareContent('media', contentId, 'general', 'Check this out!');
      if (response.success) {
        // Handle success
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  }, []);

  // Handle author press
  const handleAuthorPress = useCallback((authorId: string) => {
    // Navigate to author profile
    console.log('Navigate to author profile:', authorId);
  }, []);

  // Render content item
  const renderContentItem = useCallback(({ item }) => (
    <ContentCard
      content={item}
      onLike={handleLike}
      onComment={handleComment}
      onShare={handleShare}
      onAuthorPress={handleAuthorPress}
    />
  ), [handleLike, handleComment, handleShare, handleAuthorPress]);

  // Render loading indicator
  const renderFooter = useCallback(() => {
    if (!defaultContentLoading) return null;

    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#666" />
      </View>
    );
  }, [defaultContentLoading]);

  // Render empty state
  const renderEmpty = useCallback(() => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
      <Text style={{ fontSize: 18, color: '#666' }}>No content available</Text>
      <Text style={{ fontSize: 14, color: '#999', marginTop: 8 }}>Pull down to refresh</Text>
    </View>
  ), []);

  if (defaultContentLoading && defaultContent.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#666" />
        <Text style={{ marginTop: 12, fontSize: 16, color: '#666' }}>Loading content...</Text>
      </View>
    );
  }

  if (defaultContentError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Text style={{ fontSize: 18, color: '#e74c3c', textAlign: 'center' }}>
          Error loading content
        </Text>
        <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>
          {defaultContentError}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={defaultContent}
      renderItem={renderContentItem}
      keyExtractor={(item) => item._id}
      refreshControl={
        <RefreshControl
          refreshing={defaultContentLoading && defaultContent.length > 0}
          onRefresh={handleRefresh}
          colors={['#666']}
          tintColor="#666"
        />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmpty}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={10}
      initialNumToRender={3}
    />
  );
};

export default AllContent;
```

### **Step 4: Create `ContentCard.tsx`**

Create a new file `app/components/ContentCard.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: screenWidth } = Dimensions.get('window');

const ContentCard = ({ content, onLike, onComment, onShare, onAuthorPress }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const handleLike = async () => {
    if (onLike) {
      try {
        await onLike(content._id, !content.isLiked);
      } catch (error) {
        Alert.alert('Error', 'Failed to update like');
      }
    }
  };

  const handleComment = () => {
    if (onComment) {
      onComment(content._id);
    }
  };

  const handleShare = async () => {
    if (onShare) {
      try {
        await onShare(content._id);
      } catch (error) {
        Alert.alert('Error', 'Failed to share content');
      }
    }
  };

  const handleAuthorPress = () => {
    if (onAuthorPress) {
      onAuthorPress(content.author._id);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      {/* Header with Author Info */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorInfo}
          onPress={handleAuthorPress}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri: content.author.avatar || 'https://via.placeholder.com/40x40/cccccc/ffffff?text=U'
            }}
            style={styles.avatar}
            defaultSource={require('../assets/default-avatar.png')}
          />
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>
              {content.author.firstName} {content.author.lastName}
            </Text>
            <Text style={styles.timestamp}>{formatDate(content.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreButton}>
          <Icon name="more-vert" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Media Content */}
      <View style={styles.mediaContainer}>
        {content.contentType === 'video' ? (
          <View style={styles.videoContainer}>
            <Video
              source={{ uri: content.mediaUrl }}
              style={styles.video}
              resizeMode="cover"
              paused={!isPlaying}
              onLoad={() => setIsVideoLoading(false)}
              onError={(error) => {
                console.error('Video error:', error);
                setIsVideoLoading(false);
              }}
            />

            <TouchableOpacity
              style={styles.videoOverlay}
              onPress={() => setIsPlaying(!isPlaying)}
              activeOpacity={0.8}
            >
              {isVideoLoading && (
                <ActivityIndicator size="large" color="#fff" />
              )}
              {!isVideoLoading && (
                <Icon
                  name={isPlaying ? 'pause' : 'play-arrow'}
                  size={50}
                  color="rgba(255,255,255,0.8)"
                />
              )}
            </TouchableOpacity>
          </View>
        ) : content.contentType === 'image' ? (
          <Image
            source={{ uri: content.mediaUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => console.error('Image load error')}
          />
        ) : (
          <View style={styles.audioContainer}>
            <Icon name="music-note" size={50} color="#666" />
            <Text style={styles.audioText}>Audio Content</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLike}
          >
            <Icon
              name={content.isLiked ? 'favorite' : 'favorite-border'}
              size={24}
              color={content.isLiked ? '#e91e63' : '#666'}
            />
            <Text style={[styles.actionText, content.isLiked && styles.likedText]}>
              {content.likeCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleComment}
          >
            <Icon name="chat-bubble-outline" size={24} color="#666" />
            <Text style={styles.actionText}>{content.commentCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
          >
            <Icon name="share" size={24} color="#666" />
            <Text style={styles.actionText}>{content.shareCount}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.bookmarkButton}>
          <Icon name="bookmark-border" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Content Description */}
      <View style={styles.description}>
        <Text style={styles.title}>{content.title}</Text>
        {content.description && (
          <Text style={styles.descriptionText}>{content.description}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginBottom: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  mediaContainer: {
    width: screenWidth,
    height: screenWidth * 0.75,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  audioContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  audioText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  likedText: {
    color: '#e91e63',
  },
  bookmarkButton: {
    padding: 4,
  },
  description: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default ContentCard;
```

## 🎯 **Content Types Supported**

- `video` - Video content (sermons, etc.)
- `audio` - Audio content (music, devotionals)
- `image` - Image content (ebooks, books)

## 🚀 **Expected Result**

After implementation, your ALL tab will display:

- ✅ Instagram-style content cards
- ✅ Author information with avatars
- ✅ Like, comment, share buttons
- ✅ Video/audio/image content
- ✅ Smooth pagination
- ✅ Pull-to-refresh
- ✅ Loading states
- ✅ Error handling

## 📋 **Testing Checklist**

1. **Test the endpoint**: `https://jevahapp-backend.onrender.com/api/media/default`
2. **Verify content loads** in your ALL tab
3. **Test interactions** (like, comment, share)
4. **Test pagination** (scroll to load more)
5. **Test refresh** (pull down to refresh)

## 🆘 **Support**

If you encounter any issues:

1. Check the console for error messages
2. Verify the API endpoint is returning data
3. Check your network requests in React Native debugger

The backend is now fully ready and tested! 🎉
