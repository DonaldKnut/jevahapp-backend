# Frontend Interactions Guide - Like, Comment, Share, Save

## 🎯 **Status: READY TO IMPLEMENT**

Your frontend structure is perfect! Here's how to implement the interaction functionality with your existing code.

## 📡 **API Endpoints for Interactions**

### **1. Like/Unlike Content**

```http
POST /api/content/media/{contentId}/like
DELETE /api/content/media/{contentId}/like
```

### **2. Comment on Content**

```http
POST /api/content/media/{contentId}/comment
GET /api/content/media/{contentId}/comments
DELETE /api/content/comments/{commentId}
```

### **3. Share Content**

```http
POST /api/content/media/{contentId}/share
```

### **4. Save to Library (Bookmark)**

```http
POST /api/media/{mediaId}/bookmark
DELETE /api/media/{mediaId}/bookmark
```

## 🔧 **Implementation Steps**

### **Step 1: Update `allMediaAPI.ts`**

Add these interaction methods to your existing `allMediaAPI.ts`:

```typescript
// Add these methods to your existing allMediaAPI.ts

// Like/Unlike Content
export const toggleLike = async (contentType: string, contentId: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/content/${contentType}/${contentId}/like`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error toggling like:", error);
    return { success: false, error: error.message };
  }
};

// Add Comment
export const addComment = async (
  contentType: string,
  contentId: string,
  comment: string,
  parentCommentId?: string
) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/content/${contentType}/${contentId}/comment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          comment,
          parentCommentId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error adding comment:", error);
    return { success: false, error: error.message };
  }
};

// Get Comments
export const getComments = async (
  contentType: string,
  contentId: string,
  page = 1,
  limit = 10
) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/content/${contentType}/${contentId}/comments?page=${page}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching comments:", error);
    return { success: false, error: error.message };
  }
};

// Delete Comment
export const deleteComment = async (commentId: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/content/comments/${commentId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error deleting comment:", error);
    return { success: false, error: error.message };
  }
};

// Share Content
export const shareContent = async (
  contentType: string,
  contentId: string,
  platform: string,
  message: string
) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/content/${contentType}/${contentId}/share`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          platform,
          message,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sharing content:", error);
    return { success: false, error: error.message };
  }
};

// Save to Library (Bookmark)
export const bookmarkContent = async (mediaId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/media/${mediaId}/bookmark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error bookmarking content:", error);
    return { success: false, error: error.message };
  }
};

// Remove from Library (Unbookmark)
export const unbookmarkContent = async (mediaId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/media/${mediaId}/bookmark`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error unbookmarking content:", error);
    return { success: false, error: error.message };
  }
};

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};
```

### **Step 2: Update Your `AllContent.tsx`**

Replace your existing interaction handlers with these:

```typescript
// Replace your existing handlers in AllContent.tsx

// Handle like
const handleLike = useCallback(async (contentId: string, liked: boolean) => {
  try {
    console.log("Like action:", contentId, liked);

    const response = await toggleLike("media", contentId);

    if (response.success) {
      // Update local state - you can add this to your store
      console.log("Like successful:", response.data);

      // Optional: Update the content in your store
      // updateContentLikeStatus(contentId, response.data.isLiked, response.data.likeCount);
    } else {
      console.error("Like failed:", response.error);
      Alert.alert("Error", "Failed to update like");
    }
  } catch (error) {
    console.error("Like error:", error);
    Alert.alert("Error", "Failed to update like");
  }
}, []);

// Handle comment
const handleComment = useCallback((contentId: string) => {
  console.log("Navigate to comments for:", contentId);

  // Navigate to comments screen
  // You can implement this based on your navigation setup
  // Example: navigation.navigate('Comments', { contentId, contentType: 'media' });
}, []);

// Handle share
const handleShare = useCallback(async (contentId: string) => {
  try {
    console.log("Share action:", contentId);

    const response = await shareContent(
      "media",
      contentId,
      "general",
      "Check this out!"
    );

    if (response.success) {
      console.log("Share successful:", response.data);
      Alert.alert("Success", "Content shared successfully!");
    } else {
      console.error("Share failed:", response.error);
      Alert.alert("Error", "Failed to share content");
    }
  } catch (error) {
    console.error("Share error:", error);
    Alert.alert("Error", "Failed to share content");
  }
}, []);

