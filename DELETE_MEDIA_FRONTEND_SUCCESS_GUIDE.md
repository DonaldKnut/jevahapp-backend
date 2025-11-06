# Delete Media - Frontend Success Guide

**Quick Reference for Successfully Deleting Media**

---

## 🎯 API Endpoint

```
DELETE /api/media/:id
```

**Success Response:**
```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Unauthorized to delete this media"
}
```

---

## ✅ Complete Working Example

### 1. API Service Function

```typescript
// services/mediaService.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const API_BASE_URL = "https://your-api-domain.com/api/media";

export const deleteMedia = async (mediaId: string) => {
  // Get auth token
  const token = await SecureStore.getItemAsync("authToken");
  
  if (!token) {
    throw new Error("Please log in to delete media");
  }

  // Make DELETE request
  const response = await axios.delete(
    `${API_BASE_URL}/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  // Check success
  if (response.data.success) {
    return response.data;
  } else {
    throw new Error(response.data.message || "Failed to delete media");
  }
};
```

### 2. React Hook (Recommended)

```typescript
// hooks/useDeleteMedia.ts
import { useState } from "react";
import { deleteMedia } from "../services/mediaService";

export const useDeleteMedia = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteMediaItem = async (mediaId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await deleteMedia(mediaId);
      return result; // { success: true, message: "Media deleted successfully" }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Failed to delete media";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { deleteMediaItem, isLoading, error };
};
```

### 3. Component Usage (Success Flow)

```typescript
// components/MediaItem.tsx
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useDeleteMedia } from "../hooks/useDeleteMedia";

interface MediaItemProps {
  media: {
    _id: string;
    title: string;
    uploadedBy: string;
  };
  currentUserId: string;
  onDeleteSuccess?: () => void; // Callback after successful deletion
}

