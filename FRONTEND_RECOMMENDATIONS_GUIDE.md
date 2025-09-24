# Frontend Recommendations Integration Guide

## Overview

The Jevah backend now provides dynamic recommendations alongside the existing all-content feed. This guide covers how to consume and implement these recommendations in your frontend application.

## API Endpoints

### Authenticated Endpoint

```
GET /api/media/all-content
Authorization: Bearer <jwt_token>
Query Parameters:
- mood (optional): "worship" | "praise" | "inspiration"
```

### Public Endpoint

```
GET /api/media/public/all-content
Query Parameters:
- mood (optional): "worship" | "praise" | "inspiration"
```

## Response Structure

### Main Response

```json
{
  "success": true,
  "media": [
    {
      "_id": "68d40d9363d3c6f2529d2210",
      "title": "YOU WILL TAKE FASTING & PRAYER SERIOUSLY AFTER HEARING THIS",
      "category": "teachings",
      "commentCount": 0,
      "contentType": "sermon",
      "createdAt": "2025-09-24T15:26:10.771Z",
      "description": "The power of fasting and prayer...",
      "fileUrl": "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/...",
      "likeCount": 0,
      "shareCount": 0,
      "thumbnailUrl": "https://res.cloudinary.com/...",
      "topics": ["fasting", "prayer", "discipleship", "sermon"],
      "updatedAt": "2025-09-24T16:09:14.196Z",
      "viewCount": 5,
      "totalLikes": 0,
      "totalShares": 0,
      "totalViews": 0,
      "authorInfo": {
        "_id": "68aff175fde13033bed89d13",
        "firstName": "Evangelist Godman",
        "lastName": "Chuks",
        "fullName": "Evangelist Godman Chuks",
        "avatar": "https://res.cloudinary.com/..."
      },
      "formattedCreatedAt": "2025-09-24T15:26:10.771Z",
      "thumbnail": "https://res.cloudinary.com/..."
    }
  ],
  "total": 14,
  "recommendations": {
    "sections": [
      {
        "key": "editorial",
        "title": "Jevah Picks",
        "media": [...],
        "metadata": {
          "abTestVariant": "control"
        }
      },
      {
        "key": "for_you",
        "title": "For You",
        "reason": "Based on your activity and similar users",
        "media": [...],
        "metadata": {
          "abTestVariant": "control",
          "qualityScore": 0.75,
          "collaborativeScore": 0.68
        }
      }
    ]
  }
}
```

## Recommendation Sections

### 1. Editorial (`key: "editorial"`)

- **Title**: "Jevah Picks"
- **Content**: Curated seeded content (`isDefaultContent: true`)
- **Purpose**: Showcase high-quality, vetted gospel content
- **Personalization**: None - same for all users

### 2. For You (`key: "for_you"`)

- **Title**: "For You"
- **Content**: Personalized based on user's viewing history, favorites, shares, and bookmarks
- **Purpose**: Content tailored to user's interests
- **Personalization**:
  - Uses topic embeddings for similarity
  - Collaborative filtering with similar users
  - Quality scoring based on engagement metrics

### 3. Because You Watched (`key: "because_you_watched"`)

- **Title**: "Because you watched"
- **Content**: Similar content to the user's last viewed item
- **Purpose**: Continue user's viewing journey
- **Personalization**: Based on topics, category, and content type of last viewed

### 4. Trending (`key: "trending"`)

- **Title**: "Trending"
- **Content**: Popular content from the last 14 days
- **Purpose**: Show what's currently popular in the community
- **Personalization**: None - based on community engagement

### 5. Explore (`key: "quick_picks"`)

- **Title**: "Explore"
- **Content**: Random content for discovery
- **Purpose**: Help users discover new content
- **Personalization**: Light filtering by mood parameter

## Frontend Implementation

### React Component Example

