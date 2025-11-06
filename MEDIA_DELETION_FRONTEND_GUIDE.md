# Media Deletion - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024-01-15  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Requirements](#authentication-requirements)
3. [API Endpoint](#api-endpoint)
4. [Implementation Guide](#implementation-guide)
5. [Error Handling](#error-handling)
6. [UI/UX Best Practices](#uiux-best-practices)
7. [Complete Example](#complete-example)
8. [Security Considerations](#security-considerations)
9. [Testing](#testing)

---

## Overview

This guide explains how to implement media deletion functionality in your frontend application. Users can **only delete media items they created** - the backend enforces strict ownership validation.

### Key Features

- ✅ **Ownership Validation**: Only the creator can delete their media
- ✅ **Complete Deletion**: Removes both database record and Cloudflare R2 storage files
- ✅ **Secure**: Requires authentication token
- ✅ **Error Handling**: Clear error messages for different scenarios

---

## Authentication Requirements

### Required Headers

Every delete request must include:

```typescript
Headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Token Retrieval

```typescript
import * as SecureStore from 'expo-secure-store';

// Retrieve token
const token = await SecureStore.getItemAsync('authToken');

if (!token) {
  // Handle unauthenticated state
  throw new Error('User not authenticated');
}
```

---

## API Endpoint

### Delete Media

**Endpoint:** `DELETE /api/media/:id`

**Base URL:** `https://your-api-domain.com/api/media`

**Full URL:** `https://your-api-domain.com/api/media/{mediaId}`

**Method:** `DELETE`

**Authentication:** Required (Bearer Token)

**Authorization:** User must be the creator of the media item

---

## Implementation Guide

### Step 1: Create API Service Function

```typescript
// services/mediaService.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://your-api-domain.com/api/media';

interface DeleteMediaResponse {
  success: boolean;
  message: string;
}

interface DeleteMediaError {
  success: false;
  message: string;
}

/**
 * Delete a media item
 * @param mediaId - The ID of the media item to delete
 * @returns Promise with deletion result
 * @throws Error if deletion fails or user is not authorized
 */
export const deleteMedia = async (
  mediaId: string
): Promise<DeleteMediaResponse> => {
  try {
    // 1. Get authentication token
    const token = await SecureStore.getItemAsync('authToken');
    
    if (!token) {
      throw new Error('Authentication required. Please log in.');
    }

    // 2. Validate mediaId
    if (!mediaId || typeof mediaId !== 'string') {
      throw new Error('Invalid media ID');
    }

    // 3. Make DELETE request
    const response = await axios.delete<DeleteMediaResponse>(
      `${API_BASE_URL}/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds
      }
    );

    // 4. Check response
    if (response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.message || 'Failed to delete media');
    }
  } catch (error: any) {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const errorData = error.response.data;

      switch (status) {
        case 401:
          throw new Error('Authentication failed. Please log in again.');
        case 403:
          throw new Error(
            'You do not have permission to delete this media. Only the creator can delete it.'
          );
        case 404:
          throw new Error('Media not found. It may have already been deleted.');
        case 400:
          throw new Error(
            errorData.message || 'Invalid request. Please check the media ID.'
          );
        default:
          throw new Error(
            errorData.message || 'Failed to delete media. Please try again.'
          );
      }
    } else if (error.request) {
      // Request made but no response received
      throw new Error(
        'Network error. Please check your internet connection and try again.'
      );
    } else {
      // Error in request setup
      throw new Error(error.message || 'An unexpected error occurred.');
    }
  }
};
```

### Step 2: Create React Hook (Recommended)

```typescript
// hooks/useDeleteMedia.ts
import { useState } from 'react';
import { deleteMedia } from '../services/mediaService';

interface UseDeleteMediaReturn {
  deleteMediaItem: (mediaId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  success: boolean;
  reset: () => void;
}

export const useDeleteMedia = (): UseDeleteMediaReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const deleteMediaItem = async (mediaId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await deleteMedia(mediaId);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete media');
      throw err; // Re-throw to allow component-level handling
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
  };

  return {
    deleteMediaItem,
    isLoading,
    error,
    success,
    reset,
  };
};
```

### Step 3: Create Delete Confirmation Component

```typescript
// components/DeleteMediaConfirmation.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useDeleteMedia } from '../hooks/useDeleteMedia';

interface DeleteMediaConfirmationProps {
  visible: boolean;
  mediaId: string;
  mediaTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteMediaConfirmation: React.FC<DeleteMediaConfirmationProps> = ({
  visible,
  mediaId,
  mediaTitle,
  onClose,
  onSuccess,
}) => {
  const { deleteMediaItem, isLoading, error } = useDeleteMedia();

  const handleDelete = async () => {
    try {
      await deleteMediaItem(mediaId);
      onSuccess();
      onClose();
    } catch (err) {
      // Error is handled by the hook and displayed below
      console.error('Delete failed:', err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Delete Media</Text>
          
          <Text style={styles.message}>
            Are you sure you want to delete "{mediaTitle}"?
          </Text>
          
          <Text style={styles.warning}>
            This action cannot be undone. The media will be permanently deleted
            from your account and all storage.
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  message: {
    fontSize: 16,
    marginBottom: 12,
    color: '#666',
  },
  warning: {
    fontSize: 14,
    color: '#ff6b6b',
    marginBottom: 20,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#ff6b6b',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
```

---

## Error Handling

### Error Response Codes

| Status Code | Meaning | User Message |
|------------|---------|--------------|
| `200` | Success | "Media deleted successfully" |
| `400` | Bad Request | "Invalid media ID" |
| `401` | Unauthorized | "Please log in to delete media" |
| `403` | Forbidden | "You can only delete media you created" |
| `404` | Not Found | "Media not found" |
| `500` | Server Error | "Server error. Please try again later" |

### Error Response Format

```typescript
// Success Response
{
  success: true,
  message: "Media deleted successfully"
}

// Error Response
{
  success: false,
  message: "Unauthorized to delete this media"
}
```

### Error Handling in Components

```typescript
// Example: Handling errors in a component
const handleDelete = async () => {
  try {
    await deleteMedia(mediaId);
    
    // Show success message
    Alert.alert('Success', 'Media deleted successfully');
    
    // Refresh media list
    refreshMediaList();
    
    // Navigate back if needed
    navigation.goBack();
  } catch (error: any) {
    // Show error alert
    Alert.alert(
      'Delete Failed',
      error.message || 'Failed to delete media. Please try again.',
      [{ text: 'OK' }]
    );
  }
};
```

---

## UI/UX Best Practices

### 1. Show Delete Button Only for User's Own Media

```typescript
// components/MediaItem.tsx
interface MediaItemProps {
  media: Media;
  currentUserId: string;
}

const MediaItem: React.FC<MediaItemProps> = ({ media, currentUserId }) => {
  const isOwner = media.uploadedBy === currentUserId || 
                  media.uploadedBy._id === currentUserId;

  return (
    <View>
      {/* Media content */}
      
      {isOwner && (
        <TouchableOpacity onPress={() => showDeleteConfirmation(media.id)}>
          <Icon name="trash" />
          <Text>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

### 2. Confirmation Dialog Before Deletion

Always show a confirmation dialog before deleting:

```typescript
const showDeleteConfirmation = () => {
  Alert.alert(
    'Delete Media',
    'Are you sure you want to delete this media? This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: handleDelete,
      },
    ]
  );
};
```

### 3. Loading States

Show loading indicator during deletion:

```typescript
{isDeleting ? (
  <ActivityIndicator />
) : (
  <TouchableOpacity onPress={handleDelete}>
    <Text>Delete</Text>
  </TouchableOpacity>
)}
```

### 4. Optimistic Updates (Optional)

For better UX, you can remove the item from the UI immediately:

```typescript
const handleDelete = async () => {
  // Optimistically remove from UI
  const updatedMedia = mediaList.filter(m => m.id !== mediaId);
  setMediaList(updatedMedia);

  try {
    await deleteMedia(mediaId);
    // Success - already removed from UI
  } catch (error) {
    // Revert on error
    setMediaList(mediaList);
    Alert.alert('Error', 'Failed to delete media');
  }
};
```

### 5. Success Feedback

Provide clear feedback after successful deletion:

```typescript
import { Toast } from 'react-native-toast-message';

const handleDeleteSuccess = () => {
  Toast.show({
    type: 'success',
    text1: 'Media Deleted',
    text2: 'The media has been permanently deleted',
    position: 'bottom',
  });
};
```

---

## Complete Example

### Full Implementation Example

```typescript
// screens/MyMediaScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useDeleteMedia } from '../hooks/useDeleteMedia';
import { DeleteMediaConfirmation } from '../components/DeleteMediaConfirmation';
import { getMyMedia } from '../services/mediaService';

interface Media {
  _id: string;
  title: string;
  contentType: string;
  thumbnailUrl: string;
  uploadedBy: string;
}

export const MyMediaScreen: React.FC = () => {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { deleteMediaItem, isLoading, error } = useDeleteMedia();

  // Fetch user's media
  const fetchMyMedia = async () => {
    try {
      const response = await getMyMedia();
      setMediaList(response.data.media);
    } catch (error) {
      console.error('Failed to fetch media:', error);
    }
  };

  useEffect(() => {
    fetchMyMedia();
  }, []);

  // Handle delete confirmation
  const handleDeletePress = (media: Media) => {
    setSelectedMedia(media);
    setShowDeleteModal(true);
  };

  // Handle actual deletion
  const handleDeleteConfirm = async () => {
    if (!selectedMedia) return;

    try {
      await deleteMediaItem(selectedMedia._id);
      
      // Remove from list
      setMediaList(prev => prev.filter(m => m._id !== selectedMedia._id));
      
      // Close modal
      setShowDeleteModal(false);
      setSelectedMedia(null);
      
      // Show success message
      Alert.alert('Success', 'Media deleted successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete media');
    }
  };

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyMedia();
    setRefreshing(false);
  };

  const renderMediaItem = ({ item }: { item: Media }) => (
    <View style={styles.mediaItem}>
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaTitle}>{item.title}</Text>
        <Text style={styles.mediaType}>{item.contentType}</Text>
      </View>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeletePress(item)}
        disabled={isLoading}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mediaList}
        renderItem={renderMediaItem}
        keyExtractor={item => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No media found</Text>
          </View>
        }
      />

      <DeleteMediaConfirmation
        visible={showDeleteModal}
        mediaId={selectedMedia?._id || ''}
        mediaTitle={selectedMedia?.title || ''}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedMedia(null);
        }}
        onSuccess={handleDeleteConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mediaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mediaInfo: {
    flex: 1,
  },
  mediaTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  mediaType: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
```

---

## Security Considerations

### 1. Client-Side Validation

While the backend enforces ownership, also validate on the frontend:

```typescript
const canDeleteMedia = (media: Media, currentUserId: string): boolean => {
  return media.uploadedBy === currentUserId || 
         media.uploadedBy._id === currentUserId;
};

// Only show delete button if user can delete
{canDeleteMedia(media, currentUserId) && (
  <DeleteButton onPress={handleDelete} />
)}
```

### 2. Token Expiration Handling

Handle token expiration gracefully:

```typescript
const deleteMedia = async (mediaId: string) => {
  try {
    return await apiClient.delete(`/media/${mediaId}`);
  } catch (error: any) {
    if (error.response?.status === 401) {
      // Token expired - refresh or redirect to login
      await refreshToken();
      // Retry the request
      return await apiClient.delete(`/media/${mediaId}`);
    }
    throw error;
  }
};
```

### 3. Rate Limiting

Be aware that the API may have rate limits. Handle 429 errors:

```typescript
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'];
  throw new Error(
    `Too many requests. Please wait ${retryAfter} seconds before trying again.`
  );
}
```

---

## Testing

### Test Cases

1. **Successful Deletion**
   - User deletes their own media
   - Should receive success response
   - Media should be removed from UI

2. **Unauthorized Deletion**
   - User tries to delete media they didn't create
   - Should receive 403 error
   - Should show appropriate error message

3. **Unauthenticated Request**
   - User not logged in tries to delete
   - Should receive 401 error
   - Should redirect to login

4. **Invalid Media ID**
   - User tries to delete with invalid ID
   - Should receive 400 error
   - Should show validation error

5. **Network Errors**
   - Network failure during deletion
   - Should show network error message
   - Should allow retry

### Example Test (Jest)

```typescript
import { deleteMedia } from '../services/mediaService';

describe('deleteMedia', () => {
  it('should delete media successfully', async () => {
    const mediaId = 'valid-media-id';
    const result = await deleteMedia(mediaId);
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Media deleted successfully');
  });

  it('should throw error for unauthorized deletion', async () => {
    const mediaId = 'other-user-media-id';
    
    await expect(deleteMedia(mediaId)).rejects.toThrow(
      'You do not have permission to delete this media'
    );
  });

  it('should throw error for invalid media ID', async () => {
    const mediaId = 'invalid-id';
    
    await expect(deleteMedia(mediaId)).rejects.toThrow(
      'Invalid media ID'
    );
  });
});
```

---

## Summary

### Quick Reference

```typescript
// 1. Delete media
const result = await deleteMedia(mediaId);

// 2. Check success
if (result.success) {
  // Media deleted successfully
}

// 3. Handle errors
try {
  await deleteMedia(mediaId);
} catch (error) {
  // Handle specific errors:
  // - 401: Authentication required
  // - 403: Not authorized (not the creator)
  // - 404: Media not found
  // - 400: Invalid request
}
```

### Key Points

✅ **Always check ownership** before showing delete button  
✅ **Use confirmation dialogs** before deletion  
✅ **Handle all error cases** gracefully  
✅ **Provide user feedback** for success/error states  
✅ **Remove from UI** after successful deletion  
✅ **Refresh token** if authentication fails  

---

## Support

For issues or questions:
- Check error messages in response
- Verify authentication token is valid
- Ensure media ID format is correct (MongoDB ObjectId)
- Contact backend team for API issues

---

**Last Updated:** 2024-01-15  
**Version:** 1.0


