# User Content Management API Documentation

## Overview

This document describes all APIs available for users to manage their uploaded content, view analytics, and delete content.

**Last Updated**: 2024-12-19

---

## 📋 Table of Contents

1. [List Your Content](#list-your-content)
2. [View Content Analytics](#view-content-analytics)
3. [Delete Content](#delete-content)
4. [Content Types by Endpoint](#content-types-by-endpoint)

---

## 1. List Your Content

### Get All Your Uploaded Content (Unified Endpoint)

Get a list of all content you've uploaded with basic engagement metrics.

**Endpoint**: `GET /api/user-content/my-content`

**Authentication**: ✅ Required (Bearer token)

**Query Parameters**:
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 50)
- `sort` (string, optional): Sort order - `"recent"` or `"popular"` (default: "recent")
- `contentType` (string, optional): Filter by type - `"all"`, `"video"`, `"audio"`, `"photo"`, `"post"` (default: "all")

**Example Request**:
```bash
GET /api/user-content/my-content?page=1&limit=20&sort=recent&contentType=video
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "title": "My Video",
      "description": "Video description",
      "contentType": "videos",
      "thumbnailUrl": "https://...",
      "fileUrl": "https://...",
      "engagement": {
        "views": 1234,
        "likes": 42,
        "comments": 7,
        "shares": 8,
        "downloads": 15
      },
      "createdAt": "2024-12-19T10:00:00Z",
      "updatedAt": "2024-12-19T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

**Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

---

### Get Content by Type

You can also get content filtered by specific types using these endpoints:

#### Get Your Videos
**Endpoint**: `GET /api/user-content/user/videos`
- Returns: Videos, sermons, live streams, recordings

#### Get Your Audios
**Endpoint**: `GET /api/user-content/user/audios`
- Returns: Audio, music, podcasts

#### Get Your Photos
**Endpoint**: `GET /api/user-content/user/photos`
- Returns: Images

#### Get Your Posts
**Endpoint**: `GET /api/user-content/user/posts`
- Returns: Ebooks, devotionals, sermons

All support pagination: `?page=1&limit=20&sort=recent|popular`

---

## 2. View Content Analytics

### Get Analytics for Single Content Item

Get detailed analytics for a specific piece of content you uploaded (similar to Twitter/X post analytics).

**Endpoint**: `GET /api/media/:mediaId/analytics`

**Authentication**: ✅ Required (Bearer token)

**Path Parameters**:
- `mediaId`: MongoDB ObjectId of the media item

**Query Parameters** (optional):
- `startDate` (string, ISO format): Start date for custom time range
- `endDate` (string, ISO format): End date for custom time range
- Default: Last 30 days if not provided

**Example Request**:
```bash
GET /api/media/507f1f77bcf86cd799439011/analytics?startDate=2024-12-01T00:00:00Z&endDate=2024-12-19T23:59:59Z
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "mediaId": "507f1f77bcf86cd799439011",
    "title": "My Video",
    "metrics": {
      "views": 1234,
      "uniqueViews": 856,
      "likes": 42,
      "shares": 8,
      "comments": 7,
      "bookmarks": 15,
      "downloads": 23,
      "engagementRate": 4.62
    },
    "timeRange": {
      "startDate": "2024-12-01T00:00:00Z",
      "endDate": "2024-12-19T23:59:59Z"
    },
    "timeBasedMetrics": {
      "views24h": 45,
      "views7d": 234,
      "views30d": 1234,
      "likes24h": 3,
      "likes7d": 12,
      "likes30d": 42
    },
    "trends": {
      "viewsChange24h": 5.2,
      "viewsChange7d": 12.5,
      "likesChange24h": 0.0,
      "likesChange7d": 8.3
    },
    "engagementOverTime": [
      {
        "date": "2024-12-19",
        "views": 45,
        "likes": 3,
        "shares": 1,
        "comments": 2
      }
    ],
    "topEngagers": [],
    "publishedAt": "2024-12-01T10:00:00Z"
  }
}
```

**Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Not authorized to view analytics for this content
- `404 Not Found`: Media not found
- `500 Internal Server Error`: Server error

**Note**: You can only view analytics for content you uploaded.

---

### Get Creator Analytics Dashboard

Get comprehensive analytics for all your uploaded content (similar to Twitter/X creator dashboard).

**Endpoint**: `GET /api/media/analytics/creator`

**Authentication**: ✅ Required (Bearer token)

**Query Parameters** (optional):
- `startDate` (string, ISO format): Start date for custom time range
- `endDate` (string, ISO format): End date for custom time range
- Default: Last 30 days if not provided

**Example Request**:
```bash
GET /api/media/analytics/creator?startDate=2024-12-01T00:00:00Z&endDate=2024-12-19T23:59:59Z
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalMedia": 25,
    "timeRange": {
      "startDate": "2024-12-01T00:00:00Z",
      "endDate": "2024-12-19T23:59:59Z"
    },
    "totals": {
      "views": 45678,
      "likes": 1234,
      "shares": 567,
      "comments": 890,
      "downloads": 234,
      "bookmarks": 456
    },
    "averageEngagementRate": 5.89,
    "timeBasedMetrics": {
      "views24h": 1234,
      "views7d": 8901,
      "views30d": 45678,
      "likes24h": 45,
      "likes7d": 234,
      "likes30d": 1234
    },
    "trends": {
      "viewsChange24h": 12.5,
      "viewsChange7d": 23.4,
      "likesChange24h": 8.9,
      "likesChange7d": 15.6
    },
    "topPerformingContent": [
      {
        "mediaId": "507f1f77bcf86cd799439011",
        "title": "Top Video",
        "views": 5678,
        "likes": 234,
        "engagementRate": 4.12
      }
    ],
    "contentByType": {
      "videos": 15,
      "audio": 7,
      "ebooks": 3
    },
    "engagementOverTime": [
      {
        "date": "2024-12-19",
        "views": 1234,
        "likes": 45,
        "shares": 12,
        "comments": 34
      }
    ]
  }
}
```

**Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

---

## 3. Delete Content

Delete a piece of content you uploaded. Only the content creator or an admin can delete content.

**Endpoint**: `DELETE /api/media/:id`

**Authentication**: ✅ Required (Bearer token)

**Path Parameters**:
- `id`: MongoDB ObjectId of the media item

**Example Request**:
```bash
DELETE /api/media/507f1f77bcf86cd799439011
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