```tsx
import React, { useState, useEffect } from "react";

interface MediaItem {
  _id: string;
  title: string;
  description?: string;
  contentType: string;
  category?: string;
  fileUrl: string;
  thumbnailUrl: string;
  topics: string[];
  authorInfo: {
    _id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    avatar: string;
  };
  viewCount: number;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  totalLikes: number;
  totalShares: number;
  totalViews: number;
  formattedCreatedAt: string;
  thumbnail: string;
}

interface RecommendationSection {
  key: string;
  title: string;
  reason?: string;
  media: MediaItem[];
  metadata?: {
    abTestVariant?: string;
    qualityScore?: number;
    collaborativeScore?: number;
  };
}

interface AllContentResponse {
  success: boolean;
  media: MediaItem[];
  total: number;
  recommendations?: {
    sections: RecommendationSection[];
  };
}

const AllContentFeed: React.FC = () => {
  const [content, setContent] = useState<AllContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<string>("");

  useEffect(() => {
    fetchAllContent();
  }, [mood]);

  const fetchAllContent = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      const url = new URL(
        "/api/media/all-content",
        process.env.REACT_APP_API_URL
      );
      if (mood) url.searchParams.set("mood", mood);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data: AllContentResponse = await response.json();
      setContent(data);
    } catch (error) {
      console.error("Failed to fetch content:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderMediaItem = (item: MediaItem) => (
    <div key={item._id} className="media-item">
      <img
        src={item.thumbnailUrl || item.thumbnail}
        alt={item.title}
        className="media-thumbnail"
      />
      <div className="media-info">
        <h3 className="media-title">{item.title}</h3>
        <p className="media-author">{item.authorInfo.fullName}</p>
        <div className="media-stats">
          <span>👁 {item.totalViews || item.viewCount}</span>
          <span>❤️ {item.totalLikes || item.likeCount}</span>
          <span>💬 {item.commentCount}</span>
        </div>
        <div className="media-topics">
          {item.topics.slice(0, 3).map(topic => (
            <span key={topic} className="topic-tag">
              #{topic}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRecommendationSection = (section: RecommendationSection) => (
    <div key={section.key} className="recommendation-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
        {section.reason && <p className="section-reason">{section.reason}</p>}
        {section.metadata?.qualityScore && (
          <div className="section-metadata">
            <span className="quality-score">
              Quality: {(section.metadata.qualityScore * 100).toFixed(0)}%
            </span>
            {section.metadata.collaborativeScore && (
              <span className="collaborative-score">
                Similar Users:{" "}
                {(section.metadata.collaborativeScore * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>
      <div className="media-grid">{section.media.map(renderMediaItem)}</div>
    </div>
  );

  if (loading) return <div className="loading">Loading content...</div>;

  if (!content) return <div className="error">Failed to load content</div>;

  return (
    <div className="all-content-feed">
      {/* Mood Filter */}
      <div className="mood-filter">
        <label>Mood:</label>
        <select value={mood} onChange={e => setMood(e.target.value)}>
          <option value="">All</option>
          <option value="worship">Worship</option>
          <option value="praise">Praise</option>
          <option value="inspiration">Inspiration</option>
        </select>
      </div>

      {/* Main Content Feed */}
      <div className="main-feed">
        <h1>All Content ({content.total})</h1>
        <div className="media-grid">{content.media.map(renderMediaItem)}</div>
      </div>

      {/* Recommendations */}
      {content.recommendations?.sections && (
        <div className="recommendations">
          <h1>Recommended for You</h1>
          {content.recommendations.sections.map(renderRecommendationSection)}
        </div>
      )}
    </div>
  );
};

export default AllContentFeed;
```

### CSS Styling

```css
.all-content-feed {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.mood-filter {
  margin-bottom: 30px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.mood-filter label {
  margin-right: 10px;
  font-weight: bold;
}

.mood-filter select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.main-feed {
  margin-bottom: 40px;
}

.recommendations {
  border-top: 2px solid #eee;
  padding-top: 30px;
}

.recommendation-section {
  margin-bottom: 40px;
}

.section-header {
  margin-bottom: 20px;
}

.section-title {
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 8px 0;
  color: #333;
}

.section-reason {
  font-size: 14px;
  color: #666;
  margin: 0 0 10px 0;
  font-style: italic;
}

.section-metadata {
  display: flex;
  gap: 15px;
  font-size: 12px;
}

.quality-score,
.collaborative-score {
  background: #e3f2fd;
  padding: 4px 8px;
  border-radius: 12px;
  color: #1976d2;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.media-item {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.media-item:hover {
  transform: translateY(-2px);
}

.media-thumbnail {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.media-info {
  padding: 15px;
}

.media-title {
  font-size: 16px;
  font-weight: bold;
  margin: 0 0 8px 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.media-author {
  font-size: 14px;
  color: #666;
  margin: 0 0 10px 0;
}

.media-stats {
  display: flex;
  gap: 15px;
  margin-bottom: 10px;
  font-size: 12px;
  color: #888;
}

.media-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.topic-tag {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  color: #555;
}

.loading {
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: #666;
}

.error {
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: #d32f2f;
}

@media (max-width: 768px) {
  .media-grid {
    grid-template-columns: 1fr;
  }

  .all-content-feed {
    padding: 10px;
  }
}
```

