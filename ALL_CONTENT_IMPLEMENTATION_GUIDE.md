# All Content Implementation Guide

## 🎯 **Overview**

The "All Content" feature displays ALL media content from ALL users, regardless of who is logged in. This ensures users can browse and discover content even when not authenticated.

## 📡 **Available Endpoints**

### 1. **Public All Content (No Authentication Required)**

**Endpoint:** `GET /api/media/public/all-content`

**Description:** Retrieve ALL media content without pagination - perfect for the "All" tab

**Frontend Usage:**

```javascript
// Simple fetch without authentication
const fetchAllContent = async () => {
  try {
    const response = await fetch("/api/media/public/all-content");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch all content:", error);
    throw error;
  }
};

// Usage
const { media, total } = await fetchAllContent();
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
  "total": 150
}
```

### 2. **Authenticated All Content (With User Features)**

**Endpoint:** `GET /api/media/all-content`

**Description:** Retrieve all content with additional user-specific data (bookmarks, interactions, etc.)

**Frontend Usage:**

```javascript
// Fetch with authentication for user-specific features
const fetchAllContentWithUserData = async () => {
  try {
    const response = await fetch("/api/media/all-content", {
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch all content:", error);
    throw error;
  }
};

// Usage
const { media, total } = await fetchAllContentWithUserData();
```

## 🎨 **Frontend Implementation Examples**

### **React Hook for All Content**

```javascript
import { useState, useEffect } from "react";

const useAllContent = (isAuthenticated = false) => {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  const fetchAllContent = async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = isAuthenticated
        ? "/api/media/all-content"
        : "/api/media/public/all-content";

      const options = isAuthenticated
        ? {
            headers: {
              Authorization: `Bearer ${userToken}`,
              "Content-Type": "application/json",
            },
          }
        : {};

      const response = await fetch(endpoint, options);
      const data = await response.json();

      if (data.success) {
        setMedia(data.media);
        setTotal(data.total);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to fetch all content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllContent();
  }, [isAuthenticated]);

  return {
    media,
    loading,
    error,
    total,
    refetch: fetchAllContent,
  };
};

// Usage
const { media, loading, error, total } = useAllContent(isUserLoggedIn);
```

### **All Content Component**

```javascript
import React from "react";
import { useAllContent } from "./hooks/useAllContent";

const AllContentTab = ({ isAuthenticated }) => {
  const { media, loading, error, total } = useAllContent(isAuthenticated);

  if (loading) {
    return <div className="loading">Loading all content...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="all-content">
      <div className="content-header">
        <h2>All Content</h2>
        <span className="content-count">{total} items</span>
      </div>

      <div className="content-grid">
        {media.map(item => (
          <MediaCard
            key={item._id}
            media={item}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>

      {media.length === 0 && (
        <div className="empty-state">
          <p>No content available yet.</p>
        </div>
      )}
    </div>
  );
};
```

### **Media Card Component with User Interactions**

