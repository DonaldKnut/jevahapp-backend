# Post a Prayer - Backend Implementation Summary

**Date:** 2024  
**Status:** ✅ Complete

---

## Overview

This document summarizes the backend implementation of the "Post a Prayer" feature according to the specification provided.

---

## Implementation Details

### 1. Model Updates (`src/models/prayerPost.model.ts`)

✅ **Updated PrayerPost Schema:**
- Added validation for `prayerText` (required, 1-2000 characters)
- Added validation for `verse.text` (max 500 characters)
- Added validation for `verse.reference` (max 50 characters)
- Made `color` and `shape` required fields
- Added pre-save hook to validate verse (at least one field required if verse object exists)
- Maintained backward compatibility with `content` field

### 2. Validator Created (`src/validators/prayer.validator.ts`)

✅ **New Validator Functions:**
- `validatePrayerData()` - Validates prayer creation data
- `validatePrayerUpdateData()` - Validates prayer update data (all fields optional)

**Validation Rules Implemented:**
- Prayer text: Required, 1-2000 characters, trimmed
- Color: Required, must match hex format (#RRGGBB or #RGB)
- Shape: Required, must be one of: rectangle, circle, scalloped, square, square2, square3, square4
- Verse: Optional, but if provided must have at least text or reference
- Verse text: Max 500 characters if provided
- Verse reference: Max 50 characters if provided
- Anonymous: Optional boolean

### 3. Controller Updates (`src/controllers/communityContent.controller.ts`)

✅ **Updated Functions:**

#### `createPrayerPost()`
- Uses validator for request validation
- Handles `prayerText`, `verse`, `color`, `shape`, `anonymous` fields
- Returns spec-compliant response format with `data` object
- Includes `userLiked` field (always false for new prayers)
- Populates author information
- Returns proper error codes (`VALIDATION_ERROR`, `INTERNAL_ERROR`)

#### `getPrayerPost()`
- Supports both `:id` and `:prayerId` route parameters
- Optional authentication (for `userLiked` field)
- Checks if user liked the prayer (if authenticated)
- Returns spec-compliant response format
- Proper error handling with error codes (`VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`)

#### `updatePrayerPost()`
- Supports both `:id` and `:prayerId` route parameters
- Validates ownership (user must own the prayer)
- Uses validator for update data validation
- Handles all fields: `prayerText`, `verse`, `color`, `shape`, `anonymous`
- Returns spec-compliant response format
- Proper error handling with error codes (`VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `INTERNAL_ERROR`)

#### `serializePrayer()`
- New function to serialize prayer data according to spec
- Formats author object with `_id`, `username`, `firstName`, `lastName`, `avatarUrl`
- Generates username from email or firstName/lastName
- Formats verse object (null if empty)
- Includes all required fields: `_id`, `userId`, `prayerText`, `verse`, `color`, `shape`, `createdAt`, `updatedAt`, `likesCount`, `commentsCount`, `userLiked`, `author`, `anonymous`

### 4. Route Updates (`src/routes/community.routes.ts`)

✅ **Added Spec-Compliant Routes:**
- `POST /api/community/prayer-wall/create` - Create prayer (spec endpoint)
- `GET /api/community/prayer-wall/:prayerId` - Get single prayer (spec endpoint)
- `PUT /api/community/prayer-wall/:prayerId` - Update prayer (spec endpoint)

**Maintained Backward Compatibility:**
- Existing routes with `:id` parameter still work
- All existing aliases preserved

---

## API Endpoints

### Create Prayer
- **Endpoint:** `POST /api/community/prayer-wall/create`
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "prayerText": "Prayer text...",
    "verse": {
      "text": "Verse text...",
      "reference": "John 3:16"
    },
    "color": "#A16CE5",
    "shape": "square",
    "anonymous": false
  }
  ```
- **Response:** `{ success: true, data: {...}, message: "Prayer created successfully" }`

### Get Single Prayer
- **Endpoint:** `GET /api/community/prayer-wall/:prayerId`
- **Authentication:** Optional (for `userLiked` field)
- **Response:** `{ success: true, data: {...} }`

### Update Prayer
- **Endpoint:** `PUT /api/community/prayer-wall/:prayerId`
- **Authentication:** Required
- **Authorization:** User must own the prayer
- **Request Body:** (All fields optional)
  ```json
  {
    "prayerText": "Updated text...",
    "verse": { "text": "...", "reference": "..." },
    "color": "#1078B2",
    "shape": "circle"
  }
  ```
- **Response:** `{ success: true, data: {...} }`

---

## Response Format

All endpoints return responses in the spec-compliant format:

```typescript
{
  success: boolean;
  data?: {
    _id: string;
    userId: string;
    prayerText: string;
    verse?: {
      text?: string;
      reference?: string;
    } | null;
    color: string;
    shape: string;
    createdAt: string;
    updatedAt: string;
    likesCount: number;
    commentsCount: number;
    userLiked: boolean;
    author: {
      _id: string;
      username: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
    };
    anonymous: boolean;
  };
  error?: string;
  code?: string;
  message?: string;
  details?: any;
}
```

---

## Error Handling

All endpoints return proper error codes:

- `VALIDATION_ERROR` (400) - Request validation failed
- `UNAUTHORIZED` (401) - Authentication required or invalid token
- `FORBIDDEN` (403) - User doesn't have permission
- `NOT_FOUND` (404) - Prayer not found
- `INTERNAL_ERROR` (500) - Server error

---

## Testing Checklist

### ✅ Completed
- [x] Model validation rules
- [x] Validator functions
- [x] Create prayer endpoint
- [x] Get single prayer endpoint
- [x] Update prayer endpoint
- [x] Response format matching spec
- [x] Error handling with proper codes
- [x] User like checking
- [x] Author population
- [x] Route parameter support (both `:id` and `:prayerId`)

### 🔄 Recommended Testing
- [ ] Unit tests for validator
- [ ] Integration tests for all endpoints
- [ ] Edge case testing (empty strings, max lengths, etc.)
- [ ] Authentication/authorization testing
- [ ] Performance testing

---

## Backward Compatibility

✅ **Maintained:**
- Existing routes with `:id` parameter still work
- `content` field still supported (synced with `prayerText`)
- Existing response format still works for list endpoints
- All existing aliases preserved

---

## Notes

1. **Username Generation:** Since the User model doesn't have a `username` field, the serializer generates it from:
   - Email (before @) if available
   - firstName_lastName if available
   - "user" as fallback

2. **Verse Handling:** Verse is set to `null` if both `text` and `reference` are empty or not provided.

3. **User Liked:** The `userLiked` field is checked by querying the `MediaInteraction` model with the prayer ID as the media reference.

4. **Author Field:** The author object uses `avatarUrl` (mapped from `avatar` or `avatarUpload` in the User model).

---

## Files Modified

1. `src/models/prayerPost.model.ts` - Model validation updates
2. `src/validators/prayer.validator.ts` - New validator file
3. `src/controllers/communityContent.controller.ts` - Controller updates
4. `src/routes/community.routes.ts` - Route updates

---

**Implementation Status:** ✅ Complete and ready for testing

