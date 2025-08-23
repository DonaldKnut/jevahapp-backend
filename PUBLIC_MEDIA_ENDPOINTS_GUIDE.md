# Public Media Endpoints & Interactions Guide

## 🎯 **Problem Solved**

Previously, when users logged out, they could only see their own media. Now with public endpoints, users can view ALL media content even when not authenticated.

## 📡 **Public Media Endpoints (No Authentication Required)**

### 1. **Get All Public Media**

**Endpoint:** `GET /api/media/public`

**Description:** Retrieve all media items with optional filters (no authentication required)

**Query Parameters:**

```javascript
{
  search?: string,           // Search by title, description
  contentType?: string,      // "music" | "videos" | "books" | "live"
  category?: string,         // "worship" | "inspiration" | "youth" | "teachings"
  topics?: string,           // Comma-separated topics
  sort?: string,             // "newest" | "oldest" | "popular"
  page?: number,             // Page number (default: 1)
  limit?: number,            // Items per page (default: 50)
  creator?: string,          // Filter by creator ID
  duration?: string,         // "short" | "medium" | "long"
  startDate?: string,        // ISO date string
  endDate?: string           // ISO date string
}
```

**Frontend Usage:**

```javascript
// Fetch all public media
const fetchPublicMedia = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/media/public?${params}`);
  const data = await response.json();
  return data;
};

// Example usage
const media = await fetchPublicMedia({
  contentType: "videos",
  category: "worship",
  page: 1,
  limit: 20,
});
```

**Response:**

```json
{
  "success": true,
  "media": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "title": "Sunday Service",
      "description": "Live worship service",
      "contentType": "videos",
      "category": "worship",
      "fileUrl": "https://example.com/video.mp4",
      "thumbnailUrl": "https://example.com/thumbnail.jpg",
      "topics": ["gospel", "worship"],
      "uploadedBy": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "https://example.com/avatar.jpg"
      },
      "viewCount": 150,
      "likeCount": 25,
      "commentCount": 8,
      "duration": 3600,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### 2. **Get All Public Content (No Pagination)**

**Endpoint:** `GET /api/media/public/all-content`

**Description:** Retrieve ALL media content without pagination for the "All" tab

**Frontend Usage:**

```javascript
const fetchAllPublicContent = async () => {
  const response = await fetch("/api/media/public/all-content");
  const data = await response.json();
  return data;
};

// Example usage
const allContent = await fetchAllPublicContent();
```

**Response:**

```json
{
  "success": true,
  "media": [
    // Array of all media items
  ],
  "total": 150
}
```

### 3. **Search Public Media**

**Endpoint:** `GET /api/media/public/search`

**Description:** Search media items with filters (no authentication required)

**Frontend Usage:**

```javascript
const searchPublicMedia = async (searchTerm, filters = {}) => {
  const params = new URLSearchParams({
    search: searchTerm,
    ...filters,
  });
  const response = await fetch(`/api/media/public/search?${params}`);
  const data = await response.json();
  return data;
};

// Example usage
const searchResults = await searchPublicMedia("gospel", {
  contentType: "videos",
  category: "worship",
});
```

### 4. **Get Single Public Media Item**

**Endpoint:** `GET /api/media/public/:id`

**Description:** Retrieve a single media item by ID (no authentication required)

**Frontend Usage:**

```javascript
const fetchPublicMediaById = async mediaId => {
  const response = await fetch(`/api/media/public/${mediaId}`);
  const data = await response.json();
  return data;
};

// Example usage
const mediaItem = await fetchPublicMediaById("64f8a1b2c3d4e5f6a7b8c9d0");
```

**Response:**

