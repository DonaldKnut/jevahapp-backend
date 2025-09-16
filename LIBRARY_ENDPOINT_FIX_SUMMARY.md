# Save to Library/Bookmark Endpoint Fix Summary

## Issue Description

The save to library/bookmark functionality has similar issues to the like endpoint, with multiple conflicting endpoints, inconsistent error handling, and missing content validation. This can cause false positive error alerts in the frontend.

## Current Endpoints Analysis

### 1. Bookmark Routes (`/api/bookmarks/`)

- `POST /api/bookmarks/:mediaId` - Add bookmark
- `DELETE /api/bookmarks/:mediaId` - Remove bookmark
- `GET /api/bookmarks/get-bookmarked-media` - Get bookmarks

### 2. Media Routes (`/api/media/`)

- `POST /api/media/:id/bookmark` - Bookmark media
- `POST /api/media/:id/save` - Save media (maps to bookmark)

### 3. Library Service

- `LibraryService.saveToLibrary()` - Save to user's library array
- `LibraryService.removeFromLibrary()` - Remove from user's library array

## Problems Identified

1. **Multiple Conflicting Endpoints**: Three different endpoints doing similar bookmarking
2. **Inconsistent Data Storage**: Some use Bookmark model, others use User.library array
3. **Missing Content Validation**: No verification that media exists before bookmarking
4. **Poor Error Handling**: Generic error messages and inconsistent status codes
5. **Duplicate Bookmark Handling**: Returns 400 for already bookmarked content instead of graceful handling
6. **Inconsistent Response Formats**: Different response structures across endpoints

## Proposed Solution

### 1. Unified Bookmark Service

Create a unified bookmark service that handles all bookmark operations consistently:

```typescript
// src/service/unifiedBookmark.service.ts
export class UnifiedBookmarkService {
  /**
   * Toggle bookmark status (save/unsave)
   */
  static async toggleBookmark(
    userId: string,
    mediaId: string
  ): Promise<{ bookmarked: boolean; bookmarkCount: number }> {
    // Enhanced validation
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(mediaId)) {
      throw new Error("Invalid user or media ID");
    }

    logger.info("Toggle bookmark request", {
      userId,
      mediaId,
      timestamp: new Date().toISOString(),
    });

    const session = await Bookmark.startSession();
    try {
      let bookmarked = false;

      await session.withTransaction(async () => {
        // Verify media exists
        const mediaExists = await this.verifyMediaExists(mediaId, session);
        if (!mediaExists) {
          throw new Error(`Media not found: ${mediaId}`);
        }

        // Check existing bookmark
        const existingBookmark = await Bookmark.findOne({
          user: new Types.ObjectId(userId),
          media: new Types.ObjectId(mediaId),
        }).session(session);

        if (existingBookmark) {
          // Remove bookmark (unsave)
          await Bookmark.findByIdAndDelete(existingBookmark._id, { session });
          bookmarked = false;
        } else {
          // Add bookmark (save)
          await Bookmark.create(
            [
              {
                user: new Types.ObjectId(userId),
                media: new Types.ObjectId(mediaId),
              },
            ],
            { session }
          );
          bookmarked = true;
        }
      });

      const bookmarkCount = await this.getBookmarkCount(mediaId);

      logger.info("Toggle bookmark completed", {
        userId,
        mediaId,
        bookmarked,
        bookmarkCount,
        timestamp: new Date().toISOString(),
      });

      return {
        bookmarked,
        bookmarkCount,
      };
    } catch (error: any) {
      logger.error("Toggle bookmark transaction failed", {
        error: error.message,
        userId,
        mediaId,
        timestamp: new Date().toISOString(),
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Verify media exists
   */
  private static async verifyMediaExists(
    mediaId: string,
    session: ClientSession
  ): Promise<boolean> {
    try {
      const media = await Media.findById(mediaId)
        .session(session)
        .select("_id");
      return !!media;
    } catch (error: any) {
      logger.error("Failed to verify media exists", {
        mediaId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get bookmark count for media
   */
  private static async getBookmarkCount(mediaId: string): Promise<number> {
    try {
      return await Bookmark.countDocuments({
        media: new Types.ObjectId(mediaId),
      });
    } catch (error: any) {
      logger.error("Failed to get bookmark count", {
        mediaId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Check if user has bookmarked media
   */
  static async isBookmarked(userId: string, mediaId: string): Promise<boolean> {
    try {
      const bookmark = await Bookmark.findOne({
        user: new Types.ObjectId(userId),
        media: new Types.ObjectId(mediaId),
      });
      return !!bookmark;
    } catch (error: any) {
      logger.error("Failed to check bookmark status", {
        userId,
        mediaId,
        error: error.message,
      });
      return false;
    }
  }
}
```

### 2. Unified Bookmark Controller

