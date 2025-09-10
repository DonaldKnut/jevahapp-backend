# Update Default Content Endpoint for Frontend Integration

## Current Issue

The existing `getDefaultContent` endpoint returns a different data structure than what the React Native frontend expects for Instagram-style cards.

## Current Response Structure
```json
{
  "success": true,
  "data": {
    "total": 10,
    "grouped": {
      "music": [...],
      "videos": [...],
      "audio": [...],
      "books": [...],
      "shortClips": [...]
    },
    "all": [...]
  }
}
```

## Required Response Structure for Frontend
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
        "createdAt": "2024-01-15T10:30:00.000Z"
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

## Solution: Update the Controller

Replace the existing `getDefaultContent` function in `src/controllers/media.controller.ts`:

```typescript
export const getDefaultContent = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { contentType, limit = "10", page = "1" } = request.query;
    
    const limitNum = parseInt(limit as string) || 10;
    const pageNum = parseInt(page as string) || 1;
    const skip = (pageNum - 1) * limitNum;
    
    // Build filter for default content
    const filter: any = {
      isDefaultContent: true,
      isOnboardingContent: true,
      status: 'published'
    };
    
    // Add contentType filter if provided
    if (contentType && contentType !== 'all') {
      filter.contentType = contentType;
    }
    
    // Get total count for pagination
    const total = await Media.countDocuments(filter);
    
    // Get default content with pagination
    const defaultContentRaw = await Media.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('uploadedBy', 'firstName lastName username email avatar')
      .lean();

    // Convert stored R2 object URLs to short-lived presigned URLs for private access
    const toObjectKey = (urlString?: string): string | null => {
      if (!urlString) return null;
      try {
        const u = new URL(urlString);
        let pathname = u.pathname;
        if (pathname.startsWith('/')) pathname = pathname.slice(1);
        const bucket = process.env.R2_BUCKET;
        if (bucket && pathname.startsWith(bucket + '/')) {
          return pathname.slice(bucket.length + 1);
        }
        return pathname;
      } catch (_e) {
        return null;
      }
    };

    // Lazy import to avoid circular deps
    const { default: fileUploadService } = await import('../service/fileUpload.service');

    const content = await Promise.all(
      defaultContentRaw.map(async (item: any) => {
        const objectKey = toObjectKey(item.fileUrl);
        let mediaUrl = item.fileUrl;
        
        if (objectKey) {
          try {
            const signed = await fileUploadService.getPresignedGetUrl(objectKey, 3600);
            mediaUrl = signed;
          } catch (_e) {
            // fallback to stored URL if signing fails
          }
        }

        // Transform to frontend-expected format
        return {
          _id: item._id,
          title: item.title || 'Untitled',
          description: item.description || '',
          mediaUrl: mediaUrl,
          thumbnailUrl: item.thumbnailUrl || item.fileUrl, // Use fileUrl as fallback
          contentType: mapContentType(item.contentType),
          duration: item.duration || null,
          author: {
            _id: item.uploadedBy?._id || item.uploadedBy,
            firstName: item.uploadedBy?.firstName || 'Unknown',
            lastName: item.uploadedBy?.lastName || 'User',
            avatar: item.uploadedBy?.avatar || null
          },
          likeCount: item.likeCount || 0,
          commentCount: item.commentCount || 0,
          shareCount: item.shareCount || 0,
          viewCount: item.viewCount || 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
      })
    );
    
    response.status(200).json({
      success: true,
      data: {
        content,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
    
  } catch (error: any) {
    console.error("Get default content error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve default content",
    });
  }
};

// Helper function to map content types
const mapContentType = (contentType: string): 'video' | 'audio' | 'image' => {
  switch (contentType) {
    case 'videos':
    case 'sermon':
      return 'video';
    case 'audio':
    case 'music':
    case 'devotional':
      return 'audio';
    case 'ebook':
    case 'books':
      return 'image'; // For now, treat books as images
    default:
      return 'video';
  }
};
```

## Alternative: Add New Endpoint

If you don't want to modify the existing endpoint, add a new one:

```typescript
// In media.routes.ts
/**
 * @route   GET /api/media/default-content
 * @desc    Get default content for frontend display (Instagram-style cards)
 * @access  Public
 * @query   { page?: number, limit?: number, contentType?: string }
 * @returns { success: boolean, data: { content: array, pagination: object } }
 */
router.get("/default-content", apiRateLimiter, getDefaultContentForFrontend);

// In media.controller.ts
export const getDefaultContentForFrontend = async (
  request: Request,
  response: Response
): Promise<void> => {
  // ... same implementation as above
};
```

## Update Route Registration

Make sure the route is properly registered in `src/routes/media.route.ts`:

```typescript
// Add this route
router.get("/default-content", apiRateLimiter, getDefaultContent);
```

## Test the Updated Endpoint

```bash
# Test the endpoint
curl "http://localhost:3000/api/media/default-content?page=1&limit=5&contentType=all"

# Expected response structure
{
  "success": true,
  "data": {
    "content": [...],
    "pagination": {
      "page": 1,
      "limit": 5,
      "total": 50,
      "pages": 10
    }
  }
}
```

## Frontend Integration

With this updated endpoint, the React Native frontend can now properly consume the data:

```typescript
// In ContentService.ts
async getDefaultContent(params: {
  page?: number;
  limit?: number;
  contentType?: string;
} = {}) {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.contentType) queryParams.append('contentType', params.contentType);

  const queryString = queryParams.toString();
  const endpoint = `/media/default-content${queryString ? `?${queryString}` : ''}`;
  
  return this.makeRequest(endpoint);
}
```

This update ensures the backend returns data in the exact format the React Native frontend expects for Instagram-style content cards.