```json
{
  "success": true,
  "media": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "title": "Sunday Service",
    "description": "Live worship service",
    "contentType": "videos",
    "category": "worship",
    "fileUrl": "https://example.com/video.mp4",
    "thumbnailUrl": "https://example.com/thumbnail.jpg",
    "topics": ["gospel", "worship"],
    "uploadedBy": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "viewCount": 150,
    "likeCount": 25,
    "commentCount": 8,
    "duration": 3600,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

## 🔐 **Media Interactions (Authentication Required)**

### 1. **Like/Unlike Media**

**Endpoint:** `POST /api/media/:id/interact`

**Description:** Like or unlike a media item

**Frontend Usage:**

```javascript
const likeMedia = async mediaId => {
  const response = await fetch(`/api/media/${mediaId}/interact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      interactionType: "like",
    }),
  });
  const data = await response.json();
  return data;
};

// Example usage
const result = await likeMedia("64f8a1b2c3d4e5f6a7b8c9d0");
```

**Response:**

```json
{
  "success": true,
  "message": "Media liked successfully",
  "interaction": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
    "mediaId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "userId": "64f8a1b2c3d4e5f6a7b8c9d3",
    "interactionType": "like",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### 2. **Add/Remove from Library**

**Endpoint:** `POST /api/media/:id/bookmark`

**Description:** Add or remove media from user's library/bookmarks

**Frontend Usage:**

```javascript
const addToLibrary = async mediaId => {
  const response = await fetch(`/api/media/${mediaId}/bookmark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
  });
  const data = await response.json();
  return data;
};

// Example usage
const result = await addToLibrary("64f8a1b2c3d4e5f6a7b8c9d0");
```

**Response:**

```json
{
  "success": true,
  "message": "Media added to library successfully",
  "bookmark": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d4",
    "mediaId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "userId": "64f8a1b2c3d4e5f6a7b8c9d3",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### 3. **Record View/Listen/Read**

**Endpoint:** `POST /api/media/:id/interact`

**Description:** Record user interaction with media (view, listen, read, download)

**Frontend Usage:**

```javascript
const recordInteraction = async (mediaId, interactionType) => {
  const response = await fetch(`/api/media/${mediaId}/interact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      interactionType: interactionType, // "view" | "listen" | "read" | "download"
    }),
  });
  const data = await response.json();
  return data;
};

// Example usage
const result = await recordInteraction("64f8a1b2c3d4e5f6a7b8c9d0", "view");
```

### 4. **Track View Duration**

**Endpoint:** `POST /api/media/:id/track-view`

**Description:** Track how long user viewed media content

**Frontend Usage:**

```javascript
const trackViewDuration = async (mediaId, duration, isComplete = false) => {
  const response = await fetch(`/api/media/${mediaId}/track-view`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      duration: duration, // Duration in seconds
      isComplete: isComplete,
    }),
  });
  const data = await response.json();
  return data;
};

// Example usage
const result = await trackViewDuration("64f8a1b2c3d4e5f6a7b8c9d0", 300, true);
```

### 5. **Share Media**

**Endpoint:** `POST /api/media/:id/share`

**Description:** Share media content

**Frontend Usage:**

```javascript
const shareMedia = async (mediaId, platform = null) => {
  const response = await fetch(`/api/media/${mediaId}/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      platform: platform, // Optional: "facebook" | "twitter" | "whatsapp"
    }),
  });
  const data = await response.json();
  return data;
};

// Example usage
const result = await shareMedia("64f8a1b2c3d4e5f6a7b8c9d0", "facebook");
```

### 6. **Download Media**

**Endpoint:** `POST /api/media/:id/download`

**Description:** Record media download

**Frontend Usage:**

```javascript
const downloadMedia = async (mediaId, fileSize) => {
  const response = await fetch(`/api/media/${mediaId}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      fileSize: fileSize, // File size in bytes
    }),
  });
  const data = await response.json();
  return data;
};

// Example usage
const result = await downloadMedia("64f8a1b2c3d4e5f6a7b8c9d0", 1024000);
```

## 🎯 **Frontend Implementation Examples**

### **React Hook for Public Media**

```javascript
import { useState, useEffect } from "react";

const usePublicMedia = (filters = {}) => {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/media/public?${params}`);
      const data = await response.json();

      if (data.success) {
        setMedia(data.media);
        setPagination(data.pagination);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to fetch media");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [JSON.stringify(filters)]);

  return { media, loading, error, pagination, refetch: fetchMedia };
};

// Usage
const { media, loading, error, pagination } = usePublicMedia({
  contentType: "videos",
  page: 1,
  limit: 20,
});
```

### **React Hook for Media Interactions**

```javascript
import { useState } from "react";

const useMediaInteractions = () => {
  const [loading, setLoading] = useState(false);

  const likeMedia = async mediaId => {
    setLoading(true);
    try {
      const response = await fetch(`/api/media/${mediaId}/interact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ interactionType: "like" }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error("Failed to like media");
    } finally {
      setLoading(false);
    }
  };

  const addToLibrary = async mediaId => {
    setLoading(true);
    try {
      const response = await fetch(`/api/media/${mediaId}/bookmark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
      });
      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error("Failed to add to library");
    } finally {
      setLoading(false);
    }
  };

  return { likeMedia, addToLibrary, loading };
};

// Usage
const { likeMedia, addToLibrary, loading } = useMediaInteractions();
```

### **Complete Media Component Example**

```javascript
import React, { useState, useEffect } from "react";

const MediaCard = ({ media }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isInLibrary, setIsInLibrary] = useState(false);
  const [likeCount, setLikeCount] = useState(media.likeCount);

  const handleLike = async () => {
    try {
      const result = await likeMedia(media._id);
      if (result.success) {
        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
      }
    } catch (error) {
      console.error("Failed to like media:", error);
    }
  };

  const handleAddToLibrary = async () => {
    try {
      const result = await addToLibrary(media._id);
      if (result.success) {
        setIsInLibrary(!isInLibrary);
      }
    } catch (error) {
      console.error("Failed to add to library:", error);
    }
  };

  return (
    <div className="media-card">
      <img src={media.thumbnailUrl} alt={media.title} />
      <h3>{media.title}</h3>
      <p>{media.description}</p>
      <div className="media-actions">
        <button onClick={handleLike}>
          {isLiked ? "❤️" : "🤍"} {likeCount}
        </button>
        <button onClick={handleAddToLibrary}>
          {isInLibrary ? "📚" : "📖"}
        </button>
        <button onClick={() => shareMedia(media._id)}>📤 Share</button>
      </div>
    </div>
  );
};
```

## 🔄 **Error Handling**

### **Common Error Responses**

```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