```javascript
import React, { useState } from "react";

const MediaCard = ({ media, isAuthenticated }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isInLibrary, setIsInLibrary] = useState(false);
  const [likeCount, setLikeCount] = useState(media.likeCount);

  const handleLike = async () => {
    if (!isAuthenticated) {
      // Show login prompt
      showLoginModal();
      return;
    }

    try {
      const response = await fetch(`/api/media/${media._id}/interact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ interactionType: "like" }),
      });

      const data = await response.json();
      if (data.success) {
        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
      }
    } catch (error) {
      console.error("Failed to like media:", error);
    }
  };

  const handleAddToLibrary = async () => {
    if (!isAuthenticated) {
      showLoginModal();
      return;
    }

    try {
      const response = await fetch(`/api/media/${media._id}/bookmark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setIsInLibrary(!isInLibrary);
      }
    } catch (error) {
      console.error("Failed to add to library:", error);
    }
  };

  return (
    <div className="media-card">
      <div className="media-thumbnail">
        <img src={media.thumbnailUrl} alt={media.title} />
        <div className="media-overlay">
          <button className="play-button">▶️</button>
        </div>
      </div>

      <div className="media-info">
        <h3 className="media-title">{media.title}</h3>
        <p className="media-description">{media.description}</p>

        <div className="media-creator">
          <img
            src={media.uploadedBy.avatar}
            alt={`${media.uploadedBy.firstName} ${media.uploadedBy.lastName}`}
            className="creator-avatar"
          />
          <span className="creator-name">
            {media.uploadedBy.firstName} {media.uploadedBy.lastName}
          </span>
        </div>

        <div className="media-stats">
          <span>👁️ {media.viewCount}</span>
          <span>❤️ {likeCount}</span>
          <span>💬 {media.commentCount}</span>
        </div>
      </div>

      <div className="media-actions">
        <button
          onClick={handleLike}
          className={`like-button ${isLiked ? "liked" : ""}`}
        >
          {isLiked ? "❤️" : "🤍"} Like
        </button>

        <button
          onClick={handleAddToLibrary}
          className={`library-button ${isInLibrary ? "in-library" : ""}`}
        >
          {isInLibrary ? "📚" : "📖"} Library
        </button>

        <button className="share-button">📤 Share</button>
      </div>
    </div>
  );
};
```

### **Content Filtering and Search**

```javascript
import React, { useState, useMemo } from "react";

const AllContentWithFilters = ({ isAuthenticated }) => {
  const { media, loading, error, total } = useAllContent(isAuthenticated);
  const [searchTerm, setSearchTerm] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Filter media based on search and filters
  const filteredMedia = useMemo(() => {
    return media.filter(item => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesContentType =
        contentTypeFilter === "all" || item.contentType === contentTypeFilter;

      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesContentType && matchesCategory;
    });
  }, [media, searchTerm, contentTypeFilter, categoryFilter]);

  return (
    <div className="all-content-with-filters">
      <div className="filters-section">
        <input
          type="text"
          placeholder="Search content..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <select
          value={contentTypeFilter}
          onChange={e => setContentTypeFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Types</option>
          <option value="videos">Videos</option>
          <option value="music">Music</option>
          <option value="books">Books</option>
          <option value="live">Live</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Categories</option>
          <option value="worship">Worship</option>
          <option value="inspiration">Inspiration</option>
          <option value="youth">Youth</option>
          <option value="teachings">Teachings</option>
        </select>
      </div>

      <div className="content-results">
        <div className="results-header">
          <h3>All Content</h3>
          <span>
            {filteredMedia.length} of {total} items
          </span>
        </div>

        <div className="content-grid">
          {filteredMedia.map(item => (
            <MediaCard
              key={item._id}
              media={item}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>

        {filteredMedia.length === 0 && (
          <div className="no-results">
            <p>No content matches your filters.</p>
            <button
              onClick={() => {
                setSearchTerm("");
                setContentTypeFilter("all");
                setCategoryFilter("all");
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

## 🔄 **State Management (Redux/Zustand)**

### **Zustand Store Example**

```javascript
import { create } from "zustand";

const useAllContentStore = create((set, get) => ({
  media: [],
  loading: false,
  error: null,
  total: 0,
  filters: {
    search: "",
    contentType: "all",
    category: "all",
  },

  // Actions
  setLoading: loading => set({ loading }),
  setError: error => set({ error }),
  setMedia: (media, total) => set({ media, total }),
  setFilters: filters => set({ filters }),

  // Async actions
  fetchAllContent: async (isAuthenticated = false) => {
    const { setLoading, setError, setMedia } = get();

    try {
      setLoading(true);
      setError(null);

      const endpoint = isAuthenticated
        ? "/api/media/all-content"
        : "/api/media/public/all-content";

      const options = isAuthenticated
        ? {
            headers: {
              Authorization: `Bearer ${userToken}`,
              "Content-Type": "application/json",
            },
          }
        : {};

      const response = await fetch(endpoint, options);
      const data = await response.json();

      if (data.success) {
        setMedia(data.media, data.total);
      } else {
        setError(data.message);
      }
    } catch (error) {
      setError("Failed to fetch all content");
    } finally {
      setLoading(false);
    }
  },

  // Computed values
  getFilteredMedia: () => {
    const { media, filters } = get();
    return media.filter(item => {
      const matchesSearch =
        item.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.description.toLowerCase().includes(filters.search.toLowerCase());

      const matchesContentType =
        filters.contentType === "all" ||
        item.contentType === filters.contentType;

      const matchesCategory =
        filters.category === "all" || item.category === filters.category;

      return matchesSearch && matchesContentType && matchesCategory;
    });
  },
}));

// Usage
const {
  media,
  loading,
  error,
  total,
  filters,
  fetchAllContent,
  setFilters,
  getFilteredMedia,
} = useAllContentStore();
```

## 🎯 **Key Implementation Points**

### **1. Authentication Handling**

```javascript
// Check if user is authenticated
const isAuthenticated = !!userToken;

// Use appropriate endpoint based on authentication
const endpoint = isAuthenticated
  ? "/api/media/all-content"
  : "/api/media/public/all-content";

// Show login prompts for authenticated features
const handleAuthenticatedAction = action => {
  if (!isAuthenticated) {
    showLoginModal();
    return;
  }
  action();
};
```

### **2. Error Handling**

```javascript
const handleApiError = (error, fallbackMessage) => {
  if (error.response?.status === 401) {
    // Handle unauthorized - redirect to login
    redirectToLogin();
  } else if (error.response?.status === 404) {
    // Handle not found
    showError("Content not found");
  } else {
    // Handle other errors
    showError(fallbackMessage || "Something went wrong");
  }
};
```

### **3. Loading States**

```javascript
const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <p>Loading all content...</p>
  </div>
);

const ErrorState = ({ error, onRetry }) => (
  <div className="error-state">
    <p>Error: {error}</p>
    <button onClick={onRetry}>Try Again</button>
  </div>
);
```

### **4. Empty States**

```javascript
const EmptyState = ({ message, action }) => (
  <div className="empty-state">
    <div className="empty-icon">📭</div>
    <h3>No Content Found</h3>
    <p>{message}</p>
    {action && <button onClick={action.onClick}>{action.label}</button>}
  </div>
);
```

## 🚀 **Quick Implementation Checklist**

- [ ] **Set up public endpoint calls** for non-authenticated users
- [ ] **Implement authenticated endpoint calls** for logged-in users
- [ ] **Add loading states** for better UX
- [ ] **Handle authentication errors** gracefully
- [ ] **Implement search and filtering** functionality
- [ ] **Add user interaction features** (likes, library, shares)
- [ ] **Create responsive grid layout** for media cards
- [ ] **Add pagination or infinite scroll** if needed
- [ ] **Implement proper error boundaries**
- [ ] **Add accessibility features** (ARIA labels, keyboard navigation)
- [ ] **Test both authenticated and non-authenticated flows**
- [ ] **Optimize performance** with proper memoization
- [ ] **Add analytics tracking** for content views and interactions

## 📱 **Mobile Considerations**

```javascript
// Responsive grid layout
const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding: 20px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 15px;
    padding: 15px;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 10px;
  }
`;

// Touch-friendly buttons
const ActionButton = styled.button`
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;

  @media (max-width: 768px) {
    padding: 10px 14px;
  }
`;
```

This comprehensive guide provides everything needed to implement the "All Content" functionality that works for both authenticated and non-authenticated users! 🎯✨







