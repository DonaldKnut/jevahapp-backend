# Media Analytics System - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Production Ready

---

## 📋 Overview

This guide explains how to implement the comprehensive media analytics system in your frontend. This system provides Twitter/X-style analytics for creators, allowing them to track detailed engagement metrics for their media uploads.

## 🎯 Key Features

- ✅ **Per-Media Analytics** - Detailed stats for each individual media item
- ✅ **Creator Analytics Dashboard** - Aggregated stats across all creator's media
- ✅ **Engagement Metrics** - Views, likes, shares, comments, downloads, bookmarks
- ✅ **Engagement Rate Calculation** - Automatic calculation of engagement rates
- ✅ **Time-Based Analytics** - Views/likes over 24h, 7d, 30d periods
- ✅ **Trend Analysis** - Percentage changes compared to previous periods
- ✅ **Content Type Breakdown** - Analytics grouped by content type
- ✅ **Engagement Over Time** - Daily engagement charts for last 30 days
- ✅ **Top Performing Content** - Automatically sorted by engagement

---

## 📡 API Endpoints

### 1. Get Creator Analytics Dashboard

Get comprehensive analytics for all media by a creator (similar to Twitter/X creator dashboard).

```
GET /api/media/analytics/creator
```

**Authentication:** Required (Bearer token)  
**Access:** Creators can only view their own analytics

**Query Parameters (Optional):**
- `startDate` (string, ISO format) - Start date for custom time range
- `endDate` (string, ISO format) - End date for custom time range
- Default: Last 30 days if not provided

**Example Request:**
```typescript
GET /api/media/analytics/creator?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
Headers: {
  Authorization: "Bearer <token>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMedia": 25,
    "totalViews": 15234,
    "totalLikes": 1245,
    "totalShares": 342,
    "totalComments": 189,
    "totalDownloads": 567,
    "averageEngagementRate": 11.67,
    "viewsLast24h": 234,
    "viewsLast7d": 1234,
    "viewsLast30d": 5234,
    "likesLast24h": 23,
    "likesLast7d": 123,
    "likesLast30d": 456,
    "topPerformingMedia": [
      {
        "mediaId": "...",
        "title": "Worship Song Title",
        "contentType": "music",
        "thumbnailUrl": "...",
        "views": 2345,
        "uniqueViews": 1890,
        "likes": 234,
        "shares": 45,
        "comments": 23,
        "downloads": 89,
        "bookmarks": 34,
        "engagementRate": 12.88,
        "averageWatchTime": 245,
        "completionRate": 67.5,
        "viewsLast24h": 45,
        "viewsLast7d": 234,
        "viewsLast30d": 1234,
        "likesLast24h": 5,
        "likesLast7d": 34,
        "likesLast30d": 123,
        "viewsTrend": 15.5,
        "likesTrend": 8.3,
        "sharesTrend": 12.1,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "publishedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "byContentType": {
      "music": {
        "count": 15,
        "totalViews": 12345,
        "totalLikes": 1000,
        "averageEngagementRate": 10.5
      },
      "videos": {
        "count": 10,
        "totalViews": 2889,
        "totalLikes": 245,
        "averageEngagementRate": 13.2
      }
    },
    "engagementOverTime": [
      {
        "date": "2024-01-01",
        "views": 45,
        "likes": 5,
        "shares": 2,
        "comments": 1
      },
      {
        "date": "2024-01-02",
        "views": 67,
        "likes": 8,
        "shares": 3,
        "comments": 2
      }
      // ... 28 more days
    ]
  }
}
```

---

### 2. Get Per-Media Analytics

Get detailed analytics for a specific media item (similar to Twitter/X post analytics).

```
GET /api/media/:mediaId/analytics
```

**Authentication:** Required (Bearer token)  
**Access:** Creators can only view analytics for their own media

**URL Parameters:**
- `mediaId` (string, required) - MongoDB ObjectId of the media item

**Query Parameters (Optional):**
- `startDate` (string, ISO format) - Start date for custom time range
- `endDate` (string, ISO format) - End date for custom time range
- Default: Last 30 days if not provided

