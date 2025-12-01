# Codebase Modularization & DRY Implementation Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Implementation Guide

---

## 📋 Overview

This guide documents the modularization and DRY (Don't Repeat Yourself) refactoring of the codebase. We've created shared utilities to eliminate code duplication and standardize common patterns across controllers and services.

---

## 🎯 Goals

1. **Eliminate Code Duplication** - Remove repeated patterns across controllers
2. **Standardize Responses** - Consistent API response format
3. **Centralize Validation** - Common validation logic in one place
4. **Simplify Controllers** - Reduce boilerplate code
5. **Improve Maintainability** - Changes in one place affect all controllers
6. **Type Safety** - Maintain TypeScript type safety throughout

---

## 🛠️ New Utilities Created

### 1. Response Utility (`src/utils/response.util.ts`)

**Purpose**: Standardized API responses across all controllers

**Before** (Repeated in every controller):
```typescript
response.status(200).json({
  success: true,
  message: "Success",
  data: result,
});
```

**After**:
```typescript
ResponseUtil.success(response, result, "Success");
```

**Available Methods**:
- `ResponseUtil.success(res, data, message, statusCode)` - Success response
- `ResponseUtil.error(res, message, statusCode, error)` - Error response
- `ResponseUtil.unauthorized(res, message)` - 401 response
- `ResponseUtil.forbidden(res, message)` - 403 response
- `ResponseUtil.notFound(res, message)` - 404 response
- `ResponseUtil.badRequest(res, message, error)` - 400 response
- `ResponseUtil.created(res, data, message)` - 201 response
- `ResponseUtil.paginated(res, data, pagination, message)` - Paginated response
- `ResponseUtil.validationError(res, message, errors)` - Validation error

---

### 2. Validation Utility (`src/utils/validation.util.ts`)

**Purpose**: Common validation patterns

**Before** (Repeated everywhere):
```typescript
if (!Types.ObjectId.isValid(id)) {
  response.status(400).json({
    success: false,
    message: "Invalid ID",
  });
  return;
}
```

**After**:
```typescript
if (!ValidationUtil.validateObjectId(response, id, "ID")) return;
```

**Available Methods**:
- `ValidationUtil.isValidObjectId(id)` - Check if valid ObjectId
- `ValidationUtil.validateObjectId(res, id, fieldName)` - Validate and return error if invalid
- `ValidationUtil.isValidEmail(email)` - Check email format
- `ValidationUtil.validateEmail(res, email)` - Validate email with error
- `ValidationUtil.validateRequired(res, value, fieldName)` - Check required field
- `ValidationUtil.validateLength(res, value, fieldName, min, max)` - Validate string length
- `ValidationUtil.validateNumberRange(res, value, fieldName, min, max)` - Validate number
- `ValidationUtil.validateArray(res, value, fieldName, minItems, maxItems)` - Validate array
- `ValidationUtil.validateEnum(res, value, fieldName, allowedValues)` - Validate enum
- `ValidationUtil.validatePagination(page, limit)` - Parse pagination params
- `ValidationUtil.validateAuthentication(res, userId)` - Check authentication
- `ValidationUtil.validateFields(res, validations[])` - Validate multiple fields at once

---

### 3. Controller Utility (`src/utils/controller.util.ts`)

**Purpose**: Common controller helper methods

**Available Methods**:
- `ControllerUtil.asyncHandler(handler)` - Wrap async handlers with error handling
- `ControllerUtil.getPagination(req)` - Extract pagination from request
- `ControllerUtil.getUserId(req, res)` - Get authenticated user ID
- `ControllerUtil.requireAuth(req, res)` - Require authentication
- `ControllerUtil.requireAdmin(req, res)` - Require admin role
- `ControllerUtil.validateAndConvertObjectId(res, id, fieldName)` - Validate and convert to ObjectId
- `ControllerUtil.checkOwnership(res, resourceUserId, currentUserId, resourceName)` - Check ownership
- `ControllerUtil.handleServiceError(res, error, defaultMessage)` - Handle service errors consistently
- `ControllerUtil.paginatedResponse(res, data, total, page, limit, message)` - Send paginated response
- `ControllerUtil.getQueryParam(req, key, defaultValue, parser)` - Extract query param
- `ControllerUtil.getBodyParam(req, res, key, required, defaultValue, validator)` - Extract body param

---

### 4. Query Utility (`src/utils/query.util.ts`)

**Purpose**: Common database query patterns

**Available Methods**:
- `QueryUtil.buildPagination(page, limit)` - Build pagination options
- `QueryUtil.buildSort(sortBy, sortOrder)` - Build sort options
- `QueryUtil.buildTextSearch(searchTerm, fields)` - Build text search query
- `QueryUtil.buildDateRange(startDate, endDate, field)` - Build date range query
- `QueryUtil.buildArrayFilter(value, field)` - Build array filter (in array)
- `QueryUtil.buildQuery(filters, pagination, sort)` - Build combined query
- `QueryUtil.executePaginatedQuery(model, query, options)` - Execute paginated query
- `QueryUtil.buildUserFilter(userId, field)` - Build user filter
- `QueryUtil.buildActiveFilter(isActive, field)` - Build active filter
- `QueryUtil.buildNotDeletedFilter(field)` - Build not deleted filter
- `QueryUtil.combineFilters(...filters)` - Combine multiple filters

---

### 5. Base Controller (`src/controllers/base.controller.ts`)

**Purpose**: Reusable CRUD operations

**Available Methods**:
- `BaseController.getList()` - Get paginated list of resources
- `BaseController.getById()` - Get single resource by ID
- `BaseController.create()` - Create resource
- `BaseController.update()` - Update resource
- `BaseController.delete()` - Delete resource

---

## 📝 Refactoring Examples

### Example 1: Before and After - Create Endpoint

**BEFORE** (60+ lines):
```typescript
export const createPlaylist = async (request: Request, response: Response): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const { name, description, isPublic } = request.body;

    if (!name || name.trim().length === 0) {
      response.status(400).json({
        success: false,
        message: "Playlist name is required",
      });
      return;
    }

    // ... more validation ...

    const playlist = await Playlist.create({ ... });

    response.status(201).json({
      success: true,
      message: "Playlist created successfully",
      data: playlist,
    });
  } catch (error: any) {
    logger.error("Create playlist error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to create playlist",
    });
  }
};
```

**AFTER** (30 lines):
```typescript
export const createPlaylist = async (request: Request, response: Response): Promise<void> => {
  const userId = ControllerUtil.getUserId(request, response);
  if (!userId) return;

  if (!ValidationUtil.validateFields(response, [
    { value: request.body.name, fieldName: "name", required: true, type: "string", minLength: 1, maxLength: 100 },
  ])) return;

  const { name, description, isPublic, coverImageUrl, tags } = request.body;

  // Check duplicate
  const existing = await Playlist.findOne({
    ...QueryUtil.buildUserFilter(userId),
    name: name.trim(),
  });

  if (existing) {
    ResponseUtil.badRequest(response, "You already have a playlist with this name");
    return;
  }

  try {
    const playlist = await Playlist.create({
      name: name.trim(),
      description: description?.trim(),
      userId: new Types.ObjectId(userId),
      isPublic: isPublic || false,
      coverImageUrl,
      tags: tags || [],
      tracks: [],
      totalTracks: 0,
      playCount: 0,
    });

    logger.info("Playlist created", { playlistId: playlist._id, userId });
    ResponseUtil.created(response, playlist);
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to create playlist");
  }
};
```

**Code Reduction**: ~50% fewer lines, more readable, consistent error handling

---

### Example 2: Before and After - Get List Endpoint

**BEFORE** (40+ lines):
```typescript
export const getUserPlaylists = async (request: Request, response: Response): Promise<void> => {
  try {
    const userId = request.userId;
    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const page = parseInt(request.query.page as string) || 1;
    const limit = parseInt(request.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const playlists = await Playlist.find({
      userId: new Types.ObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Playlist.countDocuments({
      userId: new Types.ObjectId(userId),
    });

    response.status(200).json({
      success: true,
      data: playlists,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error("Get user playlists error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve playlists",
    });
  }
};
```

**AFTER** (15 lines):
```typescript
export const getUserPlaylists = async (request: Request, response: Response): Promise<void> => {
  const userId = ControllerUtil.getUserId(request, response);
  if (!userId) return;

  const { page, limit, skip } = ControllerUtil.getPagination(request);

  try {
    const { query, options } = QueryUtil.buildQuery(
      QueryUtil.buildUserFilter(userId),
      { page, limit, skip },
      { sortBy: "createdAt", sortOrder: "desc" }
    );

    const result = await QueryUtil.executePaginatedQuery(Playlist, query, options);
    ResponseUtil.paginated(response, result.data, result);
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to retrieve playlists");
  }
};
```

**Code Reduction**: ~65% fewer lines, consistent pagination handling

---

### Example 3: Before and After - Get By ID Endpoint

**BEFORE** (50+ lines):
```typescript
export const getPlaylistById = async (request: Request, response: Response): Promise<void> => {
  try {
    const { playlistId } = request.params;
    const userId = request.userId;

    if (!userId) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(playlistId)) {
      response.status(400).json({
        success: false,
        message: "Invalid playlist ID",
      });
      return;
    }

    const playlist = await Playlist.findById(playlistId).populate(...);

    if (!playlist) {
      response.status(404).json({
        success: false,
        message: "Playlist not found",
      });
      return;
    }

    // Check access
    const isOwner = playlist.userId.toString() === userId;
    if (!isOwner && !playlist.isPublic) {
      response.status(403).json({
        success: false,
        message: "You don't have permission to view this playlist",
      });
      return;
    }

    response.status(200).json({
      success: true,
      data: playlist,
    });
  } catch (error: any) {
    logger.error("Get playlist by ID error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve playlist",
    });
  }
};
```

**AFTER** (25 lines):
```typescript
export const getPlaylistById = async (request: Request, response: Response): Promise<void> => {
  const userId = ControllerUtil.getUserId(request, response);
  if (!userId) return;

  const playlistId = ControllerUtil.validateAndConvertObjectId(response, request.params.playlistId, "Playlist ID");
  if (!playlistId) return;

  try {
    const playlist = await Playlist.findById(playlistId).populate(...);

    if (!playlist) {
      ResponseUtil.notFound(response, "Playlist not found");
      return;
    }

    const isOwner = playlist.userId.toString() === userId;
    if (!isOwner && !playlist.isPublic) {
      ResponseUtil.forbidden(response, "You don't have permission to view this playlist");
      return;
    }

    ResponseUtil.success(response, playlist, "Playlist retrieved successfully");
  } catch (error: any) {
    ControllerUtil.handleServiceError(response, error, "Failed to retrieve playlist");
  }
};
```

**Code Reduction**: ~50% fewer lines, consistent validation and error handling

---

## 🔄 Migration Strategy

### Phase 1: Utilities Created ✅

- ✅ Response Utility
- ✅ Validation Utility
- ✅ Controller Utility
- ✅ Query Utility
- ✅ Base Controller

### Phase 2: Refactor Controllers (Gradual)

1. **Start with Simple Controllers**
   - Playlist controller (already created example)
   - Bookmark controller
   - Simple CRUD controllers

2. **Refactor Medium Complexity Controllers**
   - Media controller (partial refactoring)
   - User controller
   - Interaction controllers

3. **Refactor Complex Controllers Last**
   - Auth controller
   - Media controller (full refactoring)
   - Admin controllers

### Phase 3: Refactor Services (Future)

- Common service patterns
- Shared business logic
- Common data transformations

---

## 📋 Refactoring Checklist

For each controller, refactor:

- [ ] Replace response formatting with `ResponseUtil`
- [ ] Replace validation with `ValidationUtil`
- [ ] Replace authentication checks with `ControllerUtil.requireAuth()`
- [ ] Replace pagination logic with `ControllerUtil.getPagination()` + `QueryUtil`
- [ ] Replace error handling with `ControllerUtil.handleServiceError()`
- [ ] Replace ObjectId validation with `ControllerUtil.validateAndConvertObjectId()`
- [ ] Replace ownership checks with `ControllerUtil.checkOwnership()`
- [ ] Test all endpoints still work
- [ ] Verify response format consistency

---

## 🎯 Benefits

### Before Modularization

- **553** instances of `response.status().json()` patterns
- Repeated validation code in every controller
- Inconsistent error messages
- Different pagination implementations
- Duplicated authentication checks
- Hard to maintain - changes need to be made in multiple places

### After Modularization

- **Consistent** response format across all endpoints
- **Centralized** validation logic
- **Standardized** error handling
- **Reusable** pagination and query utilities
- **Maintainable** - change once, affects everywhere
- **Type-safe** - Full TypeScript support
- **Testable** - Utilities can be unit tested separately

---

## 📖 Usage Examples

### Example: Simple CRUD Controller

```typescript
import { Request, Response } from "express";
import { Playlist } from "../models/playlist.model";
import ResponseUtil from "../utils/response.util";
import ValidationUtil from "../utils/validation.util";
import ControllerUtil from "../utils/controller.util";
import QueryUtil from "../utils/query.util";

export const createPlaylist = ControllerUtil.asyncHandler(
  async (req: Request, res: Response) => {
    const userId = ControllerUtil.getUserId(req, res);
    if (!userId) return;

    // Validate
    if (!ValidationUtil.validateFields(res, [
      { value: req.body.name, fieldName: "name", required: true, type: "string", minLength: 1, maxLength: 100 },
      { value: req.body.description, fieldName: "description", type: "string", maxLength: 500 },
    ])) return;

    const playlist = await Playlist.create({
      name: req.body.name.trim(),
      description: req.body.description?.trim(),
      userId: new Types.ObjectId(userId),
      // ... other fields
    });

    ResponseUtil.created(res, playlist);
  }
);

export const getPlaylists = ControllerUtil.asyncHandler(
  async (req: Request, res: Response) => {
    const userId = ControllerUtil.getUserId(req, res);
    if (!userId) return;

    const { page, limit, skip } = ControllerUtil.getPagination(req);
    const { query, options } = QueryUtil.buildQuery(
      QueryUtil.buildUserFilter(userId),
      { page, limit, skip }
    );

    const result = await QueryUtil.executePaginatedQuery(Playlist, query, options);
    ResponseUtil.paginated(res, result.data, result);
  }
);
```

---

## ⚠️ Important Notes

1. **Gradual Migration** - Refactor controllers one at a time, test thoroughly
2. **Backward Compatibility** - Ensure existing API contracts remain the same
3. **Testing** - Test each refactored controller extensively
4. **Documentation** - Update API docs if response format changes (it shouldn't)
5. **Team Alignment** - Ensure all developers understand new utilities

---

## 🚀 Next Steps

1. **Start Refactoring**: Begin with simple controllers
2. **Test Thoroughly**: Ensure nothing breaks
3. **Code Review**: Get team approval on refactored controllers
4. **Document Patterns**: Add to team wiki/docs
5. **Continue Gradually**: Refactor remaining controllers over time

---

## 📊 Impact

- **Estimated Code Reduction**: 30-50% in controllers
- **Consistency**: 100% consistent response format
- **Maintainability**: Changes in one place affect all
- **Type Safety**: Full TypeScript support maintained
- **Developer Experience**: Faster development, less boilerplate

---

**Ready to start refactoring?** Use the utilities above and follow the examples in this guide!