```json
{
  "success": false,
  "message": "Media not found"
}
```

```json
{
  "success": false,
  "message": "Invalid media identifier"
}
```

### **Error Handling Example**

```javascript
const handleMediaAction = async (action, mediaId) => {
  try {
    const result = await action(mediaId);
    if (result.success) {
      // Handle success
      showNotification("Success!", "green");
    } else {
      // Handle API error
      showNotification(result.message, "red");
    }
  } catch (error) {
    // Handle network/other errors
    showNotification("Network error. Please try again.", "red");
  }
};
```

## 🎯 **Key Points for Frontend Developer**

1. **Public Endpoints**: Use `/api/media/public/*` for viewing content without authentication
2. **Authenticated Endpoints**: Use `/api/media/*` for user interactions (likes, library, etc.)
3. **Always Include Authorization Header**: For authenticated endpoints
4. **Handle Loading States**: Show loading indicators during API calls
5. **Error Handling**: Implement proper error handling for all API calls
6. **Optimistic Updates**: Update UI immediately, then sync with server
7. **Rate Limiting**: Be aware of rate limiting on interaction endpoints

## 🚀 **Quick Start Checklist**

- [ ] Replace existing media fetch calls with public endpoints
- [ ] Implement media interaction functions (like, library, share)
- [ ] Add proper error handling and loading states
- [ ] Test both authenticated and non-authenticated scenarios
- [ ] Implement optimistic updates for better UX
- [ ] Add proper TypeScript types for all responses