export const MediaItem: React.FC<MediaItemProps> = ({ 
  media, 
  currentUserId,
  onDeleteSuccess 
}) => {
  const { deleteMediaItem, isLoading, error } = useDeleteMedia();
  const [showConfirm, setShowConfirm] = useState(false);

  // Check if current user is the creator
  const isOwner = media.uploadedBy === currentUserId || 
                  media.uploadedBy?._id === currentUserId;

  // Handle delete with confirmation
  const handleDelete = () => {
    Alert.alert(
      "Delete Media",
      `Are you sure you want to delete "${media.title}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: performDelete,
        },
      ]
    );
  };

  // Perform actual deletion
  const performDelete = async () => {
    try {
      // Call API
      const result = await deleteMediaItem(media._id);

      // ✅ SUCCESS - Handle success response
      if (result.success) {
        // Show success message
        Alert.alert("Success", "Media deleted successfully");

        // Call success callback (e.g., refresh list, navigate back)
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }

        // Optional: Remove from local state immediately
        // setMediaList(prev => prev.filter(m => m._id !== media._id));
      }
    } catch (err: any) {
      // Handle error
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          "Failed to delete media";
      
      Alert.alert("Error", errorMessage);
    }
  };

  return (
    <View>
      <Text>{media.title}</Text>
      
      {/* Only show delete button if user is the creator */}
      {isOwner && (
        <TouchableOpacity
          onPress={handleDelete}
          disabled={isLoading}
          style={{ backgroundColor: "#ff6b6b", padding: 10, borderRadius: 5 }}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff" }}>Delete</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Show error if any */}
      {error && <Text style={{ color: "red" }}>{error}</Text>}
    </View>
  );
};
```

### 4. Screen with Media List (Complete Example)

```typescript
// screens/MyMediaScreen.tsx
import React, { useState, useEffect } from "react";
import { View, FlatList, RefreshControl, Alert } from "react-native";
import { MediaItem } from "../components/MediaItem";
import { getMyMedia } from "../services/mediaService";
import { useDeleteMedia } from "../hooks/useDeleteMedia";

export const MyMediaScreen = () => {
  const [mediaList, setMediaList] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { deleteMediaItem, isLoading } = useDeleteMedia();
  const currentUserId = "user-id-from-auth"; // Get from your auth context

  // Fetch media list
  const fetchMedia = async () => {
    try {
      const response = await getMyMedia();
      setMediaList(response.data.media);
    } catch (error) {
      console.error("Failed to fetch media:", error);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  // Handle successful deletion
  const handleDeleteSuccess = async () => {
    // Refresh the list after deletion
    await fetchMedia();
    
    // Optional: Show toast notification
    // Toast.show({ type: "success", text1: "Media deleted" });
  };

  // Handle delete action
  const handleDelete = async (mediaId: string) => {
    try {
      const result = await deleteMediaItem(mediaId);
      
      // ✅ SUCCESS
      if (result.success) {
        // Remove from list immediately (optimistic update)
        setMediaList(prev => prev.filter(m => m._id !== mediaId));
        
        // Show success message
        Alert.alert("Success", "Media deleted successfully");
      }
    } catch (error: any) {
      // Handle error
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to delete media"
      );
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={mediaList}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <MediaItem
            media={item}
            currentUserId={currentUserId}
            onDeleteSuccess={handleDeleteSuccess}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchMedia} />
        }
      />
    </View>
  );
};
```

---

## 🔄 Success Flow Diagram

```
1. User clicks "Delete" button
   ↓
2. Show confirmation dialog
   ↓
3. User confirms deletion
   ↓
4. Call deleteMediaItem(mediaId)
   ↓
5. API Request: DELETE /api/media/:id
   ↓
6. Backend validates:
   - User is authenticated ✓
   - User is creator OR admin ✓
   ↓
7. Backend deletes:
   - Database record ✓
   - Cloudflare R2 files ✓
   ↓
8. Response: { success: true, message: "Media deleted successfully" }
   ↓
9. Frontend handles success:
   - Remove from UI list ✓
   - Show success message ✓
   - Refresh data if needed ✓
```

---

## ✅ Success Checklist

- [ ] User is authenticated (token present)
- [ ] User is the creator of the media (checked on frontend and backend)
- [ ] Confirmation dialog shown before deletion
- [ ] Loading state shown during deletion
- [ ] Success response received: `{ success: true }`
- [ ] Media removed from UI after success
- [ ] Success message shown to user
- [ ] Error handling in place for edge cases

---

## 🎨 UI/UX Best Practices

### 1. Show Delete Button Only for Creator

```typescript
const isOwner = media.uploadedBy === currentUserId;
{isOwner && <DeleteButton />}
```

### 2. Confirmation Before Deletion

```typescript
Alert.alert(
  "Delete Media",
  "Are you sure? This cannot be undone.",
  [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: deleteMedia }
  ]
);
```

### 3. Loading State

```typescript
{isLoading ? (
  <ActivityIndicator />
) : (
  <Text>Delete</Text>
)}
```

### 4. Success Feedback

```typescript
// Option 1: Alert
Alert.alert("Success", "Media deleted successfully");

// Option 2: Toast
Toast.show({
  type: "success",
  text1: "Media Deleted",
  text2: "The media has been permanently deleted"
});

// Option 3: Snackbar
Snackbar.show({
  text: "Media deleted successfully",
  duration: Snackbar.LENGTH_SHORT
});
```

### 5. Optimistic Update (Remove from UI immediately)

```typescript
// Remove from list immediately
setMediaList(prev => prev.filter(m => m._id !== mediaId));

try {
  await deleteMediaItem(mediaId);
  // Already removed from UI
} catch (error) {
  // Revert on error
  setMediaList(mediaList);
  Alert.alert("Error", "Failed to delete media");
}
```

---

## 🚨 Error Handling

### Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| `401` | Unauthorized | User needs to log in |
| `403` | Forbidden | User is not the creator |
| `404` | Not Found | Media already deleted |
| `400` | Bad Request | Invalid media ID |

### Error Handling Code

```typescript
try {
  await deleteMediaItem(mediaId);
} catch (error: any) {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message;

    switch (status) {
      case 401:
        Alert.alert("Error", "Please log in to delete media");
        // Redirect to login
        break;
      case 403:
        Alert.alert("Error", "You can only delete media you created");
        break;
      case 404:
        Alert.alert("Error", "Media not found. It may have already been deleted.");
        // Refresh list
        fetchMedia();
        break;
      default:
        Alert.alert("Error", message || "Failed to delete media");
    }
  } else {
    Alert.alert("Error", "Network error. Please check your connection.");
  }
}
```

---

## 📝 Quick Copy-Paste Code

### Minimal Working Example

```typescript
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Alert } from "react-native";

// Delete function
const deleteMedia = async (mediaId: string) => {
  const token = await SecureStore.getItemAsync("authToken");
  
  const response = await axios.delete(
    `https://your-api.com/api/media/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (response.data.success) {
    Alert.alert("Success", "Media deleted successfully");
    return response.data;
  } else {
    throw new Error(response.data.message);
  }
};

// Usage
const handleDelete = async () => {
  try {
    await deleteMedia(mediaId);
    // Remove from UI
    setMediaList(prev => prev.filter(m => m._id !== mediaId));
  } catch (error) {
    Alert.alert("Error", "Failed to delete media");
  }
};
```

---

## 🎯 Key Points for Success

1. **Authentication**: Always include `Authorization: Bearer ${token}` header
2. **Authorization**: Only show delete button if user is the creator
3. **Confirmation**: Always ask for confirmation before deleting
4. **Loading State**: Show loading indicator during deletion
5. **Success Handling**: Remove from UI and show success message
6. **Error Handling**: Handle all error cases gracefully
7. **Optimistic Updates**: Remove from UI immediately for better UX

---

## 📚 Related Files

- Backend Route: `src/routes/media.route.ts`
- Backend Controller: `src/controllers/media.controller.ts`
- Backend Service: `src/service/media.service.ts`
- Full Documentation: `MEDIA_DELETION_FRONTEND_GUIDE.md`

---

**Last Updated:** 2024-01-15  
**Status:** Production Ready ✅

