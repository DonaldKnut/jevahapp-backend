# Frontend-Backend Integration Guide

## Overview

This guide provides the exact backend endpoints and data structures that the React Native frontend needs to display Instagram-style content cards without breaking.

## 🎯 Backend Endpoints for Frontend

### 1. Get Default Content (Seeded Data)

```http
GET /api/media/default-content?page=1&limit=10&contentType=all
```

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "title": "Amazing Gospel Video",
        "description": "A powerful message about faith and hope",
        "mediaUrl": "https://your-cdn.com/videos/amazing-gospel.mp4",
        "thumbnailUrl": "https://your-cdn.com/thumbnails/amazing-gospel.jpg",
        "contentType": "video",
        "duration": 180,
        "author": {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "https://your-cdn.com/avatars/john-doe.jpg"
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

### 2. Get All Content (Feed)

```http
GET /api/media/all-content?page=1&limit=10&contentType=all
```

**Response:** Same structure as default content

### 3. Like Content

```http
POST /api/content/media/{contentId}/like
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Content liked successfully",
  "data": {
    "liked": true,
    "likeCount": 43
  }
}
```

### 4. Share Content

```http
POST /api/content/media/{contentId}/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "platform": "twitter",
  "message": "Check this out!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Content shared successfully",
  "data": {
    "shareUrls": {
      "twitter": "https://twitter.com/intent/tweet?text=...",
      "facebook": "https://www.facebook.com/sharer/sharer.php?u=...",
      "linkedin": "https://www.linkedin.com/sharing/share-offsite/?url=..."
    },
    "platform": "twitter"
  }
}
```

### 5. Add Comment

```http
POST /api/content/media/{contentId}/comment
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Great video!",
  "parentCommentId": null
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment added successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
    "content": "Great video!",
    "user": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://your-cdn.com/avatars/john-doe.jpg"
    },
    "parentCommentId": null,
    "createdAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 6. Get Comments

```http
GET /api/content/media/{contentId}/comments?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
        "content": "Great video!",
        "user": {
          "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "https://your-cdn.com/avatars/john-doe.jpg"
        },
        "parentCommentId": null,
        "createdAt": "2024-01-15T11:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "pages": 1
    }
  }
}
```

### 7. Get Content Metadata

```http
GET /api/content/media/{contentId}/metadata
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contentId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "contentType": "media",
    "likeCount": 42,
    "commentCount": 8,
    "shareCount": 12,
    "viewCount": 1250,
    "isLiked": false,
    "isBookmarked": false,
    "author": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://your-cdn.com/avatars/john-doe.jpg"
    }
  }
}
```

## 🔧 Backend Implementation Requirements

### 1. Ensure Default Content Endpoint Exists

Make sure your backend has this endpoint in `media.routes.ts`:

```typescript
/**
 * @route   GET /api/media/default-content
 * @desc    Get default content for frontend display
 * @access  Public
 */
router.get("/default-content", getDefaultContent);
```

### 2. Add getDefaultContent Controller

```typescript
// In media.controller.ts
export const getDefaultContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const contentType = req.query.contentType as string || 'all';
    const category = req.query.category as string;

    const result = await mediaService.getDefaultContent({
      page,
      limit,
      contentType,
      category
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error("Get default content error", { error: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to get default content"
    });
  }
};
```

### 3. Add getDefaultContent Service Method

```typescript
// In media.service.ts
async getDefaultContent(params: {
  page: number;
  limit: number;
  contentType: string;
  category?: string;
}): Promise<any> {
  const { page, limit, contentType, category } = params;
  const skip = (page - 1) * limit;

  const query: any = {
    isDefault: true, // Only get seeded/default content
    status: 'published'
  };

  if (contentType !== 'all') {
    query.contentType = contentType;
  }

  if (category) {
    query.category = category;
  }

  const content = await Media.find(query)
    .populate('author', 'firstName lastName avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Media.countDocuments(query);

  return {
    content,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}
```

### 4. Ensure Media Model Has Required Fields

```typescript
// In media.model.ts - ensure these fields exist
const mediaSchema = new Schema({
  // ... existing fields
  title: { type: String, required: true },
  description: { type: String },
  mediaUrl: { type: String, required: true },
  thumbnailUrl: { type: String },
  contentType: { 
    type: String, 
    enum: ['video', 'audio', 'image'], 
    required: true 
  },
  duration: { type: Number }, // For videos
  author: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false }, // For seeded content
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'published' 
  },
  // ... other fields
});
```

## 🚀 Frontend Integration Steps

### 1. Install Required Dependencies

```bash
npm install react-native-video react-native-vector-icons
# For iOS
cd ios && pod install
```

### 2. Add Permissions

**Android (android/app/src/main/AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

**iOS (ios/YourApp/Info.plist):**
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```

### 3. Configure API Base URL

```typescript
// config/api.ts
export const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:3000/api'  // Android emulator
  : 'https://your-production-api.com/api';
```

### 4. Test the Integration

```typescript
// Test script
const testBackendIntegration = async () => {
  try {
    // Test default content endpoint
    const response = await fetch(`${API_BASE_URL}/media/default-content?page=1&limit=5`);
    const data = await response.json();
    
    console.log('Default content response:', data);
    
    if (data.success && data.data.content.length > 0) {
      console.log('✅ Backend integration working!');
      console.log('Sample content:', data.data.content[0]);
    } else {
      console.log('❌ No content found or API error');
    }
  } catch (error) {
    console.error('❌ Backend integration failed:', error);
  }
};
```

## 🔍 Troubleshooting Common Issues

### 1. Content Not Loading
- Check if `isDefault: true` is set on seeded content
- Verify the `/api/media/default-content` endpoint exists
- Check network connectivity and API base URL

### 2. Images Not Displaying
- Ensure thumbnail URLs are valid and accessible
- Add fallback images for missing avatars
- Check CORS settings on your backend

### 3. Videos Not Playing
- Verify video URLs are accessible
- Check video format compatibility
- Ensure proper permissions are set

### 4. Like/Share Not Working
- Verify authentication token is valid
- Check if user is logged in
- Ensure API endpoints are properly configured

## 📱 Sample Frontend Usage

```typescript
// In your main screen
import ContentFeedScreen from './screens/ContentFeedScreen';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <ContentFeedScreen />
    </View>
  );
}
```

This guide provides everything the React Native developer needs to integrate with your backend and display Instagram-style content cards without breaking the UI. The backend is already set up with the unified interaction system, so the frontend just needs to consume these endpoints properly.