**Status Codes**:
- `200 OK`: Success - Content deleted
- `401 Unauthorized`: Missing or invalid token
- `400 Bad Request`: Invalid media ID or unauthorized to delete
- `404 Not Found`: Media not found
- `500 Internal Server Error`: Server error

**Important Notes**:
- ✅ Only the content creator (uploader) can delete their content
- ✅ Admins can also delete any content
- ✅ Deletion removes files from storage (R2/Cloudflare)
- ✅ Deletion is permanent - cannot be undone
- ✅ All associated interactions (likes, comments, etc.) are also removed

---

## 4. Content Types by Endpoint

### Unified Endpoint (`/my-content`)
- `contentType: "all"` - Returns all content types
- `contentType: "video"` - Returns videos, sermons, live streams, recordings
- `contentType: "audio"` - Returns audio, music, podcasts
- `contentType: "photo"` - Returns images
- `contentType: "post"` - Returns ebooks, devotionals, sermons

### Type-Specific Endpoints
- `/user/videos` - Videos, sermons, live streams, recordings
- `/user/audios` - Audio, music, podcasts
- `/user/photos` - Images
- `/user/posts` - Ebooks, devotionals, sermons

---

## 📊 Engagement Metrics Explained

### Basic Metrics (Included in List Endpoints)

- **views**: Total number of views
- **likes**: Total number of likes
- **comments**: Total number of comments
- **shares**: Total number of shares
- **downloads**: Total number of downloads

### Detailed Analytics Metrics

- **uniqueViews**: Number of unique users who viewed
- **bookmarks**: Number of users who bookmarked
- **engagementRate**: Percentage of viewers who engaged (liked, shared, or commented)
- **timeBasedMetrics**: Views/likes over 24h, 7d, 30d periods
- **trends**: Percentage changes compared to previous periods
- **engagementOverTime**: Daily breakdown of engagement

---

## 🔒 Authorization

All endpoints require authentication:
- Include `Authorization: Bearer <token>` header
- Token is obtained from login/authentication flow
- Analytics endpoints verify ownership (you can only view analytics for your own content)
- Delete endpoint verifies ownership (you can only delete your own content)

---

## 🚀 Example Usage Flow

### 1. List Your Content
```bash
GET /api/user-content/my-content?page=1&limit=20
Authorization: Bearer <token>
```

### 2. View Analytics for Specific Content
```bash
GET /api/media/507f1f77bcf86cd799439011/analytics
Authorization: Bearer <token>
```

### 3. View Overall Creator Analytics
```bash
GET /api/media/analytics/creator
Authorization: Bearer <token>
```

### 4. Delete Content (if needed)
```bash
DELETE /api/media/507f1f77bcf86cd799439011
Authorization: Bearer <token>
```

---

## 📝 Notes

1. **Pagination**: All list endpoints support pagination with `page` and `limit` parameters
2. **Sorting**: Use `sort=recent` (default) or `sort=popular` to sort by creation date or engagement
3. **Filtering**: Use `contentType` parameter to filter by content type
4. **Rate Limiting**: All endpoints have rate limiting (typically 20 requests per minute)
5. **Caching**: Analytics data may be cached for performance

---

## 🐛 Error Handling

Common errors and solutions:

- **401 Unauthorized**: Check that your token is valid and included in headers
- **403 Forbidden**: You're trying to view analytics/delete content you don't own
- **404 Not Found**: Content ID doesn't exist or was already deleted
- **400 Bad Request**: Invalid content ID format or invalid query parameters

---

## 📚 Related Documentation

- [Media Analytics Frontend Guide](./MEDIA_ANALYTICS_FRONTEND_GUIDE.md) - Detailed analytics implementation
- [API Rate Limiting](./README.md) - Rate limiting information
- [Authentication](./README.md) - Authentication flow

---

**Document Version**: 1.0  
**Last Updated**: 2024-12-19