**Example Request:**
```typescript
GET /api/media/507f1f77bcf86cd799439011/analytics
Headers: {
  Authorization: "Bearer <token>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mediaId": "507f1f77bcf86cd799439011",
    "title": "Amazing Worship Song",
    "contentType": "music",
    "thumbnailUrl": "https://...",
    "views": 2345,
    "uniqueViews": 1890,
    "likes": 234,
    "shares": 45,
    "comments": 23,
    "downloads": 89,
    "bookmarks": 34,
    "engagementRate": 12.88,
    "averageWatchTime": 245,
    "completionRate": 67.5,
    "viewsLast24h": 45,
    "viewsLast7d": 234,
    "viewsLast30d": 1234,
    "likesLast24h": 5,
    "likesLast7d": 34,
    "likesLast30d": 123,
    "viewsTrend": 15.5,
    "likesTrend": 8.3,
    "sharesTrend": 12.1,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "publishedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 📊 Response Data Structure

### PerMediaAnalytics

| Field | Type | Description |
|-------|------|-------------|
| `mediaId` | string | MongoDB ObjectId of the media |
| `title` | string | Media title |
| `contentType` | string | Type of content (music, videos, etc.) |
| `thumbnailUrl` | string? | Thumbnail image URL |
| `views` | number | Total views (all time) |
| `uniqueViews` | number | Number of unique users who viewed |
| `likes` | number | Total likes |
| `shares` | number | Total shares |
| `comments` | number | Total comments |
| `downloads` | number | Total downloads |
| `bookmarks` | number | Total bookmarks |
| `engagementRate` | number | (likes + shares + comments) / views * 100 |
| `averageWatchTime` | number? | Average watch/listen time in seconds |
| `completionRate` | number? | Percentage who watched/listened to completion |
| `viewsLast24h` | number | Views in last 24 hours |
| `viewsLast7d` | number | Views in last 7 days |
| `viewsLast30d` | number | Views in last 30 days |
| `likesLast24h` | number | Likes in last 24 hours |
| `likesLast7d` | number | Likes in last 7 days |
| `likesLast30d` | number | Likes in last 30 days |
| `viewsTrend` | number | Percentage change in views vs previous period |
| `likesTrend` | number | Percentage change in likes vs previous period |
| `sharesTrend` | number | Percentage change in shares vs previous period |
| `createdAt` | string (ISO) | When media was created |
| `publishedAt` | string (ISO) | When media was published |

### CreatorMediaAnalytics

| Field | Type | Description |
|-------|------|-------------|
| `totalMedia` | number | Total number of media items |
| `totalViews` | number | Total views across all media |
| `totalLikes` | number | Total likes across all media |
| `totalShares` | number | Total shares across all media |
| `totalComments` | number | Total comments across all media |
| `totalDownloads` | number | Total downloads across all media |
| `averageEngagementRate` | number | Average engagement rate across all media |
| `viewsLast24h` | number | Total views in last 24 hours |
| `viewsLast7d` | number | Total views in last 7 days |
| `viewsLast30d` | number | Total views in last 30 days |
| `likesLast24h` | number | Total likes in last 24 hours |
| `likesLast7d` | number | Total likes in last 7 days |
| `likesLast30d` | number | Total likes in last 30 days |
| `topPerformingMedia` | PerMediaAnalytics[] | Top 10 performing media items |
| `byContentType` | object | Analytics broken down by content type |
| `engagementOverTime` | object[] | Daily engagement data for last 30 days |

---

## 🎨 Frontend Implementation Examples

### React/React Native Component Example

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';

interface CreatorAnalytics {
  totalMedia: number;
  totalViews: number;
  totalLikes: number;
  averageEngagementRate: number;
  topPerformingMedia: any[];
  engagementOverTime: any[];
  // ... other fields
}

const CreatorAnalyticsDashboard = () => {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCreatorAnalytics();
  }, []);

  const fetchCreatorAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/media/analytics/creator`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch analytics');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  if (error) {
    return <Text>Error: {error}</Text>;
  }

  if (!analytics) {
    return <Text>No analytics data available</Text>;
  }

  return (
    <ScrollView>
      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{analytics.totalMedia}</Text>
          <Text style={styles.statLabel}>Total Media</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{analytics.totalViews.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Views</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{analytics.totalLikes.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Likes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{analytics.averageEngagementRate.toFixed(1)}%</Text>
          <Text style={styles.statLabel}>Avg Engagement</Text>
        </View>
      </View>

      {/* Top Performing Content */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Performing Content</Text>
        {analytics.topPerformingMedia.map((media) => (
          <View key={media.mediaId} style={styles.mediaCard}>
            <Text style={styles.mediaTitle}>{media.title}</Text>
            <View style={styles.mediaStats}>
              <Text>👁️ {media.views.toLocaleString()} views</Text>
              <Text>❤️ {media.likes.toLocaleString()} likes</Text>
              <Text>📊 {media.engagementRate.toFixed(1)}% engagement</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Engagement Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Engagement Over Time</Text>
        {/* Use your charting library here (e.g., react-native-chart-kit, Victory) */}
        {/* Example: LineChart with analytics.engagementOverTime */}
      </View>
    </ScrollView>
  );
};
```

### Per-Media Analytics Component

```tsx
const MediaAnalyticsScreen = ({ mediaId }: { mediaId: string }) => {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<PerMediaAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMediaAnalytics();
  }, [mediaId]);

  const fetchMediaAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/media/${mediaId}/analytics`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return <ActivityIndicator />;
  }

  return (
    <ScrollView>
      <View style={styles.header}>
        <Text style={styles.title}>{analytics.title}</Text>
        <Text style={styles.contentType}>{analytics.contentType}</Text>
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Views"
          value={analytics.views.toLocaleString()}
          subValue={`${analytics.viewsLast24h} last 24h`}
          trend={analytics.viewsTrend}
        />
        <MetricCard
          label="Likes"
          value={analytics.likes.toLocaleString()}
          subValue={`${analytics.likesLast24h} last 24h`}
          trend={analytics.likesTrend}
        />
        <MetricCard
          label="Shares"
          value={analytics.shares.toLocaleString()}
          trend={analytics.sharesTrend}
        />
        <MetricCard
          label="Engagement Rate"
          value={`${analytics.engagementRate.toFixed(1)}%`}
        />
      </View>

      {/* Additional Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Detailed Stats</Text>
        <StatRow label="Unique Views" value={analytics.uniqueViews.toLocaleString()} />
        <StatRow label="Comments" value={analytics.comments.toLocaleString()} />
        <StatRow label="Downloads" value={analytics.downloads.toLocaleString()} />
        <StatRow label="Bookmarks" value={analytics.bookmarks.toLocaleString()} />
        {analytics.averageWatchTime && (
          <StatRow
            label="Avg Watch Time"
            value={`${Math.floor(analytics.averageWatchTime / 60)}:${(analytics.averageWatchTime % 60).toString().padStart(2, '0')}`}
          />
        )}
        {analytics.completionRate && (
          <StatRow
            label="Completion Rate"
            value={`${analytics.completionRate.toFixed(1)}%`}
          />
        )}
      </View>

      {/* Time Period Breakdown */}
      <View style={styles.timeSection}>
        <Text style={styles.sectionTitle}>Views by Time Period</Text>
        <TimePeriodCard period="24h" value={analytics.viewsLast24h} />
        <TimePeriodCard period="7d" value={analytics.viewsLast7d} />
        <TimePeriodCard period="30d" value={analytics.viewsLast30d} />
      </View>
    </ScrollView>
  );
};
```

---

## ⚠️ Error Handling

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

### Forbidden (403) - Trying to view another creator's analytics
```json
{
  "success": false,
  "message": "Unauthorized: You can only view analytics for your own content"
}
```

### Media Not Found (404)
```json
{
  "success": false,
  "message": "Media not found"
}
```

### Error Handling Example

```typescript
try {
  const response = await fetch(`${API_BASE_URL}/api/media/${mediaId}/analytics`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (response.status === 401) {
    // Redirect to login
    navigateToLogin();
    return;
  }

  if (response.status === 403) {
    Alert.alert('Access Denied', 'You can only view analytics for your own content');
    return;
  }

  if (response.status === 404) {
    Alert.alert('Not Found', 'This media item does not exist');
    return;
  }

  const data = await response.json();
  if (data.success) {
    setAnalytics(data.data);
  } else {
    throw new Error(data.message);
  }
} catch (error: any) {
  console.error('Analytics error:', error);
  Alert.alert('Error', 'Failed to load analytics. Please try again.');
}
```

---

## 📈 UI/UX Recommendations

### Creator Dashboard
1. **Summary Cards** - Display key metrics prominently at the top
2. **Charts** - Visualize engagement over time with line/bar charts
3. **Top Performing List** - Show top 10 media items with thumbnails
4. **Content Type Breakdown** - Use pie charts or grouped bar charts
5. **Time Period Selector** - Allow users to filter by 24h, 7d, 30d, custom range

### Per-Media Analytics
1. **Media Header** - Show thumbnail, title, and content type
2. **Key Metrics Grid** - Large, easy-to-read numbers with trend indicators
3. **Trend Indicators** - Use up/down arrows with colors (green for positive, red for negative)
4. **Comparison View** - Show how this media compares to average
5. **Detailed Breakdown** - Expandable sections for more detailed stats

### Chart Libraries
- **React Native**: `react-native-chart-kit`, `victory-native`, `react-native-svg-charts`
- **React Web**: `recharts`, `chart.js`, `victory`

---

## 🔄 Real-Time Updates

For real-time analytics updates, you can:
1. Poll the endpoint every 30-60 seconds while viewing analytics
2. Use WebSocket connections (if implemented) for live updates
3. Refresh on pull-to-refresh gesture

---

## 💡 Best Practices

1. **Caching** - Cache analytics data for 5-10 minutes to reduce API calls
2. **Loading States** - Always show loading indicators while fetching
3. **Error States** - Provide clear error messages and retry options
4. **Empty States** - Show helpful messages when no analytics data exists
5. **Performance** - Lazy load chart components and use virtualization for long lists
6. **Accessibility** - Ensure all metrics are accessible to screen readers

---

## 🎯 Next Steps

1. Implement the analytics dashboard screen
2. Add per-media analytics view (accessible from media detail screen)
3. Create chart components for visualization
4. Add date range picker for custom time periods
5. Implement export functionality (if needed in future)

---

**Questions?** Contact the backend team or refer to the API documentation.


