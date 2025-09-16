# Frontend Integration Guide - Like & Bookmark System

## 🎯 **Overview**

This guide provides comprehensive instructions for integrating the fixed like and bookmark systems with your React Native frontend without breaking existing code.

## 📋 **Current Status**

### ✅ **Working Endpoints** (Use These)

- `POST /api/content/{contentType}/{contentId}/like` - Universal like/unlike
- `POST /api/bookmark/{mediaId}/toggle` - Unified bookmark toggle
- `GET /api/bookmark/{mediaId}/status` - Check bookmark status
- `GET /api/bookmark/user` - Get user bookmarks
- `GET /api/notifications` - Get notifications
- `PATCH /api/notifications/{id}` - Mark notification as read

### ❌ **Deprecated Endpoints** (Don't Use These)

- `POST /api/media/{id}/bookmark` - Use unified bookmark instead
- `POST /api/media/{id}/save` - Use unified bookmark instead
- `POST /api/bookmarks/{mediaId}` - Use unified bookmark instead

## 🔧 **API Integration**

### **1. Like/Unlike Content**

```typescript
// Universal like endpoint - works for all content types
const toggleLike = async (contentType: string, contentId: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/content/${contentType}/${contentId}/like`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      return {
        liked: result.data.liked,
        likeCount: result.data.likeCount,
        message: result.message,
      };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error("Like toggle failed:", error);
    throw error;
  }
};