## A/B Testing Implementation

The backend automatically assigns users to A/B test variants for section ordering:

- **Control**: Editorial → For You → Trending → Because You Watched → Explore
- **Variant A**: For You → Editorial → Trending → Because You Watched → Explore
- **Variant B**: Trending → For You → Editorial → Because You Watched → Explore

### Tracking A/B Test Performance

```tsx
const trackABTestInteraction = (
  sectionKey: string,
  action: string,
  metadata?: any
) => {
  // Send analytics event to your tracking service
  analytics.track("recommendation_interaction", {
    sectionKey,
    action, // 'view', 'click', 'complete', etc.
    abTestVariant: metadata?.abTestVariant,
    qualityScore: metadata?.qualityScore,
    collaborativeScore: metadata?.collaborativeScore,
    timestamp: new Date().toISOString(),
  });
};

// Usage in component
const handleMediaClick = (mediaId: string, section: RecommendationSection) => {
  trackABTestInteraction(section.key, "click", section.metadata);
  // Navigate to media detail page
};
```

## Advanced Features

### 1. Completion Rate Tracking

Track user engagement to improve recommendations:

```tsx
const trackMediaProgress = async (mediaId: string, progressPercent: number) => {
  try {
    await fetch(`/api/media/${mediaId}/track-progress`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        duration: progressPercent,
        isComplete: progressPercent >= 90,
      }),
    });
  } catch (error) {
    console.error("Failed to track progress:", error);
  }
};
```

### 2. Feedback Collection

Allow users to provide feedback on recommendations:

```tsx
const provideRecommendationFeedback = async (
  mediaId: string,
  sectionKey: string,
  feedback: "like" | "dislike" | "not_interested"
) => {
  try {
    await fetch("/api/recommendations/feedback", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mediaId,
        sectionKey,
        feedback,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Failed to provide feedback:", error);
  }
};
```

### 3. Infinite Scroll with Recommendations

```tsx
const useInfiniteRecommendations = () => {
  const [sections, setSections] = useState<RecommendationSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMoreRecommendations = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const response = await fetch("/api/recommendations/load-more", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      setSections(prev => [...prev, ...data.sections]);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Failed to load more recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  return { sections, loading, hasMore, loadMoreRecommendations };
};
```

## Performance Considerations

1. **Lazy Loading**: Load recommendation sections on demand
2. **Caching**: Cache recommendation responses for 5-10 minutes
3. **Debouncing**: Debounce mood filter changes
4. **Image Optimization**: Use WebP format for thumbnails
5. **Virtual Scrolling**: For large lists of recommendations

## Error Handling

```tsx
const handleRecommendationError = (error: Error, section: string) => {
  console.error(`Recommendation error in ${section}:`, error);

  // Fallback to trending content
  fetchTrendingContent(section);

  // Report to monitoring service
  errorReporting.captureException(error, {
    tags: { section, feature: "recommendations" },
  });
};
```

## Best Practices

1. **Progressive Enhancement**: Always show main content even if recommendations fail
2. **Graceful Degradation**: Handle missing recommendation sections gracefully
3. **User Control**: Allow users to hide recommendation sections they don't want
4. **Performance Monitoring**: Track recommendation load times and engagement rates
5. **Accessibility**: Ensure recommendation sections are accessible to screen readers

This comprehensive system provides dynamic, personalized content discovery while maintaining the existing all-content feed structure.