// Handle save to library
const handleSaveToLibrary = useCallback(
  async (contentId: string, isBookmarked: boolean) => {
    try {
      console.log("Save to library action:", contentId, isBookmarked);

      const response = isBookmarked
        ? await unbookmarkContent(contentId)
        : await bookmarkContent(contentId);

      if (response.success) {
        console.log("Bookmark successful:", response.data);
        Alert.alert(
          "Success",
          isBookmarked ? "Removed from library" : "Saved to library"
        );
      } else {
        console.error("Bookmark failed:", response.error);
        Alert.alert("Error", "Failed to update library");
      }
    } catch (error) {
      console.error("Bookmark error:", error);
      Alert.alert("Error", "Failed to update library");
    }
  },
  []
);

// Handle author press
const handleAuthorPress = useCallback((authorId: string) => {
  console.log("Navigate to author profile:", authorId);
  // Navigate to author profile
  // Example: navigation.navigate('Profile', { userId: authorId });
}, []);
```

### **Step 3: Update Your `ContentCard.tsx`**

Add the save to library functionality to your ContentCard component:

```typescript
// Add this to your ContentCard.tsx

// Add save to library handler
const handleSaveToLibrary = async () => {
  if (onSaveToLibrary) {
    try {
      await onSaveToLibrary(content._id, content.isBookmarked);
    } catch (error) {
      Alert.alert('Error', 'Failed to update library');
    }
  }
};

// Update your bookmark button in the actions section
<TouchableOpacity style={styles.bookmarkButton} onPress={handleSaveToLibrary}>
  <Icon
    name={content.isBookmarked ? "bookmark" : "bookmark-border"}
    size={24}
    color={content.isBookmarked ? "#e91e63" : "#666"}
  />
</TouchableOpacity>
```

### **Step 4: Create Comments Screen**

Create a new file `app/screens/CommentsScreen.tsx`:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getComments, addComment, deleteComment } from '../utils/allMediaAPI';

const CommentsScreen = ({ route, navigation }) => {
  const { contentId, contentType = 'media' } = route.params;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load comments
  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getComments(contentType, contentId);

      if (response.success) {
        setComments(response.data.comments);
      } else {
        Alert.alert('Error', 'Failed to load comments');
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [contentId, contentType]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Submit comment
  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      const response = await addComment(contentType, contentId, commentText.trim());

      if (response.success) {
        setCommentText('');
        loadComments(); // Reload comments
        Alert.alert('Success', 'Comment added successfully');
      } else {
        Alert.alert('Error', response.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await deleteComment(commentId);

      if (response.success) {
        loadComments(); // Reload comments
        Alert.alert('Success', 'Comment deleted successfully');
      } else {
        Alert.alert('Error', response.error || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  // Render comment item
  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <Text style={styles.commentAuthor}>
          {item.author.firstName} {item.author.lastName}
        </Text>
        <Text style={styles.commentDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.commentText}>{item.comment}</Text>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteComment(item._id)}
      >
        <Icon name="delete" size={16} color="#e74c3c" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#666" />
        <Text style={styles.loadingText}>Loading comments...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item._id}
        style={styles.commentsList}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.commentInput}>
        <TextInput
          style={styles.textInput}
          placeholder="Add a comment..."
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmitComment}
          disabled={submitting || !commentText.trim()}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  commentsList: {
    flex: 1,
    padding: 16,
  },
  commentItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  commentDate: {
    fontSize: 12,
    color: '#666',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
  },
  submitButton: {
    backgroundColor: '#e91e63',
    borderRadius: 20,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default CommentsScreen;
```

## 📱 **Expected Response Formats**

### **1. Like/Unlike Response**

**Success Response:**

```json
{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "isLiked": true,
    "likeCount": 43,
    "contentId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "contentType": "media"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Content not found",
  "error": "Media with ID 64f8a1b2c3d4e5f6a7b8c9d0 does not exist"
}
```

### **2. Add Comment Response**

**Success Response:**

```json
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "comment": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "comment": "Great content! This is amazing.",
      "author": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/avatars/john-doe.jpg"
      },
      "contentId": "64f8a1b2c3d4e5f6a7b8c9d2",
      "contentType": "media",
      "parentCommentId": null,
      "replies": [],
      "likeCount": 0,
      "isLiked": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "commentCount": 8
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Failed to add comment",
  "error": "Comment text is required"
}
```