// Usage examples
await toggleLike("media", "507f1f77bcf86cd799439011");
await toggleLike("devotional", "507f1f77bcf86cd799439012");
await toggleLike("artist", "507f1f77bcf86cd799439013");
```

### **2. Bookmark/Save to Library**

```typescript
// Unified bookmark endpoint
const toggleBookmark = async (mediaId: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/bookmark/${mediaId}/toggle`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      return {
        bookmarked: result.data.bookmarked,
        bookmarkCount: result.data.bookmarkCount,
        message: result.message,
      };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error("Bookmark toggle failed:", error);
    throw error;
  }
};

// Check bookmark status
const getBookmarkStatus = async (mediaId: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/bookmark/${mediaId}/status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      return {
        isBookmarked: result.data.isBookmarked,
        bookmarkCount: result.data.bookmarkCount,
      };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error("Get bookmark status failed:", error);
    throw error;
  }
};
```

### **3. Get User Bookmarks**

```typescript
const getUserBookmarks = async (page: number = 1, limit: number = 20) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/bookmark/user?page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      return {
        bookmarks: result.data.bookmarks,
        pagination: result.data.pagination,
      };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error("Get user bookmarks failed:", error);
    throw error;
  }
};
```

### **4. Notifications**

```typescript
// Get user notifications
const getNotifications = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (result.success) {
      return result.notifications;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error("Get notifications failed:", error);
    throw error;
  }
};

// Mark notification as read
const markNotificationAsRead = async (notificationId: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/notifications/${notificationId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error("Mark notification as read failed:", error);
    throw error;
  }
};
```

## 🎨 **React Native Component Integration**

### **Like Button Component**

```typescript
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';

interface LikeButtonProps {
  contentType: string;
  contentId: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
  onLikeChange?: (liked: boolean, count: number) => void;
}

const LikeButton: React.FC<LikeButtonProps> = ({
  contentType,
  contentId,
  initialLiked = false,
  initialLikeCount = 0,
  onLikeChange,
}) => {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const result = await toggleLike(contentType, contentId);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
      onLikeChange?.(result.liked, result.likeCount);
    } catch (error) {
      console.error('Like failed:', error);
      // Optionally show error toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleLike}
      disabled={loading}
      className="flex-row items-center space-x-1"
    >
      <Heart
        size={20}
        color={liked ? '#ef4444' : '#6b7280'}
        fill={liked ? '#ef4444' : 'transparent'}
      />
      <Text className="text-gray-600 text-sm">
        {likeCount}
      </Text>
    </TouchableOpacity>
  );
};

export default LikeButton;
```

### **Bookmark Button Component**

```typescript
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Bookmark } from 'lucide-react-native';

interface BookmarkButtonProps {
  mediaId: string;
  initialBookmarked?: boolean;
  initialBookmarkCount?: number;
  onBookmarkChange?: (bookmarked: boolean, count: number) => void;
}

const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  mediaId,
  initialBookmarked = false,
  initialBookmarkCount = 0,
  onBookmarkChange,
}) => {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);
  const [loading, setLoading] = useState(false);

  const handleBookmark = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const result = await toggleBookmark(mediaId);
      setBookmarked(result.bookmarked);
      setBookmarkCount(result.bookmarkCount);
      onBookmarkChange?.(result.bookmarked, result.bookmarkCount);
    } catch (error) {
      console.error('Bookmark failed:', error);
      // Optionally show error toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleBookmark}
      disabled={loading}
      className="flex-row items-center space-x-1"
    >
      <Bookmark
        size={20}
        color={bookmarked ? '#256e63' : '#6b7280'}
        fill={bookmarked ? '#256e63' : 'transparent'}
      />
      <Text className="text-gray-600 text-sm">
        {bookmarkCount}
      </Text>
    </TouchableOpacity>
  );
};

export default BookmarkButton;
```

### **Notification List Component**

```typescript
import React, { useState, useEffect } from 'react';
import { FlatList, View, Text, TouchableOpacity } from 'react-native';
import { SafeImage } from '../components/SafeImage';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    actorName?: string;
    actorAvatar?: string;
    contentTitle?: string;
    contentType?: string;
    thumbnailUrl?: string;
  };
}

const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId
            ? { ...notif, isRead: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      className={`p-4 border-b border-gray-200 ${
        item.isRead ? 'bg-white' : 'bg-blue-50'
      }`}
      onPress={() => handleMarkAsRead(item._id)}
    >
      <View className="flex-row items-start space-x-3">
        <SafeImage
          uri={item.metadata?.actorAvatar}
          className="w-10 h-10 rounded-full"
          fallbackText={item.metadata?.actorName?.[0] || 'U'}
          showFallback={true}
        />
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">
            {item.title}
          </Text>
          <Text className="text-gray-600 mt-1">
            {item.message}
          </Text>
          <Text className="text-gray-400 text-xs mt-2">
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
        {!item.isRead && (
          <View className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      renderItem={renderNotification}
      keyExtractor={(item) => item._id}
      className="flex-1 bg-white"
    />
  );
};

export default NotificationList;
```

## 🔄 **Migration Strategy**

### **Phase 1: Parallel Implementation** (Current)

- Keep old endpoints working
- Implement new endpoints alongside
- Test new endpoints thoroughly

### **Phase 2: Frontend Migration** (Next)

1. **Update API calls** to use new endpoints
2. **Test thoroughly** with new endpoints
3. **Monitor for issues** and fix them
4. **Gradually replace** old endpoint usage

### **Phase 3: Cleanup** (Future)

1. **Remove old endpoints** from backend
2. **Clean up unused code**
3. **Update documentation**

## 📱 **Error Handling**

### **Network Errors**

```typescript
const handleApiError = (error: any) => {
  if (error.message.includes("Network")) {
    // Show network error message
    showToast("Please check your internet connection");
  } else if (error.message.includes("401")) {
    // Handle authentication error
    logout();
  } else if (error.message.includes("404")) {
    // Handle not found error
    showToast("Content not found");
  } else {
    // Handle generic error
    showToast("Something went wrong. Please try again.");
  }
};
```

### **Fallback Behavior**

```typescript
// If API fails, maintain local state
const handleLikeWithFallback = async () => {
  const previousLiked = liked;
  const previousCount = likeCount;

  // Optimistically update UI
  setLiked(!liked);
  setLikeCount(liked ? likeCount - 1 : likeCount + 1);

  try {
    await toggleLike(contentType, contentId);
  } catch (error) {
    // Revert on failure
    setLiked(previousLiked);
    setLikeCount(previousCount);
    handleApiError(error);
  }
};
```

## 🧪 **Testing**

### **Unit Tests**

```typescript
// Test like functionality
describe("LikeButton", () => {
  it("should toggle like status", async () => {
    const mockToggleLike = jest.fn().mockResolvedValue({
      liked: true,
      likeCount: 1,
    });

    // Test component behavior
  });
});
```

### **Integration Tests**

```typescript
// Test API integration
describe("Like API", () => {
  it("should like content successfully", async () => {
    const result = await toggleLike("media", "test-id");
    expect(result.liked).toBe(true);
    expect(result.likeCount).toBeGreaterThan(0);
  });
});
```

## 📊 **Performance Considerations**

### **Optimistic Updates**

- Update UI immediately
- Revert on API failure
- Improves perceived performance

### **Caching**

- Cache like/bookmark status
- Refresh periodically
- Reduce API calls

### **Debouncing**

- Prevent rapid API calls
- Debounce user interactions
- Improve user experience

## 🔒 **Security**

### **Authentication**

- Always include auth token
- Handle token expiration
- Refresh tokens when needed

### **Input Validation**

- Validate content IDs
- Sanitize user input
- Handle malformed requests

## 📝 **Best Practices**

1. **Always handle errors gracefully**
2. **Provide loading states**
3. **Use optimistic updates**
4. **Cache data when possible**
5. **Test thoroughly**
6. **Monitor API usage**
7. **Follow rate limiting**

## 🚀 **Getting Started**

1. **Update your API base URL** if needed
2. **Replace old endpoint calls** with new ones
3. **Test with the provided components**
4. **Monitor for any issues**
5. **Gradually migrate all usage**

## 📞 **Support**

If you encounter any issues:

1. Check the API response for error messages
2. Verify authentication tokens
3. Test with the provided test scripts
4. Check server logs for detailed errors
5. Contact the backend team for assistance

This guide ensures a smooth transition to the new unified like and bookmark system while maintaining all existing functionality.