```typescript
// src/controllers/unifiedBookmark.controller.ts
export const toggleBookmark = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const userId = req.userId;

    // Enhanced logging for debugging
    logger.info("Toggle bookmark request", {
      userId,
      mediaId,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    if (!userId) {
      logger.warn("Unauthorized bookmark request - no user ID", {
        mediaId,
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      logger.warn("Invalid media ID in bookmark request", {
        userId,
        mediaId,
        ip: req.ip,
      });
      res.status(400).json({
        success: false,
        message: "Invalid media ID format",
      });
      return;
    }

    const result = await UnifiedBookmarkService.toggleBookmark(userId, mediaId);

    logger.info("Toggle bookmark successful", {
      userId,
      mediaId,
      bookmarked: result.bookmarked,
      bookmarkCount: result.bookmarkCount,
    });

    res.status(200).json({
      success: true,
      message: result.bookmarked
        ? "Media saved to library successfully"
        : "Media removed from library successfully",
      data: result,
    });
  } catch (error: any) {
    logger.error("Toggle bookmark error", {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      mediaId: req.params.mediaId,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types with appropriate status codes
    if (
      error.message.includes("not found") ||
      error.message.includes("Media not found")
    ) {
      res.status(404).json({
        success: false,
        message: "Media not found",
      });
      return;
    }

    if (error.message.includes("Invalid")) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // Default to 500 for unexpected errors
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred while processing your request",
    });
  }
};

export const getBookmarkStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) {
      res.status(400).json({
        success: false,
        message: "Invalid media ID format",
      });
      return;
    }

    const isBookmarked = await UnifiedBookmarkService.isBookmarked(
      userId,
      mediaId
    );
    const bookmarkCount =
      await UnifiedBookmarkService.getBookmarkCount(mediaId);

    res.status(200).json({
      success: true,
      data: {
        isBookmarked,
        bookmarkCount,
      },
    });
  } catch (error: any) {
    logger.error("Get bookmark status error", {
      error: error.message,
      userId: req.userId,
      mediaId: req.params.mediaId,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get bookmark status",
    });
  }
};
```

### 3. Unified Routes

```typescript
// src/routes/unifiedBookmark.routes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware";
import { apiRateLimiter } from "../middleware/rateLimiter";
import {
  toggleBookmark,
  getBookmarkStatus,
  getUserBookmarks,
} from "../controllers/unifiedBookmark.controller";

const router = Router();

/**
 * @route   POST /api/bookmark/:mediaId/toggle
 * @desc    Toggle bookmark status (save/unsave)
 * @access  Protected
 * @param   { mediaId: string } - Media ID to toggle bookmark
 * @returns { success: boolean, message: string, data: { bookmarked: boolean, bookmarkCount: number } }
 */
router.post("/:mediaId/toggle", verifyToken, apiRateLimiter, toggleBookmark);

/**
 * @route   GET /api/bookmark/:mediaId/status
 * @desc    Get bookmark status for media
 * @access  Protected
 * @param   { mediaId: string } - Media ID to check
 * @returns { success: boolean, data: { isBookmarked: boolean, bookmarkCount: number } }
 */
router.get("/:mediaId/status", verifyToken, apiRateLimiter, getBookmarkStatus);

/**
 * @route   GET /api/bookmark/user
 * @desc    Get user's bookmarked media
 * @access  Protected
 * @returns { success: boolean, data: { media: Media[], pagination: object } }
 */
router.get("/user", verifyToken, apiRateLimiter, getUserBookmarks);

export default router;
```

## Expected Behavior After Fix

### Successful Save to Library

```json
{
  "success": true,
  "message": "Media saved to library successfully",
  "data": {
    "bookmarked": true,
    "bookmarkCount": 42
  }
}
```

### Successful Remove from Library

```json
{
  "success": true,
  "message": "Media removed from library successfully",
  "data": {
    "bookmarked": false,
    "bookmarkCount": 41
  }
}
```

### Media Not Found (404)

```json
{
  "success": false,
  "message": "Media not found"
}
```

### Invalid Media ID (400)

```json
{
  "success": false,
  "message": "Invalid media ID format"
}
```

### Unauthorized (401)

```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

## Benefits of the Fix

1. **Unified Interface**: Single endpoint for all bookmark operations
2. **Consistent Behavior**: Same logic for save/unsave operations
3. **Better Error Handling**: Clear, specific error messages
4. **Content Validation**: Verifies media exists before bookmarking
5. **Graceful Handling**: No more 400 errors for already bookmarked content
6. **Comprehensive Logging**: Detailed logs for debugging
7. **Consistent Response Format**: Standardized API responses
8. **Transaction Safety**: Database operations are atomic

## Migration Strategy

1. **Phase 1**: Implement unified service alongside existing endpoints
2. **Phase 2**: Update frontend to use new unified endpoint
3. **Phase 3**: Deprecate old endpoints
4. **Phase 4**: Remove old endpoints

## Files to Create/Modify

1. `src/service/unifiedBookmark.service.ts` - New unified service
2. `src/controllers/unifiedBookmark.controller.ts` - New unified controller
3. `src/routes/unifiedBookmark.routes.ts` - New unified routes
4. Update existing controllers to use unified service
5. Update frontend integration guide

## Priority: HIGH

The bookmark/save to library functionality needs the same fixes as the like endpoint to prevent false positive error alerts and provide consistent user experience.