### **3. Get Comments Response**

**Success Response:**

```json
{
  "success": true,
  "message": "Comments retrieved successfully",
  "data": {
    "comments": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "comment": "This is amazing content!",
        "author": {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/avatars/john-doe.jpg"
        },
        "contentId": "64f8a1b2c3d4e5f6a7b8c9d2",
        "contentType": "media",
        "parentCommentId": null,
        "replies": [
          {
            "_id": "64f8a1b2c3d4e5f6a7b8c9d3",
            "comment": "I agree!",
            "author": {
              "_id": "64f8a1b2c3d4e5f6a7b8c9d4",
              "firstName": "Jane",
              "lastName": "Smith",
              "avatar": "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/avatars/jane-smith.jpg"
            },
            "parentCommentId": "64f8a1b2c3d4e5f6a7b8c9d0",
            "likeCount": 2,
            "isLiked": false,
            "createdAt": "2024-01-15T11:00:00.000Z",
            "updatedAt": "2024-01-15T11:00:00.000Z"
          }
        ],
        "likeCount": 5,
        "isLiked": true,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    },
    "totalComments": 25
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Failed to retrieve comments",
  "error": "Content not found"
}
```

### **4. Delete Comment Response**

**Success Response:**

```json
{
  "success": true,
  "message": "Comment deleted successfully",
  "data": {
    "deletedCommentId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "commentCount": 7
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Failed to delete comment",
  "error": "Comment not found or unauthorized"
}
```

### **5. Share Content Response**

**Success Response:**

```json
{
  "success": true,
  "message": "Content shared successfully",
  "data": {
    "shareCount": 13,
    "contentId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "contentType": "media",
    "platform": "general",
    "message": "Check this out!",
    "sharedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Failed to share content",
  "error": "Content not found"
}
```

### **6. Bookmark/Save to Library Response**

**Success Response (Add Bookmark):**

```json
{
  "success": true,
  "message": "Content saved to library successfully",
  "data": {
    "bookmark": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "userId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "mediaId": "64f8a1b2c3d4e5f6a7b8c9d2",
      "media": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
        "title": "Amazing Gospel Video",
        "contentType": "video",
        "thumbnailUrl": "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/thumbnails/amazing-gospel.jpg"
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "isBookmarked": true
  }
}
```

**Success Response (Remove Bookmark):**

```json
{
  "success": true,
  "message": "Content removed from library successfully",
  "data": {
    "deletedBookmarkId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "isBookmarked": false
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Failed to update library",
  "error": "Media not found"
}
```

### **7. Authentication Error Response**

**Unauthorized Response:**

```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Authentication token required"
}
```

**Invalid Token Response:**

```json
{
  "success": false,
  "message": "Invalid authentication token",
  "error": "Token has expired or is invalid"
}
```

### **8. Rate Limiting Error Response**

**Too Many Requests Response:**

```json
{
  "success": false,
  "message": "Too many requests",
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}
```

### **9. Validation Error Response**

**Validation Error Response:**

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Invalid input data",
  "details": [
    {
      "field": "comment",
      "message": "Comment text is required"
    },
    {
      "field": "comment",
      "message": "Comment must be at least 1 character long"
    }
  ]
}
```

### **10. Server Error Response**

**Internal Server Error Response:**

```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Something went wrong on our end. Please try again later."
}
```

## 🚀 **Testing Checklist**

1. **Test Like/Unlike** - Tap heart icon, verify count updates
2. **Test Comments** - Add comment, verify it appears in list
3. **Test Share** - Tap share button, verify success message
4. **Test Save to Library** - Tap bookmark icon, verify state changes
5. **Test Error Handling** - Verify error messages display properly

## 🎯 **Key Features**

- ✅ **Real-time Updates** - Like counts update immediately
- ✅ **Comment System** - Add, view, delete comments
- ✅ **Share Functionality** - Share content with custom message
- ✅ **Save to Library** - Bookmark content for later
- ✅ **Error Handling** - Proper error messages and loading states
- ✅ **Authentication** - All endpoints require valid auth token

Your frontend is now ready to implement all interaction features! 🎉
